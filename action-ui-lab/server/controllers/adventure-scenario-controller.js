/**
 * DARKGRID ADVENTURE LAB — Adventure Experience, Expeditions, Discoveries & Lab Scenarios Controller
 */
const { getCharacterEquipment } = require('../../../src/domain/character/rules');
const {
  getTileById,
  getTileByCoords
} = require('../../../src/domain/world/map');
const { investigateEncounter } = require('../../../src/domain/encounters/engine');
const {
  DISCOVERY_CATALOG,
  EXPEDITION_DEFINITIONS,
  getOrCreateAdventureState,
  resetAdventureState,
  selectDiscoveryForTile,
  resolveDiscoveryChoice,
  recordEncounterStart
} = require('../../adventure-engine');
const { lookupMonsterSizeEntry } = require('../../monster-size-catalog');
const { normalizeFacing } = require('../services/facing-service');
const { ensureLivingHero } = require('../services/sandbox-db-service');
const { buildClientState } = require('../services/client-state-service');
const {
  TOWN_COORD,
  NORTH_GATE_COORD,
  STRONGHOLD_COORD,
  GOBLIN_CAVE_COORD,
  ANCIENT_CRYPT_COORD,
  STRONGHOLD_BOSS_PROFILE,
  ensureStrongholdBossInstance,
  recordTileDiscovery,
  syncCharacterQuestState,
  updateCharacterLandmarkArrival,
  openLandmarkScene
} = require('../services/topdown-world-service');

function handleAdventureScenarioAction({ db, userId, options = {}, action, payload, character, currentFacing, labToolsAllowed = false, res }) {
      // 11b. ADVENTURE EXPERIENCE ACTIONS (Isolated Lab-Only Layer — Phases 3, 5, 6, 8, 9)
      if (action === 'SET_ADVENTURE_MODE') {
        const currentTile = getTileById(db, character.tile_id);
        const advState = getOrCreateAdventureState(character.id, currentTile);
        const nextEnabled = payload.enabled !== undefined ? Boolean(payload.enabled) : !advState.enabled;
        advState.enabled = nextEnabled;
        advState.modeLabel = nextEnabled ? 'Adventure Experience — Experimental' : 'Current Experience (Baseline)';
        if (!nextEnabled) {
          advState.activeDiscovery = null;
          advState.activeTensionCue = null;
        } else if (currentTile && currentTile.is_safe === 0) {
          advState.activeDiscovery = selectDiscoveryForTile(advState, currentTile);
        }
        return res.json({
          ok: true,
          state: buildClientState(db, userId, {
            labToolsAllowed,
            infoMessage: nextEnabled
              ? 'Enabled Adventure Experience — Experimental (environmental discoveries, tension cues, choices & expedition journal active).'
              : 'Switched to Current Experience (baseline Lab exploration without experimental overlays).'
          })
        });
      }

      if (action === 'START_EXPEDITION' || action === 'RESET_EXPEDITION') {
        if (payload.deterministicSeed !== undefined && !labToolsAllowed) {
          return res.status(403).json({
            ok: false,
            error: 'Forbidden: Deterministic seed is restricted to Lab Tools mode.',
            state: buildClientState(db, userId, {
              labToolsAllowed: false,
              errorMessage: 'Forbidden: Deterministic seed is restricted to Lab Tools mode.'
            })
          });
        }

        const requestedKey = payload.expeditionKey || 'MIRKWOOD_EXPEDITION';
        const expDef = EXPEDITION_DEFINITIONS[requestedKey] || EXPEDITION_DEFINITIONS.MIRKWOOD_EXPEDITION;
        const startFacing = normalizeFacing(
          payload.facing || (action === 'RESET_EXPEDITION' ? 'NORTH' : (expDef.startTile.facing || 'NORTH'))
        );
        const startTile = getTileByCoords(db, expDef.startTile.x, expDef.startTile.y);

        if (!labToolsAllowed) {
          const activeEnc = db.prepare(`
            SELECT id, status FROM encounters
            WHERE character_id = ? AND status IN ('DISCOVERED', 'IN_COMBAT')
            LIMIT 1
          `).get(character.id);
          if (activeEnc) {
            return res.status(400).json({
              ok: false,
              error: 'Cannot start or reset an expedition while engaged in an encounter.',
              state: buildClientState(db, userId, {
                labToolsAllowed: false,
                errorMessage: 'Cannot start or reset an expedition while engaged in an encounter.'
              })
            });
          }

          const currentTile = getTileById(db, character.tile_id);
          const currentAdv = getOrCreateAdventureState(character.id, currentTile);
          resetAdventureState(character.id, {
            enabled: action === 'START_EXPEDITION' ? true : currentAdv.enabled,
            expeditionKey: expDef.expeditionKey,
            deterministicSeed: null
          });

          return res.json({
            ok: true,
            state: buildClientState(db, userId, {
              labToolsAllowed: false,
              infoMessage: action === 'RESET_EXPEDITION'
                ? `Expedition journal reset for ${expDef.title}.`
                : `${expDef.briefingTitle}: ${expDef.briefingText}`
            })
          });
        }

        db.prepare(`
          UPDATE encounters SET status = 'ESCAPED'
          WHERE character_id = ? AND status IN ('DISCOVERED', 'IN_COMBAT')
        `).run(character.id);
        if (startTile) {
          db.prepare('UPDATE characters SET tile_id = ?, current_hp = max_hp, facing = ?, pending_victory_encounter_id = NULL WHERE id = ?').run(
            startTile.id,
            startFacing,
            character.id
          );
        }

        const currentAdv = getOrCreateAdventureState(character.id, startTile);
        resetAdventureState(character.id, {
          enabled: action === 'START_EXPEDITION' ? true : currentAdv.enabled,
          expeditionKey: expDef.expeditionKey,
          deterministicSeed: payload.deterministicSeed !== undefined ? Number(payload.deterministicSeed) : currentAdv.deterministicSeed
        });

        return res.json({
          ok: true,
          state: buildClientState(db, userId, {
            labToolsAllowed,
            infoMessage: action === 'RESET_EXPEDITION'
              ? `Expedition reset: returned to Oakhaven Sanctuary [7,7] for ${expDef.title}.`
              : `${expDef.briefingTitle}: ${expDef.briefingText}`,
            fxCue: { type: 'STEP', moveKind: 'FORWARD' }
          })
        });
      }

      if (action === 'RESOLVE_DISCOVERY_CHOICE') {
        const currentTile = getTileById(db, character.tile_id);
        const result = resolveDiscoveryChoice(
          character.id,
          currentTile,
          payload.discoveryKey || payload.discoveryId,
          payload.choiceKey || payload.choiceId
        );
        if (!result.ok) {
          throw new Error(result.error || 'Could not resolve discovery choice.');
        }
        return res.json({
          ok: true,
          state: buildClientState(db, userId, {
            labToolsAllowed,
            infoMessage: `${result.outcomeTitle}: ${result.outcomeText}`,
            fxCue: {
              type: 'DISCOVERY_RESOLVED',
              outcomeTitle: result.outcomeTitle,
              outcomeText: result.outcomeText
            }
          })
        });
      }

      if (action === 'DISMISS_DISCOVERY') {
        const currentTile = getTileById(db, character.tile_id);
        const advState = getOrCreateAdventureState(character.id, currentTile);
        if (advState.activeDiscovery) {
          const rec = advState.discoveredMap[advState.activeDiscovery.discoveryKey];
          if (rec && rec.status === 'DISCOVERED') {
            rec.status = 'PASSED';
          }
          advState.activeDiscovery = null;
        }
        return res.json({
          ok: true,
          state: buildClientState(db, userId, { labToolsAllowed })
        });
      }

      if (action === 'FORCE_DISCOVERY') {
        if (!labToolsAllowed) {
          return res.status(403).json({
            ok: false,
            error: 'Forbidden: Forced discovery staging is restricted to Lab Tools mode.',
            state: buildClientState(db, userId, {
              labToolsAllowed: false,
              errorMessage: 'Forbidden: Forced discovery staging is restricted to Lab Tools mode.'
            })
          });
        }
        const currentTile = getTileById(db, character.tile_id);
        const advState = getOrCreateAdventureState(character.id, currentTile);
        advState.enabled = true;
        const forced = selectDiscoveryForTile(advState, currentTile, {
          forceTrigger: true,
          discoveryKey: payload.discoveryKey || payload.discoveryId || null
        });
        advState.activeDiscovery = forced;
        return res.json({
          ok: true,
          state: buildClientState(db, userId, {
            labToolsAllowed,
            infoMessage: forced
              ? `Director Triggered Discovery: ${forced.title} (${forced.tier}).`
              : `No eligible wilderness discovery on ${currentTile ? currentTile.name : 'this tile'} (step outside safe sanctuary to trigger).`
          })
        });
      }

      if (action === 'SET_DETERMINISTIC_SEED') {
        if (!labToolsAllowed) {
          return res.status(403).json({
            ok: false,
            error: 'Forbidden: Deterministic seed control is restricted to Lab Tools mode.',
            state: buildClientState(db, userId, {
              labToolsAllowed: false,
              errorMessage: 'Forbidden: Deterministic seed control is restricted to Lab Tools mode.'
            })
          });
        }
        const currentTile = getTileById(db, character.tile_id);
        const advState = getOrCreateAdventureState(character.id, currentTile);
        advState.deterministicSeed = Number(payload.seed || 4201);
        return res.json({
          ok: true,
          state: buildClientState(db, userId, {
            labToolsAllowed,
            infoMessage: `Deterministic Adventure Seed set to ${advState.deterministicSeed}.`
          })
        });
      }

      // =====================================================================
      // LAB DIRECTOR ACTIONS (For instant UI testing of any scenario!)
      // =====================================================================
      if (action === 'LAB_SCENARIO') {
        if (!labToolsAllowed) {
          return res.status(403).json({
            ok: false,
            error: 'Forbidden: Lab scenario and debug actions are disabled for player accounts.',
            state: buildClientState(db, userId, {
              labToolsAllowed: false,
              errorMessage: 'Forbidden: Lab scenario and debug actions are disabled for player accounts.'
            })
          });
        }
        const scenario = payload.scenario;

        // Clear any active encounter and pending victory first
        db.prepare(`
          UPDATE encounters SET status = 'ESCAPED'
          WHERE character_id = ? AND status IN ('DISCOVERED', 'IN_COMBAT')
        `).run(character.id);
        db.prepare('UPDATE characters SET pending_victory_encounter_id = NULL WHERE id = ?').run(character.id);

        if (scenario === 'TELEPORT') {
          const tx = Number(payload.x ?? TOWN_COORD.x);
          const ty = Number(payload.y ?? TOWN_COORD.y);
          const targetFacing = payload.facing ? normalizeFacing(payload.facing) : 'NORTH';
          const targetTile = getTileByCoords(db, tx, ty);
          if (!targetTile) {
            throw new Error(`No map tile found at (${tx}, ${ty}).`);
          }
          db.prepare('UPDATE characters SET tile_id = ?, facing = ? WHERE id = ?').run(targetTile.id, targetFacing, character.id);
          recordTileDiscovery(db, character, targetTile.x, targetTile.y);
          updateCharacterLandmarkArrival(db, character.id, character.tile_id, targetTile);
          recordTileDiscovery(db, character, targetTile.x, targetTile.y);
          return res.json({
            ok: true,
            state: buildClientState(db, userId, {
              infoMessage: `Teleported to ${targetTile.name} [${targetTile.x}, ${targetTile.y}] (Facing ${targetFacing}).`,
              fxCue: { type: 'STEP', moveKind: 'FORWARD' }
            })
          });
        }

        if (scenario === 'CITY') {
          const cityTile = getTileByCoords(db, TOWN_COORD.x, TOWN_COORD.y)
            || db.prepare("SELECT * FROM map_tiles WHERE terrain = 'CITY' AND is_safe = 1 LIMIT 1").get();
          const targetFacing = payload.facing ? normalizeFacing(payload.facing) : 'NORTH';
          if (cityTile) {
            db.prepare('UPDATE characters SET tile_id = ?, current_hp = max_hp, facing = ?, active_landmark_scene_key = ?, dismissed_landmark_tile_id = NULL WHERE id = ?').run(cityTile.id, targetFacing, 'OAKHAVEN', character.id);
            recordTileDiscovery(db, character, cityTile.x, cityTile.y);
          }
          return res.json({
            ok: true,
            state: buildClientState(db, userId, {
              infoMessage: `Teleported to Oakhaven Sanctuary (Facing ${targetFacing}).`,
              fxCue: { type: 'STEP', moveKind: 'FORWARD' }
            })
          });
        }

        if (scenario === 'NORTH_GATE' || scenario === 'GATE') {
          const gateTile = getTileByCoords(db, NORTH_GATE_COORD.x, NORTH_GATE_COORD.y);
          const targetFacing = payload.facing ? normalizeFacing(payload.facing) : 'NORTH';
          if (gateTile) {
            db.prepare('UPDATE characters SET tile_id = ?, facing = ? WHERE id = ?').run(gateTile.id, targetFacing, character.id);
            recordTileDiscovery(db, character, gateTile.x, gateTile.y);
          }
          return res.json({
            ok: true,
            state: buildClientState(db, userId, {
              infoMessage: `Positioned at Oakhaven North Gate [${NORTH_GATE_COORD.x}, ${NORTH_GATE_COORD.y}] Facing ${targetFacing}.`,
              fxCue: { type: 'STEP', moveKind: 'FORWARD' }
            })
          });
        }

        if (scenario === 'BRIDGE') {
          const bridgeTile = getTileByCoords(db, 19, 25);
          const targetFacing = payload.facing ? normalizeFacing(payload.facing) : 'EAST';
          if (bridgeTile) {
            db.prepare('UPDATE characters SET tile_id = ?, facing = ? WHERE id = ?').run(bridgeTile.id, targetFacing, character.id);
            recordTileDiscovery(db, character, bridgeTile.x, bridgeTile.y);
          }
          return res.json({
            ok: true,
            state: buildClientState(db, userId, {
              infoMessage: `Positioned at The Old Stone Bridge [19, 25] Facing ${targetFacing} (East: Abandoned Watchpost, West: Oakhaven, N/S: Blackwater River).`,
              fxCue: { type: 'STEP', moveKind: 'FORWARD' }
            })
          });
        }

        if (scenario === 'WATCHPOST' || scenario === 'ABANDONED_WATCHPOST') {
          const wpTile = getTileByCoords(db, 21, 25);
          const targetFacing = payload.facing ? normalizeFacing(payload.facing) : 'NORTH';
          if (wpTile) {
            db.prepare('UPDATE characters SET tile_id = ?, facing = ? WHERE id = ?').run(wpTile.id, targetFacing, character.id);
            recordTileDiscovery(db, character, wpTile.x, wpTile.y);
          }
          return res.json({
            ok: true,
            state: buildClientState(db, userId, {
              infoMessage: `Positioned at Abandoned Watchpost [21, 25] Facing ${targetFacing}.`,
              fxCue: { type: 'STEP', moveKind: 'FORWARD' }
            })
          });
        }

        if (scenario === 'BROKEN_SHRINE' || scenario === 'SHRINE') {
          const shrineTile = getTileByCoords(db, 7, 17);
          const targetFacing = payload.facing ? normalizeFacing(payload.facing) : 'NORTH';
          if (shrineTile) {
            db.prepare('UPDATE characters SET tile_id = ?, facing = ? WHERE id = ?').run(shrineTile.id, targetFacing, character.id);
            recordTileDiscovery(db, character, shrineTile.x, shrineTile.y);
          }
          return res.json({
            ok: true,
            state: buildClientState(db, userId, {
              infoMessage: `Positioned at The Broken Shrine [7, 17] Facing ${targetFacing}.`,
              fxCue: { type: 'STEP', moveKind: 'FORWARD' }
            })
          });
        }

        if (scenario === 'ANCIENT_OAK' || scenario === 'OAK') {
          const oakTile = getTileByCoords(db, 15, 15);
          const targetFacing = payload.facing ? normalizeFacing(payload.facing) : 'NORTH';
          if (oakTile) {
            db.prepare('UPDATE characters SET tile_id = ?, facing = ? WHERE id = ?').run(oakTile.id, targetFacing, character.id);
            recordTileDiscovery(db, character, oakTile.x, oakTile.y);
          }
          return res.json({
            ok: true,
            state: buildClientState(db, userId, {
              infoMessage: `Positioned at Ancient Black Oak [15, 15] Facing ${targetFacing}.`,
              fxCue: { type: 'STEP', moveKind: 'FORWARD' }
            })
          });
        }

        if (scenario === 'HUNTING_GROUNDS' || scenario === 'GOBLIN_HUNTING_GROUNDS') {
          const hgTile = getTileByCoords(db, 15, 9);
          const targetFacing = payload.facing ? normalizeFacing(payload.facing) : 'NORTH';
          if (hgTile) {
            db.prepare('UPDATE characters SET tile_id = ?, facing = ? WHERE id = ?').run(hgTile.id, targetFacing, character.id);
            recordTileDiscovery(db, character, hgTile.x, hgTile.y);
          }
          return res.json({
            ok: true,
            state: buildClientState(db, userId, {
              infoMessage: `Positioned at Goblin Hunting Grounds [15, 9] Facing ${targetFacing}.`,
              fxCue: { type: 'STEP', moveKind: 'FORWARD' }
            })
          });
        }

        if (scenario === 'DEADMANS_MIRE' || scenario === 'MIRE') {
          const mireTile = getTileByCoords(db, 26, 19);
          const targetFacing = payload.facing ? normalizeFacing(payload.facing) : 'NORTH';
          if (mireTile) {
            db.prepare('UPDATE characters SET tile_id = ?, facing = ?, active_landmark_scene_key = NULL, dismissed_landmark_tile_id = NULL WHERE id = ?').run(mireTile.id, targetFacing, character.id);
            recordTileDiscovery(db, character, mireTile.x, mireTile.y);
          }
          return res.json({
            ok: true,
            state: buildClientState(db, userId, {
              infoMessage: `Positioned at Drowned Ossuary [26, 19] in Deadman’s Mire (Undead Lands) Facing ${targetFacing}.`,
              fxCue: { type: 'STEP', moveKind: 'FORWARD' }
            })
          });
        }

        if (scenario === 'UNDEAD_LANDS' || scenario === 'BARROWLANDS' || scenario === 'WEEPING_CAIRN') {
          const barrowTile = getTileByCoords(db, 26, 15);
          const targetFacing = payload.facing ? normalizeFacing(payload.facing) : 'NORTH';
          if (barrowTile) {
            db.prepare('UPDATE characters SET tile_id = ?, facing = ?, active_landmark_scene_key = NULL, dismissed_landmark_tile_id = NULL WHERE id = ?').run(barrowTile.id, targetFacing, character.id);
            recordTileDiscovery(db, character, barrowTile.x, barrowTile.y);
          }
          return res.json({
            ok: true,
            state: buildClientState(db, userId, {
              infoMessage: `Positioned at Weeping Cairn [26, 15] in the Undead Lands Facing ${targetFacing}.`,
              fxCue: { type: 'STEP', moveKind: 'FORWARD' }
            })
          });
        }

        if (scenario === 'GOBLIN_CAVE' || scenario === 'CAVE') {
          const caveTile = getTileByCoords(db, GOBLIN_CAVE_COORD.x, GOBLIN_CAVE_COORD.y);
          const targetFacing = payload.facing ? normalizeFacing(payload.facing) : 'WEST';
          if (caveTile) {
            db.prepare('UPDATE characters SET tile_id = ?, facing = ?, active_landmark_scene_key = ?, dismissed_landmark_tile_id = NULL WHERE id = ?').run(caveTile.id, targetFacing, 'GOBLIN_CAVE', character.id);
            recordTileDiscovery(db, character, caveTile.x, caveTile.y);
          }
          return res.json({
            ok: true,
            state: buildClientState(db, userId, {
              infoMessage: `Positioned at The Goblin Cave [${GOBLIN_CAVE_COORD.x}, ${GOBLIN_CAVE_COORD.y}].`,
              fxCue: { type: 'STEP', moveKind: 'FORWARD' }
            })
          });
        }

        if (scenario === 'ANCIENT_CRYPT' || scenario === 'CRYPT') {
          const cryptTile = getTileByCoords(db, ANCIENT_CRYPT_COORD.x, ANCIENT_CRYPT_COORD.y);
          const targetFacing = payload.facing ? normalizeFacing(payload.facing) : 'NORTH';
          if (cryptTile) {
            db.prepare('UPDATE characters SET tile_id = ?, facing = ?, active_landmark_scene_key = ?, dismissed_landmark_tile_id = NULL WHERE id = ?').run(cryptTile.id, targetFacing, 'ANCIENT_CRYPT', character.id);
            recordTileDiscovery(db, character, cryptTile.x, cryptTile.y);
          }
          return res.json({
            ok: true,
            state: buildClientState(db, userId, {
              infoMessage: `Positioned at The Ancient Crypt [${ANCIENT_CRYPT_COORD.x}, ${ANCIENT_CRYPT_COORD.y}] in the Undead Lands.`,
              fxCue: { type: 'STEP', moveKind: 'FORWARD' }
            })
          });
        }

        if (scenario === 'STRONGHOLD' || scenario === 'GOBLIN_STRONGHOLD') {
          const shTile = getTileByCoords(db, STRONGHOLD_COORD.x, STRONGHOLD_COORD.y);
          const targetFacing = payload.facing ? normalizeFacing(payload.facing) : 'NORTH';
          if (shTile) {
            db.prepare('UPDATE characters SET tile_id = ?, facing = ?, active_landmark_scene_key = ?, dismissed_landmark_tile_id = NULL WHERE id = ?').run(shTile.id, targetFacing, 'GOBLIN_STRONGHOLD', character.id);
            recordTileDiscovery(db, character, shTile.x, shTile.y);
          }
          return res.json({
            ok: true,
            state: buildClientState(db, userId, {
              infoMessage: `Positioned at Goblin Stronghold Gate [${STRONGHOLD_COORD.x}, ${STRONGHOLD_COORD.y}].`,
              fxCue: { type: 'STEP', moveKind: 'FORWARD' }
            })
          });
        }

        if (scenario === 'RESET_WORLD') {
          db.prepare("UPDATE monster_instances SET status = 'DEFEATED' WHERE status = 'ACTIVE'").run();
          db.prepare("UPDATE encounters SET status = 'ESCAPED' WHERE status IN ('DISCOVERED', 'IN_COMBAT')").run();
          const cityTile = getTileByCoords(db, TOWN_COORD.x, TOWN_COORD.y)
            || db.prepare("SELECT * FROM map_tiles WHERE terrain = 'CITY' AND is_safe = 1 LIMIT 1").get();
          if (cityTile) {
            db.prepare("UPDATE characters SET tile_id = ?, current_hp = max_hp, facing = 'NORTH', pending_victory_encounter_id = NULL, quest_goblin_chieftain_status = 'NOT_ACCEPTED', goblin_chieftain_slain = 0, active_landmark_scene_key = 'OAKHAVEN', dismissed_landmark_tile_id = NULL WHERE id = ?").run(cityTile.id, character.id);
          }
          try {
            db.prepare('DELETE FROM character_quests WHERE character_id = ?').run(character.id);
            db.prepare('DELETE FROM character_discovered_tiles WHERE character_id = ?').run(character.id);
          } catch {
            // Ignore if tables not present
          }
          ensureStrongholdBossInstance(db, { forceRespawn: true });
          recordTileDiscovery(db, character, TOWN_COORD.x, TOWN_COORD.y);
          recordTileDiscovery(db, character, TOWN_COORD.x, TOWN_COORD.y);
          openLandmarkScene(db, character.id);
          syncCharacterQuestState(db, character.id);
          resetAdventureState(character.id);
          return res.json({
            ok: true,
            state: buildClientState(db, userId, {
              infoMessage: 'Sandbox world reset: restored Goblin Stronghold Chieftain, reset quest & discovery state, and returned to Oakhaven Sanctuary.',
              fxCue: { type: 'HEAL' }
            })
          });
        }

        if (scenario === 'WILDERNESS' || scenario === 'TEST_CORRIDOR') {
          const wildTile = getTileByCoords(db, 15, 23) || db.prepare("SELECT * FROM map_tiles WHERE terrain = 'FOREST' AND is_safe = 0 AND is_passable = 1 LIMIT 1").get();
          const targetFacing = payload.facing ? normalizeFacing(payload.facing) : 'NORTH';
          if (wildTile) {
            db.prepare('UPDATE characters SET tile_id = ?, facing = ? WHERE id = ?').run(wildTile.id, targetFacing, character.id);
            recordTileDiscovery(db, character, wildTile.x, wildTile.y);
          }
          return res.json({
            ok: true,
            state: buildClientState(db, userId, {
              infoMessage: `Positioned at Blackwood Crossroads [15, 23] Facing ${targetFacing}.`,
              fxCue: { type: 'STEP', moveKind: 'FORWARD' }
            })
          });
        }

        if (scenario === 'WOUNDED') {
          const lowHp = Math.max(1, Math.floor((character.max_hp || 12) * 0.25));
          db.prepare('UPDATE characters SET current_hp = ? WHERE id = ?').run(lowHp, character.id);
          return res.json({
            ok: true,
            state: buildClientState(db, userId, {
              infoMessage: `Simulated wounded vitality (${lowHp} / ${character.max_hp} HP).`,
              fxCue: { type: 'DAMAGE' }
            })
          });
        }

        if (scenario === 'HEAL') {
          db.prepare('UPDATE characters SET current_hp = max_hp WHERE id = ?').run(character.id);
          return res.json({
            ok: true,
            state: buildClientState(db, userId, {
              infoMessage: 'Restored champion vitality to full.',
              fxCue: { type: 'HEAL' }
            })
          });
        }

        const effectiveScenario =
          scenario === 'COMBAT' ? 'STAGE2_COMBAT' :
          scenario === 'SHADOW' ? 'STAGE1_MYSTERY' :
          scenario === 'AMBUSH' ? 'STAGE1_AMBUSH' :
          scenario;

        if (effectiveScenario === 'STAGE1_MYSTERY' || effectiveScenario === 'STAGE1_AMBUSH' || effectiveScenario === 'STAGE2_COMBAT' || effectiveScenario === 'STAGE2_AMBUSH' || effectiveScenario === 'AMBUSH_COMBAT') {
          // Move to a suitable wilderness tile if currently in a safe tile
          let tile = getTileById(db, character.tile_id);
          let relocatedFromSafe = false;
          if (!tile || tile.is_safe === 1) {
            relocatedFromSafe = true;
            tile = getTileByCoords(db, 15, 23) || db.prepare("SELECT * FROM map_tiles WHERE terrain IN ('FOREST', 'SWAMP', 'HILLS') AND is_safe = 0 AND is_passable = 1 LIMIT 1").get();
          }
          const liveCharRow = db.prepare('SELECT facing FROM characters WHERE id = ?').get(character.id);
          const heroFacing = normalizeFacing((liveCharRow && liveCharRow.facing) || character.facing || 'NORTH');
          let targetFacing = 'NORTH';
          if (payload.facing) {
            targetFacing = normalizeFacing(payload.facing);
          } else if (tile && (tile.terrain === 'BRIDGE' || (tile.x === 19 && tile.y === 25))) {
            targetFacing = (heroFacing === 'EAST' || heroFacing === 'WEST') ? heroFacing : 'EAST';
          } else if (payload.preserveFacing && !relocatedFromSafe) {
            targetFacing = heroFacing;
          }
          if (tile) {
            db.prepare('UPDATE characters SET tile_id = ?, facing = ?, current_hp = max_hp WHERE id = ?').run(tile.id, targetFacing, character.id);
            recordTileDiscovery(db, character, tile.x, tile.y);
            // Clear any leftover persistent monster_instances on the test tile so scenario spawn is clean and predictable
            db.prepare("UPDATE monster_instances SET status = 'DEFEATED' WHERE tile_id = ? AND status = 'ACTIVE' AND (custom_title IS NULL OR custom_title != ?)").run(tile.id, STRONGHOLD_BOSS_PROFILE.customTitle);
          }

          let monster = null;
          const requestedMonsterKey = payload.monsterName || payload.monsterSlug || payload.monsterId || payload.monster || null;
          if (requestedMonsterKey !== null && requestedMonsterKey !== undefined && String(requestedMonsterKey).trim() !== '') {
            const rawQuery = String(requestedMonsterKey).trim().toLowerCase();
            const aliasMap = {
              'creeping vine': 'assassin vine',
              'creeping_vine': 'assassin vine',
              'skeleton': 'human skeleton',
              'zombie': 'human zombie',
              'giant_rat': 'dire rat',
              'giant rat': 'dire rat',
              'will_o_wisp': "will-o'-wisp",
              'wisp': "will-o'-wisp"
            };
            const mappedQuery = aliasMap[rawQuery] || rawQuery.replace(/_/g, ' ');
            const catalogMatch = lookupMonsterSizeEntry(mappedQuery) || lookupMonsterSizeEntry(rawQuery);
            monster = db.prepare('SELECT * FROM monsters WHERE LOWER(name) = ? LIMIT 1').get(mappedQuery)
              || (catalogMatch ? db.prepare('SELECT * FROM monsters WHERE id = ? OR LOWER(name) = ? LIMIT 1').get(catalogMatch.id, String(catalogMatch.name).toLowerCase()) : null)
              || db.prepare('SELECT * FROM monsters WHERE LOWER(name) LIKE ? LIMIT 1').get(`%${mappedQuery}%`);
          }
          if (!monster) {
            monster = db.prepare("SELECT * FROM monsters WHERE name IN ('Assassin Vine', 'Ghoul', 'Wolf', 'Manticore', 'Giant Spider', 'Rust Monster') ORDER BY RANDOM() LIMIT 1").get()
              || db.prepare('SELECT * FROM monsters ORDER BY RANDOM() LIMIT 1').get();
          }

          const isAmbushScenario = (effectiveScenario === 'STAGE1_AMBUSH' || effectiveScenario === 'STAGE2_AMBUSH' || effectiveScenario === 'AMBUSH_COMBAT') ? 1 : 0;
          const spottedByHero = isAmbushScenario ? 0 : 1;
          const stateJson = isAmbushScenario ? JSON.stringify({ labForcedAmbush: true }) : '{}';

          const ins = db.prepare(`
            INSERT INTO encounters (
              character_id, tile_id, monster_id, status,
              current_monster_hp, monster_max_hp, combat_round,
              spotted_by_hero, is_ambush, opening_shot_resolved, combat_state_json
            ) VALUES (?, ?, ?, 'DISCOVERED', ?, ?, 0, ?, ?, 0, ?)
          `).run(character.id, tile.id, monster.id, monster.base_hp, monster.base_hp, spottedByHero, isAmbushScenario, stateJson);

          const encId = Number(ins.lastInsertRowid);
          const advState = getOrCreateAdventureState(character.id, tile);
          if (effectiveScenario === 'STAGE2_COMBAT' || effectiveScenario === 'STAGE2_AMBUSH' || effectiveScenario === 'AMBUSH_COMBAT') {
            investigateEncounter(db, character.id, encId, character.class, options.rng ? { rng: options.rng } : {});
            if (isAmbushScenario) {
              db.prepare("UPDATE encounters SET initiative_winner = 'MONSTER', is_ambush = 1, spotted_by_hero = 0 WHERE id = ?").run(encId);
            } else {
              db.prepare("UPDATE encounters SET initiative_winner = 'HERO' WHERE id = ?").run(encId);
            }
            recordEncounterStart(advState, tile, {
              status: 'IN_COMBAT',
              monsterName: monster ? monster.name : 'Hostile Creature'
            });
            return res.json({
              ok: true,
              state: buildClientState(db, userId, {
                infoMessage: isAmbushScenario
                  ? `AMBUSH! ${monster ? monster.name : 'A lurking foe'} lunges from the shadows! Retreat is cut off for the first 2 combat rounds!`
                  : null,
                fxCue: { type: isAmbushScenario ? 'AMBUSH_STARTED' : 'REVEAL_MONSTER' }
              })
            });
          } else if (false) {
            investigateEncounter(db, character.id, encId, character.class, options.rng ? { rng: options.rng } : {});
            db.prepare("UPDATE encounters SET initiative_winner = 'HERO' WHERE id = ?").run(encId);
            recordEncounterStart(advState, tile, {
              status: 'IN_COMBAT',
              monsterName: monster ? monster.name : 'Hostile Creature'
            });
            return res.json({
              ok: true,
              state: buildClientState(db, userId, {
                fxCue: { type: 'REVEAL_MONSTER' }
              })
            });
          }

          recordEncounterStart(advState, tile, {
            status: 'STAGE1_PRE_COMBAT',
            monsterName: null
          });
          return res.json({
            ok: true,
            state: buildClientState(db, userId, {
              fxCue: { type: 'ENCOUNTER_DISCOVERED' }
            })
          });
        }

        if (scenario === 'SWITCH_CLASS') {
          const nextClass = payload.classType || 'FIGHTER';
          db.prepare('UPDATE characters SET is_alive = 0 WHERE id = ?').run(character.id);
          ensureLivingHero(db, userId, nextClass);
          return res.json({
            ok: true,
            state: buildClientState(db, userId, {
              infoMessage: `Switched active test champion to ${nextClass}.`,
              fxCue: { type: 'HEAL' }
            })
          });
        }
      }

  return false;
}

module.exports = {
  handleAdventureScenarioAction
};
