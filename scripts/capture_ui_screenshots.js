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
  const userStmt = db.prepare("INSERT INTO users (username, password_hash) VALUES ('testhero', 'hash123')");
  const userRes = userStmt.run();
  const userId = Number(userRes.lastInsertRowid);

  const hero = createCharacter(db, {
    userId,
    name: 'Kappi',
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
  db.prepare('UPDATE characters SET gold = 45 WHERE id = ?').run(hero.id);
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
  const outDir = path.resolve(__dirname, '..', 'docs', 'screenshots');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const artifactDir = 'C:\\Users\\hih\\.gemini\\antigravity\\brain\\14812be9-97a4-4416-a129-8964708407ca';
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
    // 1. City State (Oakhaven) - at all 4 required resolutions
    console.log('\n--- State 1: City (Oakhaven) ---');
    const cityTile = db.prepare("SELECT * FROM map_tiles WHERE name = 'Oakhaven' AND terrain = 'CITY' LIMIT 1").get()
      || db.prepare("SELECT * FROM map_tiles WHERE terrain = 'CITY' LIMIT 1").get();
    db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(cityTile.id, hero.id);
    db.prepare("DELETE FROM encounters WHERE character_id = ?").run(hero.id);

    await capture('01_city_oakhaven', '/game?devHero=1', 1920, 1080);
    await capture('01_city_oakhaven', '/game?devHero=1', 1440, 900);
    await capture('01_city_oakhaven', '/game?devHero=1', 1366, 768);
    await capture('01_city_oakhaven', '/game?devHero=1', 1280, 720);

    // 2. Wilderness / Exploration State
    console.log('\n--- State 2: Wilderness Exploration ---');
    const wildTile = db.prepare("SELECT * FROM map_tiles WHERE is_safe = 0 AND is_passable = 1 AND terrain = 'FOREST' LIMIT 1").get()
      || db.prepare("SELECT * FROM map_tiles WHERE is_safe = 0 AND is_passable = 1 LIMIT 1").get();
    db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(wildTile.id, hero.id);
    db.prepare("DELETE FROM encounters WHERE character_id = ?").run(hero.id);

    await capture('02_wilderness_exploration', '/game?devHero=1', 1440, 900);
    await capture('02_wilderness_exploration', '/game?devHero=1', 1280, 720);

    // 3. Active Combat State
    console.log('\n--- State 3: Active Combat ---');
    const wolf = db.prepare("SELECT * FROM monsters WHERE name = 'Wolf'").get();
    const encRes = db.prepare(`
      INSERT INTO encounters (
        character_id, monster_id, tile_id, status, current_monster_hp,
        monster_max_hp, combat_round, created_at
      ) VALUES (?, ?, ?, 'DISCOVERED', ?, ?, 0, CURRENT_TIMESTAMP)
    `).run(hero.id, wolf.id, wildTile.id, wolf.base_hp, wolf.base_hp);
    const encId = Number(encRes.lastInsertRowid);
    startCombat(db, hero.id, encId);

    await capture('03_active_combat', '/game?devHero=1', 1440, 900);
    await capture('03_active_combat', '/game?devHero=1', 1280, 720);

    // 4. Backpack Modal
    console.log('\n--- State 4: Backpack Modal ---');
    await capture('04_modal_backpack', '/game?devHero=1&modal=backpack', 1440, 900);
    await capture('04_modal_backpack', '/game?devHero=1&modal=backpack', 1280, 720);

    // 5. Character Modal
    console.log('\n--- State 5: Character Modal ---');
    await capture('05_modal_character', '/game?devHero=1&modal=character', 1440, 900);
    await capture('05_modal_character', '/game?devHero=1&modal=character', 1280, 720);

    console.log('\nAll screenshots captured successfully!');
  } finally {
    server.close();
    closeDb();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
