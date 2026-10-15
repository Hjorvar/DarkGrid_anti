-- 010_seed_night_work_loot_and_30_monsters.sql
-- Night-Work Session:
-- 1. Rebalance Level 1 outlier monsters (Orc, Human Zombie, Gnoll, Hyena) to prevent unfair Round-1 spikes
-- 2. Set progressive min_cr tiers on mundane and magical equipment and connect all 55 unlinked active items into loot tables
-- 3. Add 4 new creature-type loot tables (MONSTROUS_HUMANOID_SPOILS, FEY_CURIOS, PLANT_TROVE, VERMIN_CARCASS_CACHE) and tune DRAGON_HOARD
-- 4. Seed 30 new Pathfinder-inspired monsters across Levels 1-5 (6 per level) and active terrains (FOREST, SWAMP, PLAINS, JUNGLE, HILLS)

-- ============================================================================
-- 1. LEVEL 1 OUTLIER MONSTER REBALANCE
-- ============================================================================

UPDATE monsters
SET attack_bonus = 3,
    damage_dice = '1d6+2'
WHERE name = 'Orc';

UPDATE monsters
SET attack_bonus = 2,
    damage_dice = '1d6+2'
WHERE name = 'Human Zombie';

UPDATE monsters
SET attack_bonus = 3,
    damage_dice = '1d6+2'
WHERE name = 'Gnoll';

UPDATE monsters
SET damage_dice = '1d6+1'
WHERE name = 'Hyena';

-- ============================================================================
-- 2. ITEM PROGRESSION TIER GATING (min_cr)
-- ============================================================================

-- Tier 0 (CR 0+): Simple & starter-tier weapons, light armor, wooden shields
UPDATE item_definitions SET min_cr = 0 WHERE name IN (
    'Club', 'Dagger', 'Shortsword', 'Handaxe', 'Light Mace', 'Quarterstaff',
    'Shortspear', 'Spear', 'Sling', 'Dart', 'Javelin', 'Shortbow',
    'Padded Armor', 'Leather Armor', 'Studded Leather Armor', 'Hide Armor',
    'Buckler', 'Light Wooden Shield', 'Heavy Wooden Shield'
);

-- Tier 1 (CR 1+): Martial one-handed weapons, polearms, standard bows/crossbows, medium armor, steel shields
UPDATE item_definitions SET min_cr = 1 WHERE name IN (
    'Longsword', 'Battleaxe', 'Warhammer', 'Heavy Mace', 'Morningstar',
    'Light Flail', 'Scimitar', 'Rapier', 'Greatclub', 'Glaive', 'Halberd',
    'Light Crossbow', 'Longbow', 'Scale Mail', 'Armored Coat', 'Chain Shirt',
    'Light Steel Shield', 'Heavy Steel Shield'
);

-- Tier 2 (CR 2+): Heavy two-handed martial weapons, composite bows, hand crossbow, chainmail, breastplate, tower shield
UPDATE item_definitions SET min_cr = 2 WHERE name IN (
    'Greatsword', 'Greataxe', 'Falchion', 'Heavy Flail', 'Scythe',
    'Heavy Crossbow', 'Composite Shortbow', 'Composite Longbow', 'Hand Crossbow',
    'Chainmail', 'Breastplate', 'Tower Shield'
);

-- Tier 3 (CR 3+): Advanced medium and heavy armors
UPDATE item_definitions SET min_cr = 3 WHERE name IN (
    'Agile Breastplate', 'Splint Mail', 'Banded Mail', 'Half-Plate'
);

-- Tier 4 (CR 4+): Masterwork Full Plate
UPDATE item_definitions SET min_cr = 4 WHERE name IN (
    'Full Plate'
);

-- Magical +1/+2 CR gating for smooth Level 1-5 attainment
UPDATE item_definitions SET min_cr = 1 WHERE name IN (
    'Dagger +1', 'Leather Armor +1', 'Chain Shirt +1', 'Light Steel Shield +1',
    'Heavy Steel Shield +1', 'Longsword +1', 'Heavy Mace +1'
);

UPDATE item_definitions SET min_cr = 2 WHERE name IN (
    'Shortsword +1', 'Battleaxe +1', 'Warhammer +1', 'Shortbow +1',
    'Longbow +1', 'Light Crossbow +1', 'Greatsword +1', 'Scale Mail +1',
    'Chainmail +1', 'Breastplate +1'
);

UPDATE item_definitions SET min_cr = 3 WHERE name IN (
    'Full Plate +1'
);

UPDATE item_definitions SET min_cr = 4 WHERE name IN (
    'Longsword +2', 'Longbow +2', 'Chain Shirt +2', 'Breastplate +2',
    'Full Plate +2', 'Heavy Steel Shield +2'
);

-- ============================================================================
-- 3. EXPANDED LOOT TABLES FOR ALL ACTIVE CREATURE TYPES
-- ============================================================================

UPDATE loot_tables
SET min_cr = 2.0,
    magic_chance_multiplier = 2.0
WHERE code = 'DRAGON_HOARD';

INSERT INTO loot_tables (
    code, name, creature_type, min_cr, max_cr, gold_multiplier, item_chance, magic_chance_multiplier, description
) VALUES
(
    'MONSTROUS_HUMANOID_SPOILS',
    'Monstrous Humanoid War Spoils',
    'MONSTROUS HUMANOID',
    0.0, 99.0,
    1.2, 0.40, 1.2,
    'Savage warlords, hags, minotaurs, and harpies hoarding martial weapons, trophies, and enchanted gear.'
),
(
    'FEY_CURIOS',
    'Fey Woodland Curios',
    'FEY',
    0.0, 99.0,
    0.9, 0.35, 1.3,
    'Trickster fey, mites, and spriggans carrying light blades, bows, gemstones, and enchanted trinkets.'
),
(
    'PLANT_TROVE',
    'Overgrown Tendril Trove',
    'PLANT',
    0.0, 99.0,
    0.8, 0.30, 1.0,
    'Carnivorous flora and fungal horrors tangling the weapons, armor, and potions of digested adventurers.'
),
(
    'VERMIN_CARCASS_CACHE',
    'Web & Chitin Victim Cache',
    'VERMIN',
    0.0, 99.0,
    0.7, 0.28, 0.9,
    'Cocoons and lair detritus of giant insects and arachnids holding surviving gear and coins.'
)
ON CONFLICT(code) DO UPDATE SET
    name = excluded.name,
    creature_type = excluded.creature_type,
    min_cr = excluded.min_cr,
    max_cr = excluded.max_cr,
    gold_multiplier = excluded.gold_multiplier,
    item_chance = excluded.item_chance,
    magic_chance_multiplier = excluded.magic_chance_multiplier,
    description = excluded.description;

-- ============================================================================
-- 4. CONNECT ALL 55 ACTIVE UNLINKED ITEMS INTO LOOT TABLE ENTRIES
-- ============================================================================

-- 4a. HUMANOID_MUNDANE (CR 0 - 2.0 Humanoids)
INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 20, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'HUMANOID_MUNDANE' AND id.name IN (
    'Club', 'Quarterstaff', 'Shortspear', 'Spear', 'Light Mace', 'Greatclub',
    'Sling', 'Dart', 'Javelin', 'Padded Armor', 'Hide Armor',
    'Light Wooden Shield', 'Heavy Wooden Shield'
);

INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 14, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'HUMANOID_MUNDANE' AND id.name IN (
    'Longsword', 'Battleaxe', 'Warhammer', 'Heavy Mace', 'Morningstar',
    'Light Flail', 'Scimitar', 'Rapier', 'Glaive', 'Halberd',
    'Light Crossbow', 'Longbow', 'Scale Mail', 'Armored Coat', 'Chain Shirt',
    'Light Steel Shield', 'Heavy Steel Shield', 'Potion of Cure Light Wounds'
);

INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 10, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'HUMANOID_MUNDANE' AND id.name IN (
    'Dagger +1', 'Shortsword +1', 'Shortbow +1', 'Light Crossbow +1',
    'Leather Armor +1', 'Light Steel Shield +1'
);

-- 4b. HUMANOID_ELITE (CR 2.1+ Humanoids)
INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 18, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'HUMANOID_ELITE' AND id.name IN (
    'Greatsword', 'Greataxe', 'Falchion', 'Heavy Flail', 'Warhammer',
    'Heavy Mace', 'Rapier', 'Scimitar', 'Halberd', 'Glaive',
    'Longbow', 'Composite Shortbow', 'Composite Longbow', 'Hand Crossbow',
    'Scale Mail', 'Chainmail', 'Tower Shield', 'Splint Mail',
    'Banded Mail', 'Agile Breastplate', 'Half-Plate', 'Full Plate'
);

INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 14, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'HUMANOID_ELITE' AND id.name IN (
    'Shortsword +1', 'Battleaxe +1', 'Warhammer +1', 'Heavy Mace +1', 'Greatsword +1',
    'Shortbow +1', 'Longbow +1', 'Light Crossbow +1',
    'Scale Mail +1', 'Chainmail +1', 'Breastplate +1', 'Full Plate +1',
    'Light Steel Shield +1', 'Heavy Steel Shield +1', 'Potion of Cure Serious Wounds'
);

INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 8, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'HUMANOID_ELITE' AND id.name IN (
    'Longsword +2', 'Longbow +2', 'Chain Shirt +2', 'Breastplate +2',
    'Full Plate +2', 'Heavy Steel Shield +2'
);

-- 4c. UNDEAD_HAUNT (CR 0 - 3.0 Undead)
INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 18, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'UNDEAD_HAUNT' AND id.name IN (
    'Light Mace', 'Heavy Mace', 'Warhammer', 'Shortsword', 'Longsword',
    'Spear', 'Chain Shirt', 'Scale Mail', 'Chainmail', 'Light Steel Shield', 'Heavy Wooden Shield'
);

INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 12, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'UNDEAD_HAUNT' AND id.name IN (
    'Dagger +1', 'Heavy Mace +1', 'Warhammer +1', 'Chainmail +1',
    'Light Steel Shield +1', 'Heavy Steel Shield +1', 'Potion of Cure Moderate Wounds'
);

-- 4d. UNDEAD_ANCIENT (CR 3.1+ Undead)
INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 18, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'UNDEAD_ANCIENT' AND id.name IN (
    'Greatsword', 'Greataxe', 'Falchion', 'Heavy Flail', 'Scythe',
    'Breastplate', 'Splint Mail', 'Banded Mail', 'Half-Plate', 'Full Plate', 'Tower Shield'
);

INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 12, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'UNDEAD_ANCIENT' AND id.name IN (
    'Longsword +1', 'Battleaxe +1', 'Warhammer +1', 'Longbow +1',
    'Chainmail +1', 'Breastplate +1', 'Heavy Steel Shield +1',
    'Longsword +2', 'Chain Shirt +2', 'Breastplate +2', 'Full Plate +2', 'Heavy Steel Shield +2'
);

-- 4e. MAGICAL_BEAST_LAIR
INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 16, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'MAGICAL_BEAST_LAIR' AND id.name IN (
    'Spear', 'Longbow', 'Composite Shortbow', 'Composite Longbow',
    'Hide Armor', 'Scale Mail', 'Chain Shirt', 'Breastplate', 'Agile Breastplate'
);

INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 14, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'MAGICAL_BEAST_LAIR' AND id.name IN (
    'Shortbow +1', 'Longbow +1', 'Shortsword +1', 'Battleaxe +1',
    'Leather Armor +1', 'Scale Mail +1', 'Breastplate +1',
    'Longbow +2', 'Breastplate +2', 'Potion of Cure Light Wounds', 'Potion of Cure Moderate Wounds'
);

-- 4f. DRAGON_HOARD (Ensure balanced weights so Legendary items remain < 1% of total drops)
INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 18, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'DRAGON_HOARD' AND id.name IN (
    'Shortsword +1', 'Dagger +1', 'Battleaxe +1', 'Warhammer +1', 'Heavy Mace +1',
    'Greatsword +1', 'Shortbow +1', 'Longbow +1', 'Light Crossbow +1',
    'Leather Armor +1', 'Scale Mail +1', 'Chainmail +1', 'Breastplate +1', 'Light Steel Shield +1'
);

INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 12, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'DRAGON_HOARD' AND id.name IN (
    'Longsword +2', 'Longbow +2', 'Chain Shirt +2', 'Breastplate +2', 'Heavy Steel Shield +2'
);

-- 4g. ABERRATION_CACHE
INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 16, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'ABERRATION_CACHE' AND id.name IN (
    'Morningstar', 'Light Crossbow', 'Heavy Crossbow', 'Hand Crossbow',
    'Rapier', 'Chain Shirt', 'Breastplate', 'Splint Mail'
);

INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 14, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'ABERRATION_CACHE' AND id.name IN (
    'Dagger +1', 'Light Crossbow +1', 'Shortsword +1', 'Warhammer +1',
    'Chain Shirt +1', 'Scale Mail +1', 'Chain Shirt +2', 'Potion of Cure Moderate Wounds'
);

-- 4h. MONSTROUS_HUMANOID_SPOILS
INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 20, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'MONSTROUS_HUMANOID_SPOILS' AND id.name IN (
    'Greatclub', 'Battleaxe', 'Greataxe', 'Greatsword', 'Falchion',
    'Spear', 'Javelin', 'Composite Longbow', 'Hide Armor', 'Scale Mail',
    'Breastplate', 'Agile Breastplate', 'Heavy Steel Shield', 'Carved Mammoth Tusk', 'Rough Emerald'
);

INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 14, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'MONSTROUS_HUMANOID_SPOILS' AND id.name IN (
    'Battleaxe +1', 'Greatsword +1', 'Longbow +1', 'Scale Mail +1',
    'Breastplate +1', 'Longsword +2', 'Breastplate +2',
    'Potion of Cure Moderate Wounds', 'Potion of Cure Serious Wounds'
);

-- 4i. FEY_CURIOS
INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 20, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'FEY_CURIOS' AND id.name IN (
    'Dagger', 'Shortsword', 'Rapier', 'Shortbow', 'Longbow', 'Composite Shortbow',
    'Dart', 'Sling', 'Leather Armor', 'Studded Leather Armor', 'Chain Shirt',
    'Buckler', 'Light Wooden Shield', 'Uncut Garnet', 'Rough Emerald'
);

INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 15, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'FEY_CURIOS' AND id.name IN (
    'Dagger +1', 'Shortsword +1', 'Shortbow +1', 'Longbow +1',
    'Leather Armor +1', 'Chain Shirt +1', 'Ring of Protection +1',
    'Minor Healing Potion', 'Potion of Cure Light Wounds', 'Potion of Cure Moderate Wounds'
);

-- 4j. PLANT_TROVE
INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 20, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'PLANT_TROVE' AND id.name IN (
    'Club', 'Quarterstaff', 'Spear', 'Handaxe', 'Scimitar', 'Glaive',
    'Sling', 'Shortbow', 'Leather Armor', 'Hide Armor', 'Scale Mail',
    'Heavy Wooden Shield', 'Uncut Garnet', 'Polished Bloodstone', 'Amber Dragon Tear'
);

INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 14, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'PLANT_TROVE' AND id.name IN (
    'Battleaxe +1', 'Shortbow +1', 'Leather Armor +1', 'Amulet of Natural Armor +1',
    'Minor Healing Potion', 'Potion of Cure Light Wounds', 'Potion of Cure Moderate Wounds'
);

-- 4k. VERMIN_CARCASS_CACHE
INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 20, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'VERMIN_CARCASS_CACHE' AND id.name IN (
    'Dagger', 'Shortsword', 'Shortspear', 'Light Mace', 'Light Crossbow',
    'Javelin', 'Padded Armor', 'Leather Armor', 'Studded Leather Armor',
    'Buckler', 'Light Steel Shield', 'Uncut Garnet'
);

INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 14, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'VERMIN_CARCASS_CACHE' AND id.name IN (
    'Dagger +1', 'Shortsword +1', 'Light Crossbow +1', 'Leather Armor +1',
    'Light Steel Shield +1', 'Minor Healing Potion', 'Potion of Cure Light Wounds'
);

-- 4l. GENERIC_WILDERNESS (Fallback)
INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 15, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'GENERIC_WILDERNESS' AND id.name IN (
    'Spear', 'Handaxe', 'Light Mace', 'Longsword', 'Battleaxe', 'Warhammer',
    'Light Crossbow', 'Longbow', 'Studded Leather Armor', 'Hide Armor',
    'Scale Mail', 'Chain Shirt', 'Buckler', 'Light Steel Shield', 'Heavy Steel Shield'
);

INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 10, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'GENERIC_WILDERNESS' AND id.name IN (
    'Shortsword +1', 'Battleaxe +1', 'Warhammer +1', 'Shortbow +1', 'Longbow +1',
    'Leather Armor +1', 'Chain Shirt +1', 'Scale Mail +1', 'Light Steel Shield +1',
    'Potion of Cure Moderate Wounds'
);

-- ============================================================================
-- 5. SEED 30 NEW MONSTERS (LEVELS 1-5) & TERRAIN BINDINGS
-- ============================================================================

-- Monster: Mite (Level 1, CR 0.25, Fey)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, defeated_image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Mite', 'm', '#4682b4', 4, 100, '1d3',
    1, 13, 1, 0.25,
    1, 12, '["F","H"]', 'WALK',
    '["hatred", "vermin_empathy", "low_light_vision"]', 'images/monsters/mite.png', 'images/monsters/mite_defeated.png', '{"1_distant":"High-pitched, spiteful giggling echoes from a tangle of hollow tree roots, accompanied by the metallic scrape of a notched blade.","2_ranger_distant":"Tiny barefoot tracks and cruel snare-wires laid across the game trail betray a diminutive, subterranean-dwelling fey gremlin.","3_close":"A hunched, warty blue-skinned gremlin with oversized bat-like ears, weeping pale eyes, and a rusted dagger clutched in knotted fingers.","4_ranger_close":"Sunlight and decisive steel rattle its cowardly resolve; strike before its spiteful lunge catches your exposed tendons.","5_health_100":"The blue-skinned gremlin capers among the roots, brandishing its rusted blade with a malicious, gap-toothed sneer.","6_health_75":"Dark ichor leaks from a shallow cut across its shoulder, turning its gleeful cackling into a furious, spitting hiss.","7_health_50":"Battered and limping, the little fey horror clutches its bruised ribs while slashing wildly from the shadows.","8_health_25":"Whimpering in terror and bleeding heavily, the cornered gremlin makes one last frantic, blind stab.","9_dead":"The twisted blue gremlin lies motionless among the gnarled roots, its rusted dagger fallen from its slack grasp."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Mite',
    'Fey', NULL, 'Standard'
)
ON CONFLICT(name) DO UPDATE SET
    symbol = excluded.symbol,
    color = excluded.color,
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    initiative_bonus = excluded.initiative_bonus,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    spawn_weight = excluded.spawn_weight,
    habitat = excluded.habitat,
    movement_type = excluded.movement_type,
    special_abilities = excluded.special_abilities,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    defeated_image_path = excluded.defeated_image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

DELETE FROM monster_terrains WHERE monster_id = (SELECT id FROM monsters WHERE name = 'Mite');
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 1 FROM monsters WHERE name = 'Mite';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Mite';

-- Monster: Bog Strider (Level 1, CR 0.5, Vermin)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, defeated_image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Bog Strider', 'b', '#556b2f', 6, 200, '1d4+1',
    2, 14, 2, 0.5,
    1, 12, '["S","J"]', 'WALK',
    '["water_stride", "lunge", "darkvision"]', 'images/monsters/bog_strider.png', 'images/monsters/bog_strider_defeated.png', '{"1_distant":"Concentric ripples spread rapidly across the black marsh water as a long-legged silhouette skims effortlessly over the surface.","2_ranger_distant":"Dimpled surface tension and drained reed-frogs mark the hunting ground of a predatory marsh insect that skates upon stagnant pools.","3_close":"A dog-sized, chitinous marsh insect balanced on six spindly stilt-like legs, with mottled reed-green plates and piercing mandibles.","4_ranger_close":"It lunges with sudden bursts of speed across water and mud alike; shatter its brittle stilt-legs to rob it of mobility.","5_health_100":"Poised upon the dark mire, the stilt-legged insect clicks its mandibles and darts forward with uncanny speed.","6_health_75":"One of its elongated legs buckles with a dry crack, though the insect continues skimming aggressively in tight arcs.","7_health_50":"Viscous greenish hemolymph oozes from cracked carapace plates as the predator hisses and snaps in agitation.","8_health_25":"Dragging two shattered limbs through the muck, the crippled insect lunges in a spasmodic final frenzy.","9_dead":"The chitinous marsh insect floats overturned in the stagnant pool, its spindly legs curled inward in death."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Water%20Strider,%20Giant',
    'Vermin', 'aquatic', 'Incidental'
)
ON CONFLICT(name) DO UPDATE SET
    symbol = excluded.symbol,
    color = excluded.color,
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    initiative_bonus = excluded.initiative_bonus,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    spawn_weight = excluded.spawn_weight,
    habitat = excluded.habitat,
    movement_type = excluded.movement_type,
    special_abilities = excluded.special_abilities,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    defeated_image_path = excluded.defeated_image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

DELETE FROM monster_terrains WHERE monster_id = (SELECT id FROM monsters WHERE name = 'Bog Strider');
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 1 FROM monsters WHERE name = 'Bog Strider';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'JUNGLE', 0 FROM monsters WHERE name = 'Bog Strider';

-- Monster: Blood Hawk (Level 1, CR 0.5, Animal)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, defeated_image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Blood Hawk', 'h', '#b22222', 5, 200, '1d4',
    3, 15, 4, 0.5,
    1, 12, '["P","H","F"]', 'FLY',
    '["bleed", "keen_sight", "flight"]', 'images/monsters/blood_hawk.png', 'images/monsters/blood_hawk_defeated.png', '{"1_distant":"A piercing, metallic shriek splits the open sky as a crimson-winged shadow circles high above the wind-bent grass.","2_ranger_distant":"Crimson contour feathers and shredded rabbit pelts on the rocks point to an aggressive, blood-maddened raptor hunting from above.","3_close":"A fierce raptor with dark rust-red plumage, cold amber eyes, and a hooked ivory beak stained with dried gore.","4_ranger_close":"Its razor talons tear arteries open on the stoop; keep your shield raised or time your swing as it dives.","5_health_100":"Wings tucked tight, the crimson raptor hurtles downward with splayed talons aimed straight at your face.","6_health_75":"Scattered red feathers drift on the wind as the wounded bird banks sharply for another vicious pass.","7_health_50":"One wing beats unevenly and blood mats its breast plumage, yet its amber eyes burn with unrelenting ferocity.","8_health_25":"Barely able to stay aloft, the battered raptor screeches hoarsely and makes a reckless, plunging strike.","9_dead":"The crimson-plumed raptor lies crumpled in the tall grass, its hooked beak and talons finally still."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Hawk',
    'Animal', NULL, 'None'
)
ON CONFLICT(name) DO UPDATE SET
    symbol = excluded.symbol,
    color = excluded.color,
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    initiative_bonus = excluded.initiative_bonus,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    spawn_weight = excluded.spawn_weight,
    habitat = excluded.habitat,
    movement_type = excluded.movement_type,
    special_abilities = excluded.special_abilities,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    defeated_image_path = excluded.defeated_image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

DELETE FROM monster_terrains WHERE monster_id = (SELECT id FROM monsters WHERE name = 'Blood Hawk');
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'PLAINS', 1 FROM monsters WHERE name = 'Blood Hawk';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Blood Hawk';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 0 FROM monsters WHERE name = 'Blood Hawk';

-- Monster: Jungle Viper (Level 1, CR 0.5, Animal)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, defeated_image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Jungle Viper', 'v', '#2e8b57', 5, 200, '1d3',
    3, 15, 4, 0.5,
    1, 12, '["J","F","S"]', 'WALK',
    '["poison", "scent", "climb"]', 'images/monsters/jungle_viper.png', 'images/monsters/jungle_viper_defeated.png', '{"1_distant":"A dry, rhythmic sibilance whispers from the drooping canopy vines, where something banded in emerald and black shifts silently.","2_ranger_distant":"Shed diamond-patterned scales clinging to the damp bark warn of an arboreal pit viper waiting to strike from overhang branches.","3_close":"A thick-bodied emerald and obsidian pit viper coiled taut upon a mossy bough, hollow fangs dripping pale amber venom.","4_ranger_close":"Its lightning strike injects burning hemotoxin; watch the tension of its neck coils and sever it behind the triangular head.","5_health_100":"Coiled like a tempered spring, the emerald serpent flares its jaws and lashes out with blinding speed.","6_health_75":"A bleeding slash mars its banded scales, prompting a furious hiss as it recoils into a tighter striking stance.","7_health_50":"Half-crushed scales trail dark blood across the moss, though its venom-dripping fangs still snap with lethal intent.","8_health_25":"Writhing weakly in the undergrowth, the mangled serpent makes one final, desperate lunge.","9_dead":"The emerald-and-black serpent lies limp and lifeless across the mossy stones, its venom spent."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Viper',
    'Animal', NULL, 'None'
)
ON CONFLICT(name) DO UPDATE SET
    symbol = excluded.symbol,
    color = excluded.color,
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    initiative_bonus = excluded.initiative_bonus,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    spawn_weight = excluded.spawn_weight,
    habitat = excluded.habitat,
    movement_type = excluded.movement_type,
    special_abilities = excluded.special_abilities,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    defeated_image_path = excluded.defeated_image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

DELETE FROM monster_terrains WHERE monster_id = (SELECT id FROM monsters WHERE name = 'Jungle Viper');
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'JUNGLE', 1 FROM monsters WHERE name = 'Jungle Viper';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 0 FROM monsters WHERE name = 'Jungle Viper';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 0 FROM monsters WHERE name = 'Jungle Viper';

-- Monster: Plague Zombie (Level 1, CR 0.5, Undead)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, defeated_image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Plague Zombie', 'z', '#6b8e23', 8, 200, '1d6+1',
    -1, 12, 2, 0.5,
    1, 12, '["H","P","S"]', 'WALK',
    '["disease", "death_burst", "undead_traits"]', 'images/monsters/plague_zombie.png', 'images/monsters/plague_zombie_defeated.png', '{"1_distant":"Arasping, wet wheeze and the sickly-sweet stench of pestilence drift down the rocky slope ahead.","2_ranger_distant":"Dragging footprints smeared with black ichor and swarm-flies indicate a corpse animated by necromantic contagion.","3_close":"A shambling, bloated cadaver in rotted linen and rusted chain scraps, its pallid grey flesh swollen with weeping pustules.","4_ranger_close":"Slashing weapons cut best through its rotted flesh, but beware the pressurized cloud of contagion when it collapses.","5_health_100":"Milky, sightless eyes lock onto you as the pustule-ridden corpse lurches forward with outstretched, filth-caked hands.","6_health_75":"Rotted muscle tears under your blow, leaking foul black humor without slowing the creature’s relentless advance.","7_health_50":"One arm hangs by a shred of sinew and its ribcage gapes open, yet the diseased husk staggers onward.","8_health_25":"Shattered and barely upright, the putrid corpse claws blindly through the air in a final spasm.","9_dead":"The pestilent corpse collapses into a motionless heap of rotted rags and silent bone."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Plague%20Zombie',
    'Undead', NULL, 'Standard'
)
ON CONFLICT(name) DO UPDATE SET
    symbol = excluded.symbol,
    color = excluded.color,
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    initiative_bonus = excluded.initiative_bonus,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    spawn_weight = excluded.spawn_weight,
    habitat = excluded.habitat,
    movement_type = excluded.movement_type,
    special_abilities = excluded.special_abilities,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    defeated_image_path = excluded.defeated_image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

DELETE FROM monster_terrains WHERE monster_id = (SELECT id FROM monsters WHERE name = 'Plague Zombie');
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 1 FROM monsters WHERE name = 'Plague Zombie';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'PLAINS', 0 FROM monsters WHERE name = 'Plague Zombie';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 0 FROM monsters WHERE name = 'Plague Zombie';

-- Monster: Grippli Scout (Level 1, CR 0.5, Humanoid)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, defeated_image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Grippli Scout', 'g', '#3cb371', 6, 200, '1d6',
    3, 15, 3, 0.5,
    1, 12, '["J","S","F"]', 'WALK',
    '["swamp_stride", "camouflage", "poison_use"]', 'images/monsters/grippli_scout.png', 'images/monsters/grippli_scout_defeated.png', '{"1_distant":"A low, resonant croak and the rustle of broad fern fronds betray a nimble hunter watching from the humid canopy.","2_ranger_distant":"Webbed, three-toed tracks on the slick roots and notched blowgun darts mark a territorial tree-frog humanoid outrider.","3_close":"A lithe, frog-like humanoid with mottled olive-and-amber skin, bulbous golden eyes, and a barbed bone hunting spear.","4_ranger_close":"It uses marsh cover and agile leaps to dart in and out of reach; corner it on firm ground to break its rhythm.","5_health_100":"Crouching low on muscular hind legs, the amphibian hunter levels its barbed bone spear with unblinking golden eyes.","6_health_75":"Bleeding from a gash along its flank, the agile scout bounds sideways across a slick root to counterattack.","7_health_50":"Breathing heavily with its throat sac pulsing rapidly, the wounded hunter parries desperately with its spear shaft.","8_health_25":"Slumped against a mossy trunk and losing blood, the amphibian warrior makes a final, defiant thrust.","9_dead":"The mottled amphibian scout lies still upon the jungle floor beside its dropped bone spear."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Grippli',
    'Humanoid', 'grippli', 'Standard'
)
ON CONFLICT(name) DO UPDATE SET
    symbol = excluded.symbol,
    color = excluded.color,
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    initiative_bonus = excluded.initiative_bonus,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    spawn_weight = excluded.spawn_weight,
    habitat = excluded.habitat,
    movement_type = excluded.movement_type,
    special_abilities = excluded.special_abilities,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    defeated_image_path = excluded.defeated_image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

DELETE FROM monster_terrains WHERE monster_id = (SELECT id FROM monsters WHERE name = 'Grippli Scout');
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'JUNGLE', 1 FROM monsters WHERE name = 'Grippli Scout';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 0 FROM monsters WHERE name = 'Grippli Scout';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 0 FROM monsters WHERE name = 'Grippli Scout';

-- Monster: Worg (Level 2, CR 2, Magical Beast)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, defeated_image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Worg', 'W', '#2f4f4f', 17, 600, '1d6+3',
    2, 14, 5, 2,
    2, 10, '["P","F","H"]', 'WALK',
    '["trip", "scent", "low_light_vision"]', 'images/monsters/worg.png', 'images/monsters/worg_defeated.png', '{"1_distant":"A chilling, guttural snarl laced with cruel intelligence rumbles across the twilight grassland.","2_ranger_distant":"Oversized lupine pawprints and gnawed traveler gear reveal a cunning, black-pelted dire predator that hunts speaking prey.","3_close":"A massive, coal-black lupine beast with a scarred muzzle, jagged ivory fangs, and eyes burning with malevolent yellow cunning.","4_ranger_close":"It snaps at ankles to wrench its quarry off balance before tearing the throat; brace your stance against its tripping jaws.","5_health_100":"The coal-black beast stalks low through the grass, curling its lip in a mocking, gravelly snarl as it lunges.","6_health_75":"Crimson blood mats its coarse dark fur, fueling a ferocious retaliatory snap of its bone-crushing jaws.","7_health_50":"Snarling through bloodied fangs, the wounded predator circles warily, looking for an opening to drag you down.","8_health_25":"Hackles raised and hind legs trembling from deep wounds, the cornered beast hurls itself forward in a last frenzy.","9_dead":"The massive coal-black predator lies vanquished in the trampled grass, its fiery yellow eyes extinguished."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Worg',
    'Magical Beast', NULL, 'Incidental'
)
ON CONFLICT(name) DO UPDATE SET
    symbol = excluded.symbol,
    color = excluded.color,
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    initiative_bonus = excluded.initiative_bonus,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    spawn_weight = excluded.spawn_weight,
    habitat = excluded.habitat,
    movement_type = excluded.movement_type,
    special_abilities = excluded.special_abilities,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    defeated_image_path = excluded.defeated_image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

DELETE FROM monster_terrains WHERE monster_id = (SELECT id FROM monsters WHERE name = 'Worg');
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'PLAINS', 1 FROM monsters WHERE name = 'Worg';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 0 FROM monsters WHERE name = 'Worg';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Worg';

-- Monster: Hippogriff (Level 2, CR 2, Magical Beast)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, defeated_image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Hippogriff', 'H', '#cd853f', 17, 600, '1d6+3',
    2, 15, 5, 2,
    2, 10, '["H","P"]', 'FLY',
    '["wing_buffet", "dive", "flight"]', 'images/monsters/hippogriff.png', 'images/monsters/hippogriff_defeated.png', '{"1_distant":"Heavy, rhythmic wingbeats buffet the highland wind as a hybrid silhouette of feathers and hooves crests the rocky ridge.","2_ranger_distant":"Deep equine hoofprints paired with three-toed raptor gouges on the crags mark the nesting territory of an avian-equine predator.","3_close":"A fierce, proud creature combining the bronze-plumed wings, talons, and hooked beak of a giant eagle with a muscular bay charger.","4_ranger_close":"It batters foes with powerful wing-strokes between beak and talon strikes; ranged shots or disciplined guard work best.","5_health_100":"Rearing on its muscular hindquarters, the winged beast unfurls its vast pinions and strikes with beak and fore-talons.","6_health_75":"Severed bronze feathers whirl around the crag as the wounded beast shrieks and batters the air with heavy wingbeats.","7_health_50":"Bleeding from its flank and struggling to stay airborne, the hybrid predator slashes viciously at close quarters.","8_health_25":"Grounded and gasping through a bloodied beak, the proud beast lashes out in one final, defiant surge.","9_dead":"The eagle-headed beast lies motionless upon the highland stones, its great feathered wings folded in defeat."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Hippogriff',
    'Magical Beast', NULL, 'Incidental'
)
ON CONFLICT(name) DO UPDATE SET
    symbol = excluded.symbol,
    color = excluded.color,
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    initiative_bonus = excluded.initiative_bonus,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    spawn_weight = excluded.spawn_weight,
    habitat = excluded.habitat,
    movement_type = excluded.movement_type,
    special_abilities = excluded.special_abilities,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    defeated_image_path = excluded.defeated_image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

DELETE FROM monster_terrains WHERE monster_id = (SELECT id FROM monsters WHERE name = 'Hippogriff');
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 1 FROM monsters WHERE name = 'Hippogriff';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'PLAINS', 0 FROM monsters WHERE name = 'Hippogriff';

-- Monster: Giant Toad (Level 2, CR 2, Animal)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, defeated_image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Giant Toad', 'T', '#556b2f', 17, 600, '1d6+2',
    1, 14, 4, 2,
    2, 10, '["S","F","J"]', 'WALK',
    '["grab", "poison_skin", "swallow_whole"]', 'images/monsters/giant_toad.png', 'images/monsters/giant_toad_defeated.png', '{"1_distant":"A bass, vibrating croak shakes the stagnant bog water, followed by a heavy splash among the rotting cypress knees.","2_ranger_distant":"Wide belly-wallows in the mud and caustic, milky slime on the reeds warn of a boulder-sized marsh amphibian.","3_close":"A hulking, wart-covered amphibian the size of a draft horse, its glistening olive hide oozing acrid toxin above a cavernous maw.","4_ranger_close":"Its whip-like tongue drags prey straight into its crushing gullet, and its warty skin secretes numbing venom on contact.","5_health_100":"The boulder-sized amphibian inflates its throat sac and snaps its cavernous jaws shut as its sticky tongue lashes out.","6_health_75":"Dark blood mixes with milky venom along its warty back as the beast hops heavily to crush you.","7_health_50":"Deep wounds gape across its bloated flank, yet the monstrous amphibian continues snapping with Voracious hunger.","8_health_25":"Slumped low in the black mire and wheezing wetly, the dying beast makes one last convulsive lunge.","9_dead":"The monstrous warty amphibian lies flattened and lifeless in the dark swamp mud."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Toad,%20Giant',
    'Animal', NULL, 'None'
)
ON CONFLICT(name) DO UPDATE SET
    symbol = excluded.symbol,
    color = excluded.color,
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    initiative_bonus = excluded.initiative_bonus,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    spawn_weight = excluded.spawn_weight,
    habitat = excluded.habitat,
    movement_type = excluded.movement_type,
    special_abilities = excluded.special_abilities,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    defeated_image_path = excluded.defeated_image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

DELETE FROM monster_terrains WHERE monster_id = (SELECT id FROM monsters WHERE name = 'Giant Toad');
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 1 FROM monsters WHERE name = 'Giant Toad';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 0 FROM monsters WHERE name = 'Giant Toad';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'JUNGLE', 0 FROM monsters WHERE name = 'Giant Toad';

-- Monster: Carbuncle (Level 2, CR 2, Magical Beast)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, defeated_image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Carbuncle', 'c', '#dc143c', 15, 600, '1d4+1',
    0, 17, 3, 2,
    2, 9, '["J","H","F"]', 'WALK',
    '["discord_gaze", "shell_armor", "telepathy"]', 'images/monsters/carbuncle.png', 'images/monsters/carbuncle_defeated.png', '{"1_distant":"A strange crimson glint pulses like a lantern through the dense ferns, accompanied by a disorienting, psychic hum.","2_ranger_distant":"Furrowed drag-marks in the loam and a sudden, unnatural urge to quarrel point to a gem-crowned reptilian beast.","3_close":"An armadillo-like reptilian creature clad in overlapping mossy shell plates, bearing a blazing blood-red ruby embedded in its brow.","4_ranger_close":"Its heavy shell deflects glancing blows while the glowing brow-gem projects waves of mental discord that cloud your aim.","5_health_100":"The crimson gem on the creature’s brow flares with hypnotic light as it lunges forward with surprisingly sharp jaws.","6_health_75":"Sparks fly from its scarred shell plates as the beast hunkers down, pulsing psychic static into your mind.","7_health_50":"Cracks spiderweb across its armored carapace and the ruby’s glow flickers erratically as it snaps in desperation.","8_health_25":"Bleeding beneath its shattered shell, the strange beast emits a final, discordant pulse before biting blindly.","9_dead":"The shelled creature lies overturned on the jungle floor, the crimson gem on its brow dull and fractured."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Carbuncle',
    'Magical Beast', NULL, 'Standard'
)
ON CONFLICT(name) DO UPDATE SET
    symbol = excluded.symbol,
    color = excluded.color,
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    initiative_bonus = excluded.initiative_bonus,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    spawn_weight = excluded.spawn_weight,
    habitat = excluded.habitat,
    movement_type = excluded.movement_type,
    special_abilities = excluded.special_abilities,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    defeated_image_path = excluded.defeated_image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

DELETE FROM monster_terrains WHERE monster_id = (SELECT id FROM monsters WHERE name = 'Carbuncle');
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'JUNGLE', 1 FROM monsters WHERE name = 'Carbuncle';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Carbuncle';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 0 FROM monsters WHERE name = 'Carbuncle';

-- Monster: Phantom Fungus (Level 2, CR 2, Plant)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, defeated_image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Phantom Fungus', 'f', '#9370db', 16, 600, '1d6+2',
    0, 14, 4, 2,
    2, 10, '["F","S"]', 'WALK',
    '["greater_invisibility", "ambush_spores", "plant_traits"]', 'images/monsters/phantom_fungus.png', 'images/monsters/phantom_fungus_defeated.png', '{"1_distant":"Soft loam compresses under invisible weight nearby, and a faint, earthy scent of decaying mushrooms hangs in the damp air.","2_ranger_distant":"Ringed impressions in the moss and a shimmer of refracted light reveal a camouflaged, mobile fungal predator stalking the woods.","3_close":"A ghostly, semi-translucent fungal mass walking on muscular root-clusters, topped by a violet cap and a maw of crystalline teeth.","4_ranger_close":"It fades into near-total transparency between strikes; watch the disturbed leaf-litter to track its lunging bite.","5_health_100":"Shimmering out of the woodland mist, the translucent fungal horror gapes its spore-lined maw to tear at your flesh.","6_health_75":"Violet ichor and glowing spores burst from a deep rent in its cap as its outline flickers in and out of sight.","7_health_50":"With several root-tendrils severed, its refractive camouflage falters, revealing its ragged, pulsing mass.","8_health_25":"Now fully visible and leaking luminous fluid, the dying fungus lurches forward for a final bite.","9_dead":"The ghostly fungal horror collapses into a visible, withered heap of inert violet sponge and dead roots."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Phantom%20Fungus',
    'Plant', NULL, 'Incidental'
)
ON CONFLICT(name) DO UPDATE SET
    symbol = excluded.symbol,
    color = excluded.color,
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    initiative_bonus = excluded.initiative_bonus,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    spawn_weight = excluded.spawn_weight,
    habitat = excluded.habitat,
    movement_type = excluded.movement_type,
    special_abilities = excluded.special_abilities,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    defeated_image_path = excluded.defeated_image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

DELETE FROM monster_terrains WHERE monster_id = (SELECT id FROM monsters WHERE name = 'Phantom Fungus');
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 1 FROM monsters WHERE name = 'Phantom Fungus';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 0 FROM monsters WHERE name = 'Phantom Fungus';

-- Monster: Gnoll Packmaster (Level 2, CR 2, Humanoid)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, defeated_image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Gnoll Packmaster', 'G', '#8b4513', 18, 600, '1d8+3',
    1, 16, 5, 2,
    2, 10, '["P","H"]', 'WALK',
    '["pack_whip", "trip", "battle_cry"]', 'images/monsters/gnoll_packmaster.png', 'images/monsters/gnoll_packmaster_defeated.png', '{"1_distant":"The sharp crack of a barbed whip and a chorus of cackling barks echo from a skull-marked rise across the savanna.","2_ranger_distant":"Heavy iron-shod bootprints alongside scarred hyena tracks point to a veteran slaver-chieftain driving the local packs.","3_close":"A towering, broad-shouldered hyena-headed marauder clad in spiked bone-and-hide armor, wielding a barbed iron whip and heavy cleaver.","4_ranger_close":"He lashes with his barbed whip to entangle and trip before bringing his cleaver down; close the distance inside his whip reach.","5_health_100":"Snarling with bloodshot eyes, the armored hyena-warrior cracks his barbed whip and charges with his jagged cleaver raised.","6_health_75":"A blow splinters the bone plates on his pauldron, drawing a barking laugh of bloodlust as he presses the attack.","7_health_50":"Blood pours down his scarred muzzle and his breathing turns ragged, though his whip-arm still lashes with cruel precision.","8_health_25":"Staggering on a wounded knee, the desperate warlord howls a curse and swings his cleaver with both hands.","9_dead":"The hyena-headed warlord lies slain in the dust, his barbed whip and cleaver scattered beside his broken armor."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Gnoll',
    'Humanoid', 'gnoll', 'Standard'
)
ON CONFLICT(name) DO UPDATE SET
    symbol = excluded.symbol,
    color = excluded.color,
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    initiative_bonus = excluded.initiative_bonus,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    spawn_weight = excluded.spawn_weight,
    habitat = excluded.habitat,
    movement_type = excluded.movement_type,
    special_abilities = excluded.special_abilities,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    defeated_image_path = excluded.defeated_image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

DELETE FROM monster_terrains WHERE monster_id = (SELECT id FROM monsters WHERE name = 'Gnoll Packmaster');
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'PLAINS', 1 FROM monsters WHERE name = 'Gnoll Packmaster';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Gnoll Packmaster';

-- Monster: Giant Mantis (Level 3, CR 3, Vermin)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, defeated_image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Giant Mantis', 'M', '#228b22', 23, 800, '1d8+3',
    2, 16, 6, 3,
    3, 9, '["J","F"]', 'WALK',
    '["grab", "lunge", "mandibles"]', 'images/monsters/giant_mantis.png', 'images/monsters/giant_mantis_defeated.png', '{"1_distant":"What appeared to be a moss-draped bough suddenly swivels a triangular head with two bulbous amber eyes.","2_ranger_distant":"Halved beetle carapaces and clean, scissor-like cuts through thick vines warn of a horse-sized ambush insect.","3_close":"A towering emerald-and-bark-brown predatory insect with serrated, scythe-like forelimbs folded beneath a swiveling triangular head.","4_ranger_close":"Its spring-loaded forelimbs Clamp like iron bear-traps to pull prey into its shearing mandibles; avoid getting pinned.","5_health_100":"Still as carved jade for a heartbeat, the colossal insect suddenly unfolds its serrated scythe-limbs and strikes.","6_health_75":"A heavy blow chips its emerald thorax, eliciting a dry rasping hiss of fluttering wings as it lunges again.","7_health_50":"Ichor drips from a cracked forelimb joint, yet the relentless predator continues scissoring its barbed arms.","8_health_25":"With its carapace split and antennae severed, the dying insect lashes out in a final, convulsive reflex.","9_dead":"The horse-sized predatory insect lies motionless on the jungle floor, its serrated scythe-limbs slack and broken."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Mantis,%20Giant',
    'Vermin', NULL, 'Incidental'
)
ON CONFLICT(name) DO UPDATE SET
    symbol = excluded.symbol,
    color = excluded.color,
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    initiative_bonus = excluded.initiative_bonus,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    spawn_weight = excluded.spawn_weight,
    habitat = excluded.habitat,
    movement_type = excluded.movement_type,
    special_abilities = excluded.special_abilities,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    defeated_image_path = excluded.defeated_image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

DELETE FROM monster_terrains WHERE monster_id = (SELECT id FROM monsters WHERE name = 'Giant Mantis');
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'JUNGLE', 1 FROM monsters WHERE name = 'Giant Mantis';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 0 FROM monsters WHERE name = 'Giant Mantis';

-- Monster: Spriggan (Level 3, CR 3, Fey)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, defeated_image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Spriggan', 'S', '#8b5a2b', 21, 800, '1d8+3',
    2, 16, 6, 3,
    3, 9, '["F","H"]', 'WALK',
    '["size_alteration", "sneak_attack", "shatter"]', 'images/monsters/spriggan.png', 'images/monsters/spriggan_defeated.png', '{"1_distant":"The sound of cracking timber and a harsh, gravelly laugh echo from a ruined stone cairn among the ancient oaks.","2_ranger_distant":"Small, gnarled footprints that abruptly deepen into giant-sized craters reveal a size-shifting, warlike woodland fey.","3_close":"A gnarled, bark-skinned fey marauder with twisted twig-like horns, malice-filled eyes, and a heavy iron morningstar.","4_ranger_close":"When angered, it swells to ogre-like stature with crushing brute strength; weather its growth surge and strike its flanks.","5_health_100":"With abone-grinding roar, the gnarled fey warrior swells to towering size and swings its spiked iron morningstar.","6_health_75":"Sap-like blood beads along its furrowed bark-hide as the enraged brute hammers at your guard.","7_health_50":"Battered and gasping, the fey marauder flickers between small cunning and giant fury as it presses its assault.","8_health_25":"Staggering and leaking dark vital sap, the cornered woodland warrior hurls its remaining strength into a desperate smash.","9_dead":"The gnarled fey warrior shrinks back to its stunted form in death, lying still beside its iron morningstar."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Spriggan',
    'Fey', 'gnome', 'Standard'
)
ON CONFLICT(name) DO UPDATE SET
    symbol = excluded.symbol,
    color = excluded.color,
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    initiative_bonus = excluded.initiative_bonus,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    spawn_weight = excluded.spawn_weight,
    habitat = excluded.habitat,
    movement_type = excluded.movement_type,
    special_abilities = excluded.special_abilities,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    defeated_image_path = excluded.defeated_image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

DELETE FROM monster_terrains WHERE monster_id = (SELECT id FROM monsters WHERE name = 'Spriggan');
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 1 FROM monsters WHERE name = 'Spriggan';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Spriggan';

-- Monster: Will-o'-Wisp (Level 3, CR 3, Aberration)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, defeated_image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Will-o''-Wisp', 'w', '#00ffff', 18, 800, '2d4',
    7, 18, 6, 3,
    3, 8, '["S","F"]', 'FLY',
    '["shock_touch", "natural_invisibility", "magic_immunity"]', 'images/monsters/will_o_wisp.png', 'images/monsters/will_o_wisp_defeated.png', '{"1_distant":"A solitary, bobbing lantern-glow of pale corpse-blue light drifts silently above the black, treacherous mire.","2_ranger_distant":"The smell of ozone and charred reeds around a sunken trail warn that the beckoning light is a malevolent, life-feeding entity.","3_close":"A hovering sphere of eerie blue-green luminescence containing a faint, skull-like vortex of crackling electrical arcs.","4_ranger_close":"It darts with blinding agility and discharges searing lightning on contact; time your strikes carefully when it swoops in to shock.","5_health_100":"Flaring with cruel blue radiance, the floating orb darts toward you, trailing jagged arcs of marsh lightning.","6_health_75":"Your weapon disrupts its luminous shell in a shower of sparks, causing the entity to pulse with furious violet static.","7_health_50":"Its glow gutters and dims momentarily before flaring back as it lashes out with a high-voltage discharge.","8_health_25":"Flickering wildly like a dying candle, the fractured orb makes one last erratic, crackling lunge.","9_dead":"Its malevolent light extinguished, only a dim, cracked ectoplasmic husk remains cooling in the marsh mud."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Will-o%27-Wisp',
    'Aberration', 'air', 'Incidental'
)
ON CONFLICT(name) DO UPDATE SET
    symbol = excluded.symbol,
    color = excluded.color,
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    initiative_bonus = excluded.initiative_bonus,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    spawn_weight = excluded.spawn_weight,
    habitat = excluded.habitat,
    movement_type = excluded.movement_type,
    special_abilities = excluded.special_abilities,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    defeated_image_path = excluded.defeated_image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

DELETE FROM monster_terrains WHERE monster_id = (SELECT id FROM monsters WHERE name = 'Will-o''-Wisp');
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 1 FROM monsters WHERE name = 'Will-o''-Wisp';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 0 FROM monsters WHERE name = 'Will-o''-Wisp';

-- Monster: Cheetah (Level 3, CR 3, Animal)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, defeated_image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Cheetah', 'C', '#daa520', 20, 800, '1d6+3',
    6, 16, 6, 3,
    3, 9, '["P","H"]', 'WALK',
    '["sprint", "pounce", "trip"]', 'images/monsters/cheetah.png', 'images/monsters/cheetah_defeated.png', '{"1_distant":"A golden, black-spotted blur streaks across the dry savanna grass with breathtaking, wind-splitting velocity.","2_ranger_distant":"Widely spaced claw-marks dug deep into the hard-packed earth reveal a sprinter big cat closing the distance in seconds.","3_close":"A lean, deep-chested feline predator with dusk-spotted amber fur, black tear-streaks down its muzzle, and blazing golden eyes.","4_ranger_close":"Its explosive sprint and pounce let it seize the opening strike and bowl prey over; hold firm against its initial rush.","5_health_100":"Covering the ground in a heartbeat, the spotted predator pounces with extended claws and jaws aimed at your windpipe.","6_health_75":"A slash across its sleek shoulder slows its stride slightly, though it pivots and lashes out with lightning reflexes.","7_health_50":"Sides heaving and spotted coat stained crimson, the big cat snarls low and springs from a crouch.","8_health_25":"Exhausted and bleeding from deep wounds, the cornered feline gathers its last ounce of speed for a final leap.","9_dead":"The sleek, spotted predator lies still upon the dry plains earth, its unmatched speed finally spent."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Cheetah',
    'Animal', NULL, 'None'
)
ON CONFLICT(name) DO UPDATE SET
    symbol = excluded.symbol,
    color = excluded.color,
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    initiative_bonus = excluded.initiative_bonus,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    spawn_weight = excluded.spawn_weight,
    habitat = excluded.habitat,
    movement_type = excluded.movement_type,
    special_abilities = excluded.special_abilities,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    defeated_image_path = excluded.defeated_image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

DELETE FROM monster_terrains WHERE monster_id = (SELECT id FROM monsters WHERE name = 'Cheetah');
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'PLAINS', 1 FROM monsters WHERE name = 'Cheetah';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Cheetah';

-- Monster: Draugr (Level 3, CR 3, Undead)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, defeated_image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Draugr', 'D', '#4682b4', 22, 800, '1d10+3',
    0, 16, 6, 3,
    3, 9, '["S","H","F"]', 'WALK',
    '["nauseating_strike", "damage_reduction_bludgeoning", "undead_traits"]', 'images/monsters/draugr.png', 'images/monsters/draugr_defeated.png', '{"1_distant":"The clank of waterlogged ring-mail and the freezing stench of bog-peat and brine rise from the mist-shrouded mire.","2_ranger_distant":"Heavy, water-logged boot tracks and barnacle-encrusted bronze links warn of a drowned revenant warrior risen from the bog.","3_close":"A hulking, peat-blackened undead warrior clad in corroded mail and barnacles, gripping a notched two-handed greataxe.","4_ranger_close":"Every blow of its cursed greataxe carries the nauseating rot of the grave, and its waterlogged bones resist glancing cuts.","5_health_100":"Eyes glowing cold corpse-blue beneath a rusted helm, the waterlogged revenant hefts its heavy greataxe and advances.","6_health_75":"Black bog-water and splintered bone fly from its chest as the undying warrior swings a sweeping, vengeful arc.","7_health_50":"Rusted mail hangs in tatters from its sodden frame, yet its cold blue gaze never wavers as it cleaves downward.","8_health_25":"Half-severed at the waist and dragging its shattered leg, the ancient revenant raises its axe for one last blow.","9_dead":"The waterlogged revenant collapses into a lifeless heap of rusted ring-mail and peat-stained bone."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Draugr',
    'Undead', 'water', 'Standard'
)
ON CONFLICT(name) DO UPDATE SET
    symbol = excluded.symbol,
    color = excluded.color,
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    initiative_bonus = excluded.initiative_bonus,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    spawn_weight = excluded.spawn_weight,
    habitat = excluded.habitat,
    movement_type = excluded.movement_type,
    special_abilities = excluded.special_abilities,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    defeated_image_path = excluded.defeated_image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

DELETE FROM monster_terrains WHERE monster_id = (SELECT id FROM monsters WHERE name = 'Draugr');
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 1 FROM monsters WHERE name = 'Draugr';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Draugr';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 0 FROM monsters WHERE name = 'Draugr';

-- Monster: Hobgoblin Captain (Level 3, CR 3, Humanoid)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, defeated_image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Hobgoblin Captain', 'H', '#8b0000', 24, 800, '1d8+4',
    3, 18, 7, 3,
    3, 9, '["H","P","F"]', 'WALK',
    '["martial_command", "shield_wall", "cleave"]', 'images/monsters/hobgoblin_captain.png', 'images/monsters/hobgoblin_captain_defeated.png', '{"1_distant":"Measured, iron-shod footsteps and the disciplined rasp of a whetstone against steel echo from a fortified hilltop.","2_ranger_distant":"Well-maintained patrol markers and crimson command pennants identify a seasoned goblinoid officer holding this ridge.","3_close":"A battle-scarred goblinoid commander in dark banded iron plate and a crimson cloak, wielding a masterwork broadsword and steel shield.","4_ranger_close":"His disciplined shield-wall stance and brutal counter-cuts punish sloppy swings; break through his guard with focused strikes.","5_health_100":"Saluting coldly with his broadsword, the armored commander Locks his spiked shield in place and advances in perfect form.","6_health_75":"A dent mars his dark iron cuirass, prompting a barked martial cadence as he ripostes with ruthless precision.","7_health_50":"Blood seeps beneath his gorget and his crimson cloak is torn, yet the veteran officer holds his ground with grim discipline.","8_health_25":"Shield arm battered and breathing blood, the commander roars a defiant war-cry and lunges with everything left.","9_dead":"The armored goblinoid commander lies fallen upon the rocky hillside beside his dented shield and broadsword."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Hobgoblin',
    'Humanoid', 'goblinoid', 'Standard'
)
ON CONFLICT(name) DO UPDATE SET
    symbol = excluded.symbol,
    color = excluded.color,
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    initiative_bonus = excluded.initiative_bonus,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    spawn_weight = excluded.spawn_weight,
    habitat = excluded.habitat,
    movement_type = excluded.movement_type,
    special_abilities = excluded.special_abilities,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    defeated_image_path = excluded.defeated_image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

DELETE FROM monster_terrains WHERE monster_id = (SELECT id FROM monsters WHERE name = 'Hobgoblin Captain');
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 1 FROM monsters WHERE name = 'Hobgoblin Captain';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'PLAINS', 0 FROM monsters WHERE name = 'Hobgoblin Captain';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 0 FROM monsters WHERE name = 'Hobgoblin Captain';

-- Monster: Displacer Beast (Level 4, CR 4, Magical Beast)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, defeated_image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Displacer Beast', 'd', '#483d8b', 32, 1200, '1d8+4',
    2, 17, 8, 4,
    4, 8, '["J","F","H"]', 'WALK',
    '["displacement", "tentacle_rake", "resistance"]', 'images/monsters/displacer_beast.png', 'images/monsters/displacer_beast_defeated.png', '{"1_distant":"A sleek, six-legged panther shadow seems to flicker in two places at once among the dark jungle trunks.","2_ranger_distant":"Six-pawed tracks accompanied by twin whip-scars stripped across tree bark warn of an illusion-shrouded aberration-stalker.","3_close":"A sleek, midnight-black six-legged feline monstrosity with two long, barbed tentacles sprouting from its muscular shoulders.","4_ranger_close":"Light-bending displacement makes it appear a foot away from its true body, while its barbed shoulder-tentacles flay armor and flesh.","5_health_100":"Wrapped in a wavering shadowy mirage, the six-legged predator lashes out with both barbed shoulder-tentacles.","6_health_75":"Your blade catches true flesh through the illusion, drawing a yowl of fury as its tentacles whip in a blur.","7_health_50":"Dark blood drips from its sleek flanks and its displacement shimmer flickers unevenly as it pounces.","8_health_25":"With its mirage nearly shattered and breath rasping, the wounded monstrosity makes a savage final lunge.","9_dead":"Its light-bending illusion finally dispelled, the six-legged black monstrosity lies motionless on the jungle floor."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Phase%20Spider',
    'Magical Beast', NULL, 'Standard'
)
ON CONFLICT(name) DO UPDATE SET
    symbol = excluded.symbol,
    color = excluded.color,
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    initiative_bonus = excluded.initiative_bonus,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    spawn_weight = excluded.spawn_weight,
    habitat = excluded.habitat,
    movement_type = excluded.movement_type,
    special_abilities = excluded.special_abilities,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    defeated_image_path = excluded.defeated_image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

DELETE FROM monster_terrains WHERE monster_id = (SELECT id FROM monsters WHERE name = 'Displacer Beast');
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'JUNGLE', 1 FROM monsters WHERE name = 'Displacer Beast';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 0 FROM monsters WHERE name = 'Displacer Beast';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Displacer Beast';

-- Monster: Shambling Mound (Level 4, CR 4, Plant)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, defeated_image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Shambling Mound', 'S', '#2e8b57', 35, 1200, '2d6+4',
    0, 17, 8, 4,
    4, 8, '["S","J","F"]', 'WALK',
    '["constrict", "grab", "electric_fortitude"]', 'images/monsters/shambling_mound.png', 'images/monsters/shambling_mound_defeated.png', '{"1_distant":"A massive heap of rotting marsh vines and black peat suddenly heaves upward with a wet, sucking roar.","2_ranger_distant":"Crushed bones woven into a wide furrow of uprooted bog-reeds warn of an ambulatory, carnivorous mound of swamp vegetation.","3_close":"A nine-foot, man-shaped colossus of writhing creepers, decaying leaves, and black muck, glaring with two yellow fungal eyes.","4_ranger_close":"Its twin vine-tendrils crush prey in a suffocating embrace; hack through its central root-core before it engulfs you.","5_health_100":"Lurching out of the mire, the towering mass of rotting vines swings two crushing tendrils like knotted battering rams.","6_health_75":"Severed creepers and black sap splash into the bog, though new tendrils immediately coil to replace them.","7_health_50":"Deep gashes expose the pulsing root-heart inside its chest as the floral behemoth thrashes violently.","8_health_25":"Half-hacked apart and shedding heaps of dead mulch, the colossus heaves forward for one last crushing slam.","9_dead":"The carnivorous plant colossus collapses into an inert, severed tangle of dead swamp vines and mud."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Shambling%20Mound',
    'Plant', NULL, 'Standard'
)
ON CONFLICT(name) DO UPDATE SET
    symbol = excluded.symbol,
    color = excluded.color,
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    initiative_bonus = excluded.initiative_bonus,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    spawn_weight = excluded.spawn_weight,
    habitat = excluded.habitat,
    movement_type = excluded.movement_type,
    special_abilities = excluded.special_abilities,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    defeated_image_path = excluded.defeated_image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

DELETE FROM monster_terrains WHERE monster_id = (SELECT id FROM monsters WHERE name = 'Shambling Mound');
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 1 FROM monsters WHERE name = 'Shambling Mound';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'JUNGLE', 0 FROM monsters WHERE name = 'Shambling Mound';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 0 FROM monsters WHERE name = 'Shambling Mound';

-- Monster: Leucrotta (Level 4, CR 4, Magical Beast)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, defeated_image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Leucrotta', 'L', '#8b4513', 33, 1200, '2d6+5',
    3, 17, 8, 4,
    4, 8, '["P","H","F"]', 'WALK',
    '["luring_cry", "armor_chew", "powerful_bite"]', 'images/monsters/leucrotta.png', 'images/monsters/leucrotta_defeated.png', '{"1_distant":"A plaintive, eerily human cry for help echoes from the dry gulch ahead, followed by the scrape of heavy cloven hooves.","2_ranger_distant":"Stag-like cloven tracks paired with sheared steel helm fragments warn of a voice-mimicking predator whose jaws shear through iron.","3_close":"A grotesque beast with the muscular body of a great stag, a lion’s tail, and a massive badger skull lined with jagged bone ridges.","4_ranger_close":"Its uncanny voice-mimicry lures victims off guard, and its shearing bone-jaws can crunch straight through shields and plate.","5_health_100":"Dropping its stolen human voice for a hideous cackle, the bone-jawed beast charges on cloven hooves to shear through your guard.","6_health_75":"Foul saliva drips from its serrated jaw-ridges as it shakes off your blow and snaps at your weapon arm.","7_health_50":"Bleeding from deep cuts along its stag-like ribs, the foul-tempered beast kicks and bites with redoubled spite.","8_health_25":"Cornered and limping on a cracked hoof, the grotesque predator lunges with its bone-crushing maw wide.","9_dead":"The stag-bodied, bone-jawed monstrosity lies slain in the dust, its deceitful voice silenced forever."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Leucrotta',
    'Magical Beast', NULL, 'Standard'
)
ON CONFLICT(name) DO UPDATE SET
    symbol = excluded.symbol,
    color = excluded.color,
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    initiative_bonus = excluded.initiative_bonus,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    spawn_weight = excluded.spawn_weight,
    habitat = excluded.habitat,
    movement_type = excluded.movement_type,
    special_abilities = excluded.special_abilities,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    defeated_image_path = excluded.defeated_image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

DELETE FROM monster_terrains WHERE monster_id = (SELECT id FROM monsters WHERE name = 'Leucrotta');
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'PLAINS', 1 FROM monsters WHERE name = 'Leucrotta';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Leucrotta';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 0 FROM monsters WHERE name = 'Leucrotta';

-- Monster: Dire Boar (Level 4, CR 4, Animal)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, defeated_image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Dire Boar', 'B', '#696969', 34, 1200, '2d6+5',
    0, 16, 8, 4,
    4, 8, '["F","H","P"]', 'WALK',
    '["ferocity", "gore_charge", "scent"]', 'images/monsters/dire_boar.png', 'images/monsters/dire_boar_defeated.png', '{"1_distant":"The earth trembles beneath thunderous hooves as saplings snap like dry twigs and a volcanic grunt echoes through the woods.","2_ranger_distant":"Deeply rooted trenches and tree trunks gouged four feet high by curved ivory tusks mark a prehistoric razorback beast.","3_close":"A colossal, prehistoric razorback boar with slate-grey hide, a ridge of iron-stiff dorsal bristles, and blood-stained ivory tusks.","4_ranger_close":"Pure blind rage keeps it fighting even when mortally wounded; brace against its tusked charge and do not drop your guard early.","5_health_100":"Lowering its armored brow, the colossal razorback bellows and hurtles forward to disembowel you with its curved tusks.","6_health_75":"Your weapon carves through its thick bristles, only stoking the beast’s bloodshot, foaming fury.","7_health_50":"Crimson froth flies from its snout as the heavily wounded beast hooks upward with bone-shattering force.","8_health_25":"Sustained only by terrifying primal ferocity, the dying razorback refuses to fall and charges one last time.","9_dead":"The colossal tusked razorback finally crashes onto its side in the forest mud, shaking the ground as it dies."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Boar,%20Dire',
    'Animal', NULL, 'None'
)
ON CONFLICT(name) DO UPDATE SET
    symbol = excluded.symbol,
    color = excluded.color,
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    initiative_bonus = excluded.initiative_bonus,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    spawn_weight = excluded.spawn_weight,
    habitat = excluded.habitat,
    movement_type = excluded.movement_type,
    special_abilities = excluded.special_abilities,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    defeated_image_path = excluded.defeated_image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

DELETE FROM monster_terrains WHERE monster_id = (SELECT id FROM monsters WHERE name = 'Dire Boar');
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 1 FROM monsters WHERE name = 'Dire Boar';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Dire Boar';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'PLAINS', 0 FROM monsters WHERE name = 'Dire Boar';

-- Monster: Forest Drake (Level 4, CR 4, Dragon)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, defeated_image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Forest Drake', 'D', '#228b22', 32, 1200, '1d8+4',
    5, 17, 8, 4,
    4, 8, '["F","J","H"]', 'FLY',
    '["acid_spit", "speed_surge", "flight"]', 'images/monsters/forest_drake.png', 'images/monsters/forest_drake_defeated.png', '{"1_distant":"A caustic, sizzling hiss and the Beat of leathery wings echo from the high canopy, where acid-charred leaves rain down.","2_ranger_distant":"Pitted, acid-melted stone and three-clawed draconic gouges in the ancient trunks warn of a feral woodland drake.","3_close":"A two-legged, winged lesser dragon clad in emerald-and-bark scales, horned crest flared as green acidic vapor curls from its jaws.","4_ranger_close":"It spits bursts of corrosive bile before diving in with jaws and tail; keep moving to avoid its lingering acid mist.","5_health_100":"Snapping its leathery wings open, the emerald-scaled drake hisses and hurls itself forward in a blur of fangs and acid.","6_health_75":"Cracked green scales shower the moss as the wounded drake shrieks and lashes out with its barbed tail.","7_health_50":"Corrosive drool spills from its bloodied jaws as the feral dragon-kin beats its torn wings in a furious surge.","8_health_25":"Grounded and bleeding dark draconic blood, the cornered predator snaps and spits in a final frenzy.","9_dead":"The emerald-scaled winged drake lies slain upon the mossy stones, its corrosive breath finally stilled."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Forest%20Drake',
    'Dragon', 'earth', 'Standard'
)
ON CONFLICT(name) DO UPDATE SET
    symbol = excluded.symbol,
    color = excluded.color,
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    initiative_bonus = excluded.initiative_bonus,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    spawn_weight = excluded.spawn_weight,
    habitat = excluded.habitat,
    movement_type = excluded.movement_type,
    special_abilities = excluded.special_abilities,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    defeated_image_path = excluded.defeated_image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

DELETE FROM monster_terrains WHERE monster_id = (SELECT id FROM monsters WHERE name = 'Forest Drake');
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 1 FROM monsters WHERE name = 'Forest Drake';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'JUNGLE', 0 FROM monsters WHERE name = 'Forest Drake';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Forest Drake';

-- Monster: Otyugh (Level 4, CR 4, Aberration)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, defeated_image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Otyugh', 'O', '#556b2f', 32, 1200, '1d8+4',
    0, 17, 7, 4,
    4, 8, '["H","S"]', 'WALK',
    '["filth_fever", "grab", "constrict"]', 'images/monsters/otyugh.png', 'images/monsters/otyugh_defeated.png', '{"1_distant":"A overpowering stench of offal and carrion rises from a sunken ravine, where a three-eyed stalk peers above the muck.","2_ranger_distant":"Tripod footprints and ridged tentacle drag-marks around a refuse pit point to a subterranean scavenger aberration.","3_close":"A grotesque, three-legged bulbous horror with rock-like grey hide, two barbed tentacles, a three-eyed sensory stalk, and a toothy maw.","4_ranger_close":"Its barbed tentacles snatch prey while its infectious bite spreads filth fever; sever the grasping tentacles to stay out of its maw.","5_health_100":"Heaving its bloated bulk on three trunk-like legs, the aberration whips its barbed tentacles forward and bellows.","6_health_75":"Thick, foul-smelling ichor oozes from its stony hide as its central eye-stalk glares and its tentacles thrash.","7_health_50":"One barbed tentacle hangs mangled and its cavernous maw bleeds, yet the scavenger snaps with rabid hunger.","8_health_25":"Staggering on buckling legs, the mortally wounded aberration makes one final, flailing sweep.","9_dead":"The three-legged tentacled aberration slumps dead in the mire, its eye-stalk and barbed limbs limp."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Otyugh',
    'Aberration', NULL, 'Standard'
)
ON CONFLICT(name) DO UPDATE SET
    symbol = excluded.symbol,
    color = excluded.color,
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    initiative_bonus = excluded.initiative_bonus,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    spawn_weight = excluded.spawn_weight,
    habitat = excluded.habitat,
    movement_type = excluded.movement_type,
    special_abilities = excluded.special_abilities,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    defeated_image_path = excluded.defeated_image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

DELETE FROM monster_terrains WHERE monster_id = (SELECT id FROM monsters WHERE name = 'Otyugh');
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 1 FROM monsters WHERE name = 'Otyugh';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 0 FROM monsters WHERE name = 'Otyugh';

-- Monster: Wyvern (Level 5, CR 5, Dragon)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, defeated_image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Wyvern', 'W', '#483d8b', 42, 1600, '1d8+5',
    5, 18, 9, 5,
    5, 7, '["H","P","F"]', 'FLY',
    '["deadly_sting", "poison", "rake", "flight"]', 'images/monsters/wyvern.png', 'images/monsters/wyvern_defeated.png', '{"1_distant":"A vast, bat-winged shadow eclipses the crags overhead, its long muscular tail arched like a scorpion’s stinger.","2_ranger_distant":"Shattered livestock bones and deep, venom-blackened punctures in the turf warn of an apex winged dragon-kin predator.","3_close":"A ferocious, dark-scaled winged dragon-kin with hooked talons, jaws of serrated ivory, and a whipping tail tipped with a venomous stinger.","4_ranger_close":"Its overhead dive combines raking talons with a lethal scorpion-like tail sting; keep your guard high and fortitude ready.","5_health_100":"Roaring like a thunderclap, the winged draconic predator stoops from the crags with talons bared and stinger poised.","6_health_75":"Dark blood streams across its bronze-and-slate scales as its venomous tail whips over its back to strike.","7_health_50":"With one leathery wing torn and jaws foaming crimson, the furious beast crashes down to fight tooth and stinger.","8_health_25":"Writhing on the rocks and leaking venom and blood, the dying dragon-kin lashes its tail in a final arc.","9_dead":"The great winged predator lies vanquished across the craggy stones, its venomous tail stinger finally still."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Wyvern',
    'Dragon', NULL, 'Standard'
)
ON CONFLICT(name) DO UPDATE SET
    symbol = excluded.symbol,
    color = excluded.color,
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    initiative_bonus = excluded.initiative_bonus,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    spawn_weight = excluded.spawn_weight,
    habitat = excluded.habitat,
    movement_type = excluded.movement_type,
    special_abilities = excluded.special_abilities,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    defeated_image_path = excluded.defeated_image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

DELETE FROM monster_terrains WHERE monster_id = (SELECT id FROM monsters WHERE name = 'Wyvern');
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 1 FROM monsters WHERE name = 'Wyvern';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'PLAINS', 0 FROM monsters WHERE name = 'Wyvern';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 0 FROM monsters WHERE name = 'Wyvern';

-- Monster: Girallon (Level 5, CR 5, Magical Beast)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, defeated_image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Girallon', 'G', '#dcdcdc', 42, 1600, '1d6+6',
    6, 17, 9, 5,
    5, 7, '["J","F","H"]', 'WALK',
    '["four_arm_rend", "rend", "climb"]', 'images/monsters/girallon.png', 'images/monsters/girallon_defeated.png', '{"1_distant":"A chest-pounding, earth-shaking roar echoes from the overgrown jungle ruins as heavy boughs snap like kindling.","2_ranger_distant":"Huge knuckle-prints in the mud and four simultaneous claw-gouges across stone pillars warn of a four-armed white ape monstrosity.","3_close":"A towering, eight-foot silver-white ape monstrosity with four muscular, claw-tipped arms and a snarling, fang-filled maw.","4_ranger_close":"If multiple clawed hands catch hold at once, all four arms pull apart in a devastating rend; never let it batter your guard unanswered.","5_health_100":"Beating its broad chest with four massive fists, the white-furred behemoth roars and charges with all four claws splayed.","6_health_75":"Crimson streaks stain its matted white pelt as the enraged monstrosity unleashes a whirlwind of four-armed slashes.","7_health_50":"One lower arm hangs bloodied and gashed, yet the remaining three limbs hammer and tear with terrifying savagery.","8_health_25":"Roaring through a bloodied jaw and tottering on weakened legs, the beast lunges for one last rending embrace.","9_dead":"The towering four-armed white beast lies vanquished upon the jungle stones, its primal fury silenced."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Girallon',
    'Magical Beast', NULL, 'Incidental'
)
ON CONFLICT(name) DO UPDATE SET
    symbol = excluded.symbol,
    color = excluded.color,
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    initiative_bonus = excluded.initiative_bonus,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    spawn_weight = excluded.spawn_weight,
    habitat = excluded.habitat,
    movement_type = excluded.movement_type,
    special_abilities = excluded.special_abilities,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    defeated_image_path = excluded.defeated_image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

DELETE FROM monster_terrains WHERE monster_id = (SELECT id FROM monsters WHERE name = 'Girallon');
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'JUNGLE', 1 FROM monsters WHERE name = 'Girallon';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 0 FROM monsters WHERE name = 'Girallon';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Girallon';

-- Monster: Catoblepas (Level 5, CR 5, Magical Beast)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, defeated_image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Catoblepas', 'C', '#556b2f', 44, 1600, '2d6+5',
    1, 18, 9, 5,
    5, 7, '["S","P"]', 'WALK',
    '["poison_breath", "tail_stun", "trample"]', 'images/monsters/catoblepas.png', 'images/monsters/catoblepas_defeated.png', '{"1_distant":"Withered, blackened reeds and a choking cloud of yellow-green marsh vapor mark the path of a heavy, wallowing bulk.","2_ranger_distant":"Deep buffalo-like tracks and a long furrow where a heavy head drags along the mud warn of a noxious, swamp-dwelling behemoth.","3_close":"A bloated, armor-plated buffalo-like beast with a clubbed tail and a long, serpentine neck dragging a bloodshot warthog head.","4_ranger_close":"Its fetid breath exhales a cloud of virulent swamp poison while its clubbed tail stuns foes; strike hard between its exhalations.","5_health_100":"Heaving its grotesque warthog head from the mud, the armored beast exhales a billow of toxic green gas and charges.","6_health_75":"Sparks and dark blood fly from its scaly flank plates as it swings its heavy clubbed tail in a bone-jarring arc.","7_health_50":"Wheezing noxious vapor from a punctured lung, the mire behemoth lowers its tusks to trample you into the mud.","8_health_25":"Knees buckling in the black water, the mortally wounded beast makes one last convulsive sweep of neck and tail.","9_dead":"The long-necked, armored swamp behemoth collapses dead into the dark mire, its toxic breath dissipating."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Catoblepas',
    'Magical Beast', NULL, 'Standard'
)
ON CONFLICT(name) DO UPDATE SET
    symbol = excluded.symbol,
    color = excluded.color,
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    initiative_bonus = excluded.initiative_bonus,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    spawn_weight = excluded.spawn_weight,
    habitat = excluded.habitat,
    movement_type = excluded.movement_type,
    special_abilities = excluded.special_abilities,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    defeated_image_path = excluded.defeated_image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

DELETE FROM monster_terrains WHERE monster_id = (SELECT id FROM monsters WHERE name = 'Catoblepas');
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 1 FROM monsters WHERE name = 'Catoblepas';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'PLAINS', 0 FROM monsters WHERE name = 'Catoblepas';

-- Monster: Barrow Wight (Level 5, CR 5, Undead)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, defeated_image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Barrow Wight', 'B', '#708090', 38, 1600, '1d8+5',
    2, 18, 9, 5,
    5, 7, '["P","H"]', 'WALK',
    '["energy_drain", "barrow_dread", "undead_traits"]', 'images/monsters/barrow_wight.png', 'images/monsters/barrow_wight_defeated.png', '{"1_distant":"Freezing grave-mist spills from an ancient burial mound on the windswept plain, where a crowned figure stands in silence.","2_ranger_distant":"Frost-rimed grass and ancient bronzegrave-goods scattered before a broken cairn warn of abarrow-king risen in undeath.","3_close":"An ancient, regal undead warlord clad in verdigris scale armor and a tarnished bronze crown, wielding a rune-etched broadsword.","4_ranger_close":"Its necrotic blade drains living warmth and courage with every strike; end the fight swiftly before its grave-chill saps your strength.","5_health_100":"Raising its rune-etched broadsword, the crowned undead king speaks a hollow curse that chills your blood and strikes.","6_health_75":"Ancient bronze scales shatter under your blow, releasing wisps of freezing barrow-mist as the monarch counterattacks.","7_health_50":"Its tarnished crown hangs askew and desiccated bone shows through its armor, yet its spectral eyes blaze with hatred.","8_health_25":"Tottering amidst swirling grave-fog, the shattered barrow-lord lunges forward for one final, life-draining thrust.","9_dead":"The ancient undead monarch collapses into a vanquished heap of verdigris armor, dry bone, and tarnished bronze."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Wight',
    'Undead', NULL, 'Double'
)
ON CONFLICT(name) DO UPDATE SET
    symbol = excluded.symbol,
    color = excluded.color,
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    initiative_bonus = excluded.initiative_bonus,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    spawn_weight = excluded.spawn_weight,
    habitat = excluded.habitat,
    movement_type = excluded.movement_type,
    special_abilities = excluded.special_abilities,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    defeated_image_path = excluded.defeated_image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

DELETE FROM monster_terrains WHERE monster_id = (SELECT id FROM monsters WHERE name = 'Barrow Wight');
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'PLAINS', 1 FROM monsters WHERE name = 'Barrow Wight';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Barrow Wight';

-- Monster: Green Hag (Level 5, CR 5, Monstrous Humanoid)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, defeated_image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Green Hag', 'H', '#2e8b57', 39, 1600, '1d6+5',
    1, 19, 9, 5,
    5, 7, '["H","S","F"]', 'WALK',
    '["weakening_touch", "evil_eye", "mimicry"]', 'images/monsters/green_hag.png', 'images/monsters/green_hag_defeated.png', '{"1_distant":"A sweet, deceptive song drifts through the mist before twisting into a rasping, malevolent cackle among the crags.","2_ranger_distant":"Fetishes of bound crow-bones and deep, iron-hard claw gouges in oak bark warn of an ancient, strength-sapping crone.","3_close":"A gangly, moss-skinned crone with tangled river-weed hair, yellow fangs, and long, curving claws as hard as forged iron.","4_ranger_close":"Beneath her frail appearance hides ogre-like strength and a hexing touch that saps muscle power; press her relentlessly.","5_health_100":"Baring yellowed fangs in a hideous grin, the moss-skinned crone fixes you with her evil eye and rakes with iron-hard claws.","6_health_75":"Black ichor seeps from her knotted shoulder as she hisses a spiteful hex and slashes with unnatural strength.","7_health_50":"Her tattered shawl is soaked in dark blood and her cackle turns to a shriek of fury as she claws at your throat.","8_health_25":"Hunched and bleeding heavily, the ancient crone spits a final curse and lunges with crooked talons.","9_dead":"The moss-skinned crone lies crumpled and lifeless upon the dark earth, her wicked hexes broken."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Green%20Hag',
    'Monstrous Humanoid', NULL, 'Standard'
)
ON CONFLICT(name) DO UPDATE SET
    symbol = excluded.symbol,
    color = excluded.color,
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    initiative_bonus = excluded.initiative_bonus,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    spawn_weight = excluded.spawn_weight,
    habitat = excluded.habitat,
    movement_type = excluded.movement_type,
    special_abilities = excluded.special_abilities,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    defeated_image_path = excluded.defeated_image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

DELETE FROM monster_terrains WHERE monster_id = (SELECT id FROM monsters WHERE name = 'Green Hag');
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 1 FROM monsters WHERE name = 'Green Hag';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 0 FROM monsters WHERE name = 'Green Hag';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 0 FROM monsters WHERE name = 'Green Hag';

-- Monster: Orc Warchief (Level 5, CR 5, Humanoid)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, defeated_image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Orc Warchief', 'O', '#8b0000', 45, 1600, '2d6+6',
    2, 18, 10, 5,
    5, 7, '["F","H","P"]', 'WALK',
    '["warlord_roar", "ferocity", "brutal_cleave"]', 'images/monsters/orc_warchief.png', 'images/monsters/orc_warchief_defeated.png', '{"1_distant":"A booming, guttural war-chant and the heavy clash of iron against timber echo from a trophy-hung clearing.","2_ranger_distant":"Massive iron-cleated tracks and cleft shields nailed to pine trunks mark the domain of a blooded orcish warlord.","3_close":"A hulking, battle-scarred orc warlord clad in spiked black iron plate and a wolf-pelt mantle, wielding a brutal double-bladed greataxe.","4_ranger_close":"His terrifying warlord roar and ferocious cleaves can overwhelm a hesitant defender; save your healing for his heavy axe swings.","5_health_100":"Bellowing a blood-curdling war-cry, the spiked-armor warlord charges with his massive double-bladed greataxe whirling.","6_health_75":"A blow sparks across his black iron breastplate, enraging the chieftain as he cleaves back with bone-crushing power.","7_health_50":"Bleeding from a split brow and cracked pauldrons, the scarred warlord grins around his tusks and swings harder.","8_health_25":"Refusing to kneel even as his lifeblood pools at his boots, the dying warchief puts all his weight into a final overhead chop.","9_dead":"The massive armored warchief crashes to the earth like a felled oak beside his bloodied double-bladed greataxe."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Orc',
    'Humanoid', 'orc', 'Double'
)
ON CONFLICT(name) DO UPDATE SET
    symbol = excluded.symbol,
    color = excluded.color,
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    initiative_bonus = excluded.initiative_bonus,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    spawn_weight = excluded.spawn_weight,
    habitat = excluded.habitat,
    movement_type = excluded.movement_type,
    special_abilities = excluded.special_abilities,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    defeated_image_path = excluded.defeated_image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

DELETE FROM monster_terrains WHERE monster_id = (SELECT id FROM monsters WHERE name = 'Orc Warchief');
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 1 FROM monsters WHERE name = 'Orc Warchief';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Orc Warchief';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'PLAINS', 0 FROM monsters WHERE name = 'Orc Warchief';
