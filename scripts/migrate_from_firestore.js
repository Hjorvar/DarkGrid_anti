/**
 * Darkgrid Non-Destructive Firestore -> Server SQLite Migration Utility
 *
 * Translates legacy Spark-era Firestore collections (`users`, `usernames`, `characters`,
 * `encounters`, `persistent_monsters`, `market_listings`, `hunting_contracts`) into
 * the authoritative server-side SQLite schema while preserving:
 * - User IDs and Firebase Auth UIDs (`firebase_uid`)
 * - Character IDs, stats, XP, gold, level, permadeath status, and inventory
 * - Persistent monsters (`monster_instances`) and their looted items
 * - Global market listings (`market_listings`) and their market item instances
 * - Hunting contracts (`hunting_contracts`)
 * - Active & historical encounters (`encounters`) and combat logs (`combat_events`)
 */

const fs = require('fs');
const path = require('path');
const { initializeDatabase, withTransaction } = require('../src/db/connection');
const { runMigrations, runSeeds } = require('../src/db/migrate');
const {
  uidToNumericId,
  exportDynamicState,
  syncSqliteSequences
} = require('../src/db/durable-store');

/**
 * Converts a Firestore backup collections map into a normalized SQLite migration dataset
 * and imports it non-destructively into `db`.
 */
function migrateFirestoreCollectionsToSqlite(db, collections = {}) {
  const summary = {
    usersMigrated: 0,
    charactersMigrated: 0,
    itemsMigrated: 0,
    persistentMonstersMigrated: 0,
    marketListingsMigrated: 0,
    huntingContractsMigrated: 0,
    encountersMigrated: 0,
    combatEventsMigrated: 0
  };

  withTransaction(db, (tx) => {
    const uidToUserIdMap = new Map();

    // 1. Migrate Users from `users` and `usernames`
    const userDocs = collections.users || [];
    const usernameDocs = collections.usernames || [];

    for (const uDoc of userDocs) {
      const d = uDoc.data || uDoc;
      const uid = d.uid || uDoc.id;
      const username = (d.username || '').trim();
      if (!uid || !username) continue;

      const existingByUid = tx.prepare('SELECT id FROM users WHERE firebase_uid = ?').get(uid);
      const existingByName = tx.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(username);

      if (existingByUid) {
        uidToUserIdMap.set(uid, existingByUid.id);
      } else if (existingByName) {
        tx.prepare('UPDATE users SET firebase_uid = COALESCE(firebase_uid, ?) WHERE id = ?').run(uid, existingByName.id);
        uidToUserIdMap.set(uid, existingByName.id);
      } else {
        const numericId = uidToNumericId(uid);
        const idConflict = tx.prepare('SELECT id FROM users WHERE id = ?').get(numericId);
        if (!idConflict) {
          tx.prepare(`
            INSERT INTO users (id, username, password_hash, firebase_uid, created_at)
            VALUES (?, ?, 'firebase-auth', ?, ?)
          `).run(numericId, username, uid, d.created_at || d.createdAt || new Date().toISOString());
          uidToUserIdMap.set(uid, numericId);
        } else {
          const res = tx.prepare(`
            INSERT INTO users (username, password_hash, firebase_uid, created_at)
            VALUES (?, 'firebase-auth', ?, ?)
          `).run(username, uid, d.created_at || d.createdAt || new Date().toISOString());
          uidToUserIdMap.set(uid, Number(res.lastInsertRowid));
        }
        summary.usersMigrated++;
      }
    }

    for (const unDoc of usernameDocs) {
      const d = unDoc.data || unDoc;
      const uid = d.uid;
      const username = (d.username || unDoc.id || '').trim();
      if (!uid || !username || uidToUserIdMap.has(uid)) continue;

      const existing = tx.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(username);
      if (existing) {
        tx.prepare('UPDATE users SET firebase_uid = COALESCE(firebase_uid, ?) WHERE id = ?').run(uid, existing.id);
        uidToUserIdMap.set(uid, existing.id);
      } else {
        const numericId = uidToNumericId(uid);
        tx.prepare(`
          INSERT OR IGNORE INTO users (id, username, password_hash, firebase_uid, created_at)
          VALUES (?, ?, 'firebase-auth', ?, ?)
        `).run(numericId, username, uid, d.created_at || new Date().toISOString());
        uidToUserIdMap.set(uid, numericId);
        summary.usersMigrated++;
      }
    }

    // 2. Migrate Persistent Monsters
    for (const pmDoc of collections.persistent_monsters || []) {
      const pm = pmDoc.data || pmDoc;
      const pmId = Number(pmDoc.id || pm.id);
      if (!pmId) continue;

      const existingPm = tx.prepare('SELECT * FROM monster_instances WHERE id = ?').get(pmId);
      if (!existingPm) {
        tx.prepare(`
          INSERT INTO monster_instances (
            id, monster_id, tile_id, current_hp, max_hp, held_gold, kill_count, custom_title, status, created_at, defeated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          pmId,
          Number(pm.monster_id || 1),
          Number(pm.tile_id || 1),
          Number(pm.current_hp ?? pm.max_hp ?? 10),
          Number(pm.max_hp ?? 10),
          Number(pm.held_gold ?? pm.gold_held ?? 0),
          Number(pm.kill_count ?? 1),
          pm.custom_title || null,
          pm.status || 'ACTIVE',
          pm.created_at || new Date().toISOString(),
          pm.defeated_at || null
        );
        summary.persistentMonstersMigrated++;
      }

      if (pm.items_held_json && (!existingPm || existingPm.status === 'ACTIVE')) {
        try {
          const items = JSON.parse(pm.items_held_json);
          for (const it of items) {
            tx.prepare(`
              INSERT OR IGNORE INTO item_instances (
                id, item_definition_id, owner_type, owner_character_id, owner_monster_id, equipped_slot, created_at
              ) VALUES (?, ?, 'MONSTER', NULL, ?, NULL, ?)
            `).run(Number(it.id), Number(it.item_definition_id), pmId, it.created_at || new Date().toISOString());
            summary.itemsMigrated++;
          }
        } catch {
          // Ignore malformed JSON
        }
      }
    }

    // 3. Migrate Characters & their Inventory
    for (const chDoc of collections.characters || []) {
      const ch = chDoc.data || chDoc;
      const charId = Number(chDoc.id || ch.id);
      if (!charId) continue;

      let ownerUserId = typeof ch.user_id === 'number' ? ch.user_id : uidToUserIdMap.get(String(ch.user_id));
      if (!ownerUserId) {
        const uidStr = String(ch.user_id || `legacy_${charId}`);
        ownerUserId = uidToNumericId(uidStr);
        tx.prepare(`
          INSERT OR IGNORE INTO users (id, username, password_hash, firebase_uid)
          VALUES (?, ?, 'firebase-auth', ?)
        `).run(ownerUserId, `hero_user_${ownerUserId}`, uidStr);
        uidToUserIdMap.set(uidStr, ownerUserId);
      }

      const existingChar = tx.prepare('SELECT * FROM characters WHERE id = ?').get(charId);
      if (!existingChar) {
        tx.prepare(`
          INSERT INTO characters (
            id, user_id, name, class, level, xp, gold,
            strength, constitution, dexterity, intelligence, wisdom, charisma,
            max_hp, current_hp, tile_id, is_alive, died_at,
            killed_by_monster_instance_id, primary_weapon,
            favored_enemy_type, favored_enemy_subtype, cleric_heal_uses, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          charId,
          ownerUserId,
          ch.name,
          ch.class,
          Number(ch.level ?? 1),
          Number(ch.xp ?? 0),
          Number(ch.gold ?? 10),
          Number(ch.strength ?? 10),
          Number(ch.constitution ?? 10),
          Number(ch.dexterity ?? 10),
          Number(ch.intelligence ?? 10),
          Number(ch.wisdom ?? 10),
          Number(ch.charisma ?? 10),
          Number(ch.max_hp ?? 10),
          Number(ch.current_hp ?? 10),
          Number(ch.tile_id ?? 113),
          ch.is_alive !== undefined ? Number(ch.is_alive) : 1,
          ch.died_at || null,
          ch.killed_by_monster_instance_id ? Number(ch.killed_by_monster_instance_id) : null,
          ch.primary_weapon || 'MELEE',
          ch.favored_enemy_type || null,
          ch.favored_enemy_subtype || null,
          Number(ch.cleric_heal_uses ?? 0),
          ch.created_at || new Date().toISOString()
        );
        summary.charactersMigrated++;
      }

      if (ch.inventory_json) {
        try {
          const invItems = JSON.parse(ch.inventory_json);
          for (const it of invItems) {
            tx.prepare(`
              INSERT OR IGNORE INTO item_instances (
                id, item_definition_id, owner_type, owner_character_id, owner_monster_id, equipped_slot, modifications, created_at
              ) VALUES (?, ?, 'CHARACTER', ?, NULL, ?, ?, ?)
            `).run(
              Number(it.id),
              Number(it.item_definition_id),
              charId,
              it.equipped_slot || null,
              it.modifications || '{}',
              it.created_at || new Date().toISOString()
            );
            summary.itemsMigrated++;
          }
        } catch {
          // Ignore malformed inventory_json
        }
      }
    }

    // 4. Migrate Market Listings
    for (const mlDoc of collections.market_listings || []) {
      const ml = mlDoc.data || mlDoc;
      const listingId = Number(mlDoc.id || ml.id);
      if (!listingId || !ml.item_instance_id) continue;

      if (ml.status === 'ACTIVE') {
        tx.prepare(`
          INSERT OR IGNORE INTO item_instances (
            id, item_definition_id, owner_type, owner_character_id, owner_monster_id, equipped_slot
          ) VALUES (?, ?, 'MARKET', NULL, NULL, NULL)
        `).run(Number(ml.item_instance_id), Number(ml.item_definition_id || 1));
      }

      const existingMl = tx.prepare('SELECT id FROM market_listings WHERE id = ?').get(listingId);
      if (!existingMl) {
        tx.prepare(`
          INSERT INTO market_listings (
            id, item_instance_id, seller_character_id, buyer_character_id, price, status, created_at, completed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          listingId,
          Number(ml.item_instance_id),
          ml.seller_character_id ? Number(ml.seller_character_id) : null,
          ml.buyer_character_id ? Number(ml.buyer_character_id) : null,
          Number(ml.price || 0),
          ml.status || 'ACTIVE',
          ml.created_at || new Date().toISOString(),
          ml.completed_at || null
        );
        summary.marketListingsMigrated++;
      }
    }

    // 5. Migrate Hunting Contracts
    for (const hcDoc of collections.hunting_contracts || []) {
      const hc = hcDoc.data || hcDoc;
      const contractId = Number(hcDoc.id || hc.id);
      if (!contractId || !hc.character_id) continue;

      const existingHc = tx.prepare('SELECT id FROM hunting_contracts WHERE id = ?').get(contractId);
      if (!existingHc) {
        tx.prepare(`
          INSERT INTO hunting_contracts (
            id, character_id, base_monster_id, custom_name, title, description,
            region_name, target_terrain, threat_label, boost_type, boost_label,
            boosted_max_hp, attack_bonus_mod, damage_bonus_mod, reward_gold,
            status, created_at_level, created_at_encounters, created_at, completed_at, claimed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          contractId,
          Number(hc.character_id),
          Number(hc.base_monster_id || 1),
          hc.custom_name || 'Named Quarry',
          hc.title || 'Hunting Warrant',
          hc.description || '',
          hc.region_name || 'Mirkwood Forest',
          hc.target_terrain || 'FOREST',
          hc.threat_label || 'Dangerous',
          hc.boost_type || 'TOUGH',
          hc.boost_label || 'Tough (+15% Max HP)',
          Number(hc.boosted_max_hp || 10),
          Number(hc.attack_bonus_mod || 0),
          Number(hc.damage_bonus_mod || 0),
          Number(hc.reward_gold || 30),
          hc.status || 'AVAILABLE',
          Number(hc.created_at_level || 1),
          Number(hc.created_at_encounters || 0),
          hc.created_at || new Date().toISOString(),
          hc.completed_at || null,
          hc.claimed_at || null
        );
        summary.huntingContractsMigrated++;
      }
    }

    // 6. Migrate Encounters & Combat Events
    for (const encDoc of collections.encounters || []) {
      const encData = encDoc.data || encDoc;
      if (encData.combat_state_json) {
        try {
          const parsed = JSON.parse(encData.combat_state_json);
          for (const e of parsed.encounters || []) {
            const existingEnc = tx.prepare('SELECT id FROM encounters WHERE id = ?').get(Number(e.id));
            if (!existingEnc) {
              tx.prepare(`
                INSERT INTO encounters (
                  id, character_id, tile_id, monster_id, monster_instance_id, bounty_contract_id,
                  status, current_monster_hp, monster_max_hp, combat_round, initiative_winner,
                  last_health_bracket, spotted_by_hero, is_ambush, opening_shot_resolved,
                  combat_state_json, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).run(
                Number(e.id),
                Number(e.character_id),
                Number(e.tile_id),
                Number(e.monster_id),
                e.monster_instance_id ? Number(e.monster_instance_id) : null,
                e.bounty_contract_id ? Number(e.bounty_contract_id) : null,
                e.status,
                Number(e.current_monster_hp ?? 10),
                Number(e.monster_max_hp ?? e.current_monster_hp ?? 10),
                Number(e.combat_round ?? 0),
                e.initiative_winner || null,
                Number(e.last_health_bracket ?? 100),
                Number(e.spotted_by_hero ?? 1),
                Number(e.is_ambush ?? 0),
                Number(e.opening_shot_resolved ?? 0),
                e.combat_state_json || '{}',
                e.created_at || new Date().toISOString(),
                e.updated_at || new Date().toISOString()
              );
              summary.encountersMigrated++;
            }
          }
          for (const ce of parsed.combat_events || []) {
            const res = tx.prepare(`
              INSERT OR IGNORE INTO combat_events (
                id, encounter_id, round_number, event_type, public_text, details, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
              Number(ce.id),
              Number(ce.encounter_id),
              Number(ce.round_number ?? 1),
              ce.event_type,
              ce.public_text,
              ce.details || '{}',
              ce.created_at || new Date().toISOString()
            );
            if (res.changes > 0) summary.combatEventsMigrated++;
          }
        } catch {
          // Ignore malformed JSON
        }
      }
    }

    syncSqliteSequences(tx);
  });

  return summary;
}

function runMigrationFromBackupFile(backupFilePath, options = {}) {
  if (!fs.existsSync(backupFilePath)) {
    throw new Error(`Backup file not found: ${backupFilePath}`);
  }
  const backup = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
  const collections = backup.firestoreBackup?.collections || {};

  const targetDbPath = options.dryRun
    ? ':memory:'
    : (options.targetDbPath || path.resolve(__dirname, '../data/darkgrid.sqlite'));

  const db = initializeDatabase(targetDbPath);
  runMigrations(db);
  runSeeds(db);

  try {
    const summary = migrateFirestoreCollectionsToSqlite(db, collections);
    const postState = exportDynamicState(db);
    return {
      dryRun: Boolean(options.dryRun),
      targetDbPath,
      summary,
      counts: postState.counts,
      checksum: postState.checksum
    };
  } finally {
    db.close();
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const backupPath = path.resolve(__dirname, '../db/backups/production-backup-latest.json');
  try {
    const res = runMigrationFromBackupFile(backupPath, { dryRun });
    console.log(`=== Darkgrid Firestore Migration ${res.dryRun ? '(DRY RUN)' : ''} Complete ===`);
    console.log('Summary:', res.summary);
    console.log('Total Counts:', res.counts);
    console.log('Checksum:', res.checksum);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

module.exports = {
  migrateFirestoreCollectionsToSqlite,
  runMigrationFromBackupFile
};
