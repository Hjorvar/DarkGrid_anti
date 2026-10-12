-- 006_seed_pathfinder_30_additional.sql: 30 Additional Authentic Pathfinder 1e monsters
-- Expanding Darkgrid monster catalog from 38 to 68 total monsters.
-- Sourced from Archives of Nethys (aonprd.com).

-- Monster: Stirge (CR 0.5, Magical Beast)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Stirge', 's', '#8b0000', 5, 200, '1d4-2',
    4, 16, 7, 0.5,
    1, 12, '["S", "F"]', 'FLY',
    '["blood_drain", "attached"]', 'images/monsters/stirge.png', '{"1_distant":"A high-pitched, droning buzz vibrates through the stagnant air as a cluster of needle-beaked shapes dart between shadows.","2_ranger_distant":"Punctured, bloodless animal carcasses hang drained in the reeds; voracious winged parasites are seeking fresh warm blood.","3_close":"A grotesque, winged fiend with the bloated abdomen of a mosquito, leathery bat wings, and a razor-sharp four-inch proboscis.","4_ranger_close":"Its flight is erratic but blindingly swift; crush it with a direct strike before its barbed needle sinks into your flesh.","5_health_100":"The winged horror hovers with rapid, frantic wingbeats, aligning its vicious needle-proboscis with your throat.","6_health_75":"Shattered wing membranes flutter erratically as the creature emits shrill, furious buzzing.","7_health_50":"Punctured and leaking acrid yellow fluid, the parasite struggles to maintain altitude but dives with bloodlust.","8_health_25":"With its abdomen ruptured and legs twitching, the dying parasite makes a desperate, blind lunging buzz.","9_dead":"The needle-nosed horror lies crushed in the mud, its swollen sac deflated and ruined."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Stirge',
    'Magical Beast', NULL, 'None'
)
ON CONFLICT(name) DO UPDATE SET
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    movement_type = excluded.movement_type,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 1 FROM monsters WHERE name = 'Stirge';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 0 FROM monsters WHERE name = 'Stirge';

-- Monster: Dire Rat (CR 0.33, Animal)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Dire Rat', 'r', '#5c4033', 5, 135, '1d4',
    3, 14, 1, 0.33,
    1, 15, '["U", "T", "S"]', 'WALK',
    '["disease", "low_light_vision", "scent"]', 'images/monsters/dire_rat.png', '{"1_distant":"Wet scraping claws and the pungent, repulsive stench of rotting waste emanate from a nearby culvert.","2_ranger_distant":"Gnawed marrow bones and wide claw marks indicate an overgrown filth-dweller scavenging aggressively in the gloom.","3_close":"A three-foot rodent bristling with greasy coarse fur, covered in weeping scabs, bearing elongated yellow incisors that drip foul saliva.","4_ranger_close":"Its jaws carry grave sepsis; strike cleanly and keep distance to prevent its filthy teeth from grazing bare skin.","5_health_100":"The massive rodent bares curved incisors, chittering aggressively with beady red eyes fixed upon you.","6_health_75":"A deep gash parts its diseased pelt, evoking a shrill defensive squeak as it circles closer to the ground.","7_health_50":"Trailing blood over the cobblestones, the rodent snarls through broken teeth, backed into a corner.","8_health_25":"Panting and dragging its hind legs, the feral vermin snaps blindly in a panic.","9_dead":"The overgrown rodent lies still in a pool of dark blood, its rancid stench beginning to fade."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Dire%20Rat',
    'Animal', NULL, 'None'
)
ON CONFLICT(name) DO UPDATE SET
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    movement_type = excluded.movement_type,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 1 FROM monsters WHERE name = 'Dire Rat';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'CITY', 0 FROM monsters WHERE name = 'Dire Rat';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 0 FROM monsters WHERE name = 'Dire Rat';

-- Monster: Viper (CR 0.5, Animal)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Viper', 'v', '#2e8b57', 6, 200, '1d2-2',
    3, 14, 5, 0.5,
    1, 12, '["F", "J", "S"]', 'WALK',
    '["poison", "scent", "low_light_vision"]', 'images/monsters/viper.png', '{"1_distant":"A dry, continuous rustling slithers through dead leaves accompanied by a warning hiss barely louder than the wind.","2_ranger_distant":"An undulating trail through the detritus reveals a venomous serpent lying coiled in wait beside the path.","3_close":"A thick-bodied serpent with iridescent green-black scales and a wide triangular head, testing the air with a flickering black tongue.","4_ranger_close":"It coils tightly to strike up to half its length; step just out of range before cleaving its neck.","5_health_100":"The serpent coils like a steel spring, hood flaring slightly as venom glistens upon needle-like fangs.","6_health_75":"A cleave shears along its scales; the snake thrashes violently, recoiling into a tighter striking posture.","7_health_50":"Severely wounded and bleeding onto the loam, its strikes become wild and erratic.","8_health_25":"Barely able to raise its head from the dirt, the dying reptile hisses faintly with clouded eyes.","9_dead":"The serpent stretches out limp and lifeless across the leaves, severed cleanly."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Viper',
    'Animal', NULL, 'None'
)
ON CONFLICT(name) DO UPDATE SET
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    movement_type = excluded.movement_type,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 1 FROM monsters WHERE name = 'Viper';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'JUNGLE', 0 FROM monsters WHERE name = 'Viper';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 0 FROM monsters WHERE name = 'Viper';

-- Monster: Giant Centipede (CR 0.5, Vermin)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Giant Centipede', 'c', '#d2691e', 4, 200, '1d6-1',
    2, 14, 2, 0.5,
    1, 14, '["U", "F", "H"]', 'CLIMB',
    '["poison", "darkvision"]', 'images/monsters/giant_centipede.png', '{"1_distant":"A rhythmic, unsettling clatter of scores of chitinous legs tapping across cracked masonry echoes from the darkness.","2_ranger_distant":"Acidic trails and shed segments of brown carapace mark the hunting path of an overgrown subterranean crawler.","3_close":"A six-foot-long segmented terror with rust-colored chitin plates and flexing venomous pincers framing a ravenous maw.","4_ranger_close":"Its belly plates are thinner than its armored dorsal ridge; wait for it to rear up before delivering a fatal blow.","5_health_100":"The segmented horror undulates with eerie speed, snapping hollow mandibles coated in paralytic venom.","6_health_75":"A row of shattered legs drops to the stone, causing the beast to wobble and writhe in fury.","7_health_50":"Its carapace is cracked wide open, oozing green hemolymph as it thrashes blindly.","8_health_25":"Twitching feebly on its back, the crippled crawler snaps its jaws without strength.","9_dead":"The massive segmented carcass curls into a brittle spiral, completely motionless."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Giant%20Centipede',
    'Vermin', NULL, 'None'
)
ON CONFLICT(name) DO UPDATE SET
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    movement_type = excluded.movement_type,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 1 FROM monsters WHERE name = 'Giant Centipede';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 0 FROM monsters WHERE name = 'Giant Centipede';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Giant Centipede';

-- Monster: Iron Cobra (CR 2, Construct)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Iron Cobra', 'C', '#708090', 15, 600, '1d6+1',
    3, 17, 3, 2,
    2, 8, '["U"]', 'WALK',
    '["poison", "construct_traits", "damage_reduction"]', 'images/monsters/iron_cobra.png', '{"1_distant":"A cold, metallic scraping rhythmically glides over stone; no breathing or heartbeat accompanies the metallic sliding.","2_ranger_distant":"Polished scratches upon ancient flagstones indicate an unliving clockwork construct patrolling on eternal guard.","3_close":"An articulated automaton crafted from dark interlocking iron plates, shaped like an iron snake with glowing ruby optical lenses.","4_ranger_close":"Constructed without flesh or organs; blunt concussive force or heavy blade strikes to its joints will disable its mechanism.","5_health_100":"The iron serpent rears up smoothly on oiled gears, cold steel fangs poised to inject alchemical toxin.","6_health_75":"Sparks shower from dented iron segments as internal gears grind and screech under the impact.","7_health_50":"Fractured steel plating exposes humming alchemical conduits; its mechanical strikes lose precision.","8_health_25":"Its optical gems flicker and die as ruptured clockwork springs burst from its dented frame.","9_dead":"The metal construct collapses into a tangle of inert gears, springs, and dented iron bands."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Iron%20Cobra',
    'Construct', NULL, 'None'
)
ON CONFLICT(name) DO UPDATE SET
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    movement_type = excluded.movement_type,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 1 FROM monsters WHERE name = 'Iron Cobra';

-- Monster: Skeletal Champion (CR 2, Undead)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Skeletal Champion', 'S', '#e6e6fa', 17, 600, '1d8+3',
    5, 21, 7, 2,
    2, 8, '["U", "M"]', 'WALK',
    '["undead_traits", "weapon_mastery", "damage_reduction"]', 'images/monsters/skeletal_champion.png', '{"1_distant":"The disciplined, heavy clank of blackened mail and the measured tread of an experienced warrior echo from the catacombs.","2_ranger_distant":"Unlike mindless animated bones, this shadow marches with the deliberate posture of a seasoned battlefield commander.","3_close":"A grim undead warrior wrapped in rusted breastplate, clutching a notched longsword and steel shield with hateful intelligence in its hollow sockets.","4_ranger_close":"It retains martial reflexes from life and parries with skill; blunt weapon impact will shatter its ancient marrow.","5_health_100":"The skeletal warrior assumes a flawless high guard, eyes burning with twin points of malevolent crimson sorcery.","6_health_75":"A blow cracks its breastplate, but the undead knight retaliates instantly with cold, calculating precision.","7_health_50":"Splintered ribs and shattered shoulder bones shake, yet its blade continues to thrust with tireless hatred.","8_health_25":"Shield arm severed and skull fractured, the ancient warrior staggers but refuses to relent.","9_dead":"The veteran skeleton shatters into inert bleached bone and rusted scrap, the crimson soul-fire extinguishing."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Skeletal%20Champion',
    'Undead', NULL, 'Standard'
)
ON CONFLICT(name) DO UPDATE SET
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    movement_type = excluded.movement_type,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 1 FROM monsters WHERE name = 'Skeletal Champion';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'MOUNTAINS', 0 FROM monsters WHERE name = 'Skeletal Champion';

-- Monster: Blink Dog (CR 2, Magical Beast)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Blink Dog', 'd', '#d4af37', 22, 600, '1d6+1',
    7, 14, 4, 2,
    2, 9, '["P", "F"]', 'WALK',
    '["blink", "teleport", "scent"]', 'images/monsters/blink_dog.png', '{"1_distant":"Sudden sharp barking sounds echo across the grass, popping in and out of earshot from impossible angles in an instant.","2_ranger_distant":"Distorted patches of flattened grass appear without connected tracks; a spatial phase predator is hunting nearby.","3_close":"A sleek, intelligent hound with short golden-brown fur and large pointed ears, shifting erratically in and out of the material plane.","4_ranger_close":"It vanishes and reappears behind targets before striking; prepare to pivot immediately as its spatial displacement cracks.","5_health_100":"The supernatural hound stands at the ready, crackling with subtle blue dimensional static along its spine.","6_health_75":"Blood marks its flank as it flickers out of sight, reappearing a few paces away with a sharp defensive yelp.","7_health_50":"Its spatial jumping grows strained and laggy; wounds bleed freely onto the trampled grass.","8_health_25":"Unable to sustain its phasing magic, the wounded hound limps heavily with flattened ears.","9_dead":"The golden hound lies motionless upon the sod, the faint dimensional static humming to silence."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Blink%20Dog',
    'Magical Beast', NULL, 'None'
)
ON CONFLICT(name) DO UPDATE SET
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    movement_type = excluded.movement_type,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'PLAINS', 1 FROM monsters WHERE name = 'Blink Dog';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 0 FROM monsters WHERE name = 'Blink Dog';

-- Monster: Duergar (CR 0.33, Humanoid)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Duergar', 'd', '#4a5568', 6, 135, '1d8+1',
    -1, 18, 3, 0.33,
    1, 15, '["U", "M"]', 'WALK',
    '["enlarge_person", "invisibility", "darkvision"]', 'images/monsters/duergar.png', '{"1_distant":"A low, guttural curse in dwarven cadence reverberates from the subterranean stone, followed by the clinking of chain links.","2_ranger_distant":"Square-toed heavy bootprints and ash residue reveal a gray-skinned subterranean slaver scouting ahead.","3_close":"A grim, stocky gray-skinned dwarf with stark white hair and callous eyes, gripping a steel warhammer and tower shield.","4_ranger_close":"Deep subterranean dwarves are resistant to magic and poison; rely on superior reach and tactical footwork.","5_health_100":"The grim gray dwarf stands immovable as granite, muttering curses as his knuckles whiten on his hammer shaft.","6_health_75":"A blow dents his iron pauldrons; he spits dark blood and readies a punishing counterswing.","7_health_50":"Grievously wounded across his chest, the stout warrior groans with stubborn defiance, refusing to surrender.","8_health_25":"Falling to one knee, the gray dwarf glares with unbridled malice, weapon trembling in numb hands.","9_dead":"The stout gray-skinned raider falls heavily against the bedrock, stone hammer slipping from limp fingers."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Duergar',
    'Humanoid', 'duergar', 'NPC Gear'
)
ON CONFLICT(name) DO UPDATE SET
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    movement_type = excluded.movement_type,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 1 FROM monsters WHERE name = 'Duergar';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'MOUNTAINS', 0 FROM monsters WHERE name = 'Duergar';

-- Monster: Drow (CR 0.33, Humanoid)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Drow', 'e', '#6b46c1', 5, 135, '1d6',
    2, 15, 2, 0.33,
    1, 15, '["U"]', 'WALK',
    '["spell_resistance", "poison", "darkvision"]', 'images/monsters/drow.png', '{"1_distant":"A whisper of silk moving against stone and the faint aroma of nightshade drift softly through the cavern corridor.","2_ranger_distant":"Poisoned crossbow bolts resting in a hidden groove betray an ambush set by subterranean elven raiders.","3_close":"A slender elven scout with obsidian-black skin, snow-white hair, and pale lilac eyes, leveling a poisoned hand crossbow and rapier.","4_ranger_close":"They possess innate spell resistance and poison-tipped steel; parry swiftly and close distance inside their weapon reach.","5_health_100":"The dark elf smiles with haughty cruelty, rapier blade poised like a striking viper.","6_health_75":"A crimson line cuts across dark leather; the dark elf''s smirk vanishes, replaced by cold calculating focus.","7_health_50":"Bleeding and breathing hard, the subterranean elf retreats gracefully, searching for shadows to slip into.","8_health_25":"Staggering against the wall with rapier lowered, the dying scout glares with aristocratic contempt.","9_dead":"The obsidian-skinned elf collapses gracefully onto the stone, white hair stained with dark blood."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Drow',
    'Humanoid', 'drow', 'NPC Gear'
)
ON CONFLICT(name) DO UPDATE SET
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    movement_type = excluded.movement_type,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 1 FROM monsters WHERE name = 'Drow';

-- Monster: Orc (CR 0.33, Humanoid)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Orc', 'o', '#276749', 6, 135, '2d4+4',
    0, 13, 5, 0.33,
    1, 15, '["H", "M", "P"]', 'WALK',
    '["ferocity", "darkvision", "weapon_familiarity"]', 'images/monsters/orc.png', '{"1_distant":"Guttural war-shouts and the thunder of iron-shod boots over rocky soil echo from just beyond the ridge.","2_ranger_distant":"Crushed brush and heavy cleaver chops into tree bark show brutal savage raiders advancing in numbers.","3_close":"A hulking, gray-green brute with protruding boar-like tusks, piggish red eyes, and a massive jagged falchion.","4_ranger_close":"They fight with feral ferocity even after sustaining mortal wounds; finish the strike cleanly without lowering guard.","5_health_100":"The brutal marauder roars an ear-splitting battle cry, raising his heavy jagged blade with both hands.","6_health_75":"A deep cut opens his torso, yet blood only fans his berserk frenzy as he swings harder.","7_health_50":"Gravely wounded and frothing at the mouth, his feral rage keeps him charging through mortal agony.","8_health_25":"Coughing dark blood through broken tusks, the savage fighter stumbles forward on sheer spite.","9_dead":"The heavy brute crashes facedown into the dirt, his brutal weapon clattering over the stones."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Orc',
    'Humanoid', 'orc', 'NPC Gear'
)
ON CONFLICT(name) DO UPDATE SET
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    movement_type = excluded.movement_type,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 1 FROM monsters WHERE name = 'Orc';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'MOUNTAINS', 0 FROM monsters WHERE name = 'Orc';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'PLAINS', 0 FROM monsters WHERE name = 'Orc';

-- Monster: Wight (CR 3, Undead)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Wight', 'W', '#4a5568', 26, 800, '1d4+1',
    1, 15, 4, 3,
    3, 7, '["U", "S"]', 'WALK',
    '["energy_drain", "create_spawn", "undead_traits"]', 'images/monsters/wight.png', '{"1_distant":"A deathly frost chills the surrounding air, accompanied by the desiccated whisper of ancient burial shrouds dragging across stone.","2_ranger_distant":"Withered vegetation and a lingering tomb-scent point to a barrow-spawn that drains vitality from the living.","3_close":"A mummified corpse with taut leathery skin stretched over withered sinew, glowing with malevolent hateful lights in sunken eye sockets.","4_ranger_close":"Its touch leeches the soul itself; avoid direct contact with its clawed hands and strike with sacred force.","5_health_100":"The barrow-dweller hisses with unholy hunger, reaching forward with long, blackened necrotic talons.","6_health_75":"A weapon blow fractures its dried ribs, releasing a puff of ancient tomb dust and foul vapors.","7_health_50":"Its leathery flesh hangs in tatters, yet the unliving abomination lunges forward undeterred.","8_health_25":"With its limbs cracked and eye-fires dimming, the cursed creature claws frantically in desperation.","9_dead":"The necrotic soul collapses into dust and withered husk, its dark curse returning to the earth."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Wight',
    'Undead', NULL, 'Incidental'
)
ON CONFLICT(name) DO UPDATE SET
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    movement_type = excluded.movement_type,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 1 FROM monsters WHERE name = 'Wight';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 0 FROM monsters WHERE name = 'Wight';

-- Monster: Harpy (CR 4, Monstrous Humanoid)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Harpy', 'H', '#c53030', 38, 1200, '1d6+1',
    2, 16, 8, 4,
    4, 6, '["M", "C", "H"]', 'FLY',
    '["captivating_song", "flight"]', 'images/monsters/harpy.png', '{"1_distant":"An eerie, haunting melody wafts through the mountain crags, seductive and unnerving against the howling wind.","2_ranger_distant":"Bleached humanoid bones scattered beneath high rocky perches reveal the nest of a winged mountain predator.","3_close":"A hideous creature with the torso and face of a feral crone, the filthy feathered wings of a vulture, and deadly curved talons.","4_ranger_close":"Its voice enchants unwary travelers; steel your resolve against its call and bring it down while it circles airborne.","5_health_100":"The winged horror shrieks a discordant note, banking sharply overhead with talons flexed for an aerial rake.","6_health_75":"Arrow wounds and cut feathers scatter in the breeze; the crone screeches in pain and climbs higher.","7_health_50":"Bleeding from a sheared wing, its flight wobbles noticeably as it attempts a desperate diving claw swipe.","8_health_25":"Grounded and coughing blood, the repulsive bird-woman snaps its beak and talons wildly from the rocks.","9_dead":"The crone lies broken upon the crags, matted feathers soaked in black blood."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Harpy',
    'Monstrous Humanoid', NULL, 'Standard'
)
ON CONFLICT(name) DO UPDATE SET
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    movement_type = excluded.movement_type,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'MOUNTAINS', 1 FROM monsters WHERE name = 'Harpy';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'COAST', 0 FROM monsters WHERE name = 'Harpy';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Harpy';

-- Monster: Doppelganger (CR 3, Monstrous Humanoid)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Doppelganger', 'D', '#a0aec0', 26, 800, '1d8+1',
    3, 16, 6, 3,
    3, 7, '["U", "T"]', 'WALK',
    '["change_shape", "detect_thoughts", "mimicry"]', 'images/monsters/doppelganger.png', '{"1_distant":"A sudden footstep falters ahead; a lone silhouette shifts unnaturally against the dim masonry, blurring at the edges.","2_ranger_distant":"Tracks on the flagstones abruptly shift gait, stride length, and weight distribution; a shapeshifter is watching.","3_close":"A hairless, gray-skinned humanoid with melting, featureless facial contours and yellow cat-like eyes, shifting between forms.","4_ranger_close":"Its rubbery hide absorbs blows easily, but steady, relentless assault disrupts its concentration and form.","5_health_100":"The shapechanger assumes an aggressive stance, its gray fists hardening into dense, club-like bone.","6_health_75":"A wound opens gray fluid beneath its flesh, momentarily revealing chaotic shifting tissue.","7_health_50":"Pushed to its limits, its features melt frantically into grimaces of agony as it reels backward.","8_health_25":"Collapsing against the stone, its disguise shatters completely into a formless gray puddle of tissue.","9_dead":"The creature lies dead in its true form, an unblemished gray corpse without identity."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Doppelganger',
    'Monstrous Humanoid', 'shapechanger', 'Double'
)
ON CONFLICT(name) DO UPDATE SET
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    movement_type = excluded.movement_type,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 1 FROM monsters WHERE name = 'Doppelganger';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'CITY', 0 FROM monsters WHERE name = 'Doppelganger';

-- Monster: Griffon (CR 4, Magical Beast)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Griffon', 'G', '#b7791f', 42, 1200, '1d6+3',
    2, 17, 8, 4,
    4, 6, '["H", "M"]', 'FLY',
    '["pounce", "scent", "flight"]', 'images/monsters/griffon.png', '{"1_distant":"A massive shadow sweeps across the rocky hilltops as a piercing, raptor-like screech echoes from above.","2_ranger_distant":"Large four-toed talon marks beside lion paw prints on high overlooks reveal a noble apex aerial predator.","3_close":"A majestic beast combining the forequarters, wings, and head of a giant eagle with the hindquarters and tawny tail of a lion.","4_ranger_close":"It uses aerial momentum to pounce and tear with multiple claws; ground it with missile fire before engaging up close.","5_health_100":"The winged predator screeches with royal ferocity, snapping its razor beak and spreading eight-foot wings.","6_health_75":"Golden feathers and lion fur fly as a solid blow lands; the beast thrashes its tail in mounting fury.","7_health_50":"Bleeding from torn flanks, the great chimera roars hoarsely and flaps its wings to keep distance.","8_health_25":"Its regal posture broken, the dying beast pants heavily on trembling foreclaws, beak dripping blood.","9_dead":"The magnificent beast crashes onto the turf, regal plumage stained crimson in final defeat."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Griffon',
    'Magical Beast', NULL, 'Incidental'
)
ON CONFLICT(name) DO UPDATE SET
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    movement_type = excluded.movement_type,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 1 FROM monsters WHERE name = 'Griffon';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'MOUNTAINS', 0 FROM monsters WHERE name = 'Griffon';

-- Monster: Giant Scorpion (CR 3, Vermin)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Giant Scorpion', 's', '#744210', 37, 800, '1d6+3',
    0, 16, 6, 3,
    3, 7, '["D", "P", "U"]', 'WALK',
    '["constrict", "grab", "poison"]', 'images/monsters/giant_scorpion.png', '{"1_distant":"The dry scrape of heavy claws against stone and the rhythmic tapping of armored chitin break the silence.","2_ranger_distant":"Deep twin trenches in the sand where heavy pincers dragged prey indicate an armored arachnid lurks nearby.","3_close":"A nine-foot armored monstrosity covered in dull black chitin, wielding two crushing pincers and an arched venomous stinger.","4_ranger_close":"Do not allow its pincers to close; sever its tail joint to neutralize its lethal venom.","5_health_100":"The armored arachnid raises twin crushing claws, curved tail arched high with venom beading upon the stinger.","6_health_75":"A cleave chips its dense carapace, causing the beast to snap its massive pincers in violent reflex.","7_health_50":"Thick yellow ichor leaks from fractured shell plates as its strikes grow sluggish.","8_health_25":"With its stinger trailing limp in the dirt, the battered arachnid twitches frantically on failing legs.","9_dead":"The massive scorpion collapses onto the sand, heavy claws curling inward in death."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Giant%20Scorpion',
    'Vermin', NULL, 'None'
)
ON CONFLICT(name) DO UPDATE SET
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    movement_type = excluded.movement_type,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'DESERT', 1 FROM monsters WHERE name = 'Giant Scorpion';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'PLAINS', 0 FROM monsters WHERE name = 'Giant Scorpion';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 0 FROM monsters WHERE name = 'Giant Scorpion';

-- Monster: Cloaker (CR 5, Aberration)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Cloaker', 'C', '#1a202c', 51, 1600, '1d6+5',
    8, 19, 8, 5,
    5, 5, '["U"]', 'FLY',
    '["infrasound", "engulf", "shadow_shift"]', 'images/monsters/cloaker.png', '{"1_distant":"A low, nauseating drone vibrates the marrow of your bones as shadows detach softly from the subterranean vault ceiling.","2_ranger_distant":"A dark drape hanging motionless against the ceiling exhibits unnatural muscle tremors; an engulfing aberration awaits.","3_close":"A bizarre flying manta-like aberration resembling a tattered black cloak, lined with needle-teeth, clawed clasps, and a whip-tail.","4_ranger_close":"Its sonic moan disorients the senses; keep moving and strike at its central nerve cluster before it engulfs you.","5_health_100":"The shadowy cloak flaps silently through the darkness, unfurling rows of jagged ivory teeth.","6_health_75":"Torn leathery hide flaps erratically as the creature emits a disorienting, high-pitched screech.","7_health_50":"Severely slashed across its underside, dark alien bile spills as its tail lashes with desperation.","8_health_25":"Grounded and spasming, the aberrant ray flaps its tattered wings in a pathetic attempt to lift off.","9_dead":"The dark leathery membrane lies spread flat and inert across the stone, dead as a discarded burial shroud."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Cloaker',
    'Aberration', NULL, 'Standard'
)
ON CONFLICT(name) DO UPDATE SET
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    movement_type = excluded.movement_type,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 1 FROM monsters WHERE name = 'Cloaker';

-- Monster: Phase Spider (CR 5, Magical Beast)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Phase Spider', 'S', '#4c51bf', 51, 1600, '2d6+7',
    7, 17, 10, 5,
    5, 5, '["U", "X"]', 'CLIMB',
    '["ethereal_jaunt", "poison", "climb"]', 'images/monsters/phase_spider.png', '{"1_distant":"Faint blue shimmering light dances in empty air, accompanied by the ethereal rustle of spectral spider silk.","2_ranger_distant":"Ghostly webs that fade in and out of the material plane indicate an ethereal arachnid stalking from between dimensions.","3_close":"An eight-foot spider with a grotesque human-like face, pale blue-white carapace, and fangs dripping virulent spatial poison.","4_ranger_close":"It steps into the ethereal plane between lunges; hold your attack until it materializes to sink its fangs.","5_health_100":"The dimensional arachnid phases into solid reality, mandibles dripping with glistening venom.","6_health_75":"A solid blow shears its carapace; it flickers into translucency for an instant before snapping back.","7_health_50":"Ichor oozes from damaged joints as its planar shifting flickers uncontrollably.","8_health_25":"Pinned to physical reality by catastrophic trauma, the spider curls its eight legs in agony.","9_dead":"The pale blue horror lies lifeless upon the floor, completely anchored to the mortal plane."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Phase%20Spider',
    'Magical Beast', NULL, 'None'
)
ON CONFLICT(name) DO UPDATE SET
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    movement_type = excluded.movement_type,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 1 FROM monsters WHERE name = 'Phase Spider';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'EXTRAPLANAR', 0 FROM monsters WHERE name = 'Phase Spider';

-- Monster: Wraith (CR 5, Undead)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Wraith', 'W', '#2d3748', 47, 1600, '1d6',
    7, 18, 6, 5,
    5, 5, '["U", "S"]', 'FLY',
    '["constitution_drain", "incorporeal", "undead_traits", "sunlight_powerlessness"]', 'images/monsters/wraith.png', '{"1_distant":"An unnatural draft chills the air to freezing, extinguishing nearby torch flames into thin wisps of smoke.","2_ranger_distant":"Frost crystallizes across solid stone while faint wailing echoes from the walls; an incorporeal specter stalks here.","3_close":"A terrifying apparition woven of pure shadowy malice, with glowing red pinpoints of hatred burning within its cowl.","4_ranger_close":"Physical armor cannot bar its spectral touch, and it leeches vitality directly from the soul; strike with blessed steel.","5_health_100":"The incorporeal specter drifts forward effortlessly, extending shadowy claws that hunger for the warmth of the living.","6_health_75":"A clean cut disrupts its smoky form, eliciting a chilling, ear-piercing scream of spectral torment.","7_health_50":"Its shadowy outline wavers and frays like burned silk as spiritual agony consumes it.","8_health_25":"Fading into thin gray vapor, the phantom''s crimson eyes flare weakly in final defiance.","9_dead":"The shadow entity dissolves into nothingness, leaving only the freezing chill of the grave behind."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Wraith',
    'Undead', 'incorporeal', 'Incidental'
)
ON CONFLICT(name) DO UPDATE SET
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    movement_type = excluded.movement_type,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 1 FROM monsters WHERE name = 'Wraith';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 0 FROM monsters WHERE name = 'Wraith';

-- Monster: Gibbering Mouther (CR 5, Aberration)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Gibbering Mouther', 'M', '#9b2c2c', 45, 1600, '1d4',
    3, 19, 7, 5,
    5, 5, '["U", "S"]', 'WALK',
    '["gibbering", "spittle", "engulf", "ground_manipulation"]', 'images/monsters/gibbering_mouther.png', '{"1_distant":"A chaotic, maddening chorus of babbling, weeping, and laughing voices echoes off wet cavern walls.","2_ranger_distant":"Slime-slicked ground turning soft as quicksand and overlapping mad murmurs reveal an amorphous eldritch horror.","3_close":"An amorphous mound of bubbling, weeping flesh, dotted with dozens of blinking eyes and chattering fanged mouths.","4_ranger_close":"Its incessant babble confuses the mind; focus on your weapon rhythm and carve through its spongy mass.","5_health_100":"Dozens of mouths babble in unholy languages simultaneously as the mass of flesh rolls forward hungrily.","6_health_75":"Scores of eyes burst under blade impact, spraying acidic slime while the remaining mouths scream in unison.","7_health_50":"Deep gashes divide the flesh mass; it struggles to coordinate its dozens of gnashing maws.","8_health_25":"Collapsing into a sluggish puddle of twitching lips and half-shut eyes, its babble turns to faint whimpering.","9_dead":"The amorphous blob melts into foul, bubbling sludge, completely quiet at last."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Gibbering%20Mouther',
    'Aberration', NULL, 'None'
)
ON CONFLICT(name) DO UPDATE SET
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    movement_type = excluded.movement_type,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 1 FROM monsters WHERE name = 'Gibbering Mouther';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 0 FROM monsters WHERE name = 'Gibbering Mouther';

-- Monster: Peryton (CR 4, Magical Beast)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Peryton', 'P', '#702459', 42, 1200, '1d6+3',
    7, 17, 7, 4,
    4, 6, '["M", "F"]', 'FLY',
    '["shadow_manipulation", "gore", "damage_reduction"]', 'images/monsters/peryton.png', '{"1_distant":"A winged shadow glides over the slopes, yet curiously the shadow cast upon the rocks resembles that of a horned human.","2_ranger_distant":"Decapitated deer and an ominous human-shaped silhouette cast upon the crags warn of a cursed winged carnivore.","3_close":"A stag-headed flying predator with dark purple eagle wings, sharp obsidian horns, and the cruel talons of an oversized bird of prey.","4_ranger_close":"It dives from above aiming its heavy antlers at the chest; sidestep its charge and slice its wing tendons.","5_health_100":"The horned avian predator circles gracefully, horns lowered for a devastating aerial impalement.","6_health_75":"Slashed feathers and splintered antler tips evoke an angry, screeching dive from the winged stag.","7_health_50":"Struggling to climb against the mountain wind, blood flows over its purple plumage.","8_health_25":"Grounded and coughing crimson foam, the beast lashes out blindly with cracked antlers.","9_dead":"The dark winged predator lies still, its sinister shadow fading away with its final breath."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Peryton',
    'Magical Beast', NULL, 'Standard'
)
ON CONFLICT(name) DO UPDATE SET
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    movement_type = excluded.movement_type,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'MOUNTAINS', 1 FROM monsters WHERE name = 'Peryton';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 0 FROM monsters WHERE name = 'Peryton';

-- Monster: Giant Stag Beetle (CR 4, Vermin)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Giant Stag Beetle', 'B', '#234e52', 45, 1200, '2d8+6',
    -1, 19, 8, 4,
    4, 6, '["F", "J"]', 'WALK',
    '["trample", "darkvision"]', 'images/monsters/giant_stag_beetle.png', '{"1_distant":"Branches splinter and the earth trembles rhythmically as a massive, heavy armored creature bulldozes through the underbrush.","2_ranger_distant":"Gouged tree trunks and flattened saplings point to a territorial behemoth beetle foraging aggressively.","3_close":"A ten-foot beetle armored in thick iridescent blue-black carapace, brandishing colossal branching mandibles capable of snapping logs.","4_ranger_close":"Its dorsal shell is nearly impenetrable; aim for the softer connective joints beneath its massive horn.","5_health_100":"The titanic insect clatters forward like a living siege engine, clicking its immense mandibles with bone-crushing force.","6_health_75":"A heavy weapon blow fractures its outer shell, but the behemoth simply lowers its horns and charges harder.","7_health_50":"Milky fluid leaks freely from crushed carapace segments as its heavy charges lose momentum.","8_health_25":"Staggering on crushed legs, the immense beetle tilts sideways, mandibles dragging through the soil.","9_dead":"The giant beetle rolls onto its side with a shuddering groan, armored mandibles resting inert upon the moss."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Giant%20Stag%20Beetle',
    'Vermin', NULL, 'None'
)
ON CONFLICT(name) DO UPDATE SET
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    movement_type = excluded.movement_type,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 1 FROM monsters WHERE name = 'Giant Stag Beetle';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'JUNGLE', 0 FROM monsters WHERE name = 'Giant Stag Beetle';

-- Monster: Vegepygmy (CR 0.5, Plant)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Vegepygmy', 'v', '#2f855a', 7, 200, '1d6+1',
    2, 16, 1, 0.5,
    1, 12, '["S", "U"]', 'WALK',
    '["plant_traits", "damage_reduction", "low_light_vision"]', 'images/monsters/vegepygmy.png', '{"1_distant":"A dry, rhythmic clicking of wood and rustling of fungal caps emerges from the damp shadows.","2_ranger_distant":"Spores and fibrous moss trails mark the territory of primitive mold-born plant humanoids.","3_close":"A diminutive, fibrous plant humanoid made of dense fungus and woody vines, gripping a primitive stone-tipped spear.","4_ranger_close":"Its fibrous body resists piercing and blunt attacks; slashing edges cut easily through its vine-like sinews.","5_health_100":"The small mold-creature clicks its wooden mandibles, thrusting its crude spear with surprising vigor.","6_health_75":"Severed vines spill sap instead of blood as the creature emits a hiss of irritating spores.","7_health_50":"Punctured and leaking greenish sap, the plant creature stumbles backward into the moss.","8_health_25":"Its fungal torso unraveling, the creature feebly swings its spear with failing strength.","9_dead":"The mold-born creature falls into a heap of withered stalks and inert, harmless lichen."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Vegepygmy',
    'Plant', NULL, 'Incidental'
)
ON CONFLICT(name) DO UPDATE SET
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    movement_type = excluded.movement_type,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 1 FROM monsters WHERE name = 'Vegepygmy';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 0 FROM monsters WHERE name = 'Vegepygmy';

-- Monster: Ghast (CR 2, Undead)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Ghast', 'G', '#319795', 17, 600, '1d6+3',
    3, 16, 5, 2,
    2, 8, '["U", "S"]', 'WALK',
    '["stench", "paralysis", "undead_traits"]', 'images/monsters/ghast.png', '{"1_distant":"An overwhelming, suffocating stench of decayed flesh heralds the presence of an insatiable graveyard scavenger.","2_ranger_distant":"Unearthed graves and clawed tracks slick with foul rot reveal an elite carrion-feeder nearby.","3_close":"A feral undead abomination with mottled gray skin, elongated teeth, and claws dripping paralytic filth.","4_ranger_close":"Its unbearable stench sickens the weak, and its claws paralyze; keep distance and strike with divine fury.","5_health_100":"The ravenous undead leaps forward with animalistic speed, jaws slavering with hunger.","6_health_75":"Blade strikes carve into its gray meat; it roars with carrion breath and attacks with renewed violence.","7_health_50":"Grievously wounded and leaking bile, the beast snarls through shattered fangs.","8_health_25":"Crawling along the flagstones with broken limbs, the creature snaps its teeth in futile hunger.","9_dead":"The foul abomination collapses in a heap of rotten flesh, its sickening stench gradually dissipating."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Ghast',
    'Undead', NULL, 'Standard'
)
ON CONFLICT(name) DO UPDATE SET
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    movement_type = excluded.movement_type,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 1 FROM monsters WHERE name = 'Ghast';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 0 FROM monsters WHERE name = 'Ghast';

-- Monster: Giant Bat (CR 2, Animal)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Giant Bat', 'b', '#4a5568', 22, 600, '1d8+3',
    2, 15, 5, 2,
    2, 9, '["U", "F"]', 'FLY',
    '["blindsense", "flight"]', 'images/monsters/giant_bat.png', '{"1_distant":"High-frequency clicks and the heavy, leathery buffet of giant wings disturb the upper cavern air.","2_ranger_distant":"Guano mounds and claw marks on high stalactites indicate an aggressive giant cave flyer roosting nearby.","3_close":"A massive flying mammal with a five-foot furry body, a ten-foot leathery wingspan, and razor-sharp fangs.","4_ranger_close":"It navigates by sound rather than sight; loud percussive strikes disorient its flight.","5_health_100":"The giant flyer dives from the cavern roof, leathery wings spreading wide as fangs bare in a screech.","6_health_75":"A torn wing membrane disrupts its swoop, forcing it to bank sharply to avoid crashing.","7_health_50":"Bleeding and unable to maintain sustained flight, the creature flutters near the ground with furious bites.","8_health_25":"Crawling on its wing-claws with broken bones, the injured beast shrieks in pain.","9_dead":"The massive winged mammal falls silent, tangled in its own limp, shredded wings."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Bat,%20Dire',
    'Animal', NULL, 'None'
)
ON CONFLICT(name) DO UPDATE SET
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    movement_type = excluded.movement_type,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 1 FROM monsters WHERE name = 'Giant Bat';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 0 FROM monsters WHERE name = 'Giant Bat';

-- Monster: Morlock (CR 2, Monstrous Humanoid)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Morlock', 'm', '#e2e8f0', 22, 600, '1d4+2',
    8, 15, 5, 2,
    2, 8, '["U"]', 'CLIMB',
    '["sneak_attack", "darkvision", "light_blindness", "climb"]', 'images/monsters/morlock.png', '{"1_distant":"A feral chittering and the agile scraping of bare hands and feet scaling sheer cavern walls echo above.","2_ranger_distant":"Oily pale handprints and bones gnawed by humanoid teeth indicate degenerate subterranean cave stalkers.","3_close":"A degenerate, chalk-white humanoid with spindly limbs, enormous milky eyes, and a vicious serrated bone club.","4_ranger_close":"Their eyes cannot withstand bright illumination; hold the high ground and strike when they leap from the walls.","5_health_100":"The pale troglodytic creature scampers across the wall with unnatural speed, teeth chattering aggressively.","6_health_75":"Blood spatters its chalk-white hide; the feral creature shrieks and leaps to a higher ledge.","7_health_50":"Severely battered, the degenerate creature snarls and swings its primitive club with desperate fury.","8_health_25":"Huddled against the stone with shattered limbs, the pale stalker cowers with terrified, milky eyes.","9_dead":"The degenerate white humanoid lies limp upon the cavern floor, motionless in the dark."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Morlock',
    'Monstrous Humanoid', NULL, 'Standard'
)
ON CONFLICT(name) DO UPDATE SET
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    movement_type = excluded.movement_type,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 1 FROM monsters WHERE name = 'Morlock';

-- Monster: Violet Fungus (CR 3, Plant)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Violet Fungus', 'F', '#805ad5', 30, 800, '1d4+1',
    -2, 15, 4, 3,
    3, 7, '["U", "S"]', 'WALK',
    '["rot", "tentacles", "plant_traits"]', 'images/monsters/violet_fungus.png', '{"1_distant":"A sickly sweet odor of rotting fungus fills the damp cavern, accompanied by the wet sliding of slimy tendrils.","2_ranger_distant":"Necrotic black mold covering old bones indicates a predatory rotting mushroom lurking ahead.","3_close":"A four-foot tall purplish mushroom cap sprouting four whip-like, thorny tentacles that drip flesh-dissolving acid.","4_ranger_close":"Its tentacles cause rapid flesh necrosis on contact; keep clear of its reach and sever its stalk with heavy cuts.","5_health_100":"The violet mushroom whips its four thorny tentacles through the air, hissing with corrosive venom.","6_health_75":"One of its flailing tendrils is severed cleanly, spraying acidic purple spores across the flagstones.","7_health_50":"Its main fungal cap is sliced open, leaking noxious rotting bile as its flailing grows chaotic.","8_health_25":"With three tentacles severed and its stalk collapsing, the dying fungus emits a faint sickly hiss.","9_dead":"The purple mushroom collapses into a pile of rotten, harmless fungal pulp."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Violet%20Fungus',
    'Plant', NULL, 'None'
)
ON CONFLICT(name) DO UPDATE SET
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    movement_type = excluded.movement_type,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 1 FROM monsters WHERE name = 'Violet Fungus';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 0 FROM monsters WHERE name = 'Violet Fungus';

-- Monster: Grick (CR 2, Aberration)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Grick', 'g', '#2c7a7b', 27, 600, '1d4+1',
    2, 16, 4, 2,
    2, 8, '["U", "H"]', 'CLIMB',
    '["damage_reduction", "scent", "climb"]', 'images/monsters/grick.png', '{"1_distant":"A wet, slithering sound accompanied by the clicking of a sharp beak emerges from cracks in the rocky ceiling.","2_ranger_distant":"Dislodged pebbles and a slick slime trail reveal an ambush predator blended seamlessly into the stone.","3_close":"A worm-like horror with rubbery slate-gray hide, a snapping parrot-like beak, and four barbed tentacles circling its mouth.","4_ranger_close":"Its rubbery hide resists non-magical strikes; focus strong thrusts directly into its beaked maw.","5_health_100":"The rubbery worm coils like a spring, tentacles writhing and beak snapping hungrily.","6_health_75":"A deep cut slices through its tentacle cluster, causing the beast to hiss in pain and lash out blindly.","7_health_50":"Leaking dark alien fluid from multiple wounds, the worm struggles to keep its coils steady.","8_health_25":"Twitching feebly on the cavern floor, the wounded horror snaps its beak with fading energy.","9_dead":"The rubbery monstrosity lies lifeless and limp, its barbed tentacles uncurling across the rock."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Grick',
    'Aberration', NULL, 'Incidental'
)
ON CONFLICT(name) DO UPDATE SET
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    movement_type = excluded.movement_type,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 1 FROM monsters WHERE name = 'Grick';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Grick';

-- Monster: Krenshar (CR 1, Magical Beast)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Krenshar', 'k', '#dd6b20', 13, 400, '1d6',
    2, 15, 3, 1,
    1, 10, '["F", "P"]', 'WALK',
    '["scare", "scent"]', 'images/monsters/krenshar.png', '{"1_distant":"A low, feline growl echoes through the trees, suddenly escalating into an unnatural, blood-chilling screech.","2_ranger_distant":"Deep feline claw marks high on tree trunks indicate a bizarre predator known for terrifying psychological displays.","3_close":"A hyena-like feline beast that can retract the skin of its face to reveal bare muscle, fangs, and glistening skull.","4_ranger_close":"Do not look into its terrifying peeled skull visage; rely on disciplined strikes and ignore the hideous display.","5_health_100":"The predator peels back the flesh of its head in a terrifying grimace, snarling with exposed bone and teeth.","6_health_75":"A solid blow cuts across its tawny flank; the creature recoils with a sharp yowl of surprised pain.","7_health_50":"Bleeding freely and its terrifying display broken, the feline beast circles warily.","8_health_25":"Limping heavily with its head bowed, the wounded predator whines with failing breath.","9_dead":"The tawny beast collapses onto the forest floor, its facial skin settling peacefully over its skull in death."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Krenshar',
    'Magical Beast', NULL, 'None'
)
ON CONFLICT(name) DO UPDATE SET
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    movement_type = excluded.movement_type,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 1 FROM monsters WHERE name = 'Krenshar';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'PLAINS', 0 FROM monsters WHERE name = 'Krenshar';

-- Monster: Bunyip (CR 3, Magical Beast)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Bunyip', 'B', '#2b6cb0', 30, 800, '1d8+4',
    3, 15, 7, 3,
    3, 7, '["R", "S", "C"]', 'SWIM',
    '["roar", "blood_frenzy", "swim"]', 'images/monsters/bunyip.png', '{"1_distant":"A deep, resonant bellow reverberates across the dark waters, followed by heavy splashes breaking the calm surface.","2_ranger_distant":"Disturbed reeds and floating bloody fish heads indicate an aggressive aquatic beast patrolling the shallows.","3_close":"A fearsome aquatic chimera combining the body of a huge seal with the head and ferocious jaws of a great shark.","4_ranger_close":"Its terrifying roar panics nearby prey and it enters a frenzy at the scent of blood; avoid fighting in deep water.","5_health_100":"The amphibious monster surfaces with a deafening roar, razor-sharp shark teeth glistening in the water.","6_health_75":"A strike slices into its blubbery hide; the creature thrashes the water to foam in mounting fury.","7_health_50":"Dark blood plumes around the beast in the water as its powerful lunges grow clumsy.","8_health_25":"Gasping on the riverbank with shredded fins, the dying aquatic predator snaps feebly at the air.","9_dead":"The shark-headed beast rolls belly-up upon the water, floating motionless among the reeds."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Bunyip',
    'Magical Beast', 'aquatic', 'None'
)
ON CONFLICT(name) DO UPDATE SET
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    movement_type = excluded.movement_type,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'RIVER_LAKE', 1 FROM monsters WHERE name = 'Bunyip';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 0 FROM monsters WHERE name = 'Bunyip';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'COAST', 0 FROM monsters WHERE name = 'Bunyip';

-- Monster: Sahuagin (CR 2, Monstrous Humanoid)
INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, image_path, descriptions, source_url,
    creature_type, creature_subtype, treasure_type
) VALUES (
    'Sahuagin', 'S', '#007791', 15, 600, '1d8+3',
    1, 16, 4, 2,
    2, 8, '["C", "O", "R"]', 'SWIM',
    '["blood_frenzy", "aquatic", "darkvision"]', 'images/monsters/sahuagin.png', '{"1_distant":"The wet slap of webbed feet upon coastal rock and the click of trident shafts echo from the crashing surf.","2_ranger_distant":"Webbed claw prints and discarded sea-shells sharpened into weapons betray coastal raiders scouting the shoreline.","3_close":"A predatory fish-like humanoid with green-scaled hide, webbed clawed hands, shark-like jaws, and a heavy coral trident.","4_ranger_close":"Blood in the water sends them into an uncontrollable frenzy; maintain discipline and parry their trident thrusts.","5_health_100":"The sea-devil hisses through rows of triangular teeth, spinning its heavy trident in a lethal guard.","6_health_75":"Shattered green scales bleed dark crimson into the foam; the raider lets out an enraged aquatic screech.","7_health_50":"Grievously injured, the coastal hunter stumbles backward into the surf, gasping through flared gills.","8_health_25":"Collapsing onto the tidal rocks with broken fins, the sea-raider glares with fading predatory hatred.","9_dead":"The green-scaled sea-devil lies still upon the shoreline, the incoming tide washing over its lifeless fins."}', 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Sahuagin',
    'Monstrous Humanoid', 'aquatic', 'Standard'
)
ON CONFLICT(name) DO UPDATE SET
    base_hp = excluded.base_hp,
    armor_class = excluded.armor_class,
    attack_bonus = excluded.attack_bonus,
    damage_dice = excluded.damage_dice,
    xp_reward = excluded.xp_reward,
    solo_level = excluded.solo_level,
    challenge_rating = excluded.challenge_rating,
    movement_type = excluded.movement_type,
    source_url = excluded.source_url,
    image_path = excluded.image_path,
    descriptions = excluded.descriptions,
    creature_type = excluded.creature_type,
    creature_subtype = excluded.creature_subtype,
    treasure_type = excluded.treasure_type;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'COAST', 1 FROM monsters WHERE name = 'Sahuagin';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'OCEAN', 0 FROM monsters WHERE name = 'Sahuagin';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'RIVER_LAKE', 0 FROM monsters WHERE name = 'Sahuagin';

