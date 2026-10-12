const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const app = require('../src/app');
const { getDb } = require('../src/db/connection');
const { getMinimapData, getAvailableDirections } = require('../src/domain/world/map');
const { formatModifier } = require('../src/domain/character/rules');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR = path.join(__dirname, '../screenshots');

function shoot(html, filename, width = 1280, height = 950) {
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
  console.log(`Generated: ${filename} (exists: ${fs.existsSync(outPath)}, size: ${fs.existsSync(outPath) ? fs.statSync(outPath).size : 0} bytes)`);
}

async function run() {
  const db = getDb();

  const hero = {
    id: 1,
    name: 'Skugga-Valdi',
    class: 'RANGER',
    level: 2,
    current_hp: 16,
    max_hp: 18,
    gold: 45,
    xp: 600,
    strength: 12,
    constitution: 10,
    dexterity: 16,
    intelligence: 10,
    wisdom: 13,
    charisma: 10
  };

  const modifiers = {
    strength: formatModifier(hero.strength),
    constitution: formatModifier(hero.constitution),
    dexterity: formatModifier(hero.dexterity),
    intelligence: formatModifier(hero.intelligence),
    wisdom: formatModifier(hero.wisdom),
    charisma: formatModifier(hero.charisma)
  };

  const showcaseMonsters = [
    { name: 'Assassin Vine', terrain: 'FOREST', prefix: 'stage_assassin_vine' },
    { name: 'Ghoul', terrain: 'SWAMP', prefix: 'stage_ghoul' },
    { name: 'Giant Spider', terrain: 'FOREST', prefix: 'stage_giant_spider' },
    { name: 'Rust Monster', terrain: 'HILLS', prefix: 'stage_rust_monster' }
  ];

  for (const item of showcaseMonsters) {
    const tile = db.prepare('SELECT * FROM map_tiles WHERE terrain = ? LIMIT 1').get(item.terrain);
    const minimap = getMinimapData(db, tile, 2);
    const directions = getAvailableDirections(db, tile);
    const monster = db.prepare('SELECT * FROM monsters WHERE name = ?').get(item.name);
    if (!monster) continue;

    const descs = JSON.parse(monster.descriptions || '{}');

    // 1. Stage 1: Unknown Threat (DISCOVERED)
    const encStage1 = {
      id: 200 + monster.id,
      character_id: hero.id,
      tile_id: tile.id,
      monster_id: monster.id,
      monster_name: monster.name,
      monster_symbol: monster.symbol,
      monster_color: monster.color,
      status: 'DISCOVERED',
      isRevealed: false,
      current_monster_hp: monster.base_hp,
      resolvedDescription: descs['2_ranger_distant'] || descs['1_distant'],
      isRangerSpecial: true,
      imageUrl: '/' + monster.image_path,
      imageSlug: monster.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
    };

    await new Promise((resolve) => {
      app.render('game', {
        currentUser: { id: 1, username: 'Skugga-Valdi' },
        character: hero,
        currentTile: tile,
        minimap,
        directions,
        encounter: encStage1,
        modifiers,
        errorMessage: null,
        infoMessage: null
      }, (err, html) => {
        if (err) return console.error('Render err stage 1:', err);
        shoot(html, `${item.prefix}_1_unknown.png`, 1280, 950);
        resolve();
      });
    });

    // 2. Stage 2: Revealed Monster (IN_COMBAT)
    const encStage2 = {
      ...encStage1,
      status: 'IN_COMBAT',
      isRevealed: true,
      resolvedDescription: descs['4_ranger_close'] || descs['3_close']
    };

    await new Promise((resolve) => {
      app.render('game', {
        currentUser: { id: 1, username: 'Skugga-Valdi' },
        character: hero,
        currentTile: tile,
        minimap,
        directions,
        encounter: encStage2,
        modifiers,
        errorMessage: null,
        infoMessage: null
      }, (err, html) => {
        if (err) return console.error('Render err stage 2:', err);
        shoot(html, `${item.prefix}_2_revealed.png`, 1280, 950);
        resolve();
      });
    });
  }

  console.log('All showcase screenshots generated successfully!');
}

run();
