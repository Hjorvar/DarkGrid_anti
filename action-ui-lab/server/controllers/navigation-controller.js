/**
 * DARKGRID ADVENTURE LAB — Navigation, Facing, POI Inspection & Teleport Controller
 */
const { withTransaction } = require('../../../src/db/connection');
const {
  getTileById,
  getTileByCoords,
  validateMovement
} = require('../../../src/domain/world/map');
const {
  checkTileEncounter,
  getActiveEncounterForCharacter,
  ignoreEncounter
} = require('../../../src/domain/encounters/engine');
const {
  normalizeSceneMode,
  resolvePointOfInterest
} = require('../../scene-catalog');
const {
  computeEncounterPacingChance,
  getOrCreateAdventureState,
  onPlayerStep,
  recordPoiInspection,
  recordEncounterStart,
  recordEncounterOutcome
} = require('../../adventure-engine');
const {
  FACING_ORDER,
  FACING_VECTORS,
  normalizeFacing,
  rotateFacing,
  getRelativeCardinalMap,
  getMoveKindFromCardinal
} = require('../services/facing-service');
const { inspectSceneTile } = require('../services/viewport-scene-service');
const { buildClientState } = require('../services/client-state-service');
const {
  isCoordInTopdownRegion,
  recordTileDiscovery,
  computePhase8StepEncounterChance,
  checkGoblinForestEncounter,
  updateCharacterLandmarkArrival,
  dismissLandmarkScene,
  openLandmarkScene
} = require('../services/topdown-world-service');
const {
  enterDungeon,
  exitDungeon,
  moveInDungeon
} = require('../services/dungeon-service');

function handleNavigationAction({ db, userId, options, action, payload, character, currentFacing, labToolsAllowed = false, res }) {
      // 0a. SET_SCENE_MODE ('A' | 'B' | 'C' | 'LEGACY') — Live comparison switcher
      if (action === 'SET_SCENE_MODE') {
        const nextMode = normalizeSceneMode(payload.sceneMode || payload.mode || 'A');
        db.prepare('UPDATE characters SET scene_mode = ? WHERE id = ?').run(nextMode, character.id);
        const modeDescMap = {
          A: 'Scene Mode A (Single Scene — Place-Centric)',
          B: 'Scene Mode B (Directional Scene — Forward-Vista)',
          C: 'Scene Mode C (First-Person Perspective — Eye-Level Location + Facing)',
          LEGACY: 'Legacy Multi-Plane Blended + SVG'
        };
        const modeDesc = modeDescMap[nextMode] || modeDescMap.A;
        return res.json({
          ok: true,
          state: buildClientState(db, userId, {
            infoMessage: `Switched viewport renderer to ${modeDesc}.`
          })
        });
      }

      // 0. TURN / ROTATE FACING (Never rolls encounters, never resets active encounter, never grants free combat actions)
      if (action === 'TURN') {
        const turnDir = String(payload.turn || payload.direction || '').toUpperCase().trim();
        const nextFacing = payload.facing
          ? normalizeFacing(payload.facing)
          : rotateFacing(currentFacing, turnDir);

        db.prepare('UPDATE characters SET facing = ? WHERE id = ?').run(nextFacing, character.id);

        return res.json({
          ok: true,
          state: buildClientState(db, userId, {
            fxCue: {
              type: 'TURN',
              turn: turnDir === 'LEFT' || turnDir === 'CCW' ? 'LEFT' : 'RIGHT',
              previousFacing: currentFacing,
              facing: nextFacing
            }
          })
        });
      }

      // 0b. OPTIONAL DISMISS VICTORY OVERLAY (Not required before moving!)
      if (action === 'DISMISS_VICTORY') {
        db.prepare('UPDATE characters SET pending_victory_encounter_id = NULL WHERE id = ?').run(character.id);
        return res.json({
          ok: true,
          state: buildClientState(db, userId)
        });
      }

      // 0c. PHASE 9A: DISMISS / OPEN MAJOR LANDMARK SCENE
      if (action === 'DISMISS_LANDMARK_SCENE' || action === 'CONTINUE_EXPLORING') {
        dismissLandmarkScene(db, character.id);
        return res.json({
          ok: true,
          state: buildClientState(db, userId, {
            infoMessage: 'You step back into the surrounding territory and survey the map.'
          })
        });
      }

      if (action === 'OPEN_LANDMARK_SCENE') {
        openLandmarkScene(db, character.id);
        return res.json({
          ok: true,
          state: buildClientState(db, userId)
        });
      }

      // 0d. PHASE 9C: ENTER / EXIT LARGE DUNGEONS (Goblin Cave [9, 12] & Ancient Crypt [26, 5])
      if (action === 'EXPLORE_GOBLIN_CAVE' || action === 'ENTER_ANCIENT_CRYPT' || action === 'ENTER_DUNGEON') {
        const activeEnc = getActiveEncounterForCharacter(db, character.id, character.class);
        if (activeEnc) {
          throw new Error('Cannot enter a dungeon while engaged in an active encounter.');
        }
        const dungeonKey = action === 'ENTER_ANCIENT_CRYPT'
          ? 'ANCIENT_CRYPT'
          : action === 'EXPLORE_GOBLIN_CAVE'
            ? 'GOBLIN_CAVE'
            : String(payload.dungeonKey || 'GOBLIN_CAVE').toUpperCase();
        const enterRes = enterDungeon(db, character, dungeonKey);
        return res.json({
          ok: true,
          state: buildClientState(db, userId, {
            labToolsAllowed,
            infoMessage: enterRes.message,
            fxCue: { type: 'STEP', moveKind: 'FORWARD' }
          })
        });
      }

      if (action === 'EXIT_DUNGEON') {
        const activeEnc = getActiveEncounterForCharacter(db, character.id, character.class);
        if (activeEnc && activeEnc.status === 'IN_COMBAT') {
          throw new Error('Cannot ascend from the dungeon while engaged in combat!');
        }
        const exitRes = exitDungeon(db, character);
        return res.json({
          ok: true,
          state: buildClientState(db, userId, {
            labToolsAllowed,
            infoMessage: exitRes.message,
            fxCue: { type: 'STEP', moveKind: 'FORWARD' }
          })
        });
      }

      // 1. MOVEMENT (Relative FORWARD / BACKWARD / STRAFE_LEFT / STRAFE_RIGHT or Cardinal NORTH / EAST / SOUTH / WEST)
      if (action === 'MOVE') {
        if (payload.testForceEncounter !== undefined && !labToolsAllowed) {
          return res.status(403).json({
            ok: false,
            error: 'Forbidden: Encounter forcing is restricted to Lab Tools mode.',
            state: buildClientState(db, userId, {
              labToolsAllowed: false,
              errorMessage: 'Forbidden: Encounter forcing is restricted to Lab Tools mode.'
            })
          });
        }
        const relInput = String(payload.relative || '').toUpperCase().trim();
        const relMap = getRelativeCardinalMap(currentFacing);

        let direction = '';
        let moveKind = 'FORWARD';
        let updateFacingToDirection = false;

        if (relInput && relMap[relInput]) {
          direction = relMap[relInput];
          moveKind = relInput === 'LEFT' ? 'STRAFE_LEFT' : (relInput === 'RIGHT' ? 'STRAFE_RIGHT' : relInput);
        } else {
          direction = String(payload.direction || '').toUpperCase().trim();
          moveKind = getMoveKindFromCardinal(currentFacing, direction);
          updateFacingToDirection = Boolean(FACING_ORDER.includes(direction) && payload.keepFacing !== true);
        }

        if (!FACING_ORDER.includes(direction)) {
          return res.json({
            ok: false,
            state: buildClientState(db, userId, {
              errorMessage: `Invalid movement direction: ${direction || relInput || 'NONE'}.`,
              fxCue: { type: 'BLOCKED_MOVE', moveKind, relativeMove: moveKind }
            })
          });
        }

        // Check active encounter state first
        const activeEnc = getActiveEncounterForCharacter(db, character.id, character.class);
        if (activeEnc && activeEnc.status === 'IN_COMBAT') {
          return res.json({
            ok: false,
            state: buildClientState(db, userId, {
              errorMessage: 'You cannot walk away while engaged in combat! You must fight or flee.',
              fxCue: { type: 'BLOCKED_MOVE', direction, moveKind, relativeMove: moveKind }
            })
          });
        }

        // Check if DISCOVERED encounter is an Ambush
        let isAmbushLocked = false;
        if (activeEnc && activeEnc.status === 'DISCOVERED') {
          let labForcedAmbush = false;
          const rawEnc = db.prepare('SELECT is_ambush, combat_state_json FROM encounters WHERE id = ?').get(activeEnc.id);
          if (rawEnc && rawEnc.combat_state_json) {
            try {
              const parsed = JSON.parse(rawEnc.combat_state_json);
              labForcedAmbush = Boolean(parsed && parsed.labForcedAmbush);
            } catch {
              labForcedAmbush = false;
            }
          }
          isAmbushLocked = Boolean(activeEnc.isAmbush || (rawEnc && Number(rawEnc.is_ambush) === 1) || labForcedAmbush);
          if (isAmbushLocked) {
            return res.json({
              ok: false,
              state: buildClientState(db, userId, {
                errorMessage: 'Ambush! Your path is cut off—you cannot bypass this threat and must face the ambush!',
                fxCue: { type: 'BLOCKED_MOVE', direction, moveKind, relativeMove: moveKind }
              })
            });
          }
        }

        // PHASE 9C: SUBTERRANEAN DUNGEON GRID MOVEMENT
        if (character.active_dungeon_key) {
          const effectiveFacing = updateFacingToDirection ? direction : currentFacing;
          const dungeonMoveOpts = {};
          if (options.rng) dungeonMoveOpts.rng = options.rng;
          if (labToolsAllowed) {
            if (payload.testForceOutcome) dungeonMoveOpts.forceOutcome = String(payload.testForceOutcome).toUpperCase();
            if (payload.testForceAmbush !== undefined) dungeonMoveOpts.forceAmbush = Boolean(payload.testForceAmbush);
            if (payload.testForceEncounter !== undefined) {
              dungeonMoveOpts.forcedChance = payload.testForceEncounter ? 100 : 0;
            }
          }

          let bypassedEncounter = false;
          if (activeEnc && activeEnc.status === 'DISCOVERED') {
            ignoreEncounter(db, character.id, activeEnc.id);
            bypassedEncounter = true;
          }

          const moveRes = moveInDungeon(db, character, direction, dungeonMoveOpts);
          if (!moveRes.ok) {
            return res.json({
              ok: false,
              state: buildClientState(db, userId, {
                labToolsAllowed,
                errorMessage: moveRes.error || 'Passage blocked by solid subterranean stone.',
                fxCue: { type: 'BLOCKED_MOVE', direction, moveKind, relativeMove: moveKind }
              })
            });
          }

          db.prepare('UPDATE characters SET facing = ?, pending_victory_encounter_id = NULL WHERE id = ?').run(
            effectiveFacing,
            character.id
          );

          const spawnedEncounter = moveRes.encounter || null;
          const isAmbushTriggered = Boolean(spawnedEncounter && (spawnedEncounter.status === 'IN_COMBAT' || spawnedEncounter.isAmbush));
          const msgParts = [];
          if (moveRes.treasureFound && moveRes.treasureFound.message) {
            msgParts.push(moveRes.treasureFound.message);
          }
          if (moveRes.hazardMessage) {
            msgParts.push(moveRes.hazardMessage);
          }
          if (isAmbushTriggered) {
            msgParts.push(`AMBUSH! ${spawnedEncounter.monster_name || 'A lurking subterranean horror'} strikes from the darkness! Retreat is cut off for 2 rounds!`);
          } else if (bypassedEncounter) {
            msgParts.push(`You slipped past the threat in the dark and moved ${FACING_VECTORS[direction].label.toLowerCase()} into ${moveRes.targetTile.name}.`);
          }
          const infoMessage = msgParts.length > 0 ? msgParts.join(' ') : null;

          return res.json({
            ok: true,
            state: buildClientState(db, userId, {
              labToolsAllowed,
              infoMessage,
              fxCue: {
                type: isAmbushTriggered ? 'AMBUSH_STARTED' : (spawnedEncounter ? 'ENCOUNTER_DISCOVERED' : 'STEP'),
                direction,
                moveKind,
                relativeMove: moveKind,
                facing: effectiveFacing,
                bypassedEncounter,
                bypassedPrevious: bypassedEncounter
              }
            })
          });
        }

        // Validate target tile coordinates and passability BEFORE modifying any DISCOVERED encounter
        const currentTile = getTileById(db, character.tile_id);
        const dirVec = FACING_VECTORS[direction];
        const targetTile = currentTile ? getTileByCoords(db, currentTile.x + dirVec.dx, currentTile.y + dirVec.dy) : null;

        const advForBounds = getOrCreateAdventureState(character.id, currentTile);
        const enforceTopdownBounds =
          currentTile &&
          isCoordInTopdownRegion(currentTile.x, currentTile.y) &&
          (!advForBounds || advForBounds.expeditionKey !== 'ROTTEN_LANDS_EXPEDITION');

        if (!targetTile || (enforceTopdownBounds && !isCoordInTopdownRegion(targetTile.x, targetTile.y))) {
          return res.json({
            ok: false,
            state: buildClientState(db, userId, {
              errorMessage: 'Dense primeval timber and impassable cliffs seal the perimeter of Blackwood Forest.',
              fxCue: { type: 'BLOCKED_MOVE', direction, moveKind, relativeMove: moveKind }
            })
          });
        }

        if (targetTile.is_passable === 0) {
          return res.json({
            ok: false,
            state: buildClientState(db, userId, {
              errorMessage: `Path blocked: ${targetTile.name} (${targetTile.terrain}) is impassable.`,
              fxCue: { type: 'BLOCKED_MOVE', direction, moveKind, relativeMove: moveKind }
            })
          });
        }

        const effectiveFacing = updateFacingToDirection ? direction : currentFacing;
        let spawnedEncounter = null;
        let bypassedEncounter = false;
        let pacingDecision = null;

        withTransaction(db, (tx) => {
          // If an un-ambushed DISCOVERED encounter was on the tile, bypass it and move in the same atomic action
          if (activeEnc && activeEnc.status === 'DISCOVERED') {
            ignoreEncounter(tx, character.id, activeEnc.id);
            bypassedEncounter = true;
            if (currentTile) {
              recordEncounterOutcome(character.id, currentTile, 'Unidentified Threat', 'BYPASSED');
            }
          }

          // Clear any pending victory overlay and update character tile_id (and facing if moving cardinally)
          tx.prepare('UPDATE characters SET tile_id = ?, facing = ?, pending_victory_encounter_id = NULL WHERE id = ?').run(
            targetTile.id,
            effectiveFacing,
            character.id
          );
          recordTileDiscovery(tx, character, targetTile.x, targetTile.y);
          updateCharacterLandmarkArrival(tx, character.id, currentTile ? currentTile.id : null, targetTile);

          // Roll for encounter on the new tile unless safe city or Stronghold entrance
          if (!(targetTile.terrain === 'CITY' && targetTile.is_safe === 1)) {
            const encounterOpts = { currentTile };
            if (labToolsAllowed) {
              if (payload.testForceOutcome) encounterOpts.forceOutcome = String(payload.testForceOutcome).toUpperCase();
              if (payload.testForceAmbush !== undefined) encounterOpts.forceAmbush = Boolean(payload.testForceAmbush);
              if (payload.allowLevel1Ambush !== undefined) encounterOpts.allowLevel1Ambush = Boolean(payload.allowLevel1Ambush);
            }
            if (options.rng) encounterOpts.rng = options.rng;
            if (payload.testForceEncounter !== undefined) {
              encounterOpts.forcedChance = payload.testForceEncounter ? 100 : 0;
              pacingDecision = {
                chancePercent: encounterOpts.forcedChance,
                baseChancePercent: encounterOpts.forcedChance,
                reason: 'TEST_FORCE_ENCOUNTER',
                modifiers: ['TEST_OVERRIDE']
              };
            } else {
              pacingDecision = computeEncounterPacingChance(tx, character, currentTile, targetTile, {
                bypassedPreviousEncounter: bypassedEncounter
              });
              const calibratedChance = computePhase8StepEncounterChance(
                tx,
                character,
                currentTile,
                targetTile,
                pacingDecision.chancePercent
              );
              pacingDecision.chancePercent = calibratedChance;
              encounterOpts.forcedChance = calibratedChance;
            }
            spawnedEncounter = checkGoblinForestEncounter(tx, character, targetTile, encounterOpts);
          } else {
            pacingDecision = {
              chancePercent: 0,
              baseChancePercent: 0,
              reason: 'SANCTUARY_SAFE_ZONE',
              modifiers: ['SANCTUARY_ZERO']
            };
          }
        });

        const isAmbushTriggered = Boolean(spawnedEncounter && (spawnedEncounter.status === 'IN_COMBAT' || spawnedEncounter.isAmbush));
        const infoMessage = isAmbushTriggered
          ? `AMBUSH! ${spawnedEncounter.monster_name || 'A lurking foe'} strikes from the shadows before you can react! Retreat is cut off for 2 rounds!`
          : bypassedEncounter
          ? `You slipped past the threat in the shadows and moved ${FACING_VECTORS[direction].label.toLowerCase()} to ${targetTile.name}.`
          : null;

        // Compute new tile's directional neighbors & persistent threat awareness for atomic travel continuity
        const stepRelDirs = getRelativeCardinalMap(effectiveFacing);
        const stepAheadVec = FACING_VECTORS[stepRelDirs.FORWARD];
        const stepBackVec = FACING_VECTORS[stepRelDirs.BACKWARD];
        const stepLeftVec = FACING_VECTORS[stepRelDirs.STRAFE_LEFT];
        const stepRightVec = FACING_VECTORS[stepRelDirs.STRAFE_RIGHT];
        const stepAheadTile = getTileByCoords(db, targetTile.x + stepAheadVec.dx, targetTile.y + stepAheadVec.dy);
        const stepBehindTile = getTileByCoords(db, targetTile.x + stepBackVec.dx, targetTile.y + stepBackVec.dy);
        const stepLeftTile = getTileByCoords(db, targetTile.x + stepLeftVec.dx, targetTile.y + stepLeftVec.dy);
        const stepRightTile = getTileByCoords(db, targetTile.x + stepRightVec.dx, targetTile.y + stepRightVec.dy);
        const stepPersistentRow = targetTile
          ? db.prepare("SELECT id, kill_count, custom_title FROM monster_instances WHERE tile_id = ? AND status = 'ACTIVE'").get(targetTile.id)
          : null;
        const stepPersistentAlert = stepPersistentRow
          ? `Genuine Sign: Fresh bloodstains and scarred earth confirm a battle-hardened survivor (${stepPersistentRow.kill_count || 1} fallen hero${Number(stepPersistentRow.kill_count || 1) === 1 ? '' : 'es'} claimed) lurks at ${targetTile.name}.`
          : null;
        const stepAdjacentPersistentCount = [stepAheadTile, stepBehindTile, stepLeftTile, stepRightTile]
          .filter(t => t && t.id && Number(
            (db.prepare("SELECT COUNT(*) AS cnt FROM monster_instances WHERE tile_id = ? AND status = 'ACTIVE'").get(t.id) || {}).cnt || 0
          ) > 0).length;

        // Update isolated Adventure Experience state on movement step (never consumes combat/encounter RNG)
        onPlayerStep(
          character.id,
          targetTile,
          spawnedEncounter
            ? { status: 'STAGE1_PRE_COMBAT', isPersistent: Boolean(spawnedEncounter.monster_instance_id), monsterName: null }
            : null,
          stepPersistentAlert,
          stepAdjacentPersistentCount,
          {
            db,
            facing: effectiveFacing,
            moveAction: moveKind,
            aheadTile: stepAheadTile,
            leftTile: stepLeftTile,
            rightTile: stepRightTile,
            behindTile: stepBehindTile,
            encounterPacing: pacingDecision
          }
        );

        return res.json({
          ok: true,
          state: buildClientState(db, userId, {
            infoMessage,
            fxCue: {
              type: isAmbushTriggered ? 'AMBUSH_STARTED' : (spawnedEncounter ? 'ENCOUNTER_DISCOVERED' : 'STEP'),
              direction,
              moveKind,
              relativeMove: moveKind,
              facing: effectiveFacing,
              bypassedEncounter,
              bypassedPrevious: bypassedEncounter
            }
          })
        });
      }

      // 11. PHASE 4.3: INSPECT POINT OF INTEREST (Non-gameplay lore inspection)
      if (action === 'INSPECT_POI') {
        const currentTile = getTileById(db, character.tile_id);
        const fVec = FACING_VECTORS[currentFacing];
        const ahead1 = currentTile ? inspectSceneTile(db, currentTile.x + fVec.dx, currentTile.y + fVec.dy, currentFacing) : null;
        const currentInspected = currentTile ? inspectSceneTile(db, currentTile.x, currentTile.y, currentFacing) : null;
        const poi = resolvePointOfInterest(currentInspected, ahead1, currentFacing);
        if (!poi) {
          return res.json({
            ok: true,
            state: buildClientState(db, userId, {
              infoMessage: `You survey ${currentTile ? currentTile.name : 'your surroundings'}: ${currentTile && currentTile.description ? currentTile.description : 'Only the cold wind and drifting mist stir ahead.'}`
            })
          });
        }
        recordPoiInspection(character.id, currentTile, poi);
        return res.json({
          ok: true,
          state: buildClientState(db, userId, {
            infoMessage: `${poi.icon} ${poi.title}: ${poi.description}`,
            fxCue: { type: 'INSPECT_POI', poi }
          })
        });
      }

      // 12. PHASE 1.2: TELEPORT TO TILE (From World Visual Atlas / Expedition Presets)
      if (action === 'TELEPORT_TO_TILE') {
        if (!labToolsAllowed) {
          return res.status(403).json({
            ok: false,
            error: 'Forbidden: Atlas teleportation is restricted to Lab Tools mode.',
            state: buildClientState(db, userId, {
              labToolsAllowed: false,
              errorMessage: 'Forbidden: Atlas teleportation is restricted to Lab Tools mode.'
            })
          });
        }
        const tx = Number(payload.x);
        const ty = Number(payload.y);
        const targetFacing = payload.facing ? normalizeFacing(payload.facing) : currentFacing;
        const targetTile = getTileByCoords(db, tx, ty);
        if (!targetTile) {
          throw new Error(`No map tile found at coordinates (${tx}, ${ty}).`);
        }
        db.prepare(`
          UPDATE encounters SET status = 'ESCAPED'
          WHERE character_id = ? AND status IN ('DISCOVERED', 'IN_COMBAT')
        `).run(character.id);
        db.prepare('UPDATE characters SET tile_id = ?, facing = ?, pending_victory_encounter_id = NULL, active_dungeon_key = NULL, dungeon_x = NULL, dungeon_y = NULL WHERE id = ?').run(
          targetTile.id,
          targetFacing,
          character.id
        );
        recordTileDiscovery(db, character, targetTile.x, targetTile.y);
        updateCharacterLandmarkArrival(db, character.id, character.tile_id, targetTile);
        if (payload.openLandmarkScene !== false) {
          openLandmarkScene(db, character.id);
        }
        return res.json({
          ok: true,
          state: buildClientState(db, userId, {
            infoMessage: targetTile.description || `Arrived at ${targetTile.name}.`,
            fxCue: { type: 'STEP', moveKind: 'FORWARD' }
          })
        });
      }

  return false;
}

module.exports = {
  handleNavigationAction
};
