const fs = require('fs');
const path = require('path');

// 15x15 map (x: 0..14, y: 0..14)
// (7,7) is Oakhaven City (Safe)
const width = 15;
const height = 15;
const tiles = [];

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    let name = '';
    let terrain = 'PLAINS';
    let feature = null;
    let description = '';
    let isPassable = 1;
    let isSafe = 0;

    // Boundaries / Edge mountains and deep water
    if (x === 0 || y === 0 || y === 14) {
      if (y === 0 || x === 0) {
        terrain = 'MOUNTAINS';
        name = 'Darkmount Peaks';
        description = 'Impassable, razor-sharp crags that cleave the stormy sky. Bitter winds howl through the chasms.';
        isPassable = 0;
      } else {
        terrain = 'SWAMP';
        name = 'The Bottomless Mire';
        description = 'An impassable quagmire where no living creature treads without sinking forever into the black depths.';
        isPassable = 0;
      }
    } else if (x === 14) {
      terrain = 'OCEAN';
      name = 'The Murksea';
      description = 'Churning black swells crash violently against the cliffs. The surging ocean is impassable on foot.';
      isPassable = 0;
    } else if (x === 7 && y === 7) {
      // Center City
      terrain = 'CITY';
      name = 'Oakhaven';
      feature = 'MARKETPLACE';
      description = 'A fortified town standing at the confluence of deep forests and sprawling marshes. Watchfires burn and sentinels keep vigil upon the timber palisades. Here reigns safety and refuge.';
      isSafe = 1;
      isPassable = 1;
    } else if (x === 7 && y === 6) {
      terrain = 'PLAINS';
      name = 'Oakhaven North Gate';
      feature = 'TOWN_GATES';
      description = 'Outside the timber palisades of Oakhaven. The road winds north into the oppressive canopy of the Mirkwood.';
      isSafe = 1;
      isPassable = 1;
    } else if (x === 7 && y === 8) {
      terrain = 'PLAINS';
      name = 'Oakhaven South Gate';
      feature = 'TOWN_GATES';
      description = 'The heavy wooden gates of Oakhaven facing south. The damp air hangs heavy with the stench of stagnant bogs.';
      isSafe = 1;
      isPassable = 1;
    } else if (x === 8 && y === 7) {
      terrain = 'BRIDGE';
      name = 'The Old Stone Bridge';
      feature = 'ANCIENT_BRIDGE';
      description = 'An ancient stone archway spanning a deep and churning river. Weathered, moss-grown stones bear silent witness to forgotten ages.';
      isSafe = 0;
      isPassable = 1;
    } else if (x === 9 && (y >= 4 && y <= 10)) {
      terrain = 'RIVER_LAKE';
      name = 'Blackwater River';
      description = 'A deep and turbulent river of pitch-black water. Impassable without crossing a bridge.';
      isPassable = 0;
    } else if (y <= 5 && x >= 4 && x <= 11) {
      // North: Deep Forest
      terrain = 'FOREST';
      if (x === 7 && y === 3) {
        name = 'Heart of the Mirkwood';
        feature = 'ANCIENT_OAK';
        description = 'Towering ancient boughs blot out what little daylight filters down. Wicked brambles and twisting vines choke ancient tree trunks.';
      } else {
        name = 'Mirkwood Forest';
        description = 'A dense, brooding woodland. The undergrowth is tangled and thick, and a chill wind whispers through the swaying branches.';
      }
    } else if (y >= 9 && x <= 7) {
      // South-West: Swamp
      terrain = 'SWAMP';
      if (x === 4 && y === 11) {
        name = "Deadman's Mire";
        feature = 'SUNK_RUIN';
        description = 'Sunken bogs and putrid pools. The crumbling remnants of ancient stone structures slowly submerge into the murky sludge.';
      } else {
        name = 'Rotting Fen';
        description = 'A treacherous wetland steeped in stagnation. Deceptive moss conceals sucking mud and noxious vapors.';
      }
    } else if (y >= 9 && x >= 8) {
      // South-East: Jungle
      terrain = 'JUNGLE';
      name = 'Venomous Jungle';
      description = 'A suffocating and unforgiving jungle thick with humid mist. Monstrous flora and coiled vines choke every path in menacing tangles.';
    } else if (x <= 4 && y <= 8) {
      // North-West: Hills & Mountains
      terrain = 'HILLS';
      name = 'Raven Crags';
      description = 'Rugged hills and windswept rock faces. Black ravens circle high above the treacherous ravines.';
    } else if (x >= 10 && y <= 6) {
      // North-East: Plains
      terrain = 'PLAINS';
      name = 'Windblown Heath';
      description = 'Bleak, wind-scoured grasslands stretching toward the dim horizon. Pale grass ripples beneath a restless gale.';
    } else {
      // Default Plains / Grasslands
      terrain = 'PLAINS';
      name = 'Verdant Plains';
      description = 'Open grassy plains lying between dark woods and settled lands. Dotted with sparse thornbushes and overgrown trails.';
    }

    tiles.push({
      x,
      y,
      name,
      terrain,
      feature,
      description,
      isPassable,
      isSafe
    });
  }
}

// Generate SQL
let sql = `-- 001_seed_world.sql: 15x15 Seed Map for Darkgrid\n`;
sql += `INSERT INTO map_tiles (x, y, name, terrain, feature, description, is_passable, is_safe) VALUES\n`;

const valueStrings = tiles.map(t => {
  const feat = t.feature ? `'${t.feature}'` : 'NULL';
  const desc = t.description.replace(/'/g, "''");
  const name = t.name.replace(/'/g, "''");
  return `  (${t.x}, ${t.y}, '${name}', '${t.terrain}', ${feat}, '${desc}', ${t.isPassable}, ${t.isSafe})`;
});

sql += valueStrings.join(',\n') + '\n';
sql += `ON CONFLICT(x, y) DO UPDATE SET\n`;
sql += `  name = excluded.name,\n`;
sql += `  terrain = excluded.terrain,\n`;
sql += `  feature = excluded.feature,\n`;
sql += `  description = excluded.description,\n`;
sql += `  is_passable = excluded.is_passable,\n`;
sql += `  is_safe = excluded.is_safe;\n`;

const outPath = path.join(__dirname, '../db/seeds/001_seed_world.sql');
fs.writeFileSync(outPath, sql, 'utf8');
console.log(`Generated ${tiles.length} map tiles into ${outPath}`);
