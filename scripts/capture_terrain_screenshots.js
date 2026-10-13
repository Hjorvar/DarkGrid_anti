const http = require('http');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

const { createTestDb } = require('../tests/test_helpers');
const { setDb, closeDb } = require('../src/db/connection');
const { createCharacter } = require('../src/domain/character/rules');
const { startCombat } = require('../src/domain/combat/engine');

async function main() {
  const db = createTestDb();
  setDb(db);

  // Set up test user and character
  const userStmt = db.prepare("INSERT INTO users (username, password_hash) VALUES ('terraintester', 'hash123')");
  const userRes = userStmt.run();
  const userId = Number(userRes.lastInsertRowid);

  const hero = createCharacter(db, {
    userId,
    name: 'Valerius',
    classType: 'FIGHTER',
    stats: {
      strength: 16,
      constitution: 14,
      dexterity: 12,
      intelligence: 10,
      wisdom: 10,
      charisma: 9
    }
  });

  // Give some gold, potions and items
  db.prepare('UPDATE characters SET gold = 85 WHERE id = ?').run(hero.id);
  const potionDef = db.prepare("SELECT id FROM item_definitions WHERE name = 'Potion of Healing'").get();
  if (potionDef) {
    db.prepare('INSERT INTO items (character_id, item_definition_id) VALUES (?, ?)').run(hero.id, potionDef.id);
    db.prepare('INSERT INTO items (character_id, item_definition_id) VALUES (?, ?)').run(hero.id, potionDef.id);
  }

  // Load app and add devHero middleware for headless screenshots
  const app = require('../src/app');
  app.use((req, res, next) => {
    if (req.query.devHero) {
      req.session.userId = userId;
      req.session.characterId = hero.id;
    }
    next();
  });
  const devLayer = app.router.stack.pop();
  app.router.stack.splice(8, 0, devLayer);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Ephemeral test server running at ${baseUrl}`);

  const edgeExe = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const outDir = path.resolve(__dirname, '..', 'docs', 'screenshots', 'terrain');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const artifactDir = 'C:\\Users\\hih\\.gemini\\antigravity\\brain\\7c56d692-3403-4e85-891f-e9b740ff5202\\terrain_screenshots';
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  async function capture(name, urlPath, width, height) {
    const filename = `${name}_${width}x${height}.png`;
    const tmpPath = path.join(os.tmpdir(), `edge_cap_${Date.now()}_${filename}`);
    const fullPath = path.join(outDir, filename);
    const artifactPath = path.join(artifactDir, filename);
    const targetUrl = `${baseUrl}${urlPath}`;
    console.log(`Capturing: ${filename} from ${targetUrl} [${width}x${height}]`);

    try {
      await execFileAsync(edgeExe, [
        '--headless=new',
        '--no-sandbox',
        '--disable-gpu',
        '--hide-scrollbars',
        '--disable-dev-shm-usage',
        '--proxy-server=direct://',
        '--proxy-bypass-list=*',
        '--no-first-run',
        '--no-default-browser-check',
        '--allow-insecure-localhost',
        `--window-size=${width},${height}`,
        `--screenshot=${tmpPath}`,
        targetUrl
      ], { timeout: 15000 });

      if (fs.existsSync(tmpPath)) {
        fs.copyFileSync(tmpPath, fullPath);
        fs.copyFileSync(tmpPath, artifactPath);
        fs.unlinkSync(tmpPath);
        const stats = fs.statSync(fullPath);
        console.log(`  -> Successfully saved: ${filename} (${stats.size} bytes)`);
      } else {
        console.error(`  -> Failed: temporary screenshot file not found: ${tmpPath}`);
      }
    } catch (err) {
      if (fs.existsSync(tmpPath)) {
        fs.copyFileSync(tmpPath, fullPath);
        fs.copyFileSync(tmpPath, artifactPath);
        fs.unlinkSync(tmpPath);
        const stats = fs.statSync(fullPath);
        console.log(`  -> Successfully saved (despite browser stderr): ${filename} (${stats.size} bytes)`);
      } else {
        console.error(`  -> Error capturing ${filename}:`, err.message);
      }
    }
  }

  try {
    // 1. Oakhaven City (ART-01)
    console.log('\n--- Scene 1: Oakhaven City ---');
    const cityTile = db.prepare("SELECT * FROM map_tiles WHERE name = 'Oakhaven'").get();
    db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(cityTile.id, hero.id);
    db.prepare('DELETE FROM encounters WHERE character_id = ?').run(hero.id);
    await capture('terrain_01_city_oakhaven', '/game?devHero=1', 1440, 900);
    await capture('terrain_01_city_oakhaven', '/game?devHero=1', 1366, 768);

    // 2. Town Gates (ART-02)
    console.log('\n--- Scene 2: Town Gates ---');
    const gateTile = db.prepare("SELECT * FROM map_tiles WHERE name = 'Oakhaven North Gate'").get();
    db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(gateTile.id, hero.id);
    db.prepare('DELETE FROM encounters WHERE character_id = ?').run(hero.id);
    await capture('terrain_02_town_gates', '/game?devHero=1', 1440, 900);
    await capture('terrain_02_town_gates', '/game?devHero=1', 1366, 768);

    // 3. Forest (ART-03)
    console.log('\n--- Scene 3: Forest ---');
    const forestTile = db.prepare("SELECT * FROM map_tiles WHERE terrain = 'FOREST' AND is_passable = 1 LIMIT 1").get();
    db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(forestTile.id, hero.id);
    db.prepare('DELETE FROM encounters WHERE character_id = ?').run(hero.id);
    await capture('terrain_03_forest', '/game?devHero=1', 1440, 900);
    await capture('terrain_03_forest', '/game?devHero=1', 1366, 768);

    // 4. Plains (ART-04)
    console.log('\n--- Scene 4: Plains ---');
    const plainsTile = db.prepare("SELECT * FROM map_tiles WHERE terrain = 'PLAINS' AND feature IS NULL LIMIT 1").get();
    db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(plainsTile.id, hero.id);
    db.prepare('DELETE FROM encounters WHERE character_id = ?').run(hero.id);
    await capture('terrain_04_plains', '/game?devHero=1', 1440, 900);
    await capture('terrain_04_plains', '/game?devHero=1', 1366, 768);

    // 5. Swamp (ART-05)
    console.log('\n--- Scene 5: Swamp ---');
    const swampTile = db.prepare("SELECT * FROM map_tiles WHERE terrain = 'SWAMP' AND is_passable = 1 LIMIT 1").get();
    db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(swampTile.id, hero.id);
    db.prepare('DELETE FROM encounters WHERE character_id = ?').run(hero.id);
    await capture('terrain_05_swamp', '/game?devHero=1', 1440, 900);
    await capture('terrain_05_swamp', '/game?devHero=1', 1366, 768);

    // 6. Hills (ART-06)
    console.log('\n--- Scene 6: Hills ---');
    const hillsTile = db.prepare("SELECT * FROM map_tiles WHERE terrain = 'HILLS' AND is_passable = 1 LIMIT 1").get();
    db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(hillsTile.id, hero.id);
    db.prepare('DELETE FROM encounters WHERE character_id = ?').run(hero.id);
    await capture('terrain_06_hills', '/game?devHero=1', 1440, 900);
    await capture('terrain_06_hills', '/game?devHero=1', 1366, 768);

    // 7. Jungle (ART-07)
    console.log('\n--- Scene 7: Jungle ---');
    const jungleTile = db.prepare("SELECT * FROM map_tiles WHERE terrain = 'JUNGLE' AND is_passable = 1 LIMIT 1").get();
    db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(jungleTile.id, hero.id);
    db.prepare('DELETE FROM encounters WHERE character_id = ?').run(hero.id);
    await capture('terrain_07_jungle', '/game?devHero=1', 1440, 900);
    await capture('terrain_07_jungle', '/game?devHero=1', 1366, 768);

    // 8. Discovered Encounter in Forest
    console.log('\n--- Scene 8: Discovered Encounter (Forest) ---');
    db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(forestTile.id, hero.id);
    db.prepare('DELETE FROM encounters WHERE character_id = ?').run(hero.id);
    const wolf = db.prepare("SELECT * FROM monsters WHERE name = 'Wolf'").get();
    db.prepare(`
      INSERT INTO encounters (
        character_id, monster_id, tile_id, status, current_monster_hp,
        monster_max_hp, combat_round, created_at
      ) VALUES (?, ?, ?, 'DISCOVERED', ?, ?, 0, CURRENT_TIMESTAMP)
    `).run(hero.id, wolf.id, forestTile.id, wolf.base_hp, wolf.base_hp);
    await capture('terrain_08_discovered_encounter_forest', '/game?devHero=1', 1440, 900);
    await capture('terrain_08_discovered_encounter_forest', '/game?devHero=1', 1366, 768);

    // 9. Active Combat in Hills
    console.log('\n--- Scene 9: Active Combat in Hills ---');
    db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(hillsTile.id, hero.id);
    db.prepare('DELETE FROM encounters WHERE character_id = ?').run(hero.id);
    const ogre = db.prepare("SELECT * FROM monsters WHERE name = 'Ogre'").get() || wolf;
    const combatEncRes = db.prepare(`
      INSERT INTO encounters (
        character_id, monster_id, tile_id, status, current_monster_hp,
        monster_max_hp, combat_round, created_at
      ) VALUES (?, ?, ?, 'DISCOVERED', ?, ?, 0, CURRENT_TIMESTAMP)
    `).run(hero.id, ogre.id, hillsTile.id, ogre.base_hp, ogre.base_hp);
    const combatEncId = Number(combatEncRes.lastInsertRowid);
    startCombat(db, hero.id, combatEncId);
    await capture('terrain_09_active_combat_hills', '/game?devHero=1', 1440, 900);
    await capture('terrain_09_active_combat_hills', '/game?devHero=1', 1366, 768);
    await capture('terrain_09_active_combat_hills', '/game?devHero=1', 1280, 720);

    // 10. The Old Stone Bridge (ART-08)
    console.log('\n--- Scene 10: The Old Stone Bridge ---');
    db.prepare('DELETE FROM combat_events WHERE encounter_id = ?').run(combatEncId);
    db.prepare('DELETE FROM encounters WHERE character_id = ?').run(hero.id);
    const bridgeTile = db.prepare("SELECT * FROM map_tiles WHERE name = 'The Old Stone Bridge'").get();
    if (bridgeTile) {
      db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(bridgeTile.id, hero.id);
      await capture('terrain_10_bridge', '/game?devHero=1', 1440, 900);
      await capture('terrain_10_bridge', '/game?devHero=1', 1366, 768);
    }

    console.log('\nAll terrain visual QA screenshots captured successfully!');
  } finally {
    server.close();
    closeDb();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
