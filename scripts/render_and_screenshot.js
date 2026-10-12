const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const app = require('../src/app');
const { getDb } = require('../src/db/connection');
const { getMinimapData, getAvailableDirections } = require('../src/domain/world/map');
const { formatModifier } = require('../src/domain/character/rules');
const { classBases, statRules } = require('../src/config');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR = path.join(__dirname, '../screenshots');

function shoot(html, filename, width = 1280, height = 950) {
  // Inject absolute URLs for assets
  const fixedHtml = html
    .replace(/href="\/css/g, 'href="http://localhost:3000/css')
    .replace(/src="\/js/g, 'src="http://localhost:3000/js')
    .replace(/src="\/images/g, 'src="http://localhost:3000/images');

  const tmpHtml = path.join(OUT_DIR, `temp_${Date.now()}_${Math.random().toString(36).slice(2)}.html`);
  fs.writeFileSync(tmpHtml, fixedHtml, 'utf8');

  const outPath = path.join(OUT_DIR, filename);
  const psCmd = `Start-Process -FilePath "${CHROME}" -ArgumentList "--headless=new", "--window-size=${width},${height}", "--screenshot=${outPath}", "${tmpHtml}" -Wait`;
  spawnSync('powershell', ['-Command', psCmd], { stdio: 'inherit' });

  try { fs.unlinkSync(tmpHtml); } catch {}
  console.log(`Generated: ${filename} (exists: ${fs.existsSync(outPath)})`);
}

async function generateAll() {
  const db = getDb();

  // 1. Character Creation View
  app.render('create-character', {
    currentUser: { id: 1, username: 'Skugga-Valdi' },
    classBases,
    statRules,
    formData: { name: 'Skugga-Valdi', classType: 'RANGER' },
    error: null,
    errors: []
  }, (err, html) => {
    if (err) return console.error('Char create render error:', err);
    shoot(html, '02_character_create.png', 1280, 1100);
  });

  // 2. Exploration View (Oakhaven)
  const oakhavenTile = db.prepare("SELECT * FROM map_tiles WHERE x = 7 AND y = 7").get();
  const mockRanger = {
    id: 1,
    name: 'Skugga-Valdi',
    class: 'RANGER',
    level: 1,
    current_hp: 12,
    max_hp: 12,
    gold: 25,
    xp: 0,
    strength: 12,
    constitution: 10,
    dexterity: 16,
    intelligence: 10,
    wisdom: 13,
    charisma: 10
  };
  const minimap = getMinimapData(db, oakhavenTile, 2);
  const directions = getAvailableDirections(db, oakhavenTile);
  const modifiers = {
    strength: formatModifier(mockRanger.strength),
    constitution: formatModifier(mockRanger.constitution),
    dexterity: formatModifier(mockRanger.dexterity),
    intelligence: formatModifier(mockRanger.intelligence),
    wisdom: formatModifier(mockRanger.wisdom),
    charisma: formatModifier(mockRanger.charisma)
  };

  app.render('game', {
    currentUser: { id: 1, username: 'Skugga-Valdi' },
    character: mockRanger,
    currentTile: oakhavenTile,
    minimap,
    directions,
    encounter: null,
    modifiers,
    errorMessage: null,
    infoMessage: 'Welcome to Darkgrid. You stand in the heart of Oakhaven.'
  }, (err, html) => {
    if (err) return console.error('Exploration render error:', err);
    shoot(html, '03_game_exploration.png', 1280, 920);
  });

  // 3. Active Encounter View with Assassin Vine
  const forestTile = db.prepare("SELECT * FROM map_tiles WHERE terrain = 'FOREST' LIMIT 1").get();
  const forestMinimap = getMinimapData(db, forestTile, 2);
  const forestDirections = getAvailableDirections(db, forestTile);
  const assassinVine = db.prepare("SELECT * FROM monsters WHERE name = 'Assassin Vine'").get();
  const descs = JSON.parse(assassinVine.descriptions);

  const activeEncounter = {
    id: 42,
    character_id: 1,
    tile_id: forestTile.id,
    monster_id: assassinVine.id,
    monster_name: assassinVine.name,
    monster_symbol: assassinVine.symbol,
    monster_color: assassinVine.color,
    status: 'DISCOVERED',
    current_monster_hp: assassinVine.base_hp,
    resolvedDescription: descs['2_ranger_distant'] || descs['1_distant'],
    isRangerSpecial: true,
    imageUrl: '/images/monsters/assassin_vine.png',
    imageSlug: 'assassin_vine'
  };

  // Injure hero slightly to demonstrate HP bar gauge
  const injuredRanger = { ...mockRanger, current_hp: 8 };

  app.render('game', {
    currentUser: { id: 1, username: 'Skugga-Valdi' },
    character: injuredRanger,
    currentTile: forestTile,
    minimap: forestMinimap,
    directions: forestDirections,
    encounter: activeEncounter,
    modifiers,
    errorMessage: null,
    infoMessage: null
  }, (err, html) => {
    if (err) return console.error('Encounter render error:', err);
    // Desktop screenshot
    shoot(html, '04_game_encounter_art.png', 1280, 950);
    // Mobile screenshot (414x920)
    shoot(html, '05_game_mobile.png', 414, 920);
  });

  // 4. Test Feral Wolf with [DEV-PLACEHOLDER] suffix as in SQLite
  const wolf = db.prepare("SELECT * FROM monsters WHERE name LIKE '%Feral Wolf%'").get();
  const wolfDescs = JSON.parse(wolf.descriptions || '{}');
  const wolfEncounter = {
    id: 43,
    character_id: 1,
    tile_id: forestTile.id,
    monster_id: wolf.id,
    monster_name: wolf.name, // 'Feral Wolf [DEV-PLACEHOLDER]'
    monster_symbol: wolf.symbol,
    monster_color: wolf.color,
    status: 'DISCOVERED',
    current_monster_hp: wolf.base_hp,
    resolvedDescription: wolfDescs['1_distant'] || 'A snarling beast with glowing amber eyes emerges from the dark.',
    isRangerSpecial: false,
    imageUrl: '/images/monsters/feral_wolf.png',
    imageSlug: 'feral_wolf'
  };

  app.render('game', {
    currentUser: { id: 1, username: 'Skugga-Valdi' },
    character: mockRanger,
    currentTile: forestTile,
    minimap: forestMinimap,
    directions: forestDirections,
    encounter: wolfEncounter,
    modifiers,
    errorMessage: null,
    infoMessage: null
  }, (err, html) => {
    if (err) return console.error('Wolf render error:', err);
    shoot(html, '04b_feral_wolf_encounter.png', 1280, 950);
  });

  // 5. Encounters for the 5 new Pathfinder monsters
  const newMonstersList = [
    { name: 'Ghoul', terrain: 'SWAMP', file: '06_ghoul_encounter.png' },
    { name: 'Giant Spider', terrain: 'FOREST', file: '07_giant_spider_encounter.png' },
    { name: 'Choker', terrain: 'HILLS', file: '08_choker_encounter.png' },
    { name: 'Rust Monster', terrain: 'HILLS', file: '09_rust_monster_encounter.png' },
    { name: 'Manticore', terrain: 'HILLS', file: '10_manticore_encounter.png' }
  ];

  for (const item of newMonstersList) {
    const tile = db.prepare('SELECT * FROM map_tiles WHERE terrain = ? LIMIT 1').get(item.terrain);
    const tileMinimap = getMinimapData(db, tile, 2);
    const tileDirections = getAvailableDirections(db, tile);
    const mon = db.prepare('SELECT * FROM monsters WHERE name = ?').get(item.name);
    if (!mon) continue;

    const descs = JSON.parse(mon.descriptions || '{}');
    const enc = {
      id: 100 + mon.id,
      character_id: 1,
      tile_id: tile.id,
      monster_id: mon.id,
      monster_name: mon.name,
      monster_symbol: mon.symbol,
      monster_color: mon.color,
      status: 'DISCOVERED',
      current_monster_hp: mon.base_hp,
      resolvedDescription: descs['2_ranger_distant'] || descs['1_distant'],
      isRangerSpecial: true,
      imageUrl: '/' + mon.image_path,
      imageSlug: mon.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
    };

    app.render('game', {
      currentUser: { id: 1, username: 'Skugga-Valdi' },
      character: mockRanger,
      currentTile: tile,
      minimap: tileMinimap,
      directions: tileDirections,
      encounter: enc,
      modifiers,
      errorMessage: null,
      infoMessage: null
    }, (err, html) => {
      if (err) return console.error(`Error rendering ${item.name}:`, err);
      shoot(html, item.file, 1280, 950);
    });
  }
}

generateAll();

