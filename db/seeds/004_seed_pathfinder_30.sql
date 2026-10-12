-- 004_seed_pathfinder_30.sql: 30 Authentic Pathfinder 1e monsters for Darkgrid
-- Sourced from Archives of Nethys (aonprd.com)
-- Covers CR 1/4 to CR 5 for levels 1-5 with full terrain coverage and threat secrecy descriptions.

-- Monster: Kobold (CR 0.25, Humanoid)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Kobold', 'k', '#8b4513', 5, 100, '1d6-1',
    1, 15, 1, 0.25,
    1, 15, '["U", "F", "H"]', 'WALK',
    '["darkvision", "light_sensitivity", "crafty"]', 'images/monsters/kobold.png', '{
  "1_distant": "A faint scuttling sound and the click of claws over loose gravel echo ahead, accompanied by nervous, high-pitched chirps.",
  "2_ranger_distant": "You notice hidden tripwires and small, reptilian claw prints dusted with soot; crafty subterranean scavengers are preparing an ambush.",
  "3_close": "A diminutive, reptilian humanoid with mottled rust-scaled hide and glowing red eyes, clutching a crude spear behind a light wooden shield.",
  "4_ranger_close": "Its scales are brittle and it recoils from sudden illumination; press aggressively to break its cowardly discipline.",
  "5_health_100": "The scaly creature hisses through sharp teeth, holding its javelin steady while darting its gaze for an escape.",
  "6_health_75": "Cracked scales leak pale blood, prompting frantic yips and defensive spear thrusts.",
  "7_health_50": "Bleeding heavily from its torso, the creature stumbles backward, desperate to put distance between you.",
  "8_health_25": "Dropping its shield with a frightened squeal, it cowers low, clutching its shattered flank.",
  "9_dead": "A frail scaly form lies crumpled in the dirt, spear broken beneath its weight."
}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Kobold',
    'Humanoid', 'reptilian'
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
SELECT id, 'UNDERGROUND_RUINS', 1 FROM monsters WHERE name = 'Kobold';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 0 FROM monsters WHERE name = 'Kobold';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Kobold';

-- Monster: Goblin (CR 0.33, Humanoid)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Goblin', 'g', '#556b2f', 6, 135, '1d4',
    6, 16, 2, 0.33,
    1, 15, '["F", "P", "H", "C"]', 'WALK',
    '["darkvision"]', 'images/monsters/goblin.png', '{
  "1_distant": "Muffled, raspy giggles and the metallic clatter of mismatched blades rustle within the nearby foliage.",
  "2_ranger_distant": "Crude snares made of horsehair and scorched dog bones litter the thicket; feral, screeching scavengers are lurking close.",
  "3_close": "A wiry, flat-faced runt with sickly green skin, a comically oversized skull, and a jagged rusted blade gripped in twitching hands.",
  "4_ranger_close": "Its erratic dodges rely on speed over armor; anticipate its chaotic leaps to cut it down.",
  "5_health_100": "The runt hops from foot to foot, baring needle-sharp yellow teeth and brandishing its notched blade with crazed glee.",
  "6_health_75": "A crimson slash across its leathery chest silences its manic cackle into a furious screech.",
  "7_health_50": "Wounded and spitting curses, it clutches a lacerated shoulder while swinging wildly in panic.",
  "8_health_25": "Bleeding profusely, it whimpers pathetically and scrambles on all fours to flee.",
  "9_dead": "The oversized head falls still in the mud, dead eyes staring wide into oblivion."
}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Goblin',
    'Humanoid', 'goblinoid'
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
SELECT id, 'FOREST', 1 FROM monsters WHERE name = 'Goblin';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'PLAINS', 0 FROM monsters WHERE name = 'Goblin';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Goblin';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'COAST', 0 FROM monsters WHERE name = 'Goblin';

-- Monster: Human Skeleton (CR 0.33, Undead)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Human Skeleton', 's', '#dcdcdc', 4, 135, '1d6',
    6, 16, 0, 0.33,
    1, 15, '["U", "P", "H", "S", "F", "T", "D", "C"]', 'WALK',
    '["damage_reduction_bludgeoning", "immune_cold", "undead_traits"]', 'images/monsters/human_skeleton.png', '{
  "1_distant": "A dry, rhythmic clicking of brittle bones echoes through the dark, accompanied by the scrape of rusted iron over stone.",
  "2_ranger_distant": "Pale bone splinters and ancient, tattered burial shrouds snagged on stones reveal restless dead wandering the area.",
  "3_close": "A bleached human skeleton held together by grim sorcery, hollow eye sockets staring unblinkingly as it raises a tarnished scimitar.",
  "4_ranger_close": "Blades and piercing tips slip uselessly through hollow ribs; crushing blunt weapons will shatter its brittle structure.",
  "5_health_100": "The skeletal warrior advances with jerky, relentless precision, sword raised in silence.",
  "6_health_75": "Cracks spiderweb across its ribcage from the impact, yet it marches forward without hesitation.",
  "7_health_50": "Several ribs and arm fragments shatter to dust, causing its posture to lurch erratically.",
  "8_health_25": "Its spine is nearly severed; the skull rattles atop fractured vertebrae as it feebly swings.",
  "9_dead": "The animating magic snaps, collapsing the skeleton into a motionless mound of harmless bones."
}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Human%20Skeleton',
    'Undead', NULL
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
SELECT id, 'UNDERGROUND_RUINS', 1 FROM monsters WHERE name = 'Human Skeleton';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'PLAINS', 0 FROM monsters WHERE name = 'Human Skeleton';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Human Skeleton';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 0 FROM monsters WHERE name = 'Human Skeleton';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 0 FROM monsters WHERE name = 'Human Skeleton';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'CITY', 0 FROM monsters WHERE name = 'Human Skeleton';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'DESERT', 0 FROM monsters WHERE name = 'Human Skeleton';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'COAST', 0 FROM monsters WHERE name = 'Human Skeleton';

-- Monster: Hobgoblin (CR 0.5, Humanoid)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Hobgoblin', 'H', '#cd853f', 11, 200, '1d8+1',
    2, 16, 2, 0.5,
    1, 12, '["H", "M", "U", "F"]', 'WALK',
    '["darkvision"]', 'images/monsters/hobgoblin.png', '{
  "1_distant": "Disciplined, heavy footsteps crunch over gravel, followed by the firm clink of well-oiled iron armor.",
  "2_ranger_distant": "Measured boot prints in patrol formation and polished whetstone shavings indicate an organized, martial scout watching the ridges.",
  "3_close": "A tall, broad-shouldered humanoid with reddish-grey skin, sharp canine teeth, and steely eyes, holding a broad longsword in a trained guard.",
  "4_ranger_close": "This soldier fights with strict tactical discipline; parry its calculated thrusts and exploit its rigid stance.",
  "5_health_100": "The militaristic soldier barks a harsh command, standing firm and testing your guard with measured steel.",
  "6_health_75": "Blood stains its studded armor, but its hardened expression tightens into cold resolve.",
  "7_health_50": "Grievously wounded, the soldier shifts to a defensive stance, teeth gritted through heavy breaths.",
  "8_health_25": "Kneeling on one leg in a pool of blood, the warrior stubbornly raises its cracked shield with trembling arms.",
  "9_dead": "The stern warrior collapses flat upon the stone, sword clattering loosely from lifeless fingers."
}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Hobgoblin',
    'Humanoid', 'goblinoid'
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
SELECT id, 'HILLS', 1 FROM monsters WHERE name = 'Hobgoblin';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'MOUNTAINS', 0 FROM monsters WHERE name = 'Hobgoblin';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 0 FROM monsters WHERE name = 'Hobgoblin';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 0 FROM monsters WHERE name = 'Hobgoblin';

-- Monster: Human Zombie (CR 0.5, Undead)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Human Zombie', 'Z', '#696969', 12, 200, '1d6+4',
    0, 12, 4, 0.5,
    1, 12, '["S", "U", "P", "F", "C"]', 'WALK',
    '["damage_reduction_slashing", "staggered", "undead_traits"]', 'images/monsters/human_zombie.png', '{
  "1_distant": "A heavy, dragging shuffle squelches in the muck, accompanied by a low, guttural moan that chills the air.",
  "2_ranger_distant": "Rotting scraps of burial cloth caught on thorns and dragged heels in the mud signal an animated corpse driven by unnatural hunger.",
  "3_close": "A decayed human corpse with grey, sloughing flesh, clouded lifeless eyes, and rotting limbs raised to batter you into the soil.",
  "4_ranger_close": "It feels no pain and plods slowly; keep moving to evade its ponderous slams and sever its limbs with slashing strikes.",
  "5_health_100": "The corpse lurches forward heedless of danger, unhinging jaw to emit a hollow groan.",
  "6_health_75": "Flesh splits and dark, congealed blood oozes forth, yet the dead body advances without flinching.",
  "7_health_50": "A heavy blow shatters its shoulder, leaving one arm dangling uselessly while it stumbles on.",
  "8_health_25": "Half its ribcage is smashed open; dragging its broken torso through the dirt, it still reaches out to grasp.",
  "9_dead": "The foul animating spark extinguishes, leaving inert, rotting meat to return to the earth."
}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Human%20Zombie',
    'Undead', NULL
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
SELECT id, 'SWAMP', 1 FROM monsters WHERE name = 'Human Zombie';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 0 FROM monsters WHERE name = 'Human Zombie';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'PLAINS', 0 FROM monsters WHERE name = 'Human Zombie';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 0 FROM monsters WHERE name = 'Human Zombie';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'COAST', 0 FROM monsters WHERE name = 'Human Zombie';

-- Monster: Troglodyte (CR 1, Humanoid)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Troglodyte', 't', '#4e5d42', 13, 400, '1d6+1',
    -1, 15, 2, 1,
    1, 10, '["U", "S"]', 'WALK',
    '["stench", "darkvision"]', 'images/monsters/troglodyte.png', '{
  "1_distant": "An overpowering, nauseating stench of rotten musk wafts ahead, accompanied by guttural reptilian clicks.",
  "2_ranger_distant": "Foul, oily secretion smeared along cavern walls marks the territory of subterranean lizard-folk who choke their prey with foul stench.",
  "3_close": "A crouched, scaly subterranean savage with sickly olive hide, dorsal frills, and red eyes, brandishing a crudely carved stone club.",
  "4_ranger_close": "Its glandular secretions induce violent nausea; keep upwind and strike swiftly before the foul odor overwhelms your senses.",
  "5_health_100": "The reptilian savage bellows a guttural challenge, glandular pores oozing a noxious, sickening fog.",
  "6_health_75": "Deep lacerations across its torso leak dark green blood, infuriating the beast into a frenzy of claw swipes.",
  "7_health_50": "Gasping and wheezing, the reptile recoils as cracked ribs force it to drop its stone weapon.",
  "8_health_25": "Collapsing onto slick stones, it thrashes weakly with its tail, clutching its torn abdomen.",
  "9_dead": "The scaly brute lies motionless in a pool of foul musk, finally robbed of its sickening stench."
}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Troglodyte',
    'Humanoid', 'reptilian'
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
SELECT id, 'UNDERGROUND_RUINS', 1 FROM monsters WHERE name = 'Troglodyte';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 0 FROM monsters WHERE name = 'Troglodyte';

-- Monster: Darkmantle (CR 1, Magical Beast)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Darkmantle', 'd', '#2f4f4f', 15, 400, '1d4+4',
    4, 15, 3, 1,
    1, 10, '["U"]', 'WALK',
    '["darkness", "constrict", "blindsight"]', 'images/monsters/darkmantle.png', '{
  "1_distant": "An unnatural drop of icy water falls from the ceiling, followed by a faint, leathery scraping above.",
  "2_ranger_distant": "You notice stalactites on the ceiling that lack mineral seams and appear oddly fleshy; a predatory ceiling-lurker is waiting overhead.",
  "3_close": "A bizarre subterranean carnivore shaped like a stony stalactite, opening into a webbed mantle ringed with claws and a snapping central maw.",
  "4_ranger_close": "It drops from above to engulf and suffocate heads in magical darkness; guard your throat and slice the webbed mantle.",
  "5_health_100": "The creature unfurls its webbed tentacles with a wet snap, descending rapidly like a living executioner''s hood.",
  "6_health_75": "A slash tears through its leathery webbing, releasing cloudy fluid as it screeches sharply.",
  "7_health_50": "Losing its suction on the stone, the beast thrashes on the ground with severed tentacles.",
  "8_health_25": "Its central stony mantle is split wide open; it twitches pathetically as darkness bleeds from its wounds.",
  "9_dead": "A deflated, rubbery mass of torn webbing and shattered stone-like hide sprawled limp upon the floor."
}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Darkmantle',
    'Magical Beast', NULL
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
SELECT id, 'UNDERGROUND_RUINS', 1 FROM monsters WHERE name = 'Darkmantle';

-- Monster: Lizardfolk (CR 1, Humanoid)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Lizardfolk', 'L', '#2e8b57', 11, 400, '1d8+1',
    0, 17, 2, 1,
    1, 10, '["S", "R", "C"]', 'WALK',
    '["hold_breath", "swim"]', 'images/monsters/lizardfolk.png', '{
  "1_distant": "A heavy splash ripples across the murky waters, followed by the low hiss of an unblinking watcher among the reeds.",
  "2_ranger_distant": "Webbed footprints and discarded, stripped fish carcasses in the shallow banks indicate an amphibious tribal hunter defending its territory.",
  "3_close": "A tall, muscular reptilian warrior with emerald scales, a lashing muscular tail, and a spiked morningstar clutched in clawed fingers.",
  "4_ranger_close": "Its thick natural scales deflect slashing attacks, but its aquatic tail balance can be exploited to knock it prone.",
  "5_health_100": "The scaly warrior lets out a fierce territorial hiss, flexing its powerful tail and raising its spiked weapon.",
  "6_health_75": "Bright reptilian blood drips from its shoulder scales as it counters with a ferocious snap of its jaws.",
  "7_health_50": "Staggered by a solid blow, the hunter retreats toward the water, balance faltering on the muddy bank.",
  "8_health_25": "Collapsing into the shallows, the warrior wheezes through cracked scales, clawing feebly at the mud.",
  "9_dead": "The reptilian hunter drifts motionless in the marsh weeds, its warrior spirit departed."
}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Lizardfolk',
    'Humanoid', 'reptilian'
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
SELECT id, 'SWAMP', 1 FROM monsters WHERE name = 'Lizardfolk';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'RIVER_LAKE', 0 FROM monsters WHERE name = 'Lizardfolk';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'COAST', 0 FROM monsters WHERE name = 'Lizardfolk';

-- Monster: Hyena (CR 1, Animal)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Hyena', 'h', '#a0522d', 13, 400, '1d6+3',
    2, 14, 3, 1,
    1, 12, '["P", "D", "H"]', 'WALK',
    '["trip", "scent", "low-light vision"]', 'images/monsters/hyena.png', '{
  "1_distant": "A haunting, whooping bark echoes across the open scrubland, followed by the hurried rustling of dry grass.",
  "2_ranger_distant": "Crushed, marrow-splintered bones and heavy four-toed paw prints reveal a powerful bone-cracking scavenger circling for an opening.",
  "3_close": "A sloped-backed canine with coarse, spotted tawny fur, massive jaw musculature, and wicked fangs bared in a mocking snarl.",
  "4_ranger_close": "Its crushing bite is designed to pull prey off its feet; brace your legs against its lunges to avoid being pinned.",
  "5_health_100": "The predator paces in a wide circle, chuckling low in its throat as it gauges your vulnerability.",
  "6_health_75": "A sharp blow across its ribs turns its mocking cackle into an enraged, guttural growl.",
  "7_health_50": "Limping heavily on a fractured hind leg, the scavenger snaps desperately whenever you advance.",
  "8_health_25": "Whimpering in agony, the animal collapses into the dust, tongue lolling as it bleeds out.",
  "9_dead": "A spotted, mangy carcass lies limp upon the savannah earth, jaw frozen slightly agape."
}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Hyena',
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
SELECT id, 'PLAINS', 1 FROM monsters WHERE name = 'Hyena';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'DESERT', 0 FROM monsters WHERE name = 'Hyena';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Hyena';

-- Monster: Gnoll (CR 1, Humanoid)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Gnoll', 'G', '#8b5a2b', 11, 400, '1d8+3',
    0, 15, 3, 1,
    1, 10, '["D", "P", "H"]', 'WALK',
    '["darkvision"]', 'images/monsters/gnoll.png', '{
  "1_distant": "A cruel, barking laugh drifts across the dunes, punctuated by the clank of bone jewelry and rusted chain.",
  "2_ranger_distant": "Scattered iron shackles and hyena-like boot tracks reveal a ruthless desert raider stalking travelers for flesh and coin.",
  "3_close": "A hulking, hyena-headed humanoid standing over seven feet tall, with matted brown fur, glowing amber eyes, and a notched spear.",
  "4_ranger_close": "It relies on brute strength and ferocious reach; parry its spear thrusts to exploit its reckless, lunging footwork.",
  "5_health_100": "The hyena-man snarls viciously, rattling its spear against its hide shield with terrifying bloodlust.",
  "6_health_75": "Blood stains its bristling pelt, but pain only stokes the brute''s sadistic frenzy.",
  "7_health_50": "Coughing blood through bared fangs, the raider falters as its vicious sneer turns into grim realization.",
  "8_health_25": "Dropping its shield, the gnoll staggers backward clutching its butchered abdomen with clawed paws.",
  "9_dead": "The towering hyena-raider crashes into the sand, dead eyes reflecting the empty desert sky."
}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Gnoll',
    'Humanoid', 'gnoll'
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
SELECT id, 'DESERT', 1 FROM monsters WHERE name = 'Gnoll';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'PLAINS', 0 FROM monsters WHERE name = 'Gnoll';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Gnoll';

-- Monster: Giant Frog (CR 1, Animal)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Giant Frog', 'F', '#2e8b57', 15, 400, '1d6+2',
    1, 12, 3, 1,
    1, 10, '["R", "S", "A"]', 'WALK',
    '["tongue", "pull", "swallow_whole", "swim"]', 'images/monsters/giant_frog.png', '{
  "1_distant": "A deep, resonant croak vibrates through the reeds, followed by the heavy suck of mud under massive webbed limbs.",
  "2_ranger_distant": "A wide trail of slick slime and flattened rushes leading toward deep water points to a giant amphibian lying in wait.",
  "3_close": "A monstrous amphibian the size of a pony, with mottled warty skin, bulging yellow eyes, and an immense rubbery gullet.",
  "4_ranger_close": "Its whip-like tongue strikes from a distance to drag prey toward its cavernous mouth; sever the tongue if it ensnares you.",
  "5_health_100": "The bloated beast inflates its throat sac with a deafening thrum, ready to lash out with sticky speed.",
  "6_health_75": "Thick, pale fluid oozes from punctured skin as the frog recoils into the shallow water.",
  "7_health_50": "Gashed across its flank, the creature thrashes sluggishly, tongue trailing clumsily in the muck.",
  "8_health_25": "Its throat sac collapses as blood pools in the water; it feebly kicks its webbed feet.",
  "9_dead": "A bloated, lifeless mound floats belly-up among the water lilies."
}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Giant%20Frog',
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
SELECT id, 'RIVER_LAKE', 1 FROM monsters WHERE name = 'Giant Frog';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 0 FROM monsters WHERE name = 'Giant Frog';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'AQUATIC', 0 FROM monsters WHERE name = 'Giant Frog';

-- Monster: Boar (CR 2, Animal)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Boar', 'b', '#5c4033', 18, 600, '1d8+4',
    0, 14, 4, 2,
    2, 12, '["F", "P", "H"]', 'WALK',
    '["ferocity", "scent", "low-light vision"]', 'images/monsters/boar.png', '{
  "1_distant": "Furious snorting and the violent snapping of saplings resound as heavy hooves gouge deep furrows in the loam.",
  "2_ranger_distant": "Freshly uprooted saplings and tree bark shredded by sharp tusks warn of a territorial wild swine in rutting fury.",
  "3_close": "A muscular wild swine covered in bristling dark brown bristles, small bloodshot eyes gleaming with unrestrained savagery below curved tusks.",
  "4_ranger_close": "Its relentless ferocity keeps it fighting through lethal wounds; maintain your guard even when it appears mortally injured.",
  "5_health_100": "Pawings at the dirt, the brute lowers its razor tusks and bellows a furious snort of pure malice.",
  "6_health_75": "Deep blade cuts score its shoulders, but the animal only squeals with mounting, reckless rage.",
  "7_health_50": "Frothing red at the jowls and bleeding heavily, its ferocity drives it forward in a blind, suicidal charge.",
  "8_health_25": "With broken legs and pierced lungs, the dying beast stubbornly drags itself forward to deliver one final gore.",
  "9_dead": "The heavy bristled carcass collapses onto the broken ferns, breath exhaling in a final shudder."
}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Boar',
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
SELECT id, 'FOREST', 1 FROM monsters WHERE name = 'Boar';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'PLAINS', 0 FROM monsters WHERE name = 'Boar';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Boar';

-- Monster: Yellow Musk Creeper (CR 2, Plant)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Yellow Musk Creeper', 'Y', '#d4af37', 22, 600, '1d4+1',
    2, 14, 4, 2,
    2, 10, '["F", "U", "J"]', 'WALK',
    '["enthrall", "mind_destroying_pollen", "plant_traits"]', 'images/monsters/yellow_musk_creeper.png', '{
  "1_distant": "A cloying, sickly-sweet perfume drifts on the breeze, accompanied by the dry rustle of creeping green tendrils.",
  "2_ranger_distant": "A trail of hollow-eyed animal carcasses with yellow blossoms sprouting from their craniums marks a predatory mind-devouring plant.",
  "3_close": "A sprawling thicket of clinging green vines adorned with brilliant yellow orchid-like blossoms that puff clouds of golden dust.",
  "4_ranger_close": "Its sweet pollen cloud bewitches the mind to harvest brains; cover your nose and incinerate its central root cluster.",
  "5_health_100": "The blossoms twitch in unison, spraying an intoxicating yellow mist toward your face.",
  "6_health_75": "Severed vines weep yellow milky sap as the remaining blooms shudder and contract defensively.",
  "7_health_50": "Crushed blossoms litter the forest floor; the creeper thrashes its thorny shoots in desperate spasms.",
  "8_health_25": "The main root system splits wide open, discharging a dying hiss of acrid spores.",
  "9_dead": "A withered, blackened mass of dead stems, its toxic fragrance vanishing into the damp earth."
}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Yellow%20Musk%20Creeper',
    'Plant', NULL
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
SELECT id, 'FOREST', 1 FROM monsters WHERE name = 'Yellow Musk Creeper';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 0 FROM monsters WHERE name = 'Yellow Musk Creeper';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'JUNGLE', 0 FROM monsters WHERE name = 'Yellow Musk Creeper';

-- Monster: Bugbear (CR 2, Humanoid)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Bugbear', 'B', '#8b4513', 16, 600, '1d8+3',
    1, 17, 5, 2,
    2, 10, '["H", "M", "F", "U"]', 'WALK',
    '["sneak_attack", "scent", "darkvision"]', 'images/monsters/bugbear.png', '{
  "1_distant": "A chilling silence falls over the trail, broken only by the faint, eerie snap of a twig directly behind you.",
  "2_ranger_distant": "Heavy padded footprints that vanish without a sound into the shadows suggest an ambush predator skilled in silent stalking.",
  "3_close": "A towering, feral goblinoid covered in coarse brown fur, sporting wedge-shaped ears, predatory fangs, and a spiked morningstar.",
  "4_ranger_close": "Despite its hulking bulk, it strikes from blind spots with deadly precision; keep your back to solid rock.",
  "5_health_100": "The shadowy brute steps from the brush with terrifying grace, flashing a cruel sneer as it raises its spiked weapon.",
  "6_health_75": "A solid strike cuts through its thick pelt, drawing a feral snarl as it retreats into a defensive crouch.",
  "7_health_50": "Blood drenches its matted fur, forcing the ambusher to limp while swinging in violent frustration.",
  "8_health_25": "Gasping on one knee, the wounded stalker glares with bared fangs, weapon slipping from bloody claws.",
  "9_dead": "The giant goblinoid topples heavily into the brush, silent in death as in life."
}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Bugbear',
    'Humanoid', 'goblinoid'
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
SELECT id, 'HILLS', 1 FROM monsters WHERE name = 'Bugbear';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'MOUNTAINS', 0 FROM monsters WHERE name = 'Bugbear';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 0 FROM monsters WHERE name = 'Bugbear';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 0 FROM monsters WHERE name = 'Bugbear';

-- Monster: Boggard (CR 2, Humanoid)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Boggard', 'b', '#6b8e23', 19, 600, '1d8+3',
    0, 14, 5, 2,
    2, 10, '["S", "R"]', 'WALK',
    '["terrifying_croak", "sticky_tongue", "swamp_stride"]', 'images/monsters/boggard.png', '{
  "1_distant": "A deep, chest-rattling boom vibrates through the stagnant air, sending flocking swamp birds into terrified flight.",
  "2_ranger_distant": "Piles of rotting dragonflies and ritual swamp totems formed of woven reeds warn of a savage frog-folk territory.",
  "3_close": "A squat, bulbous amphibian humanoid with slimy green skin, a gaping maw, and bulbous orange eyes, clutching a crude morningstar.",
  "4_ranger_close": "Its terrifying croak can paralyze the faint of heart; steady your resolve and strike before it inflates its vocal sacs.",
  "5_health_100": "The swamp brute expands its vast throat with a thunderous croak, raising its crude club to crush you.",
  "6_health_75": "A gash across its slimy belly spills dark ichor, breaking the rhythm of its war cries.",
  "7_health_50": "Wheezing from cracked ribs, the frog-man hops back clumsily, spitting foul swamp water and blood.",
  "8_health_25": "Its throat sac punctured and hissing air, the creature collapses onto its stomach with feeble croaks.",
  "9_dead": "The slimy humanoid lies still in the swamp water, skin rapidly drying beneath the pale sky."
}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Boggard',
    'Humanoid', 'boggard'
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
SELECT id, 'SWAMP', 1 FROM monsters WHERE name = 'Boggard';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'RIVER_LAKE', 0 FROM monsters WHERE name = 'Boggard';

-- Monster: Death Dog (CR 2, Magical Beast)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Death Dog', 'D', '#4a0e17', 22, 600, '1d6+2',
    2, 14, 4, 2,
    2, 10, '["D", "P", "U"]', 'WALK',
    '["two_headed", "rotting_disease", "trip"]', 'images/monsters/death_dog.png', '{
  "1_distant": "A dual, discordant snarling echoes across the arid rocks, followed by the dry crunch of bones.",
  "2_ranger_distant": "Rotten saliva pooled around half-eaten carrion carries a foul necrotic stench; a diseased two-headed hound is hunting nearby.",
  "3_close": "A monstrous, hairless mastiff bearing two vicious heads with weeping sores, bared yellow fangs, and eyes glowing with feverish rage.",
  "4_ranger_close": "Both heads strike independently and carry a flesh-rotting plague; evade its dual bites to avoid permanent corruption.",
  "5_health_100": "Both snarling heads snap in unison, saliva dripping on the sand as the monstrosity bounds forward.",
  "6_health_75": "One head yelps as a weapon strikes true, while the other head snarls with redoubled fury.",
  "7_health_50": "Bleeding from multiple punctures, the two-headed beast stumbles, heads snapping at each other in frantic confusion.",
  "8_health_25": "One head lies limp in the dirt while the second feebly bares its fangs in a dying wheeze.",
  "9_dead": "A grotesque two-headed corpse lies twisted upon the stones, its rotting disease silenced."
}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Death%20Dog',
    'Magical Beast', NULL
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
SELECT id, 'DESERT', 1 FROM monsters WHERE name = 'Death Dog';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'PLAINS', 0 FROM monsters WHERE name = 'Death Dog';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 0 FROM monsters WHERE name = 'Death Dog';

-- Monster: Giant Crab (CR 2, Vermin)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Giant Crab', 'C', '#8b0000', 19, 600, '1d4+2',
    1, 16, 4, 2,
    2, 10, '["C", "R", "A"]', 'WALK',
    '["grab", "constrict", "water_dependency"]', 'images/monsters/giant_crab.png', '{
  "1_distant": "A sharp, rhythmic clacking of heavy chitin plates echoes along the wet rocks, accompanied by the hiss of sea foam.",
  "2_ranger_distant": "Deep semicircular gouges in the sand and crushed mollusk shells indicate a heavily armored littoral crustacean on the hunt.",
  "3_close": "An immense armored crustacean with a barnacle-encrusted red-brown carapace and two massive, bone-crushing pincers raised high.",
  "4_ranger_close": "Its thick carapace repels glancing blows; target the softer joints beneath its eyestalks and leg hinges.",
  "5_health_100": "The armored horror clacks its immense claws menacingly, scuttling sideways with surprising speed.",
  "6_health_75": "A fracture appears along its dorsal shell, leaking clear, viscous fluid as it snaps defensively.",
  "7_health_50": "One massive pincher hangs fractured and useless, while several walking legs buckle beneath its bulk.",
  "8_health_25": "Its shell is severely cracked; bubbles froth from its mouthparts as it feebly retreats toward the surf.",
  "9_dead": "The shattered carapace lies overturned in the tide pool, legs curled tight beneath the cracked shell."
}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Giant%20Crab',
    'Vermin', 'aquatic'
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
SELECT id, 'COAST', 1 FROM monsters WHERE name = 'Giant Crab';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'RIVER_LAKE', 0 FROM monsters WHERE name = 'Giant Crab';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'AQUATIC', 0 FROM monsters WHERE name = 'Giant Crab';

-- Monster: Ettercap (CR 3, Aberration)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Ettercap', 'e', '#4b0082', 30, 800, '1d6+2',
    7, 15, 5, 3,
    3, 10, '["F", "U"]', 'WALK',
    '["poison", "web", "traps"]', 'images/monsters/ettercap.png', '{
  "1_distant": "A soft, rhythmic tapping vibrates through thick webs suspended between ancient trees, accompanied by a chittering hiss.",
  "2_ranger_distant": "Intricately spun web sheets rigged with hanging bone noisemakers reveal an intelligent, venomous spider-tender watching from the canopy.",
  "3_close": "A repulsive bipedal monstrosity with swollen purple skin, an arachnid face sporting eight glittering eyes, dripping fangs, and clawed hands.",
  "4_ranger_close": "Its fangs inject debilitating poison while its glands spray strangling webs; sever its silk lines to evade entanglement.",
  "5_health_100": "The spider-like horror chatters its fangs gleefully, leaping from a low branch while drawing a sticky sheet of silk.",
  "6_health_75": "Dark, purplish hemolymph spurts from its slashed torso as it skitters backward into the shadows.",
  "7_health_50": "Several of its eyes are blinded and its abdomen is ruptured; it flails wildly with venom-dripping mandibles.",
  "8_health_25": "Coughing black bile, the creature crawls through tangled webs on shaking limbs.",
  "9_dead": "The misshapen abomination hangs tangled in its own sticky silk, finally lifeless."
}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Ettercap',
    'Aberration', NULL
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
SELECT id, 'FOREST', 1 FROM monsters WHERE name = 'Ettercap';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 0 FROM monsters WHERE name = 'Ettercap';

-- Monster: Cockatrice (CR 3, Magical Beast)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Cockatrice', 'c', '#808000', 27, 800, '1d4-2',
    3, 15, 6, 3,
    3, 10, '["P", "H"]', 'FLY',
    '["petrification", "flight"]', 'images/monsters/cockatrice.png', '{
  "1_distant": "A shrill, metallic crowing echoes over the tall grass, followed by the dry flapping of leathery wings.",
  "2_ranger_distant": "Petrified rodents and stone lizards frozen in mid-flight warn of a deadly avian beast whose peck turns living flesh to stone.",
  "3_close": "A bizarre creature combining the head, legs, and wings of a rooster with the serpentine body, scales, and tail of a dragon.",
  "4_ranger_close": "Even a grazing scratch from its beak can petrify limbs; keep your shield raised high and do not let it peck your flesh.",
  "5_health_100": "The winged hybrid fluffs its ragged feathers, hissing like a viper as its serpentine tail lashes the earth.",
  "6_health_75": "A spray of feathers and black blood follows a strike; the creature screeches piercingly and circles overhead.",
  "7_health_50": "With a fractured wing dragging on the ground, the beast pecks erratically with desperate fury.",
  "8_health_25": "Shuddering with dying gasps, it feebly snaps its stone-hard beak from the grass.",
  "9_dead": "The chimera lies limp, its deadly petrifying touch extinguished forever."
}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Cockatrice',
    'Magical Beast', NULL
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
SELECT id, 'PLAINS', 1 FROM monsters WHERE name = 'Cockatrice';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Cockatrice';

-- Monster: Ankheg (CR 3, Magical Beast)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Ankheg', 'A', '#8b5a2b', 28, 800, '2d6+4',
    0, 16, 5, 3,
    3, 10, '["P", "F", "D"]', 'WALK',
    '["burrow", "spit_acid", "grab"]', 'images/monsters/ankheg.png', '{
  "1_distant": "A low rumble vibrates beneath your boots as earth shifts and cracks, followed by a sharp hiss of corrosive acid.",
  "2_ranger_distant": "Collapsing sinkholes bordered by sizzling, acid-scorched loam reveal a massive subterranean burrower hunting from below.",
  "3_close": "A massive, multi-legged insectoid predator with a chitinous brown carapace, twitching antennae, and mandibles dripping steaming acid.",
  "4_ranger_close": "Its mandibles can crush armor and spray concentrated acid; evade its subterranean eruption and strike its softer ventral joints.",
  "5_health_100": "The insectoid terror bursts through the soil, mandibles snapping with tremendous force as acid sizzles in its jaws.",
  "6_health_75": "Thick green ichor seeps from cracked carapace plates; the beast thrashes its spiny legs in agitation.",
  "7_health_50": "One of its main mandibles is sheared off, and several legs collapse as the creature struggles to burrow back into the dirt.",
  "8_health_25": "Spitting a weak spray of caustic bile, the wounded beast convulses on its back.",
  "9_dead": "The giant burrower lies motionless in a crater of its own making, legs curled in rigor mortis."
}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Ankheg',
    'Magical Beast', NULL
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
SELECT id, 'PLAINS', 1 FROM monsters WHERE name = 'Ankheg';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 0 FROM monsters WHERE name = 'Ankheg';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'DESERT', 0 FROM monsters WHERE name = 'Ankheg';

-- Monster: Ogre (CR 3, Humanoid)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Ogre', 'O', '#8b4513', 30, 800, '2d8+7',
    -1, 17, 7, 3,
    3, 10, '["H", "M", "F"]', 'WALK',
    '["darkvision", "low-light vision"]', 'images/monsters/ogre.png', '{
  "1_distant": "Tremendous, earth-shaking footsteps crash through the boulders ahead, accompanied by foul grunts and the stench of unwashed hides.",
  "2_ranger_distant": "Shattered tree trunks stripped of branches and large, crushed humanoid skulls point to a brutal giant brute prowling the foothills.",
  "3_close": "A hulking, ten-foot-tall brute clad in filthy stitched animal hides, brandishing a massive tree-trunk greatclub with knotted arms.",
  "4_ranger_close": "Its wide swings carry devastating crushing force but leave it off-balance; step inside its reach right after a swing.",
  "5_health_100": "The giant brute roars a deafening bellow of bloodlust, swinging its tremendous club overhead with murderous intent.",
  "6_health_75": "Blood pours from deep gashes in its thick blubber, sending the monster into a furious, howling tantrum.",
  "7_health_50": "Staggered and bleeding from multiple wounds, the brute swings with sloppy, desperate violence.",
  "8_health_25": "Dropping its heavy club, the giant falls to both knees, coughing black blood as its dim eyes glaze over.",
  "9_dead": "A colossal mountain of filthy flesh crashes to earth with a final resounding thud."
}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Ogre',
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
SELECT id, 'HILLS', 1 FROM monsters WHERE name = 'Ogre';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'MOUNTAINS', 0 FROM monsters WHERE name = 'Ogre';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 0 FROM monsters WHERE name = 'Ogre';

-- Monster: Shadow (CR 3, Undead)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Shadow', 'S', '#1c1c1c', 19, 800, '1d6',
    2, 15, 4, 3,
    3, 10, '["U", "F", "H", "T"]', 'FLY',
    '["strength_damage", "incorporeal", "undead_traits"]', 'images/monsters/shadow.png', '{
  "1_distant": "The ambient light dims unnaturally, and the temperature drops as a silhouette along the stone wall detaches itself from the surface.",
  "2_ranger_distant": "A sudden patch of intense, unnatural frost and lingering spiritual dread indicates an incorporeal shade that drains the vitality of the living.",
  "3_close": "A horrifying humanoid silhouette of pure darkness, floating without weight as two chilling white pinpricks of light gleam where eyes should be.",
  "4_ranger_close": "Physical blades pass harmlessly through its immaterial form; only magic, holy power, or enchanted weapons can harm it.",
  "5_health_100": "The dark shape reaches out with cold, wispy claws that chill the marrow of your bones.",
  "6_health_75": "The silhouette frays at the edges, its shadowy form flickering like a guttering flame.",
  "7_health_50": "Part of its torso dissipates into grey smoke as its unholy presence weakens visibly.",
  "8_health_25": "A faint, wispy wisp of darkness shivers, barely able to hold human form.",
  "9_dead": "The silhouette completely dissolves into nothingness, leaving behind only an icy breeze."
}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Shadow',
    'Undead', 'incorporeal'
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
SELECT id, 'UNDERGROUND_RUINS', 1 FROM monsters WHERE name = 'Shadow';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 0 FROM monsters WHERE name = 'Shadow';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Shadow';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'CITY', 0 FROM monsters WHERE name = 'Shadow';

-- Monster: Owlbear (CR 4, Magical Beast)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Owlbear', 'O', '#554138', 42, 1200, '1d6+4',
    1, 15, 8, 4,
    4, 10, '["F", "H"]', 'WALK',
    '["grab", "scent", "low-light vision"]', 'images/monsters/owlbear.png', '{
  "1_distant": "A piercing, unearthly screech that blends the shriek of a bird of prey with the roar of a bear tears through the canopy.",
  "2_ranger_distant": "Enormous clawed bear tracks paired with discarded owl pellets of crushed armor and bone reveal a territorial woodland terror.",
  "3_close": "A ferocious behemoth combining the thick fur and muscled physique of a grizzly with the head, feathers, and hooked beak of a giant owl.",
  "4_ranger_close": "Its massive forearms lock into an inescapable bear hug while its razor beak shreds flesh; stay agile to avoid its grapple.",
  "5_health_100": "The beast rears up on its hind legs, snapping its razor beak and bellowing a maddened war screech.",
  "6_health_75": "Blood mats its thick coat of feathers and fur, but the pain only inflames its terrifying savagery.",
  "7_health_50": "Grievously wounded, the monstrosity thrashes its heavy claws in blind fury, foam flying from its beak.",
  "8_health_25": "Collapsing onto its forelegs, the dying beast gasps through a shattered beak, still glaring with murderous hatred.",
  "9_dead": "The giant chimeric terror falls still among the ferns, its legendary roar silenced at last."
}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Owlbear',
    'Magical Beast', NULL
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
SELECT id, 'FOREST', 1 FROM monsters WHERE name = 'Owlbear';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Owlbear';

-- Monster: Minotaur (CR 4, Monstrous Humanoid)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Minotaur', 'M', '#8b0000', 45, 1200, '3d6+6',
    0, 14, 9, 4,
    4, 10, '["U", "H"]', 'WALK',
    '["powerful_charge", "natural_cunning", "darkvision"]', 'images/monsters/minotaur.png', '{
  "1_distant": "Heavy, cloven hooves strike stone with thunderous force, accompanied by deep snorts echoing through the ruined passages.",
  "2_ranger_distant": "Deep axe gouges on corridor corners and hoof prints never hesitating at labyrinth crossroads reveal the master of the maze.",
  "3_close": "A muscular giant possessing the body of a towering warrior and the head and horns of a vicious bull, wielding a colossal greataxe.",
  "4_ranger_close": "Its devastating headlong charge can impale and crush shields; sidestep its initial rush before parrying its great weapon.",
  "5_health_100": "The bull-headed giant snorts steam from flaring nostrils, pawing the earth before raising its greataxe.",
  "6_health_75": "A deep wound across its muscled chest spills hot blood, driving the beast into an enraged snort of defiance.",
  "7_health_50": "Breathing heavily through bloody nostrils, the beast swings its massive axe with reckless, ragged power.",
  "8_health_25": "Staggered and bleeding from multiple strikes, the wounded brute leans on its axe shaft, shaking its horned head.",
  "9_dead": "The lord of the labyrinth crashes onto the stone floor, its horn snapping against the rock."
}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Minotaur',
    'Monstrous Humanoid', NULL
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
SELECT id, 'UNDERGROUND_RUINS', 1 FROM monsters WHERE name = 'Minotaur';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Minotaur';

-- Monster: Yeti (CR 4, Monstrous Humanoid)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Yeti', 'Y', '#f0f8ff', 45, 1200, '1d6+4',
    1, 16, 7, 4,
    4, 10, '["M", "H"]', 'WALK',
    '["cold", "frightful_gaze", "climb"]', 'images/monsters/yeti.png', '{
  "1_distant": "A bloodcurdling roar howls through the blinding blizzard, accompanied by the thud of massive footsteps in deep snow.",
  "2_ranger_distant": "Enormous ape-like tracks dusted with frost and frozen chunks of prey indicate a terrifying white-furred summit hunter.",
  "3_close": "A hulking, shaggy biped covered in dense, snow-white fur, with blue-tinged skin, cruel claws, and piercing eyes radiating icy malice.",
  "4_ranger_close": "Its hypnotic stare induces paralyzing terror, and its body radiates bitter frost; warm blades will bypass its icy resilience.",
  "5_health_100": "The mountain devil pounds its chest with furry fists, unleashing a freezing roar that echoes across the crags.",
  "6_health_75": "Crimson blood stains its pristine white fur, breaking its icy composure into a flurry of frenzied claw strikes.",
  "7_health_50": "Panting icy vapor through broken fangs, the beast staggers as frost magic gutters in its veins.",
  "8_health_25": "Collapsing into a snowdrift, the wounded giant weakly swings its frostbitten claws with dying rage.",
  "9_dead": "The snow beast lies still upon the icy ridge, its pale fur slowly freezing to the glacier."
}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Yeti',
    'Monstrous Humanoid', 'cold'
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
SELECT id, 'MOUNTAINS', 1 FROM monsters WHERE name = 'Yeti';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Yeti';

-- Monster: Gargoyle (CR 4, Monstrous Humanoid)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Gargoyle', 'g', '#708090', 42, 1200, '1d6+2',
    2, 16, 7, 4,
    4, 10, '["T", "U", "H", "M", "C"]', 'FLY',
    '["damage_reduction_magic", "freeze", "flight"]', 'images/monsters/gargoyle.png', '{
  "1_distant": "A dry, rasping scrape of living stone echoes overhead, followed by the heavy downdraft of leathery wings.",
  "2_ranger_distant": "Stone carvings along the ledge exhibit subtle shifts in posture between glances; a winged stone stalker is observing you.",
  "3_close": "A winged, horned predator carved from dark, weathered granite, with razor claws, a demonic visage, and a serpentine tail.",
  "4_ranger_close": "Its stone skin shrugs off mundane steel with supernatural hardness; only enchanted weapons can reliably crack its petrified hide.",
  "5_health_100": "The stony gargoyle leaps from its high perch, spreading leathery wings and shrieking a harsh, grinding cry.",
  "6_health_75": "Chipped stone and grey dust spray from a solid impact as cracks spread across its rocky chest.",
  "7_health_50": "One stone wing is cracked and dragging; the creature snaps its granite fangs in frustrated fury.",
  "8_health_25": "Its stony visage is half-shattered, dropping gravel and stone fragments with every labored movement.",
  "9_dead": "The demonic statue collapses into an inert pile of shattered stone rubble."
}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Gargoyle',
    'Monstrous Humanoid', 'earth'
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
SELECT id, 'CITY', 1 FROM monsters WHERE name = 'Gargoyle';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 0 FROM monsters WHERE name = 'Gargoyle';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Gargoyle';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'MOUNTAINS', 0 FROM monsters WHERE name = 'Gargoyle';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'COAST', 0 FROM monsters WHERE name = 'Gargoyle';

-- Monster: Basilisk (CR 5, Magical Beast)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Basilisk', 'B', '#556b2f', 52, 1600, '1d8+4',
    -1, 17, 8, 5,
    5, 8, '["H", "M", "U", "D"]', 'WALK',
    '["petrifying_gaze", "darkvision", "low-light vision"]', 'images/monsters/basilisk.png', '{
  "1_distant": "A low, dry hiss scrapes across the rocky scree, surrounded by an eerie silence devoid of all wildlife.",
  "2_ranger_distant": "Lifelike statues of terrified adventurers scattered among the boulders warn of a gaze that turns warm flesh instantly to stone.",
  "3_close": "A sluggish, eight-legged reptilian beast with moss-green scales, bony spines along its back, and pale eyes glowing with petrifying sorcery.",
  "4_ranger_close": "Meeting its glowing gaze will turn you to stone; avert your eyes and strike by reading its heavy scuttling movements.",
  "5_health_100": "The eight-legged lizard fixes you with its pale, unblinking eyes, hissing as a stone-hardening chill fills the air.",
  "6_health_75": "A strike cleaves through thick scales, causing the reptile to hiss sharply and swing its heavy tail.",
  "7_health_50": "Several legs are damaged; the beast drags its scaly body, desperately attempting to lock eyes.",
  "8_health_25": "Bleeding greenish blood, the creature wheezes, its petrifying eyes growing dim and cloudy.",
  "9_dead": "The eight-legged horror slumps lifeless on the rocks, its deadly gaze extinguished forever."
}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Basilisk',
    'Magical Beast', NULL
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
SELECT id, 'HILLS', 1 FROM monsters WHERE name = 'Basilisk';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'MOUNTAINS', 0 FROM monsters WHERE name = 'Basilisk';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 0 FROM monsters WHERE name = 'Basilisk';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'DESERT', 0 FROM monsters WHERE name = 'Basilisk';

-- Monster: Mummy (CR 5, Undead)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Mummy', 'M', '#d2b48c', 60, 1600, '1d8+10',
    0, 20, 14, 5,
    5, 8, '["D", "U"]', 'WALK',
    '["despair", "mummy_rot", "damage_reduction"]', 'images/monsters/mummy.png', '{
  "1_distant": "The dry, bitter scent of myrrh and natron salt fills the air, accompanied by the whisper of linen bandages scraping stone.",
  "2_ranger_distant": "Hieroglyphic tomb curses etched into broken stone and fine embalming dust on the floor indicate an ancient preserved tomb guardian.",
  "3_close": "A withered corpse wrapped in yellowed, resin-hardened linen bandages, hollow eye sockets blazing with malevolent scarlet flame.",
  "4_ranger_close": "Its gaze causes paralyzing despair and its rotting touch inflicts an incurable curse; cleanse your weapons with fire.",
  "5_health_100": "The embalmed horror raises dust-caked fists, a wave of supernatural despair radiating from its desiccated form.",
  "6_health_75": "Bandages unravel and desiccated flesh tears under your strikes, revealing ancient blackened bones beneath.",
  "7_health_50": "A heavy blow breaks its withered shoulder, yet the cursed corpse relentlessly marches onward.",
  "8_health_25": "Its brittle spine is cracked and smoldering; it swings one remaining fist with terrifying, cursed force.",
  "9_dead": "The ancient curse breaks, and the mummy collapses into a pile of harmless, smoldering bandages and dust."
}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Mummy',
    'Undead', NULL
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
SELECT id, 'DESERT', 1 FROM monsters WHERE name = 'Mummy';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 0 FROM monsters WHERE name = 'Mummy';

-- Monster: Ochre Jelly (CR 5, Ooze)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Ochre Jelly', 'J', '#cc7722', 63, 1600, '2d4+3',
    -5, 9, 5, 5,
    5, 8, '["U", "S"]', 'WALK',
    '["split", "acid", "constrict", "ooze_traits"]', 'images/monsters/ochre_jelly.png', '{
  "1_distant": "A wet, bubbling slosh echoes from the cavern floor, accompanied by the acrid, stinging stench of strong acid.",
  "2_ranger_distant": "Cleanly dissolved stone floors stripped of moss and skeletons with marrow hollowed out reveal a massive acidic ooze on the prowl.",
  "3_close": "A huge, pulsating heap of translucent yellowish-brown protoplasm that ripples and flows, extruding acidic pseudopods.",
  "4_ranger_close": "Slashing blades and lightning will split it into two identical living horrors; crush it with bludgeoning attacks or fire.",
  "5_health_100": "The gelatinous mass surges forward, sending thick, corrosive pseudopods lashing toward your boots.",
  "6_health_75": "Chunks of acidic slime splatter against the walls as the amorphous bulk wobbles and reforms.",
  "7_health_50": "The mass loses coherence, pooling across the stone as acidic bubbles violently burst on its surface.",
  "8_health_25": "Its volume greatly reduced, the remnant slime thrashes weakly in a puddle of smoking digestive fluid.",
  "9_dead": "The acidic mass dissolves into a harmless, inert pool of pungent brownish liquid."
}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Ochre%20Jelly',
    'Ooze', NULL
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
SELECT id, 'UNDERGROUND_RUINS', 1 FROM monsters WHERE name = 'Ochre Jelly';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 0 FROM monsters WHERE name = 'Ochre Jelly';

-- Monster: Winter Wolf (CR 5, Magical Beast)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype
) VALUES (
    'Winter Wolf', 'W', '#e0ffff', 57, 1600, '1d8+6',
    5, 17, 9, 5,
    5, 8, '["M", "F", "P", "H"]', 'WALK',
    '["breath_weapon_cold", "trip", "scent", "cold_subtype"]', 'images/monsters/winter_wolf.png', '{
  "1_distant": "A mournful, bone-chilling howl freezes the air, accompanied by a sudden blizzard wind smelling of frost and fresh blood.",
  "2_ranger_distant": "Paws as large as shields pressed into icy rime and trees frosted over with supernatural cold reveal an intelligent, monstrous predator of the wastes.",
  "3_close": "A magnificent, horse-sized wolf with snow-white fur, ice-blue eyes gleaming with cruel intellect, and rime-coated fangs.",
  "4_ranger_close": "It exhales a cone of devastating supernatural frost before dragging prey down; close the distance swiftly with fire.",
  "5_health_100": "The giant wolf bares frosted fangs, a blast of sub-zero mist billowing from its throat as it stalks forward.",
  "6_health_75": "Dark blood freezes instantly on its white coat; the beast growls in guttural Common with malicious defiance.",
  "7_health_50": "Staggered by fire and steel, the great beast limps while snapping its icy jaws in wounded fury.",
  "8_health_25": "Its frost breath gutters into weak vapor as the dying wolf shudders in the snow.",
  "9_dead": "The colossal white wolf lies still upon the snow, its breath of winter silenced."
}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Winter%20Wolf',
    'Magical Beast', 'cold'
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
SELECT id, 'MOUNTAINS', 1 FROM monsters WHERE name = 'Winter Wolf';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 0 FROM monsters WHERE name = 'Winter Wolf';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'PLAINS', 0 FROM monsters WHERE name = 'Winter Wolf';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Winter Wolf';

