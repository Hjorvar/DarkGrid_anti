-- 002_seed_monsters.sql: Monster catalog for Darkgrid
-- Includes authentic Assassin Vine with author's 9 custom descriptions
-- Plus clearly marked development placeholders for levels 1-2 & 4 to test normal weighting.

-- 1. Assassin Vine (Official test entry)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Assassin Vine', 'P', '#006400', 30, 800, '1d8+7',
    0, 15, 7, 3,
    3, 10, '["F", "J", "S"]', 'WALK',
    '["grab", "constrict", "entangle", "camouflage"]',
    'images/monsters/assassin_vine.png',
    '{
      "1_distant": "The undergrowth here is unusually thick, and the vines seem to twitch against the wind.",
      "2_ranger_distant": "You spot the skeletal remains of birds within the brush; this foliage is carnivorous.",
      "3_close": "A thick, knotted vine with purple flowers and thorns the size of daggers that lashes out like a snake.",
      "4_ranger_close": "It has no eyes to blind; you recall it tracks prey through vibration and heat alone.",
      "5_health_100": "The entire plant writhes, seeking to constrict and crush.",
      "6_health_75": "Several vines are severed, leaking thick, white sap.",
      "7_health_50": "It recoils, its movements becoming sluggish and jerky.",
      "8_health_25": "The main trunk is split, and the thorns droop downward.",
      "9_dead": "A withered pile of dead plant matter, indistinguishable from the forest floor."
    }',
    'https://www.d20pfsrd.com/bestiary/monster-listings/plants/assassin-vine/',
    'Plant', NULL
)
ON CONFLICT(name) DO UPDATE SET
    solo_level = excluded.solo_level,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 1 FROM monsters WHERE name = 'Assassin Vine';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'JUNGLE', 0 FROM monsters WHERE name = 'Assassin Vine';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 0 FROM monsters WHERE name = 'Assassin Vine';

-- 2. Wolf (Official Pathfinder 1e, CR 1, Animal)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Wolf', 'W', '#8b5a2b', 13, 400, '1d6+1',
    2, 14, 2, 1.0,
    1, 12, '["F", "P", "H"]', 'WALK',
    '["trip", "scent", "low-light vision"]',
    'images/monsters/wolf.png',
    '{
      "1_distant": "Low amber eyes gleam in the dark shadows between the trees, followed by a muffled snarl.",
      "2_ranger_distant": "Claw prints and tufts of matted grey fur reveal a lone, diseased pack-hunter circling downwind.",
      "3_close": "A gaunt grey wolf with bared fangs dripping foul saliva, crouching to pounce at your throat.",
      "4_ranger_close": "Its hind leg bears an old scar, causing it to favor its right flank when lunging.",
      "5_health_100": "The predator stalks smoothly, muscles taut and ready to snap forward.",
      "6_health_75": "Blood mats its coarse coat from a solid strike, turning its snarl frantic.",
      "7_health_50": "The beast limps heavily, whimpering with each labored breath as red foam stains its jaws.",
      "8_health_25": "Collapsing onto its side, the wolf feebly snaps at empty air.",
      "9_dead": "A limp grey carcass sprawled cold upon the earth."
    }',
    'https://aonprd.com/MonsterDisplay.aspx?ItemName=Wolf',
    'Animal', NULL
)
ON CONFLICT(name) DO UPDATE SET
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 1 FROM monsters WHERE name = 'Wolf';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'PLAINS', 0 FROM monsters WHERE name = 'Wolf';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Wolf';

-- 3. Troll (Official Pathfinder 1e, CR 5, Large Humanoid (giant))
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Troll', 'T', '#4a5d4e', 63, 1600, '1d6+5',
    2, 16, 8, 5.0,
    5, 5, '["M", "S", "U"]', 'WALK',
    '["regeneration", "rend", "scent", "darkvision"]',
    'images/monsters/troll.png',
    '{
      "1_distant": "The earth trembles faintly under heavy, thudding footsteps accompanied by the stench of rotten carrion.",
      "2_ranger_distant": "Crushed boulders and deeply gouged moss reveal a massive brutish humanoid scouring the marsh.",
      "3_close": "A hulking behemoth with moss-covered warty green skin and claws like iron pickaxes.",
      "4_ranger_close": "Its flesh knits together unnaturally fast; only fire or acid can halt its vile regeneration.",
      "5_health_100": "The brute roars a deafening challenge, slamming its massive fists into the ground.",
      "6_health_75": "Deep gashes along its torso seep dark blood, but muscle fibers visibly strain to knit shut.",
      "7_health_50": "Its monstrous roar turns into a guttural howl of rage as broken bones protrude from its limbs.",
      "8_health_25": "Staggering and blinded by its own black blood, the giant brute swings clumsily in desperation.",
      "9_dead": "A colossal heap of putrid green flesh, at last still and silent."
    }',
    'https://aonprd.com/MonsterDisplay.aspx?ItemName=Troll',
    'Humanoid', 'giant'
)
ON CONFLICT(name) DO UPDATE SET
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'MOUNTAINS', 1 FROM monsters WHERE name = 'Troll';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 0 FROM monsters WHERE name = 'Troll';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 0 FROM monsters WHERE name = 'Troll';
