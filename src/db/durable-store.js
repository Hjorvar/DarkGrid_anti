/**
 * Darkgrid Durable Persistence & Cloud Firestore Sync Engine
 *
 * Ensures that the server-side SQLite relational engine (node:sqlite DatabaseSync)
 * has durable, crash-safe persistence across container restarts, scale-to-zero events,
 * and deployments on Cloud Run / Firebase App Hosting, as well as verified JSON/SQLite
 * backup and restore capabilities.
 *
 * Key Guarantees:
 * 1. Never relies on `/tmp/darkgrid.sqlite` alone in production.
 * 2. Monotonic state protection: Stale data can NEVER resurrect a dead character
 *    (is_alive: 0 -> 1), a defeated persistent monster (DEFEATED -> ACTIVE),
 *    a sold market listing (SOLD -> ACTIVE), or a completed bounty (COMPLETED -> ACTIVE).
 * 3. Differential write-through to Cloud Firestore (or durable snapshot file) so
 *    only modified records are written per transaction, keeping cost near 0 ISK/month.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { withTransaction } = require('./connection');
const { logInfo, logError, logSecurity } = require('../utils/logger');

const DYNAMIC_TABLES = [
  'users',
  'characters',
  'monster_instances',
  'item_instances',
  'market_listings',
  'hunting_contracts',
  'encounters',
  'combat_events',
  'user_sessions',
  'action_idempotency_log',
  'world_sync_meta',
  'character_discovered_tiles',
  'character_dungeon_discovered_tiles',
  'character_dungeon_events',
  'character_monster_knowledge',
  'character_quests'
];

function getTableOrderBy(table) {
  switch (table) {
    case 'user_sessions': return 'sid ASC';
    case 'world_sync_meta': return 'key ASC';
    case 'character_discovered_tiles': return 'character_id ASC, y ASC, x ASC';
    case 'character_dungeon_discovered_tiles': return 'character_id ASC, dungeon_key ASC, y ASC, x ASC';
    case 'character_dungeon_events': return 'character_id ASC, dungeon_key ASC, event_key ASC';
    case 'character_monster_knowledge': return 'character_id ASC, monster_id ASC';
    case 'character_quests': return 'character_id ASC, quest_key ASC';
    default: return 'id ASC';
  }
}

function getTableRowPrimaryKey(table, row) {
  switch (table) {
    case 'user_sessions': return String(row.sid);
    case 'world_sync_meta': return String(row.key);
    case 'character_discovered_tiles': return `${row.character_id}_${row.x}_${row.y}`;
    case 'character_dungeon_discovered_tiles': return `${row.character_id}_${row.dungeon_key}_${row.x}_${row.y}`;
    case 'character_dungeon_events': return `${row.character_id}_${row.dungeon_key}_${row.event_key}`;
    case 'character_monster_knowledge': return `${row.character_id}_${row.monster_id}`;
    case 'character_quests': return `${row.character_id}_${row.quest_key}`;
    default: return String(row.id);
  }
}

// Per-database state cache for differential write-through
const lastRowHashesByDb = new WeakMap();

/**
 * Computes deterministic SHA-256 hex digest of an object or string
 */
function sha256(input) {
  const str = typeof input === 'string' ? input : JSON.stringify(input);
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

/**
 * Generates deterministic integer ID from Firebase UID string (matches legacy spark-client mapping)
 */
function uidToNumericId(uid) {
  let hash = 5381;
  for (let i = 0; i < uid.length; i++) {
    hash = ((hash << 5) + hash) + uid.charCodeAt(i);
    hash = hash & 0x7fffffff;
  }
  return Math.max(1, hash);
}

/**
 * Checks if a table exists in the given SQLite database
 */
function tableExists(db, tableName) {
  const row = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName);
  return Boolean(row);
}

/**
 * Exports all dynamic gameplay tables from SQLite into a portable, checksummed snapshot object.
 */
function exportDynamicState(db) {
  const tables = {};

  for (const table of DYNAMIC_TABLES) {
    if (!tableExists(db, table)) {
      tables[table] = [];
      continue;
    }
    const orderBy = getTableOrderBy(table);
    const rows = db.prepare(`SELECT * FROM ${table} ORDER BY ${orderBy}`).all();
    tables[table] = rows.map(r => ({ ...r }));
  }

  const referenceMap = { monsters: {}, items: {}, characterCoords: {} };
  if (tableExists(db, 'monsters')) {
    for (const m of db.prepare('SELECT id, name FROM monsters').all()) {
      referenceMap.monsters[m.id] = m.name;
    }
  }
  if (tableExists(db, 'item_definitions')) {
    for (const item of db.prepare('SELECT id, name FROM item_definitions').all()) {
      referenceMap.items[item.id] = item.name;
    }
  }
  if (tableExists(db, 'characters') && tableExists(db, 'map_tiles')) {
    try {
      const charTiles = db.prepare(`
        SELECT c.id as char_id, m.x, m.y, m.landmark_key
        FROM characters c
        JOIN map_tiles m ON c.tile_id = m.id
      `).all();
      for (const ct of charTiles) {
        referenceMap.characterCoords[ct.char_id] = {
          x: Number(ct.x),
          y: Number(ct.y),
          landmark_key: ct.landmark_key || null
        };
      }
    } catch {
      // Ignore if map_tiles join fails
    }
  }

  let worldVersion = null;
  if (tableExists(db, 'game_config')) {
    try {
      const wvRow = db.prepare("SELECT value FROM game_config WHERE key = 'topdown_world_version'").get();
      if (wvRow && wvRow.value) worldVersion = String(wvRow.value);
    } catch {
      // Ignore if game_config not queryable
    }
  }

  const canonicalPayload = JSON.stringify(tables);
  const checksum = sha256(canonicalPayload);

  return {
    version: '2.0.0-blaze',
    worldVersion,
    exportedAt: new Date().toISOString(),
    projectId: process.env.FIREBASE_PROJECT_ID || 'darkgrid-rpg',
    checksum,
    counts: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length])),
    referenceMap,
    tables
  };
}

/**
 * Verifies the integrity checksum of a snapshot object.
 */
function verifySnapshotIntegrity(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || !snapshot.tables) {
    return { valid: false, reason: 'Snapshot is missing tables payload.' };
  }
  if (!snapshot.checksum) {
    return { valid: false, reason: 'Snapshot is missing SHA-256 checksum.' };
  }
  const expected = sha256(JSON.stringify(snapshot.tables));
  if (expected !== snapshot.checksum) {
    return { valid: false, reason: `Checksum mismatch: expected ${ snapshot.checksum }, got ${ expected }.` };
  }
  return { valid: true };
}

/**
 * Synchronizes sqlite_sequence so subsequent AUTOINCREMENT inserts never collide with imported IDs.
 */
function syncSqliteSequences(db) {
  const autoIncTables = [
    'users',
    'characters',
    'monster_instances',
    'item_instances',
    'market_listings',
    'hunting_contracts',
    'encounters',
    'combat_events',
    'action_idempotency_log'
  ];

  for (const table of autoIncTables) {
    if (!tableExists(db, table)) continue;
    const maxRow = db.prepare(`SELECT MAX(id) as maxId FROM ${table}`).get();
    const maxId = Number(maxRow?.maxId || 0);
    if (maxId > 0) {
      try {
        const exists = db.prepare('SELECT seq FROM sqlite_sequence WHERE name = ?').get(table);
        if (exists) {
          db.prepare('UPDATE sqlite_sequence SET seq = MAX(seq, ?) WHERE name = ?').run(maxId, table);
        } else {
          db.prepare('INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)').run(table, maxId);
        }
      } catch {
        // Ignore if sqlite_sequence not yet initialized
      }
    }
  }
}

function resolveMonsterId(tx, rawId, refMap) {
  const direct = tx.prepare('SELECT id FROM monsters WHERE id = ?').get(rawId);
  if (direct) return direct.id;
  const nameHint = refMap?.monsters?.[rawId];
  if (nameHint) {
    const byName = tx.prepare('SELECT id FROM monsters WHERE name = ?').get(nameHint);
    if (byName) return byName.id;
  }
  const allMonsters = tx.prepare('SELECT id FROM monsters ORDER BY id ASC').all();
  if (allMonsters.length > 0) {
    const idx = Math.abs(Number(rawId || 1) - 1) % allMonsters.length;
    return allMonsters[idx].id;
  }
  return rawId;
}

const LEGACY_15X15_TO_44X30_COORDS = Object.freeze({
  '7,7': { x: 15, y: 27 }, // Oakhaven
  '7,6': { x: 15, y: 26 }, // Oakhaven North Gate
  '8,7': { x: 19, y: 25 }, // The Old Stone Bridge
  '9,7': { x: 21, y: 25 }, // Abandoned Watchpost
  '7,5': { x: 15, y: 23 }, // Blackwood Crossroads
  '7,4': { x: 15, y: 19 }, // Central Trail
  '7,3': { x: 15, y: 15 }, // Ancient Black Oak
  '9,3': { x: 20, y: 9 },  // Old Log Crossing
  '7,2': { x: 15, y: 3 },  // Stronghold Approach
  '7,1': { x: 15, y: 2 }   // Goblin Stronghold
});

function seedInitialDiscoveryAround(tx, characterId, charClass, centerX, centerY, maxX, maxY) {
  if (!tableExists(tx, 'character_discovered_tiles')) return;
  const radius = String(charClass || '').toUpperCase() === 'RANGER' ? 4 : 3;
  const maxDistSq = radius * radius + 1;
  const insertStmt = tx.prepare(`
    INSERT OR IGNORE INTO character_discovered_tiles (character_id, x, y)
    VALUES (?, ?, ?)
  `);
  // Always ensure Oakhaven (15, 27) and North Gate (15, 26) are known
  insertStmt.run(characterId, 15, 27);
  insertStmt.run(characterId, 15, 26);

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > maxDistSq) continue;
      const txCoord = centerX + dx;
      const tyCoord = centerY + dy;
      if (txCoord >= 0 && txCoord <= maxX && tyCoord >= 0 && tyCoord <= maxY) {
        insertStmt.run(characterId, txCoord, tyCoord);
      }
    }
  }
}

/**
 * Safely migrates character tile_id across world grid sizes (15x15 -> 30x30 -> 44x30)
 * using snapshot worldVersion, tile coordinates, passability, and character discovery state.
 * Never remaps legitimate 44x30 positions merely because they share a numeric ID with older maps.
 */
function migrateImportedCharacterTiles(tx, snapshot) {
  if (!tableExists(tx, 'map_tiles') || !tableExists(tx, 'characters')) return;

  const mapStats = tx.prepare('SELECT MAX(x) as maxX, MAX(y) as maxY, COUNT(*) as total FROM map_tiles').get();
  // Only run 44x30 migration when the target DB actually has the 44x30 world loaded (1320 tiles)
  if (!mapStats || Number(mapStats.total) < 1000 || Number(mapStats.maxX) < 40) {
    return;
  }

  const oakhavenTile = tx.prepare('SELECT * FROM map_tiles WHERE x = 15 AND y = 27').get();
  if (!oakhavenTile) return;

  const metaWorldVersion = (snapshot.tables?.world_sync_meta || []).find(
    r => r && (r.key === 'topdown_world_version' || r.key === 'world_version')
  )?.value || null;
  const snapshotWorldVersion = snapshot.worldVersion || metaWorldVersion || null;
  const isSnapshot44x30 = snapshotWorldVersion === 'PHASE_9C_DUNGEONS_AND_HIGHLANDS';

  const importedChars = Array.isArray(snapshot.tables?.characters) ? snapshot.tables.characters : [];
  for (const ch of importedChars) {
    const charRow = tx.prepare('SELECT * FROM characters WHERE id = ?').get(ch.id);
    if (!charRow) continue;

    const discRows = tableExists(tx, 'character_discovered_tiles')
      ? tx.prepare('SELECT x, y FROM character_discovered_tiles WHERE character_id = ?').all(charRow.id)
      : [];
    const discSet = new Set(discRows.map(r => `${r.x},${r.y}`));
    const currentTile = tx.prepare('SELECT * FROM map_tiles WHERE id = ?').get(charRow.tile_id);

    const isCurrentTileValidAndDiscovered = Boolean(
      currentTile &&
      Number(currentTile.is_passable) === 1 &&
      discRows.length > 0 &&
      discSet.has(`${currentTile.x},${currentTile.y}`)
    );

    // If the snapshot is already from the 44x30 world (or the character has discovered this exact 44x30 passable tile
    // and is not explicitly marked as an older world version), preserve their exact tile_id untouched!
    if (
      isCurrentTileValidAndDiscovered &&
      snapshotWorldVersion !== '15X15' &&
      snapshotWorldVersion !== 'PHASE_8_30X30' &&
      snapshotWorldVersion !== 'PHASE_9A_THREAT_AND_LANDMARKS' &&
      snapshotWorldVersion !== 'PHASE_9B_UNDEAD_LANDS'
    ) {
      continue;
    }

    let targetCoord = null;
    const rawTileId = Number(charRow.tile_id || 0);

    // Case 1: Legacy 15x15 character (0 discovered tiles in 44x30 or explicit 15X15 version, tile_id in 1..225)
    if ((discRows.length === 0 || snapshotWorldVersion === '15X15') && rawTileId >= 1 && rawTileId <= 225) {
      const old15X = (rawTileId - 1) % 15;
      const old15Y = Math.floor((rawTileId - 1) / 15);
      targetCoord = LEGACY_15X15_TO_44X30_COORDS[`${old15X},${old15Y}`] || { x: 15, y: 27 };
    }

    // Case 2: 30x30 world character (tile_id in 226..1125 with offset 226, or 1..900 with offset 1)
    if (!targetCoord && !isSnapshot44x30) {
      const candidates30x30 = [];
      if (rawTileId >= 226 && rawTileId <= 1125) {
        const idxA = rawTileId - 226;
        candidates30x30.push({ x: idxA % 30, y: Math.floor(idxA / 30) });
      }
      if (rawTileId >= 1 && rawTileId <= 900) {
        const idxB = rawTileId - 1;
        candidates30x30.push({ x: idxB % 30, y: Math.floor(idxB / 30) });
      }
      for (const cand of candidates30x30) {
        if (discSet.has(`${cand.x},${cand.y}`) || (cand.x === 15 && cand.y === 27)) {
          const candTile = tx.prepare('SELECT * FROM map_tiles WHERE x = ? AND y = ?').get(cand.x, cand.y);
          if (candTile && Number(candTile.is_passable) === 1) {
            targetCoord = cand;
            break;
          }
        }
      }
    }

    // Case 2b: If snapshot referenceMap carries explicit characterCoords (from a DB with shifted autoincrement IDs)
    if (!targetCoord && snapshot.referenceMap?.characterCoords?.[charRow.id]) {
      const refCoord = snapshot.referenceMap.characterCoords[charRow.id];
      if (refCoord && refCoord.x !== undefined && refCoord.y !== undefined) {
        const candTile = tx.prepare('SELECT * FROM map_tiles WHERE x = ? AND y = ?').get(refCoord.x, refCoord.y);
        if (candTile && Number(candTile.is_passable) === 1) {
          targetCoord = { x: Number(refCoord.x), y: Number(refCoord.y) };
        }
      }
    }

    // Case 3: If currentTile is valid and passable in 44x30 and no 15x15/30x30 remap matched, keep currentTile
    if (!targetCoord) {
      if (currentTile && Number(currentTile.is_passable) === 1 && isCurrentTileValidAndDiscovered) {
        continue;
      }
      targetCoord = { x: 15, y: 27 };
    }

    const targetTile =
      tx.prepare('SELECT * FROM map_tiles WHERE x = ? AND y = ?').get(targetCoord.x, targetCoord.y) ||
      oakhavenTile;

    if (targetTile && Number(targetTile.id) !== Number(charRow.tile_id)) {
      tx.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(targetTile.id, charRow.id);
      if (tableExists(tx, 'encounters')) {
        tx.prepare(`
          UPDATE encounters
          SET tile_id = ?
          WHERE character_id = ? AND status IN ('INVESTIGATING', 'IN_COMBAT')
        `).run(targetTile.id, charRow.id);
      }
    }

    if (Number(charRow.is_alive) === 1 && targetTile) {
      seedInitialDiscoveryAround(
        tx,
        charRow.id,
        charRow.class,
        Number(targetTile.x),
        Number(targetTile.y),
        Number(mapStats.maxX),
        Number(mapStats.maxY)
      );
    }
  }
}

function resolveItemDefId(tx, rawId, refMap) {
  const direct = tx.prepare('SELECT id FROM item_definitions WHERE id = ?').get(rawId);
  if (direct) return direct.id;
  const nameHint = refMap?.items?.[rawId];
  if (nameHint) {
    const byName = tx.prepare('SELECT id FROM item_definitions WHERE name = ?').get(nameHint);
    if (byName) return byName.id;
  }
  const allItems = tx.prepare('SELECT id FROM item_definitions ORDER BY id ASC').all();
  if (allItems.length > 0) {
    const idx = Math.abs(Number(rawId || 1) - 1) % allItems.length;
    return allItems[idx].id;
  }
  return rawId;
}

/**
 * Imports a dynamic state snapshot into SQLite atomically while strictly enforcing
 * monotonic state rules (dead characters stay dead, defeated persistent monsters stay defeated,
 * sold market items stay sold, completed bounties stay completed).
 */
function importDynamicState(db, snapshot, options = {}) {
  const verification = verifySnapshotIntegrity(snapshot);
  if (!verification.valid && !options.skipChecksum) {
    throw new Error(`Cannot import corrupted snapshot: ${verification.reason}`);
  }

  const t = snapshot.tables || {};
  const refMap = snapshot.referenceMap || {};

  withTransaction(db, (tx) => {
    // 1. Users
    if (Array.isArray(t.users)) {
      const hasFirebaseUidCol = Boolean(
        tx.prepare("SELECT 1 FROM pragma_table_info('users') WHERE name = 'firebase_uid'").get()
      );
      for (const u of t.users) {
        const existingById = tx.prepare('SELECT * FROM users WHERE id = ?').get(u.id);
        const existingByName = tx.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(u.username);
        if (!existingById && !existingByName) {
          if (hasFirebaseUidCol) {
            tx.prepare(`
              INSERT INTO users (id, username, password_hash, firebase_uid, created_at)
              VALUES (?, ?, ?, ?, ?)
            `).run(u.id, u.username, u.password_hash || 'firebase-auth', u.firebase_uid || null, u.created_at || new Date().toISOString());
          } else {
            tx.prepare(`
              INSERT INTO users (id, username, password_hash, created_at)
              VALUES (?, ?, ?, ?)
            `).run(u.id, u.username, u.password_hash || 'firebase-auth', u.created_at || new Date().toISOString());
          }
        } else if (existingById) {
          // Preserve upgraded bcrypt hash if existing row already has one
          const keepHash = (existingById.password_hash && existingById.password_hash.startsWith('$2'))
            ? existingById.password_hash
            : (u.password_hash || existingById.password_hash);
          if (hasFirebaseUidCol) {
            tx.prepare(`
              UPDATE users SET username = ?, password_hash = ?, firebase_uid = COALESCE(?, firebase_uid)
              WHERE id = ?
            `).run(u.username, keepHash, u.firebase_uid || null, u.id);
          } else {
            tx.prepare('UPDATE users SET username = ?, password_hash = ? WHERE id = ?').run(u.username, keepHash, u.id);
          }
        }
      }
    }

    // 2. Monster Instances (Monotonic: DEFEATED can never revert to ACTIVE)
    if (Array.isArray(t.monster_instances)) {
      for (const mi of t.monster_instances) {
        const resolvedMonsterId = resolveMonsterId(tx, mi.monster_id, refMap);
        const existing = tx.prepare('SELECT * FROM monster_instances WHERE id = ?').get(mi.id);
        if (!existing) {
          tx.prepare(`
            INSERT INTO monster_instances (
              id, monster_id, tile_id, current_hp, max_hp, held_gold, kill_count, custom_title, status, created_at, defeated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            mi.id,
            resolvedMonsterId,
            mi.tile_id,
            mi.current_hp,
            mi.max_hp,
            mi.held_gold || 0,
            mi.kill_count || 1,
            mi.custom_title || null,
            mi.status || 'ACTIVE',
            mi.created_at || new Date().toISOString(),
            mi.defeated_at || null
          );
        } else {
          // If already DEFEATED in DB, never resurrect to ACTIVE!
          const effectiveStatus = existing.status === 'DEFEATED' ? 'DEFEATED' : (mi.status || existing.status);
          const effectiveGold = effectiveStatus === 'DEFEATED' ? 0 : (mi.held_gold ?? existing.held_gold);
          const effectiveDefeatedAt = existing.defeated_at || mi.defeated_at || null;
          tx.prepare(`
            UPDATE monster_instances
            SET current_hp = ?, max_hp = ?, held_gold = ?, kill_count = MAX(kill_count, ?),
                custom_title = COALESCE(?, custom_title), status = ?, defeated_at = ?
            WHERE id = ?
          `).run(
            mi.current_hp ?? existing.current_hp,
            mi.max_hp ?? existing.max_hp,
            effectiveGold,
            mi.kill_count || 1,
            mi.custom_title || null,
            effectiveStatus,
            effectiveDefeatedAt,
            mi.id
          );
        }
      }
    }

    // 3. Characters (Monotonic: is_alive = 0 can never revert to is_alive = 1)
    if (Array.isArray(t.characters)) {
      for (const ch of t.characters) {
        const existing = tx.prepare('SELECT * FROM characters WHERE id = ?').get(ch.id);
        if (!existing) {
          tx.prepare(`
            INSERT INTO characters (
              id, user_id, name, class, is_alive, level, xp, gold,
              strength, constitution, dexterity, intelligence, wisdom, charisma,
              current_hp, max_hp, tile_id, killed_by_monster_instance_id,
              favored_enemy_type, favored_enemy_subtype, cleric_heal_uses, primary_weapon,
              created_at, died_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            ch.id,
            ch.user_id,
            ch.name,
            ch.class,
            ch.is_alive ?? 1,
            ch.level ?? 1,
            ch.xp ?? 0,
            ch.gold ?? 0,
            ch.strength ?? 10,
            ch.constitution ?? 10,
            ch.dexterity ?? 10,
            ch.intelligence ?? 10,
            ch.wisdom ?? 10,
            ch.charisma ?? 10,
            ch.current_hp ?? 10,
            ch.max_hp ?? 10,
            ch.tile_id ?? 113,
            ch.killed_by_monster_instance_id || null,
            ch.favored_enemy_type || null,
            ch.favored_enemy_subtype || null,
            ch.cleric_heal_uses ?? 0,
            ch.primary_weapon || 'MELEE',
            ch.created_at || new Date().toISOString(),
            ch.died_at || null
          );
        } else {
          const effectiveAlive = existing.is_alive === 0 ? 0 : (ch.is_alive ?? existing.is_alive);
          const effectiveHp = effectiveAlive === 0 ? 0 : (ch.current_hp ?? existing.current_hp);
          const effectiveDiedAt = existing.died_at || ch.died_at || null;
          tx.prepare(`
            UPDATE characters
            SET name = ?, class = ?, is_alive = ?, level = ?, xp = ?, gold = ?,
                strength = ?, constitution = ?, dexterity = ?, intelligence = ?, wisdom = ?, charisma = ?,
                current_hp = ?, max_hp = ?, tile_id = ?, killed_by_monster_instance_id = COALESCE(?, killed_by_monster_instance_id),
                favored_enemy_type = ?, favored_enemy_subtype = ?, cleric_heal_uses = ?, primary_weapon = ?,
                died_at = ?
            WHERE id = ?
          `).run(
            ch.name,
            ch.class,
            effectiveAlive,
            ch.level ?? existing.level,
            ch.xp ?? existing.xp,
            ch.gold ?? existing.gold,
            ch.strength ?? existing.strength,
            ch.constitution ?? existing.constitution,
            ch.dexterity ?? existing.dexterity,
            ch.intelligence ?? existing.intelligence,
            ch.wisdom ?? existing.wisdom,
            ch.charisma ?? existing.charisma,
            effectiveHp,
            ch.max_hp ?? existing.max_hp,
            ch.tile_id ?? existing.tile_id,
            ch.killed_by_monster_instance_id || null,
            ch.favored_enemy_type || null,
            ch.favored_enemy_subtype || null,
            ch.cleric_heal_uses ?? existing.cleric_heal_uses,
            ch.primary_weapon || existing.primary_weapon || 'MELEE',
            effectiveDiedAt,
            ch.id
          );
        }

        const charCols = new Set(tx.prepare("PRAGMA table_info('characters')").all().map(c => c.name));
        const extendedCols = [
          'facing', 'pending_victory_encounter_id', 'scene_mode', 'attribute_points',
          'initial_attributes_json', 'favored_enemy_family', 'divine_charges',
          'quest_goblin_chieftain_status', 'goblin_chieftain_slain',
          'quest_ancient_crypt_status', 'ancient_crypt_boss_slain',
          'quest_ravencrag_warlord_status', 'ravencrag_warlord_slain',
          'active_landmark_scene_key', 'dismissed_landmark_tile_id',
          'active_dungeon_key', 'dungeon_x', 'dungeon_y'
        ].filter(col => charCols.has(col) && ch[col] !== undefined);
        if (extendedCols.length > 0) {
          const setClause = extendedCols.map(col => `${col} = ?`).join(', ');
          const values = extendedCols.map(col => ch[col]);
          tx.prepare(`UPDATE characters SET ${setClause} WHERE id = ?`).run(...values, ch.id);
        }
      }
    }

    // 4. Item Instances
    if (Array.isArray(t.item_instances)) {
      if (options.replaceItems) {
        tx.prepare('DELETE FROM item_instances').run();
      }
      for (const ii of t.item_instances) {
        const resolvedItemDefId = resolveItemDefId(tx, ii.item_definition_id, refMap);
        const existing = tx.prepare('SELECT * FROM item_instances WHERE id = ?').get(ii.id);
        if (!existing) {
          tx.prepare(`
            INSERT INTO item_instances (
              id, item_definition_id, owner_type, owner_character_id, owner_monster_id, equipped_slot, modifications, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            ii.id,
            resolvedItemDefId,
            ii.owner_type,
            ii.owner_character_id || null,
            ii.owner_monster_id || null,
            ii.equipped_slot || null,
            ii.modifications || '{}',
            ii.created_at || new Date().toISOString()
          );
        } else {
          tx.prepare(`
            UPDATE item_instances
            SET item_definition_id = ?, owner_type = ?, owner_character_id = ?, owner_monster_id = ?,
                equipped_slot = ?, modifications = ?
            WHERE id = ?
          `).run(
            resolvedItemDefId,
            ii.owner_type,
            ii.owner_character_id || null,
            ii.owner_monster_id || null,
            ii.equipped_slot || null,
            ii.modifications || '{}',
            ii.id
          );
        }
      }
    }

    // 5. Market Listings (Monotonic: SOLD/CANCELLED never reverts to ACTIVE)
    if (Array.isArray(t.market_listings)) {
      for (const ml of t.market_listings) {
        const existing = tx.prepare('SELECT * FROM market_listings WHERE id = ?').get(ml.id);
        if (!existing) {
          tx.prepare(`
            INSERT INTO market_listings (
              id, item_instance_id, seller_character_id, buyer_character_id, price, status, created_at, completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            ml.id,
            ml.item_instance_id,
            ml.seller_character_id || null,
            ml.buyer_character_id || null,
            ml.price,
            ml.status || 'ACTIVE',
            ml.created_at || new Date().toISOString(),
            ml.completed_at || null
          );
        } else {
          const isAlreadyClosed = existing.status === 'SOLD' || existing.status === 'CANCELLED';
          const effectiveStatus = isAlreadyClosed ? existing.status : (ml.status || existing.status);
          const effectiveBuyer = existing.buyer_character_id || ml.buyer_character_id || null;
          const effectiveCompleted = existing.completed_at || ml.completed_at || null;
          tx.prepare(`
            UPDATE market_listings
            SET buyer_character_id = ?, price = ?, status = ?, completed_at = ?
            WHERE id = ?
          `).run(effectiveBuyer, ml.price ?? existing.price, effectiveStatus, effectiveCompleted, ml.id);
        }
      }
    }

    // 6. Hunting Contracts (Monotonic: COMPLETED/ABANDONED/FAILED never reverts to ACTIVE/AVAILABLE/READY_TO_CLAIM)
    if (Array.isArray(t.hunting_contracts) && tableExists(tx, 'hunting_contracts')) {
      for (const hc of t.hunting_contracts) {
        const resolvedBaseMonsterId = resolveMonsterId(tx, hc.base_monster_id, refMap);
        const existing = tx.prepare('SELECT * FROM hunting_contracts WHERE id = ?').get(hc.id);
        if (!existing) {
          tx.prepare(`
            INSERT INTO hunting_contracts (
              id, character_id, base_monster_id, custom_name, title, description,
              region_name, target_terrain, threat_label, boost_type, boost_label,
              boosted_max_hp, attack_bonus_mod, damage_bonus_mod, reward_gold,
              status, created_at_level, created_at_encounters, created_at, completed_at, claimed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            hc.id,
            hc.character_id,
            resolvedBaseMonsterId,
            hc.custom_name,
            hc.title,
            hc.description,
            hc.region_name,
            hc.target_terrain,
            hc.threat_label || 'Dangerous',
            hc.boost_type,
            hc.boost_label,
            hc.boosted_max_hp,
            hc.attack_bonus_mod || 0,
            hc.damage_bonus_mod || 0,
            hc.reward_gold,
            hc.status || 'AVAILABLE',
            hc.created_at_level || 1,
            hc.created_at_encounters || 0,
            hc.created_at || new Date().toISOString(),
            hc.completed_at || null,
            hc.claimed_at || null
          );
        } else {
          const isTerminal = ['COMPLETED', 'ABANDONED', 'FAILED'].includes(existing.status);
          const effectiveStatus = isTerminal ? existing.status : (hc.status || existing.status);
          tx.prepare(`
            UPDATE hunting_contracts
            SET status = ?, completed_at = COALESCE(?, completed_at), claimed_at = COALESCE(?, claimed_at)
            WHERE id = ?
          `).run(effectiveStatus, hc.completed_at || null, hc.claimed_at || null, hc.id);
        }
      }
    }

    // 7. Encounters
    if (Array.isArray(t.encounters)) {
      for (const e of t.encounters) {
        const resolvedMonsterId = resolveMonsterId(tx, e.monster_id, refMap);
        const existing = tx.prepare('SELECT * FROM encounters WHERE id = ?').get(e.id);
        if (!existing) {
          tx.prepare(`
            INSERT INTO encounters (
              id, character_id, tile_id, monster_id, monster_instance_id, bounty_contract_id,
              status, current_monster_hp, monster_max_hp, combat_round,
              initiative_winner, hero_initiative, monster_initiative,
              last_health_bracket, spotted_by_hero, is_ambush, opening_shot_resolved,
              combat_state_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            e.id,
            e.character_id,
            e.tile_id,
            resolvedMonsterId,
            e.monster_instance_id || null,
            e.bounty_contract_id || null,
            e.status,
            e.current_monster_hp ?? 10,
            e.monster_max_hp ?? e.current_monster_hp ?? 10,
            e.combat_round ?? 0,
            e.initiative_winner || null,
            e.hero_initiative ?? null,
            e.monster_initiative ?? null,
            e.last_health_bracket ?? 100,
            e.spotted_by_hero ?? 1,
            e.is_ambush ?? 0,
            e.opening_shot_resolved ?? 0,
            e.combat_state_json || '{}',
            e.created_at || new Date().toISOString(),
            e.updated_at || new Date().toISOString()
          );
        } else {
          tx.prepare(`
            UPDATE encounters
            SET status = ?, current_monster_hp = ?, monster_max_hp = ?, combat_round = ?,
                initiative_winner = ?, hero_initiative = ?, monster_initiative = ?,
                last_health_bracket = ?, spotted_by_hero = ?, is_ambush = ?,
                opening_shot_resolved = ?, combat_state_json = ?, updated_at = ?
            WHERE id = ?
          `).run(
            e.status,
            e.current_monster_hp ?? existing.current_monster_hp,
            e.monster_max_hp ?? existing.monster_max_hp,
            e.combat_round ?? existing.combat_round,
            e.initiative_winner || existing.initiative_winner,
            e.hero_initiative ?? existing.hero_initiative,
            e.monster_initiative ?? existing.monster_initiative,
            e.last_health_bracket ?? existing.last_health_bracket,
            e.spotted_by_hero ?? existing.spotted_by_hero,
            e.is_ambush ?? existing.is_ambush,
            e.opening_shot_resolved ?? existing.opening_shot_resolved,
            e.combat_state_json || existing.combat_state_json || '{}',
            e.updated_at || new Date().toISOString(),
            e.id
          );
        }
      }
    }

    // 8. Combat Events
    if (Array.isArray(t.combat_events)) {
      for (const ce of t.combat_events) {
        tx.prepare(`
          INSERT OR IGNORE INTO combat_events (
            id, encounter_id, round_number, event_type, public_text, details, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          ce.id,
          ce.encounter_id,
          ce.round_number ?? 1,
          ce.event_type,
          ce.public_text,
          ce.details || '{}',
          ce.created_at || new Date().toISOString()
        );
      }
    }

    // 9. User Sessions
    if (Array.isArray(t.user_sessions) && tableExists(tx, 'user_sessions')) {
      for (const s of t.user_sessions) {
        tx.prepare(`
          INSERT OR REPLACE INTO user_sessions (sid, user_id, sess, expire, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(s.sid, s.user_id || null, s.sess, s.expire, s.updated_at || new Date().toISOString());
      }
    }

    // 10. Action Idempotency Log
    if (Array.isArray(t.action_idempotency_log) && tableExists(tx, 'action_idempotency_log')) {
      for (const il of t.action_idempotency_log) {
        tx.prepare(`
          INSERT OR IGNORE INTO action_idempotency_log (
            id, user_id, idempotency_key, method, path, status_code, redirect_url, response_body, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          il.id,
          il.user_id,
          il.idempotency_key,
          il.method,
          il.path,
          il.status_code,
          il.redirect_url || null,
          il.response_body || null,
          il.created_at
        );
      }
    }

    // 11. Extended Discovery, Dungeon & Quest Tables
    const extendedTables = [
      'character_discovered_tiles',
      'character_dungeon_discovered_tiles',
      'character_dungeon_events',
      'character_monster_knowledge',
      'character_quests'
    ];
    for (const extTable of extendedTables) {
      if (Array.isArray(t[extTable]) && tableExists(tx, extTable)) {
        const schemaCols = tx.prepare(`PRAGMA table_info('${extTable}')`).all().map(c => c.name);
        for (const r of t[extTable]) {
          const validCols = schemaCols.filter(col => r[col] !== undefined);
          if (validCols.length > 0) {
            const placeholders = validCols.map(() => '?').join(', ');
            const vals = validCols.map(col => r[col]);
            tx.prepare(`INSERT OR REPLACE INTO ${extTable} (${validCols.join(', ')}) VALUES (${placeholders})`).run(...vals);
          }
        }
      }
    }

    // 12. Migrate any legacy 15x15 (tile_id=113) or 30x30 (tile_id=1051) character coordinates safely to 44x30 (tile_id=1429)
    migrateImportedCharacterTiles(tx, snapshot);

    syncSqliteSequences(tx);
  });

  // Prime differential hash cache
  primeRowHashCache(db);
  return { imported: true, counts: snapshot.counts };
}

/**
 * Saves an atomic JSON snapshot checkpoint to disk (writes to .tmp then renames).
 */
function saveSnapshotToFile(db, filePath) {
  const snapshot = exportDynamicState(db);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(snapshot, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
  return snapshot;
}

/**
 * Restores dynamic state from a JSON snapshot file on disk into SQLite.
 */
function restoreSnapshotFromFile(db, filePath, options = {}) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Snapshot file not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const snapshot = JSON.parse(raw);
  return importDynamicState(db, snapshot, options);
}

/**
 * Tracks row-level hashes in memory so we can compute minimal diffs per request
 */
function computeTableRowMap(db) {
  const map = new Map();
  for (const table of DYNAMIC_TABLES) {
    if (!tableExists(db, table)) continue;
    const rows = db.prepare(`SELECT * FROM ${table}`).all();
    const tableMap = new Map();
    for (const r of rows) {
      const key = getTableRowPrimaryKey(table, r);
      tableMap.set(key, { row: { ...r }, hash: sha256(r) });
    }
    map.set(table, tableMap);
  }
  return map;
}

function primeRowHashCache(db) {
  lastRowHashesByDb.set(db, computeTableRowMap(db));
}

/**
 * Computes changed (upserted) and deleted rows since last prime/sync for differential persistence
 */
function computeDirtyDelta(db) {
  const previous = lastRowHashesByDb.get(db) || new Map();
  const current = computeTableRowMap(db);
  const upserts = {};
  const deletes = {};
  let totalChanges = 0;

  for (const table of DYNAMIC_TABLES) {
    const prevTable = previous.get(table) || new Map();
    const currTable = current.get(table) || new Map();
    const tableUpserts = [];
    const tableDeletes = [];

    for (const [pk, entry] of currTable.entries()) {
      const prevEntry = prevTable.get(pk);
      if (!prevEntry || prevEntry.hash !== entry.hash) {
        tableUpserts.push(entry.row);
        totalChanges++;
      }
    }

    for (const pk of prevTable.keys()) {
      if (!currTable.has(pk)) {
        tableDeletes.push(pk);
        totalChanges++;
      }
    }

    if (tableUpserts.length > 0) upserts[table] = tableUpserts;
    if (tableDeletes.length > 0) deletes[table] = tableDeletes;
  }

  lastRowHashesByDb.set(db, current);
  return { totalChanges, upserts, deletes };
}

/**
 * Converts a plain JS value to Firestore REST API Value format
 */
function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

/**
 * Converts a Firestore REST API Document into a plain JS object
 */
function fromFirestoreValue(v) {
  if (!v || typeof v !== 'object') return null;
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return Boolean(v.booleanValue);
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('stringValue' in v) return String(v.stringValue);
  if ('timestampValue' in v) return String(v.timestampValue);
  if ('arrayValue' in v) {
    return (v.arrayValue.values || []).map(fromFirestoreValue);
  }
  if ('mapValue' in v) {
    const obj = {};
    for (const [k, subVal] of Object.entries(v.mapValue.fields || {})) {
      obj[k] = fromFirestoreValue(subVal);
    }
    return obj;
  }
  return null;
}

function docToObject(doc) {
  if (!doc || !doc.fields) return null;
  const obj = {};
  for (const [k, v] of Object.entries(doc.fields)) {
    obj[k] = fromFirestoreValue(v);
  }
  return obj;
}

function isFirebaseTokenConfigValid(cfg, minValidityMs = 30000) {
  const token = cfg?.tokens?.access_token;
  if (!token || typeof token !== 'string') return false;
  const expiresAt = Number(cfg?.tokens?.expires_at || 0);
  if (expiresAt > 0 && expiresAt <= Date.now() + minValidityMs) {
    return false;
  }
  return true;
}

/**
 * Acquires a Google Cloud access token for server-side Firestore REST calls.
 * Supports:
 * 1. Explicit options.accessToken / options.token or env var GOOGLE_OAUTH_ACCESS_TOKEN
 * 2. Cloud Run / GCE Metadata Server (automatic in Cloud Run / App Hosting)
 * 3. Local Firebase CLI configstore token with expiry validation and automatic CLI refresh
 *
 * Never logs or exposes raw access_token or refresh_token values.
 */
async function getServerAccessToken(options = {}) {
  if (options.accessToken || options.token) {
    return options.accessToken || options.token;
  }
  if (process.env.GOOGLE_OAUTH_ACCESS_TOKEN) {
    return process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
  }

  const fetchImpl = options.fetchFn || global.fetch;

  // Try Cloud Run / GCE metadata server unless explicitly skipped in local unit tests
  if (!options.skipMetadataServer && typeof fetchImpl === 'function') {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1200);
      const res = await fetchImpl(
        'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
        {
          headers: { 'Metadata-Flavor': 'Google' },
          signal: controller.signal
        }
      );
      clearTimeout(timer);
      if (res && res.ok) {
        const data = await res.json();
        if (data && data.access_token) return data.access_token;
      }
    } catch {
      // Not running on GCP metadata environment
    }
  }

  // Fallback to local Firebase CLI token if available
  const homeDir = process.env.USERPROFILE || process.env.HOME || '';
  const fbCfgPath = options.firebaseConfigPath || (homeDir ? path.join(homeDir, '.config/configstore/firebase-tools.json') : '');
  if (fbCfgPath && fs.existsSync(fbCfgPath)) {
    let cfg = null;
    try {
      cfg = JSON.parse(fs.readFileSync(fbCfgPath, 'utf8'));
    } catch {
      cfg = null;
    }

    if (isFirebaseTokenConfigValid(cfg)) {
      return cfg.tokens.access_token;
    }

    // Token is expired or missing access_token: attempt supported Firebase CLI refresh if refresh_token is present
    const hasRefreshToken = Boolean(cfg?.tokens?.refresh_token);
    if (hasRefreshToken && options.allowCliRefresh !== false) {
      try {
        if (typeof options.refreshCliTokenFn === 'function') {
          await options.refreshCliTokenFn(fbCfgPath);
        } else {
          const { execSync } = require('child_process');
          execSync('npx firebase-tools projects:list --json', {
            stdio: 'ignore',
            timeout: 25000
          });
        }
        const refreshedCfg = JSON.parse(fs.readFileSync(fbCfgPath, 'utf8'));
        if (isFirebaseTokenConfigValid(refreshedCfg, 0)) {
          return refreshedCfg.tokens.access_token;
        }
      } catch {
        // Refresh failed; fall through to expired handling
      }
    }

    if (options.throwOnExpired) {
      const err = new Error(
        'Firebase CLI OAuth access_token is expired or invalid and automatic refresh did not succeed. Please run `npx firebase-tools login --reauth`.'
      );
      err.code = 'OAUTH_TOKEN_EXPIRED';
      err.status = 401;
      throw err;
    }
    return null;
  }

  if (options.throwOnExpired) {
    const err = new Error('No Google Cloud / Firebase OAuth credentials found. Please run `npx firebase-tools login`.');
    err.code = 'NO_OAUTH_TOKEN';
    err.status = 401;
    throw err;
  }

  return null;
}

let firestoreWriteDay = new Date().toISOString().slice(0, 10);
let firestoreDailyWrites = 0;

/**
 * Pushes dirty SQLite rows to Cloud Firestore using the atomic `:commit` batch API.
 * Enforces a runaway-loop safety cap (default 250,000 writes/day) aligned with the $25/month budget.
 */
async function pushDeltaToFirestoreServer(db, options = {}) {
  const delta = computeDirtyDelta(db);
  if (delta.totalChanges === 0 && !options.forceFull) {
    return { synced: true, changes: 0 };
  }

  // Always update local snapshot file if configured
  if (options.snapshotFilePath) {
    saveSnapshotToFile(db, options.snapshotFilePath);
  }

  const today = new Date().toISOString().slice(0, 10);
  if (today !== firestoreWriteDay) {
    firestoreWriteDay = today;
    firestoreDailyWrites = 0;
  }

  const maxDailyWrites = parseInt(process.env.MAX_DAILY_FIRESTORE_WRITES || '250000', 10);
  if (!options.forceFull && firestoreDailyWrites >= maxDailyWrites) {
    logError('FIRESTORE_DAILY_CAP_REACHED', `Runaway daily Firestore write cap (${maxDailyWrites}) reached; pausing remote sync to protect $25 monthly budget.`, {
      firestoreDailyWrites,
      maxDailyWrites
    });
    return { synced: false, reason: 'daily_write_cap_reached', changes: delta.totalChanges };
  }

  const token = options.accessToken || options.token || await getServerAccessToken();
  if (!token) {
    return { synced: false, reason: 'no_access_token', changes: delta.totalChanges };
  }

  const projectId = options.projectId || process.env.FIREBASE_PROJECT_ID || 'darkgrid-rpg';
  const dbPath = `projects/${projectId}/databases/(default)/documents`;
  const writes = [];

  for (const [table, rows] of Object.entries(delta.upserts)) {
    for (const row of rows) {
      const docId = encodeURIComponent(getTableRowPrimaryKey(table, row));
      const fields = {};
      for (const [k, v] of Object.entries(row)) {
        fields[k] = toFirestoreValue(v);
      }
      writes.push({
        update: {
          name: `${dbPath}/server_${table}/${docId}`,
          fields
        }
      });
    }
  }

  for (const [table, pks] of Object.entries(delta.deletes)) {
    for (const pk of pks) {
      const docId = encodeURIComponent(String(pk));
      writes.push({
        delete: `${dbPath}/server_${table}/${docId}`
      });
    }
  }

  // Batch in chunks of 400 (Firestore limit is 500 writes per commit)
  for (let i = 0; i < writes.length; i += 400) {
    const chunk = writes.slice(i, i + 400);
    const res = await fetch(`https://firestore.googleapis.com/v1/${dbPath}:commit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ writes: chunk })
    });
    if (!res.ok) {
      const errText = await res.text();
      logError('FIRESTORE_SYNC_ERROR', `Failed to commit delta batch (${res.status})`, new Error(errText));
      return { synced: false, status: res.status, changes: delta.totalChanges };
    }
    firestoreDailyWrites += chunk.length;
  }

  return { synced: true, changes: delta.totalChanges, writes: writes.length };
}

/**
 * Hydrates SQLite on server startup from Cloud Firestore (`server_*` collections + legacy collections)
 */
async function pullFromFirestoreServer(db, options = {}) {
  const token = options.accessToken || await getServerAccessToken(options);
  if (!token) {
    return { hydrated: false, reason: 'no_access_token' };
  }

  const fetchImpl = options.fetchFn || global.fetch;
  const projectId = options.projectId || process.env.FIREBASE_PROJECT_ID || 'darkgrid-rpg';
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

  const tables = {};
  for (const table of DYNAMIC_TABLES) {
    const res = await fetchImpl(`${baseUrl}/server_${table}?pageSize=1000`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.status === 401 || res.status === 403) {
      const err = new Error(`Firestore hydration rejected with HTTP ${res.status} on server_${table}.`);
      err.status = res.status;
      err.code = res.status === 401 ? 'FIRESTORE_UNAUTHENTICATED' : 'FIRESTORE_PERMISSION_DENIED';
      if (options.strictAuth) throw err;
      return { hydrated: false, reason: err.code, status: res.status };
    }
    if (res.ok) {
      const data = await res.json();
      tables[table] = (data.documents || []).map(docToObject).filter(Boolean);
    } else {
      tables[table] = [];
    }
  }

  // Also check legacy `users` collection so any existing Spark-era accounts are automatically imported
  const legacyUsersRes = await fetchImpl(`${baseUrl}/users?pageSize=500`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (legacyUsersRes.ok) {
    const legacyUsersData = await legacyUsersRes.json();
    const existingUids = new Set((tables.users || []).map(u => u.firebase_uid).filter(Boolean));
    const existingNames = new Set((tables.users || []).map(u => (u.username || '').toLowerCase()));

    for (const doc of legacyUsersData.documents || []) {
      const u = docToObject(doc);
      if (!u || !u.username) continue;
      const uid = u.uid || doc.name.split('/').pop();
      if (existingUids.has(uid) || existingNames.has(u.username.toLowerCase())) continue;

      tables.users.push({
        id: uidToNumericId(uid),
        username: u.username,
        password_hash: 'firebase-auth',
        firebase_uid: uid,
        created_at: u.created_at || u.createdAt || new Date().toISOString()
      });
      existingUids.add(uid);
      existingNames.add(u.username.toLowerCase());
    }
  }

  const snapshot = {
    version: '2.0.0-blaze',
    exportedAt: new Date().toISOString(),
    projectId,
    checksum: sha256(JSON.stringify(tables)),
    counts: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length])),
    tables
  };

  importDynamicState(db, snapshot, { skipChecksum: true });
  logInfo('DURABLE_STORE_HYDRATED', 'Hydrated SQLite database from Cloud Firestore', { counts: snapshot.counts });
  return { hydrated: true, counts: snapshot.counts };
}

module.exports = {
  DYNAMIC_TABLES,
  LEGACY_15X15_TO_44X30_COORDS,
  sha256,
  uidToNumericId,
  exportDynamicState,
  verifySnapshotIntegrity,
  importDynamicState,
  migrateImportedCharacterTiles,
  syncSqliteSequences,
  saveSnapshotToFile,
  restoreSnapshotFromFile,
  saveDurableSnapshotFile: saveSnapshotToFile,
  loadDurableSnapshotFile: restoreSnapshotFromFile,
  primeRowHashCache,
  computeDirtyDelta,
  isFirebaseTokenConfigValid,
  getServerAccessToken,
  getFirebaseCliToken: getServerAccessToken,
  pushDeltaToFirestoreServer,
  pullFromFirestoreServer
};

