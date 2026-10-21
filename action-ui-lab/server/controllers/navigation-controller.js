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

function handleNavigationAction({ db, userId, options, action, payload, character, currentFacing, res }) {
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

      // 1. MOVEMENT (Relative FORWARD / BACKWARD / STRAFE_LEFT / STRAFE_RIGHT or Cardinal NORTH / EAST / SOUTH / WEST)
      if (action === 'MOVE') {
        const relInput = String(payload.relative || '').toUpperCase().trim();
        const relMap = getRelativeCardinalMap(currentFacing);

        let direction = '';
        let moveKind = 'FORWARD';

        if (relInput && relMap[relInput]) {
          direction = relMap[relInput];
          moveKind = relInput === 'LEFT' ? 'STRAFE_LEFT' : (relInput === 'RIGHT' ? 'STRAFE_RIGHT' : relInput);
        } else {
          direction = String(payload.direction || '').toUpperCase().trim();
          moveKind = getMoveKindFromCardinal(currentFacing, direction);
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

        // Validate target tile coordinates and passability BEFORE modifying any DISCOVERED encounter
        const currentTile = getTileById(db, character.tile_id);
        const dirVec = FACING_VECTORS[direction];
        const targetTile = currentTile ? getTileByCoords(db, currentTile.x + dirVec.dx, currentTile.y + dirVec.dy) : null;

        if (!targetTile) {
          return res.json({
            ok: false,
            state: buildClientState(db, userId, {
              errorMessage: 'You stand at the edge of the world; you cannot travel further in this direction.',
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

          // Clear any pending victory overlay and update character tile_id
          tx.prepare('UPDATE characters SET tile_id = ?, pending_victory_encounter_id = NULL WHERE id = ?').run(
            targetTile.id,
            character.id
          );

          // Roll for encounter on the new tile unless safe city
          if (!(targetTile.terrain === 'CITY' && targetTile.is_safe === 1)) {
            const encounterOpts = {};
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
              encounterOpts.forcedChance = pacingDecision.chancePercent;
            }
            spawnedEncounter = checkTileEncounter(tx, character, targetTile, encounterOpts);
          } else {
            pacingDecision = {
              chancePercent: 0,
              baseChancePercent: 0,
              reason: 'SANCTUARY_SAFE_ZONE',
              modifiers: ['SANCTUARY_ZERO']
            };
          }
        });

        const infoMessage = bypassedEncounter
          ? `You slipped past the threat in the shadows and moved ${FACING_VECTORS[direction].label.toLowerCase()} to ${targetTile.name}.`
          : null;

        // Compute new tile's directional neighbors & persistent threat awareness for atomic travel continuity
        const stepRelDirs = getRelativeCardinalMap(currentFacing);
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
            facing: currentFacing,
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
              type: spawnedEncounter ? 'ENCOUNTER_DISCOVERED' : 'STEP',
              direction,
              moveKind,
              relativeMove: moveKind,
              facing: currentFacing,
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
        db.prepare('UPDATE characters SET tile_id = ?, facing = ?, pending_victory_encounter_id = NULL WHERE id = ?').run(
          targetTile.id,
          targetFacing,
          character.id
        );
        return res.json({
          ok: true,
          state: buildClientState(db, userId, {
            infoMessage: `Atlas Teleport: Positioned at ${targetTile.name} [${targetTile.x}, ${targetTile.y}] Facing ${targetFacing}.`,
            fxCue: { type: 'STEP', moveKind: 'FORWARD' }
          })
        });
      }

  return false;
}

module.exports = {
  handleNavigationAction
};
