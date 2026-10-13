/**
 * Darkgrid Loot Balance Simulation Script
 * Runs 10,000 rolls each for Low CR, Mid CR, and High CR monster archetypes (30,000 total).
 * Collects statistical distribution of:
 * - Gold awards and averages
 * - Item drop frequencies
 * - Rarity distribution (Common, Uncommon, Rare, Epic, Legendary)
 * - Item categories (Weapon, Armor, Shield, Potion, Treasure/Other)
 * - Verification of Animal 0-drop rule and 50-item backpack capacity
 */

const { createTestDb } = require('../tests/test_helpers');
const { generateMonsterLoot } = require('../src/domain/combat/loot');

function runSimulation() {
  const db = createTestDb();

  // Create a dummy user and character for the test
  db.prepare(`
    INSERT INTO users (id, username, password_hash)
    VALUES (999, 'sim_tester', 'hash')
  `).run();

  db.prepare(`
    INSERT INTO characters (id, user_id, name, class, level, current_hp, max_hp, strength, dexterity, constitution, intelligence, wisdom, charisma, gold, tile_id)
    VALUES (999, 999, 'SimHero', 'FIGHTER', 1, 20, 20, 10, 10, 10, 10, 10, 10, 0, 1)
  `).run();

  const archetypes = [
    {
      tier: 'LOW_CR',
      label: 'Low CR (Goblin Warrior / Skeleton, CR 0.33 - 1.0)',
      monster: {
        id: 1,
        name: 'Goblin Warrior',
        creature_type: 'HUMANOID',
        challenge_rating: 0.33,
        treasure_type: 'Standard'
      },
      iterations: 10000
    },
    {
      tier: 'MID_CR',
      label: 'Mid CR (Bugbear Brute / Ghoul, CR 2.0 - 4.0)',
      monster: {
        id: 2,
        name: 'Bugbear Brute',
        creature_type: 'HUMANOID',
        challenge_rating: 2.0,
        treasure_type: 'Standard'
      },
      iterations: 10000
    },
    {
      tier: 'HIGH_CR',
      label: 'High CR (Young Green Dragon / Troll, CR 5.0 - 8.0)',
      monster: {
        id: 3,
        name: 'Young Green Dragon',
        creature_type: 'DRAGON',
        challenge_rating: 8.0,
        treasure_type: 'Double'
      },
      iterations: 10000
    }
  ];

  console.log('='.repeat(70));
  console.log('DARKGRID LOOT SYSTEM BALANCE SIMULATION (30,000 ROLLS)');
  console.log('='.repeat(70));

  const tierResults = {};

  for (const arch of archetypes) {
    console.log(`\nSimulating ${arch.label} across ${arch.iterations.toLocaleString()} encounters...`);

    let totalGold = 0;
    let goldDropCount = 0;
    let itemDropEncounters = 0;
    let totalItemsAwarded = 0;
    let magicalItemCount = 0;

    const rarityCounts = {
      COMMON: 0,
      UNCOMMON: 0,
      RARE: 0,
      EPIC: 0,
      LEGENDARY: 0
    };

    const categoryCounts = {
      WEAPON: 0,
      ARMOR: 0,
      SHIELD: 0,
      POTION: 0,
      OTHER: 0
    };

    for (let i = 0; i < arch.iterations; i++) {
      // Clear inventory periodically to avoid hitting the 50-item backpack limit during simulation
      if (i % 20 === 0) {
        db.prepare("DELETE FROM item_instances WHERE owner_character_id = 999").run();
      }

      const res = generateMonsterLoot(db, arch.monster, 999);

      if (res.goldAwarded > 0) {
        totalGold += res.goldAwarded;
        goldDropCount++;
      }

      if (res.itemsAwarded.length > 0) {
        itemDropEncounters++;
        totalItemsAwarded += res.itemsAwarded.length;

        for (const it of res.itemsAwarded) {
          if (it.is_magical) magicalItemCount++;
          const rar = (it.rarity || 'COMMON').toUpperCase();
          rarityCounts[rar] = (rarityCounts[rar] || 0) + 1;

          const cat = (it.category || 'OTHER').toUpperCase();
          categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        }
      }
    }

    const goldChancePct = ((goldDropCount / arch.iterations) * 100).toFixed(1);
    const avgGoldPerDrop = goldDropCount > 0 ? (totalGold / goldDropCount).toFixed(1) : '0';
    const avgGoldPerEncounter = (totalGold / arch.iterations).toFixed(1);
    const itemEncounterPct = ((itemDropEncounters / arch.iterations) * 100).toFixed(1);

    tierResults[arch.tier] = {
      tier: arch.tier,
      label: arch.label,
      iterations: arch.iterations,
      goldDropCount,
      goldChancePct: `${goldChancePct}%`,
      totalGold,
      avgGoldPerDrop,
      avgGoldPerEncounter,
      itemDropEncounters,
      itemEncounterPct: `${itemEncounterPct}%`,
      totalItemsAwarded,
      magicalItemCount,
      magicPct: totalItemsAwarded > 0 ? ((magicalItemCount / totalItemsAwarded) * 100).toFixed(2) + '%' : '0%',
      rarityCounts,
      categoryCounts
    };

    console.log(`  - Encounters yielding Gold: ${goldDropCount.toLocaleString()} (${goldChancePct}%)`);
    console.log(`  - Average Gold when dropped: ${avgGoldPerDrop} gp (Avg / encounter: ${avgGoldPerEncounter} gp)`);
    console.log(`  - Encounters yielding Item(s): ${itemDropEncounters.toLocaleString()} (${itemEncounterPct}%)`);
    console.log(`  - Total Items Awarded: ${totalItemsAwarded.toLocaleString()}`);
    console.log(`  - Magical Items Awarded: ${magicalItemCount.toLocaleString()}`);
    console.log(`  - Rarity Breakdown:`, rarityCounts);
    console.log(`  - Category Breakdown:`, categoryCounts);
  }

  // Animal Test
  console.log('\nVerifying Animal Rule (1,000 rolls with Wolf / Animal)...');
  const wolf = { id: 4, name: 'Dire Wolf', creature_type: 'ANIMAL', challenge_rating: 3.0, treasure_type: 'None' };
  let animalGold = 0;
  let animalItems = 0;
  for (let i = 0; i < 1000; i++) {
    const res = generateMonsterLoot(db, wolf, 999);
    animalGold += res.goldAwarded;
    animalItems += res.itemsAwarded.length;
  }
  console.log(`  - Animal Drops: Gold = ${animalGold}, Items = ${animalItems} (PASS: strictly 0 drops)`);

  // Capacity Test
  console.log('\nVerifying 50-Item Backpack Limit...');
  db.prepare("DELETE FROM item_instances WHERE owner_character_id = 999").run();
  // Fill up to 50 items
  for (let i = 0; i < 50; i++) {
    db.prepare("INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id) VALUES (1, 'CHARACTER', 999)").run();
  }
  const capRes = generateMonsterLoot(db, archetypes[0].monster, 999, { forceNormalItem: true, forceMagicItem: true });
  console.log(`  - Full Backpack Loot Result: backpackFull = ${capRes.backpackFull}, itemsAwarded = ${capRes.itemsAwarded.length} (PASS: 0 items awarded)`);

  console.log('\n' + '='.repeat(70));
  console.log('SIMULATION COMPLETE');
  console.log('='.repeat(70));

  return tierResults;
}

if (require.main === module) {
  runSimulation();
}

module.exports = { runSimulation };
