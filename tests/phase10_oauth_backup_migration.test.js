const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { initializeDatabase, closeDb } = require('../src/db/connection');
const { runMigrations, runSeeds } = require('../src/db/migrate');
const {
  getServerAccessToken,
  exportDynamicState,
  importDynamicState,
  pullFromFirestoreServer,
  sha256
} = require('../src/db/durable-store');
const { runBackup, fetchFirestoreCollections } = require('../scripts/backup_database');
const { checkBillingStatus } = require('../scripts/deploy_blaze');
const { ensureNonDestructiveLabAdapter } = require('../action-ui-lab/server/services/legacy-compatibility-service');
const { applyTopdownExperimentWorld } = require('../action-ui-lab/server/services/topdown-world-service');
const { getTileById, getTileByCoords } = require('../src/domain/world/map');

test('Phase 10 (Phase 1.1, 1.2, 1.3) — OAuth Token Refresh, Backup Fail-Safe & World Tile Migration', async (t) => {
  await t.test('1.1 OAuth token validation, automatic CLI refresh, and Cloud Billing 401/403/Spark/Blaze distinction', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dg-oauth-test-'));
    const cfgPath = path.join(tmpDir, 'firebase-tools.json');

    const savedEnvToken = process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
    delete process.env.GOOGLE_OAUTH_ACCESS_TOKEN;

    try {
      // 1. Expired token without refresh capability must NOT return expired token
      fs.writeFileSync(
        cfgPath,
        JSON.stringify({
          tokens: {
            access_token: 'expired-token-value',
            expires_at: Date.now() - 3600_000,
            refresh_token: 'refresh-placeholder'
          }
        }),
        'utf8'
      );

      const noRefreshToken = await getServerAccessToken({
        firebaseConfigPath: cfgPath,
        skipMetadataServer: true,
        allowCliRefresh: false
      });
      assert.equal(noRefreshToken, null, 'Must never return an expired OAuth access_token');

      await assert.rejects(
        () =>
          getServerAccessToken({
            firebaseConfigPath: cfgPath,
            skipMetadataServer: true,
            allowCliRefresh: false,
            throwOnExpired: true
          }),
        (err) => err.code === 'OAUTH_TOKEN_EXPIRED' && err.status === 401
      );

      // 2. Expired token WITH working CLI refresh automatically updates and returns fresh token
      const refreshedToken = await getServerAccessToken({
        firebaseConfigPath: cfgPath,
        skipMetadataServer: true,
        allowCliRefresh: true,
        refreshCliTokenFn: async (filePath) => {
          fs.writeFileSync(
            filePath,
            JSON.stringify({
              tokens: {
                access_token: 'freshly-renewed-oauth-token',
                expires_at: Date.now() + 3600_000,
                refresh_token: 'refresh-placeholder'
              }
            }),
            'utf8'
          );
        }
      });
      assert.equal(refreshedToken, 'freshly-renewed-oauth-token');

      // 3. checkBillingStatus clearly distinguishes 401, 403, network error, Spark (false), and Blaze (true)
      const res401 = await checkBillingStatus('bad-token', {
        fetchFn: async () => ({ ok: false, status: 401 })
      });
      assert.equal(res401.ok, false);
      assert.equal(res401.status, 401);
      assert.equal(res401.errorCode, 'AUTH_EXPIRED');
      assert.equal(res401.billingEnabled, null, '401 must NEVER be interpreted as billingEnabled: false');

      const res403 = await checkBillingStatus('restricted-token', {
        fetchFn: async () => ({ ok: false, status: 403 })
      });
      assert.equal(res403.ok, false);
      assert.equal(res403.status, 403);
      assert.equal(res403.errorCode, 'INSUFFICIENT_PERMISSIONS');
      assert.equal(res403.billingEnabled, null);

      const resNet = await checkBillingStatus('any-token', {
        fetchFn: async () => {
          throw new Error('ECONNRESET');
        }
      });
      assert.equal(resNet.ok, false);
      assert.equal(resNet.errorCode, 'NETWORK_ERROR');
      assert.equal(resNet.billingEnabled, null);

      const resSpark = await checkBillingStatus('valid-token', {
        fetchFn: async () => ({
          ok: true,
          status: 200,
          json: async () => ({ billingEnabled: false })
        })
      });
      assert.equal(resSpark.ok, true);
      assert.equal(resSpark.billingEnabled, false);

      const resBlaze = await checkBillingStatus('valid-token', {
        fetchFn: async () => ({
          ok: true,
          status: 200,
          json: async () => ({
            billingEnabled: true,
            billingAccountName: 'billingAccounts/012345-6789AB-CDEF01'
          })
        })
      });
      assert.equal(resBlaze.ok, true);
      assert.equal(resBlaze.billingEnabled, true);
      assert.equal(resBlaze.billingAccountName, 'billingAccounts/012345-6789AB-CDEF01');
    } finally {
      if (savedEnvToken !== undefined) process.env.GOOGLE_OAUTH_ACCESS_TOKEN = savedEnvToken;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  await t.test('1.2 Backup fail-safe: rejects HTTP 401/403 and strictly blocks overwriting populated backup with 0 users', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dg-backup-failsafe-'));
    const populatedDbPath = path.join(tmpDir, 'populated.sqlite');
    const emptyDbPath = path.join(tmpDir, 'empty.sqlite');
    const backupFilePath = path.join(tmpDir, 'production-backup-latest.json');

    try {
      // Create a populated DB with 2 users and 1 living hero
      const popDb = initializeDatabase(populatedDbPath);
      runMigrations(popDb);
      runSeeds(popDb);
      popDb.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'haraldur', '$2b$10$hash')").run();
      popDb.prepare("INSERT INTO users (id, username, password_hash) VALUES (2, 'hjorvaringi', '$2b$10$hash')").run();
      popDb.prepare(`
        INSERT INTO characters (
          id, user_id, name, class, is_alive, level, xp, gold,
          strength, constitution, dexterity, intelligence, wisdom, charisma,
          current_hp, max_hp, tile_id
        ) VALUES (1, 1, 'Torgal', 'RANGER', 1, 1, 200, 59, 14, 12, 16, 10, 12, 8, 8, 8, 113)
      `).run();
      popDb.close();

      // 1. Valid backup succeeds and writes atomically
      const initialBackup = await runBackup({
        dbPath: populatedDbPath,
        outputPath: backupFilePath,
        token: 'valid-token',
        fetchFn: async () => ({
          ok: true,
          status: 200,
          json: async () => ({
            documents: [
              {
                name: 'projects/darkgrid-rpg/databases/(default)/documents/users/1',
                fields: { username: { stringValue: 'haraldur' } }
              }
            ]
          })
        })
      });
      assert.equal(initialBackup.backup.sqliteSnapshot.counts.users, 2);
      const originalFileContent = fs.readFileSync(backupFilePath, 'utf8');

      // 2. Firestore HTTP 401 MUST fail and leave backupFilePath completely untouched
      await assert.rejects(
        () =>
          runBackup({
            dbPath: populatedDbPath,
            outputPath: backupFilePath,
            token: 'expired-token',
            fetchFn: async () => ({ ok: false, status: 401 })
          }),
        (err) => err.code === 'FIRESTORE_UNAUTHENTICATED' && err.status === 401
      );
      assert.equal(fs.readFileSync(backupFilePath, 'utf8'), originalFileContent);

      // 3. Firestore HTTP 403 MUST fail and leave backupFilePath completely untouched
      await assert.rejects(
        () =>
          runBackup({
            dbPath: populatedDbPath,
            outputPath: backupFilePath,
            token: 'forbidden-token',
            fetchFn: async () => ({ ok: false, status: 403 })
          }),
        (err) => err.code === 'FIRESTORE_PERMISSION_DENIED' && err.status === 403
      );
      assert.equal(fs.readFileSync(backupFilePath, 'utf8'), originalFileContent);

      // 4. Empty SQLite + empty Firestore MUST be blocked from overwriting populated backupFilePath
      await assert.rejects(
        () =>
          runBackup({
            dbPath: emptyDbPath,
            outputPath: backupFilePath,
            skipFirestore: true
          }),
        (err) =>
          err.code === 'EMPTY_BACKUP_OVERWRITE_BLOCKED' ||
          err.code === 'EMPTY_SQLITE_OVERWRITE_BLOCKED'
      );
      assert.equal(fs.readFileSync(backupFilePath, 'utf8'), originalFileContent);
    } finally {
      closeDb();
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // Ignore Windows file lock delay
      }
    }
  });

  await t.test('1.3 World tile migration: migrates 15x15 (113) and 30x30 (1051) to 44x30 (1429) without remapping legitimate 44x30 tiles', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dg-tile-migration-'));
    const dbPath = path.join(tmpDir, 'world44x30.sqlite');

    try {
      const db = initializeDatabase(dbPath);
      runMigrations(db);
      runSeeds(db);
      ensureNonDestructiveLabAdapter(db);
      applyTopdownExperimentWorld(db);

      const oakhaven44 = getTileByCoords(db, 15, 27);
      const crossroads44 = getTileByCoords(db, 15, 23);
      assert.ok(oakhaven44, 'Oakhaven (15, 27) must exist in 44x30 map');
      assert.equal(oakhaven44.id, 1429, 'Oakhaven in 44x30 map has canonical tile_id = 1429');

      // Find a legitimate passable tile in 44x30 to test non-remapping of valid 44x30 heroes
      const legitimate44Tile =
        db.prepare('SELECT * FROM map_tiles WHERE id = 1051 AND is_passable = 1').get() ||
        db.prepare('SELECT * FROM map_tiles WHERE x = 33 AND is_passable = 1 LIMIT 1').get();
      assert.ok(legitimate44Tile, 'Must have a passable highland tile in 44x30');

      const legacyTables = {
        users: [
          { id: 1, username: 'haraldur', password_hash: '$2b$10$hash1', created_at: '2026-10-14 17:47:33' },
          { id: 2138115539, username: 'hjorvaringi', password_hash: '$2b$10$hash2', created_at: '2026-10-24 10:42:46' },
          { id: 3, username: 'phase8player', password_hash: '$2b$10$hash3', created_at: '2026-10-20 12:00:00' },
          { id: 4, username: 'phase9cplayer', password_hash: '$2b$10$hash4', created_at: '2026-10-24 11:00:00' }
        ],
        characters: [
          // 1. Legacy 15x15 hero Torgal at tile_id = 113 (Oakhaven 7,7 in 15x15), 0 discovered tiles
          {
            id: 1,
            user_id: 1,
            name: 'Torgal',
            class: 'RANGER',
            is_alive: 1,
            level: 1,
            xp: 200,
            gold: 59,
            strength: 14,
            constitution: 12,
            dexterity: 16,
            intelligence: 10,
            wisdom: 12,
            charisma: 8,
            current_hp: 8,
            max_hp: 8,
            tile_id: 113,
            favored_enemy_type: 'HUMANOID',
            favored_enemy_subtype: 'GOBLINOID',
            primary_weapon: 'RANGED'
          },
          // 2. Legacy 15x15 hero magnus at tile_id = 113 (Oakhaven 7,7 in 15x15), 0 discovered tiles
          {
            id: 2,
            user_id: 2138115539,
            name: 'magnus',
            class: 'RANGER',
            is_alive: 1,
            level: 1,
            xp: 0,
            gold: 10,
            strength: 12,
            constitution: 12,
            dexterity: 16,
            intelligence: 10,
            wisdom: 13,
            charisma: 8,
            current_hp: 8,
            max_hp: 8,
            tile_id: 113,
            primary_weapon: 'MELEE'
          },
          // 3. Phase 8 (30x30) hero at tile_id = 1051 (which was Oakhaven 15,27 in 30x30)
          {
            id: 3,
            user_id: 3,
            name: 'Aldric30',
            class: 'CLERIC',
            is_alive: 1,
            level: 3,
            xp: 5400,
            gold: 185,
            strength: 14,
            constitution: 14,
            dexterity: 10,
            intelligence: 10,
            wisdom: 16,
            charisma: 12,
            current_hp: 24,
            max_hp: 24,
            tile_id: 1051,
            primary_weapon: 'MELEE'
          },
          // 4. Legitimate 44x30 hero standing on legitimate44Tile (with that tile in character_discovered_tiles)
          {
            id: 4,
            user_id: 4,
            name: 'Highlander44',
            class: 'FIGHTER',
            is_alive: 1,
            level: 4,
            xp: 9500,
            gold: 310,
            strength: 17,
            constitution: 15,
            dexterity: 12,
            intelligence: 10,
            wisdom: 10,
            charisma: 8,
            current_hp: 38,
            max_hp: 38,
            tile_id: legitimate44Tile.id,
            primary_weapon: 'MELEE'
          }
        ],
        item_instances: [
          { id: 101, item_definition_id: 1, owner_type: 'CHARACTER', owner_character_id: 1, equipped_slot: 'MELEE_WEAPON', modifications: '{}' },
          { id: 102, item_definition_id: 2, owner_type: 'CHARACTER', owner_character_id: 1, equipped_slot: 'RANGED_WEAPON', modifications: '{}' },
          { id: 103, item_definition_id: 3, owner_type: 'CHARACTER', owner_character_id: 2, equipped_slot: 'MELEE_WEAPON', modifications: '{}' }
        ],
        character_discovered_tiles: [
          // Aldric30 discovered Oakhaven (15,27) and North Gate (15,26) in 30x30, NOT (33,18)
          { character_id: 3, x: 15, y: 27 },
          { character_id: 3, x: 15, y: 26 },
          // Highlander44 legitimately discovered legitimate44Tile in 44x30
          { character_id: 4, x: 15, y: 27 },
          { character_id: 4, x: legitimate44Tile.x, y: legitimate44Tile.y }
        ]
      };

      const snapshot = {
        version: '2.0.0-blaze',
        exportedAt: new Date().toISOString(),
        projectId: 'darkgrid-rpg',
        checksum: sha256(JSON.stringify(legacyTables)),
        tables: legacyTables
      };

      importDynamicState(db, snapshot);

      const torgal = db.prepare('SELECT * FROM characters WHERE id = 1').get();
      const magnus = db.prepare('SELECT * FROM characters WHERE id = 2').get();
      const aldric = db.prepare('SELECT * FROM characters WHERE id = 3').get();
      const highlander = db.prepare('SELECT * FROM characters WHERE id = 4').get();

      // Verify 15x15 (113) and 30x30 (1051) heroes landed in Oakhaven (1429)
      assert.equal(torgal.tile_id, oakhaven44.id, 'Torgal (15x15 tile_id=113) must migrate to 44x30 Oakhaven (1429)');
      assert.equal(magnus.tile_id, oakhaven44.id, 'magnus (15x15 tile_id=113) must migrate to 44x30 Oakhaven (1429)');
      assert.equal(aldric.tile_id, oakhaven44.id, 'Aldric30 (30x30 tile_id=1051) must migrate to 44x30 Oakhaven (1429)');

      // Verify legitimate 44x30 hero is NOT remapped
      assert.equal(
        highlander.tile_id,
        legitimate44Tile.id,
        'Legitimate 44x30 hero with discovered tile must NOT be remapped'
      );

      // Verify all stats, XP, gold, HP, and items are preserved 100%
      assert.equal(torgal.xp, 200);
      assert.equal(torgal.gold, 59);
      assert.equal(torgal.dexterity, 16);
      assert.equal(magnus.gold, 10);
      assert.equal(aldric.level, 3);
      assert.equal(aldric.xp, 5400);
      assert.equal(aldric.gold, 185);

      const torgalItems = db.prepare('SELECT * FROM item_instances WHERE owner_character_id = 1').all();
      assert.equal(torgalItems.length, 2, 'Torgal must retain all equipped items');

      const torgalDiscovered = db.prepare('SELECT COUNT(*) as c FROM character_discovered_tiles WHERE character_id = 1').get().c;
      assert.ok(torgalDiscovered >= 10, 'Torgal must have initial Oakhaven discovery tiles seeded');

      db.close();
    } finally {
      closeDb();
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // Ignore Windows file lock delay
      }
    }
  });
});
