-- 003_seed_new_monsters.sql: Five new Pathfinder 1e monsters for Darkgrid
-- Sourced from Archives of Nethys (aonprd.com)
-- 1. Ghoul (CR 1, Undead)
-- 2. Giant Spider (CR 1, Vermin)
-- 3. Choker (CR 2, Aberration)
-- 4. Rust Monster (CR 3, Aberration)
-- 5. Manticore (CR 5, Magical Beast)

-- 1. Ghoul (Level 1, Underground/Plains/Swamp)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Ghoul', 'G', '#7a8b7b', 13, 400, '1d6+1',
    2, 14, 3, 1.0,
    1, 10, '["U", "P", "S"]', 'WALK',
    '["paralysis", "ghoul_fever"]',
    'images/monsters/ghoul.png',
    '{
      "1_distant": "A sickening stench of rot drifts on the chill wind, accompanied by the wet, sickening crunch of gnawed bone.",
      "2_ranger_distant": "You recognize the frantic, clawed excavations around burial mounds; an undead scavenger is feasting nearby.",
      "3_close": "A gaunt, ash-grey corpse crouches before you, its sunken jaws lined with jagged teeth and a foul, drooling tongue.",
      "4_ranger_close": "Its filth-encrusted claws carry virulent paralysis; evade its reach and strike from beyond its claw span.",
      "5_health_100": "The ghoul hisses with manic fury, corded tendons taut as it readies to tear warm flesh.",
      "6_health_75": "Black ichor spatters its withered skin as it snarls, undeterred by the pain.",
      "7_health_50": "Its desiccated limbs fracture beneath the assault, yet hunger drives its broken jaws forward.",
      "8_health_25": "Crawling through the dirt on splintered limbs, it snaps blindly with shattered teeth.",
      "9_dead": "A twisted, motionless heap of decaying bones and grey flesh, its unnatural hunger finally quenched."
    }',
    'https://aonprd.com/MonsterDisplay.aspx?ItemName=Ghoul',
    'Undead', NULL
)
ON CONFLICT(name) DO UPDATE SET
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 1 FROM monsters WHERE name = 'Ghoul';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'PLAINS', 0 FROM monsters WHERE name = 'Ghoul';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 0 FROM monsters WHERE name = 'Ghoul';

-- 2. Giant Spider (Level 1, Forest/Jungle/Swamp/Underground)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Giant Spider', 'S', '#4a382a', 16, 400, '1d6',
    3, 14, 2, 1.0,
    1, 12, '["F", "J", "S", "U"]', 'WALK',
    '["poison", "web"]',
    'images/monsters/giant_spider.png',
    '{
      "1_distant": "Thick, dust-choked webs drape across the shadows, vibrating faintly as if touched by invisible hands.",
      "2_ranger_distant": "Silk tripwires crisscross the narrow path ahead, rigged to alert an eight-legged ambusher concealed above.",
      "3_close": "A bloated, bristling arachnid descends rapidly, eight crimson eyes glittering above venom-dripping black chelicerae.",
      "4_ranger_close": "Its bulbous abdomen houses pressurized web-spinners; severing its leg joints will cripple its lethal scuttling charge.",
      "5_health_100": "The massive arachnid rears up on its hind legs, snapping its dripping fangs with dry, clicking snaps.",
      "6_health_75": "Thick, cloudy hemolymph oozes from pierced chitin plates as the beast recoils.",
      "7_health_50": "Several legs drag limp and crumpled; the spider thrashes wildly, spraying sticky silk in defense.",
      "8_health_25": "Its ruptured thorax shudders against the ground, mandibles twitching weakly in dying convulsions.",
      "9_dead": "A shriveled, curled cluster of bristled legs curled tight over a broken, oozing carapace."
    }',
    'https://aonprd.com/MonsterDisplay.aspx?ItemName=Giant%20Spider',
    'Vermin', NULL
)
ON CONFLICT(name) DO UPDATE SET
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 1 FROM monsters WHERE name = 'Giant Spider';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'JUNGLE', 0 FROM monsters WHERE name = 'Giant Spider';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 0 FROM monsters WHERE name = 'Giant Spider';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 0 FROM monsters WHERE name = 'Giant Spider';

-- 3. Choker (Level 2, Underground/Hills/Mountains)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Choker', 'C', '#8c7b64', 16, 600, '1d4+3',
    6, 17, 6, 2.0,
    2, 10, '["U", "H", "M"]', 'CLIMB',
    '["grab", "constrict", "strangle"]',
    'images/monsters/choker.png',
    '{
      "1_distant": "A faint rustle of stones and a dry, rasping scrape echo from the high crevices above the path.",
      "2_ranger_distant": "Gouge marks and pale, rubbery slime on the rocky ceiling reveal the stalking perch of a subterranean strangler.",
      "3_close": "A hunched, hairless horror with mottled pale skin drops down, flailing four boneless, tentacular arms capped with jagged claws.",
      "4_ranger_close": "Its pliable limbs lack rigid bones, allowing it to constrict prey in seconds; keep blade between its tentacles and your throat.",
      "5_health_100": "The aberration flexes its serpentine arms eagerly, wide lidless eyes fixed hungrily on your neck.",
      "6_health_75": "Slashed rubbery flesh weeps yellow grease, provoking a high-pitched, screeching hiss.",
      "7_health_50": "One grasping tentacle hangs severed at the elbow, and the creature frantically scurries backward into the shadows.",
      "8_health_25": "Wheezing through a punctured ribcage, the wretched creature feebly shields its skull with its remaining claw.",
      "9_dead": "A limp, pale puddle of boneless limbs and bloated torso sprawled silent upon the cold rock."
    }',
    'https://aonprd.com/MonsterDisplay.aspx?ItemName=Choker',
    'Aberration', NULL
)
ON CONFLICT(name) DO UPDATE SET
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 1 FROM monsters WHERE name = 'Choker';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Choker';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'MOUNTAINS', 0 FROM monsters WHERE name = 'Choker';

-- 4. Rust Monster (Level 3, Underground/Hills/Mountains)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Rust Monster', 'R', '#9e472a', 27, 800, '1d3',
    3, 18, 6, 3.0,
    3, 8, '["U", "H", "M"]', 'WALK',
    '["rust", "scent_metals"]',
    'images/monsters/rust_monster.png',
    '{
      "1_distant": "A strange metallic clinking drifts through the corridor, followed by the acrid, coppery smell of oxidization.",
      "2_ranger_distant": "Discarded flakes of corroded iron and pitted weapon fragments litter the trail—a metal-devourer prowls this sector.",
      "3_close": "An armored, insectoid quadruped with rust-red chitinous plating and two long, feathery antennae quivering toward your gear.",
      "4_ranger_close": "Its antennae dissolve forged metals in a heartbeat; stow your steel or strike with wooden, stone, or distance tactics.",
      "5_health_100": "The beast clicks its paddle-tail aggressively, antennae whipping eagerly toward the scent of cold iron.",
      "6_health_75": "Cracks appear across its thick carapace, leaking foul orange fluids as it skitters in agitated circles.",
      "7_health_50": "One antenna hangs burned and snapped; the creature lets out a shrill chittering sound of distress.",
      "8_health_25": "Smashed chitin exposes pulsing soft tissues; the rust-eater scrambles feebly, seeking refuge.",
      "9_dead": "A shattered husk of dull reddish armor plates, collapsing into inert flakes of brittle shell."
    }',
    'https://aonprd.com/MonsterDisplay.aspx?ItemName=Rust%20Monster',
    'Aberration', NULL
)
ON CONFLICT(name) DO UPDATE SET
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 1 FROM monsters WHERE name = 'Rust Monster';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Rust Monster';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'MOUNTAINS', 0 FROM monsters WHERE name = 'Rust Monster';

-- 5. Manticore (Level 5, Hills/Mountains/Plains/Swamp)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Manticore', 'M', '#b35d25', 57, 1600, '1d8+5',
    2, 17, 10, 5.0,
    5, 5, '["H", "M", "P", "S"]', 'FLY',
    '["spike_volley", "scent", "flight"]',
    'images/monsters/manticore.png',
    '{
      "1_distant": "A piercing, brassy roar reverberates across the ridges, followed by the heavy downdraft of monstrous wings.",
      "2_ranger_distant": "Barbed iron-hard quills embedded deep in shattered stone mark the hunting territory of a territorial aerial chimera.",
      "3_close": "A colossal monstrosity with a muscular lion body, leathery bat wings, and a sinister human face beneath a crown of wicked horns.",
      "4_ranger_close": "Its tail works like a catapult loaded with deadly spikes; seek solid cover when its tail coils to fire.",
      "5_health_100": "The manticore spreads its massive wings, baring rows of shark-like teeth as its barbed tail snaps rhythmically.",
      "6_health_75": "Pierced wing membranes flutter raggedly; crimson stains its tawny coat as it bellows in savage anger.",
      "7_health_50": "Grounded by torn flight muscles, the beast snarls viciously, lashing its tail spikes with frantic fury.",
      "8_health_25": "Bleeding profusely from deep gashes, the creature staggers on broken legs, spitting bloody curses.",
      "9_dead": "The majestic horror lies broken upon the earth, massive wings folded in stillness, tail quills scattered and inert."
    }',
    'https://aonprd.com/MonsterDisplay.aspx?ItemName=Manticore',
    'Magical Beast', NULL
)
ON CONFLICT(name) DO UPDATE SET
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 1 FROM monsters WHERE name = 'Manticore';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'MOUNTAINS', 0 FROM monsters WHERE name = 'Manticore';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'PLAINS', 0 FROM monsters WHERE name = 'Manticore';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 0 FROM monsters WHERE name = 'Manticore';
