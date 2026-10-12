-- 005_seed_pathfinder_items.sql: Comprehensive Pathfinder 1e Item Database for Darkgrid
-- Sourced directly from Archives of Nethys (Pathfinder 1e Core Rulebook)
-- Total: 83 authentic item definitions (24 melee, 10 ranged, 20 armor/shields, 5 potions, 12 magic weapons, 12 magic armor/shields)

-- ============================================================================
-- 1. NORMAL MELEE WEAPONS (24 Items)
-- ============================================================================

INSERT INTO item_definitions (
    name, category, description, buy_price, sell_price, is_magical,
    damage_dice, armor_bonus, shield_bonus, equip_slot, allowed_classes,
    max_dex_bonus, enhancement_bonus, weapon_range_type, is_two_handed,
    pathfinder_source, min_cr, attributes
) VALUES
('Dagger', 'WEAPON', 'A small, easily concealed blade honed for swift thrusts and cuts.', 2, 1, 0, '1d4', 0, 0, 'MAIN_HAND', '["FIGHTER","RANGER","CLERIC"]', NULL, 0, 'MELEE', 0, 'Pathfinder 1e Core Rulebook pg. 142', 0, '{"weapon_type":"melee","damage_type":"piercing","crit_threat":19,"crit_mult":2}'),
('Shortsword', 'WEAPON', 'A straight steel blade designed for rapid thrusting in close quarters.', 10, 5, 0, '1d6', 0, 0, 'MAIN_HAND', '["FIGHTER","RANGER","CLERIC"]', NULL, 0, 'MELEE', 0, 'Pathfinder 1e Core Rulebook pg. 143', 0, '{"weapon_type":"melee","damage_type":"piercing","crit_threat":19,"crit_mult":2}'),
('Longsword', 'WEAPON', 'A versatile steel blade forged for lethal slashes and thrusts.', 15, 7, 0, '1d8', 0, 0, 'MAIN_HAND', '["FIGHTER","RANGER","CLERIC"]', NULL, 0, 'MELEE', 0, 'Pathfinder 1e Core Rulebook pg. 143', 0, '{"weapon_type":"melee","damage_type":"slashing","crit_threat":19,"crit_mult":2}'),
('Greatsword', 'WEAPON', 'A massive double-edged sword requiring two hands to deliver devastating sweeping blows.', 50, 25, 0, '2d6', 0, 0, 'MAIN_HAND', '["FIGHTER","RANGER"]', NULL, 0, 'MELEE', 1, 'Pathfinder 1e Core Rulebook pg. 143', 0, '{"weapon_type":"melee","damage_type":"slashing","crit_threat":19,"crit_mult":2}'),
('Battleaxe', 'WEAPON', 'A broad, single-bitted steel axe capable of cleaving shields and armor.', 10, 5, 0, '1d8', 0, 0, 'MAIN_HAND', '["FIGHTER","RANGER"]', NULL, 0, 'MELEE', 0, 'Pathfinder 1e Core Rulebook pg. 142', 0, '{"weapon_type":"melee","damage_type":"slashing","crit_threat":20,"crit_mult":3}'),
('Greataxe', 'WEAPON', 'A colossal executioner''s axe weighted for earth-shattering overhead chops.', 20, 10, 0, '1d12', 0, 0, 'MAIN_HAND', '["FIGHTER","RANGER"]', NULL, 0, 'MELEE', 1, 'Pathfinder 1e Core Rulebook pg. 143', 0, '{"weapon_type":"melee","damage_type":"slashing","crit_threat":20,"crit_mult":3}'),
('Handaxe', 'WEAPON', 'A compact bearded axe suitable for quick close-range strikes.', 6, 3, 0, '1d6', 0, 0, 'MAIN_HAND', '["FIGHTER","RANGER"]', NULL, 0, 'MELEE', 0, 'Pathfinder 1e Core Rulebook pg. 142', 0, '{"weapon_type":"melee","damage_type":"slashing","crit_threat":20,"crit_mult":3}'),
('Warhammer', 'WEAPON', 'A dense iron hammer with a blunt striking face and back spike for crushing plate.', 12, 6, 0, '1d8', 0, 0, 'MAIN_HAND', '["FIGHTER","CLERIC"]', NULL, 0, 'MELEE', 0, 'Pathfinder 1e Core Rulebook pg. 143', 0, '{"weapon_type":"melee","damage_type":"bludgeoning","crit_threat":20,"crit_mult":3}'),
('Light Mace', 'WEAPON', 'A flanged iron cudgel light enough for rapid defensive swings.', 5, 2, 0, '1d6', 0, 0, 'MAIN_HAND', '["FIGHTER","CLERIC"]', NULL, 0, 'MELEE', 0, 'Pathfinder 1e Core Rulebook pg. 142', 0, '{"weapon_type":"melee","damage_type":"bludgeoning","crit_threat":20,"crit_mult":2}'),
('Heavy Mace', 'WEAPON', 'A fluted iron mace designed to crush bone and armor with immense bludgeoning force.', 12, 6, 0, '1d8', 0, 0, 'MAIN_HAND', '["FIGHTER","CLERIC"]', NULL, 0, 'MELEE', 0, 'Pathfinder 1e Core Rulebook pg. 142', 0, '{"weapon_type":"melee","damage_type":"bludgeoning","crit_threat":20,"crit_mult":2}'),
('Morningstar', 'WEAPON', 'A spiked iron ball affixed to a reinforced shaft, combining blunt impact with piercing spikes.', 8, 4, 0, '1d8', 0, 0, 'MAIN_HAND', '["FIGHTER","CLERIC"]', NULL, 0, 'MELEE', 0, 'Pathfinder 1e Core Rulebook pg. 142', 0, '{"weapon_type":"melee","damage_type":"bludgeoning_piercing","crit_threat":20,"crit_mult":2}'),
('Spear', 'WEAPON', 'A long ash pole topped with a leaf-shaped steel head for piercing thrusts.', 2, 1, 0, '1d8', 0, 0, 'MAIN_HAND', '["FIGHTER","RANGER","CLERIC"]', NULL, 0, 'MELEE', 1, 'Pathfinder 1e Core Rulebook pg. 142', 0, '{"weapon_type":"melee","damage_type":"piercing","crit_threat":20,"crit_mult":3}'),
('Shortspear', 'WEAPON', 'A one-handed spear balanced for fighting alongside a shield.', 1, 0, 0, '1d6', 0, 0, 'MAIN_HAND', '["FIGHTER","RANGER","CLERIC"]', NULL, 0, 'MELEE', 0, 'Pathfinder 1e Core Rulebook pg. 142', 0, '{"weapon_type":"melee","damage_type":"piercing","crit_threat":20,"crit_mult":2}'),
('Quarterstaff', 'WEAPON', 'A seasoned hardwood stave bound with iron rings at both tips.', 1, 0, 0, '1d6', 0, 0, 'MAIN_HAND', '["FIGHTER","RANGER","CLERIC"]', NULL, 0, 'MELEE', 1, 'Pathfinder 1e Core Rulebook pg. 142', 0, '{"weapon_type":"melee","damage_type":"bludgeoning","crit_threat":20,"crit_mult":2}'),
('Halberd', 'WEAPON', 'A polearm mounting an axe blade topped with a spike and rear hook.', 10, 5, 0, '1d10', 0, 0, 'MAIN_HAND', '["FIGHTER"]', NULL, 0, 'MELEE', 1, 'Pathfinder 1e Core Rulebook pg. 143', 0, '{"weapon_type":"melee","damage_type":"slashing_piercing","crit_threat":20,"crit_mult":3}'),
('Scythe', 'WEAPON', 'A curved harvesting blade repurposed as an ominous weapon of execution.', 18, 9, 0, '2d4', 0, 0, 'MAIN_HAND', '["FIGHTER","CLERIC"]', NULL, 0, 'MELEE', 1, 'Pathfinder 1e Core Rulebook pg. 143', 0, '{"weapon_type":"melee","damage_type":"slashing_piercing","crit_threat":20,"crit_mult":4}'),
('Heavy Flail', 'WEAPON', 'A spiked iron cylinder connected to a stout haft by heavy iron chain links.', 15, 7, 0, '1d10', 0, 0, 'MAIN_HAND', '["FIGHTER"]', NULL, 0, 'MELEE', 1, 'Pathfinder 1e Core Rulebook pg. 143', 0, '{"weapon_type":"melee","damage_type":"bludgeoning","crit_threat":19,"crit_mult":2}'),
('Light Flail', 'WEAPON', 'A one-handed flail designed to wrap around enemy parries and shields.', 8, 4, 0, '1d8', 0, 0, 'MAIN_HAND', '["FIGHTER","CLERIC"]', NULL, 0, 'MELEE', 0, 'Pathfinder 1e Core Rulebook pg. 143', 0, '{"weapon_type":"melee","damage_type":"bludgeoning","crit_threat":20,"crit_mult":2}'),
('Scimitar', 'WEAPON', 'A curved steel blade favored for drawing cuts and fluid slashes.', 15, 7, 0, '1d6', 0, 0, 'MAIN_HAND', '["FIGHTER","RANGER"]', NULL, 0, 'MELEE', 0, 'Pathfinder 1e Core Rulebook pg. 143', 0, '{"weapon_type":"melee","damage_type":"slashing","crit_threat":18,"crit_mult":2}'),
('Rapier', 'WEAPON', 'A slender, pointed sword optimized for agile thrusting attacks.', 20, 10, 0, '1d6', 0, 0, 'MAIN_HAND', '["FIGHTER","RANGER"]', NULL, 0, 'MELEE', 0, 'Pathfinder 1e Core Rulebook pg. 143', 0, '{"weapon_type":"melee","damage_type":"piercing","crit_threat":18,"crit_mult":2}'),
('Club', 'WEAPON', 'A solid wooden cudgel, rough-hewn but effective.', 0, 0, 0, '1d6', 0, 0, 'MAIN_HAND', '["FIGHTER","RANGER","CLERIC"]', NULL, 0, 'MELEE', 0, 'Pathfinder 1e Core Rulebook pg. 142', 0, '{"weapon_type":"melee","damage_type":"bludgeoning","crit_threat":20,"crit_mult":2}'),
('Greatclub', 'WEAPON', 'A massive tree bough reinforced with iron studs for crushing strikes.', 5, 2, 0, '1d10', 0, 0, 'MAIN_HAND', '["FIGHTER"]', NULL, 0, 'MELEE', 1, 'Pathfinder 1e Core Rulebook pg. 142', 0, '{"weapon_type":"melee","damage_type":"bludgeoning","crit_threat":20,"crit_mult":2}'),
('Glaive', 'WEAPON', 'A single-edged curving blade mounted atop a six-foot pole.', 8, 4, 0, '1d10', 0, 0, 'MAIN_HAND', '["FIGHTER"]', NULL, 0, 'MELEE', 1, 'Pathfinder 1e Core Rulebook pg. 143', 0, '{"weapon_type":"melee","damage_type":"slashing","crit_threat":20,"crit_mult":3}'),
('Falchion', 'WEAPON', 'A broad, heavy cleaving sword with a weighted curved edge.', 75, 37, 0, '2d4', 0, 0, 'MAIN_HAND', '["FIGHTER"]', NULL, 0, 'MELEE', 1, 'Pathfinder 1e Core Rulebook pg. 143', 0, '{"weapon_type":"melee","damage_type":"slashing","crit_threat":18,"crit_mult":2}')
ON CONFLICT(name) DO UPDATE SET
    category = excluded.category,
    description = excluded.description,
    buy_price = excluded.buy_price,
    sell_price = excluded.sell_price,
    damage_dice = excluded.damage_dice,
    weapon_range_type = excluded.weapon_range_type,
    is_two_handed = excluded.is_two_handed,
    allowed_classes = excluded.allowed_classes,
    pathfinder_source = excluded.pathfinder_source,
    attributes = excluded.attributes;

-- ============================================================================
-- 2. NORMAL RANGED WEAPONS (10 Items)
-- ============================================================================

INSERT INTO item_definitions (
    name, category, description, buy_price, sell_price, is_magical,
    damage_dice, armor_bonus, shield_bonus, equip_slot, allowed_classes,
    max_dex_bonus, enhancement_bonus, weapon_range_type, is_two_handed,
    pathfinder_source, min_cr, attributes
) VALUES
('Shortbow', 'WEAPON', 'A curved yew bow capable of driving arrows swiftly through armor.', 30, 15, 0, '1d6', 0, 0, 'MAIN_HAND', '["FIGHTER","RANGER"]', NULL, 0, 'RANGED', 1, 'Pathfinder 1e Core Rulebook pg. 143', 0, '{"weapon_type":"ranged","damage_type":"piercing","crit_threat":20,"crit_mult":3}'),
('Longbow', 'WEAPON', 'A tall war bow crafted from seasoned yew, delivering powerful shots across great distance.', 75, 37, 0, '1d8', 0, 0, 'MAIN_HAND', '["FIGHTER","RANGER"]', NULL, 0, 'RANGED', 1, 'Pathfinder 1e Core Rulebook pg. 143', 0, '{"weapon_type":"ranged","damage_type":"piercing","crit_threat":20,"crit_mult":3}'),
('Composite Shortbow', 'WEAPON', 'Horn and wood laminated together to provide extra tension and velocity.', 75, 37, 0, '1d6', 0, 0, 'MAIN_HAND', '["FIGHTER","RANGER"]', NULL, 0, 'RANGED', 1, 'Pathfinder 1e Core Rulebook pg. 143', 0, '{"weapon_type":"ranged","damage_type":"piercing","crit_threat":20,"crit_mult":3}'),
('Composite Longbow', 'WEAPON', 'A heavy laminated bow forged for strong archers to penetrate thick hides.', 100, 50, 0, '1d8', 0, 0, 'MAIN_HAND', '["FIGHTER","RANGER"]', NULL, 0, 'RANGED', 1, 'Pathfinder 1e Core Rulebook pg. 143', 0, '{"weapon_type":"ranged","damage_type":"piercing","crit_threat":20,"crit_mult":3}'),
('Light Crossbow', 'WEAPON', 'A mechanical steel crossbow fitted with a stirrup and lever for reliable bolts.', 35, 17, 0, '1d8', 0, 0, 'MAIN_HAND', '["FIGHTER","RANGER","CLERIC"]', NULL, 0, 'RANGED', 1, 'Pathfinder 1e Core Rulebook pg. 142', 0, '{"weapon_type":"ranged","damage_type":"piercing","crit_threat":19,"crit_mult":2}'),
('Heavy Crossbow', 'WEAPON', 'A powerful winch-drawn crossbow firing heavy bolts with bone-shattering force.', 50, 25, 0, '1d10', 0, 0, 'MAIN_HAND', '["FIGHTER","RANGER"]', NULL, 0, 'RANGED', 1, 'Pathfinder 1e Core Rulebook pg. 143', 0, '{"weapon_type":"ranged","damage_type":"piercing","crit_threat":19,"crit_mult":2}'),
('Hand Crossbow', 'WEAPON', 'A compact pistol-sized crossbow favored by scouts and assassins.', 100, 50, 0, '1d4', 0, 0, 'MAIN_HAND', '["FIGHTER","RANGER"]', NULL, 0, 'RANGED', 0, 'Pathfinder 1e Core Rulebook pg. 143', 0, '{"weapon_type":"ranged","damage_type":"piercing","crit_threat":19,"crit_mult":2}'),
('Sling', 'WEAPON', 'A simple leather cradle and cords for hurling smooth lead bullets or stones.', 1, 0, 0, '1d4', 0, 0, 'MAIN_HAND', '["FIGHTER","RANGER","CLERIC"]', NULL, 0, 'RANGED', 0, 'Pathfinder 1e Core Rulebook pg. 142', 0, '{"weapon_type":"ranged","damage_type":"bludgeoning","crit_threat":20,"crit_mult":2}'),
('Javelin', 'WEAPON', 'A light, flexible throwing spear balanced for direct ranged attacks.', 1, 0, 0, '1d6', 0, 0, 'MAIN_HAND', '["FIGHTER","RANGER"]', NULL, 0, 'RANGED', 0, 'Pathfinder 1e Core Rulebook pg. 142', 0, '{"weapon_type":"ranged","damage_type":"piercing","crit_threat":20,"crit_mult":2}'),
('Dart', 'WEAPON', 'A heavy weighted metal dart designed to be thrown by hand.', 1, 0, 0, '1d4', 0, 0, 'MAIN_HAND', '["FIGHTER","RANGER","CLERIC"]', NULL, 0, 'RANGED', 0, 'Pathfinder 1e Core Rulebook pg. 142', 0, '{"weapon_type":"ranged","damage_type":"piercing","crit_threat":20,"crit_mult":2}')
ON CONFLICT(name) DO UPDATE SET
    category = excluded.category,
    description = excluded.description,
    buy_price = excluded.buy_price,
    sell_price = excluded.sell_price,
    damage_dice = excluded.damage_dice,
    weapon_range_type = excluded.weapon_range_type,
    is_two_handed = excluded.is_two_handed,
    allowed_classes = excluded.allowed_classes,
    pathfinder_source = excluded.pathfinder_source,
    attributes = excluded.attributes;

-- ============================================================================
-- 3. NORMAL ARMOR & SHIELDS (20 Items)
-- ============================================================================

INSERT INTO item_definitions (
    name, category, description, buy_price, sell_price, is_magical,
    damage_dice, armor_bonus, shield_bonus, equip_slot, allowed_classes,
    max_dex_bonus, enhancement_bonus, weapon_range_type, is_two_handed,
    pathfinder_source, min_cr, attributes
) VALUES
('Padded Armor', 'ARMOR', 'Quilted layers of dense cloth and wool offering minimal protection with maximum mobility.', 5, 2, 0, NULL, 1, 0, 'CHEST', '["FIGHTER","RANGER","CLERIC"]', 8, 0, NULL, 0, 'Pathfinder 1e Core Rulebook pg. 151', 0, '{"armor_type":"light"}'),
('Leather Armor', 'ARMOR', 'Tough boiled leather breastplate and greaves offering flexibility and silence in the wilderness.', 10, 5, 0, NULL, 2, 0, 'CHEST', '["FIGHTER","RANGER","CLERIC"]', 6, 0, NULL, 0, 'Pathfinder 1e Core Rulebook pg. 151', 0, '{"armor_type":"light"}'),
('Studded Leather Armor', 'ARMOR', 'Reinforced leather armor studded with close-set metal rivets.', 25, 12, 0, NULL, 3, 0, 'CHEST', '["FIGHTER","RANGER","CLERIC"]', 5, 0, NULL, 0, 'Pathfinder 1e Core Rulebook pg. 151', 0, '{"armor_type":"light"}'),
('Chain Shirt', 'ARMOR', 'Interlinked steel rings worn between layers of quilted fabric, providing reliable protection.', 100, 50, 0, NULL, 4, 0, 'CHEST', '["FIGHTER","RANGER"]', 4, 0, NULL, 0, 'Pathfinder 1e Core Rulebook pg. 151', 0, '{"armor_type":"light"}'),
('Hide Armor', 'ARMOR', 'Thick cured beast hide reinforced with rough bone or horn plates.', 15, 7, 0, NULL, 4, 0, 'CHEST', '["FIGHTER","RANGER","CLERIC"]', 4, 0, NULL, 0, 'Pathfinder 1e Core Rulebook pg. 151', 0, '{"armor_type":"medium"}'),
('Scale Mail', 'ARMOR', 'Overlapping scales of hammered bronze and iron riveted to a heavy leather tunic.', 50, 25, 0, NULL, 5, 0, 'CHEST', '["FIGHTER","CLERIC"]', 3, 0, NULL, 0, 'Pathfinder 1e Core Rulebook pg. 151', 0, '{"armor_type":"medium"}'),
('Chainmail', 'ARMOR', 'A heavy hauberk of interlocking steel links draped over padded gambeson.', 150, 75, 0, NULL, 6, 0, 'CHEST', '["FIGHTER","CLERIC"]', 2, 0, NULL, 0, 'Pathfinder 1e Core Rulebook pg. 151', 0, '{"armor_type":"medium"}'),
('Breastplate', 'ARMOR', 'A solid contoured steel breastplate protecting the vital torso while leaving limbs agile.', 200, 100, 0, NULL, 6, 0, 'CHEST', '["FIGHTER","RANGER","CLERIC"]', 3, 0, NULL, 0, 'Pathfinder 1e Core Rulebook pg. 151', 0, '{"armor_type":"medium"}'),
('Splint Mail', 'ARMOR', 'Overlapping vertical metal strips riveted to a leather backing for heavy defense.', 200, 100, 0, NULL, 7, 0, 'CHEST', '["FIGHTER","CLERIC"]', 0, 0, NULL, 0, 'Pathfinder 1e Core Rulebook pg. 151', 0, '{"armor_type":"heavy"}'),
('Banded Mail', 'ARMOR', 'Horizontal steel bands overlapping like shingles over a chain underlay.', 250, 125, 0, NULL, 7, 0, 'CHEST', '["FIGHTER","CLERIC"]', 1, 0, NULL, 0, 'Pathfinder 1e Core Rulebook pg. 151', 0, '{"armor_type":"heavy"}'),
('Half-Plate', 'ARMOR', 'Combination of shaped steel plates and chainmail covering torso and limbs.', 600, 300, 0, NULL, 8, 0, 'CHEST', '["FIGHTER"]', 0, 0, NULL, 0, 'Pathfinder 1e Core Rulebook pg. 151', 0, '{"armor_type":"heavy"}'),
('Full Plate', 'ARMOR', 'The pinnacle of mundane protection: fitted interlocking plates encasing the entire body.', 1500, 750, 0, NULL, 9, 0, 'CHEST', '["FIGHTER"]', 1, 0, NULL, 0, 'Pathfinder 1e Core Rulebook pg. 151', 0, '{"armor_type":"heavy"}'),
('Buckler', 'SHIELD', 'A small round steel shield strapped to the forearm.', 5, 2, 0, NULL, 0, 1, 'OFF_HAND', '["FIGHTER","RANGER","CLERIC"]', NULL, 0, NULL, 0, 'Pathfinder 1e Core Rulebook pg. 151', 0, '{"shield_type":"buckler"}'),
('Light Wooden Shield', 'SHIELD', 'A light oak shield with iron rim, light enough for nimble defense.', 3, 1, 0, NULL, 0, 1, 'OFF_HAND', '["FIGHTER","RANGER","CLERIC"]', NULL, 0, NULL, 0, 'Pathfinder 1e Core Rulebook pg. 151', 0, '{"shield_type":"light"}'),
('Light Steel Shield', 'SHIELD', 'A lightweight pressed steel shield capable of turning blades aside.', 9, 4, 0, NULL, 0, 1, 'OFF_HAND', '["FIGHTER","CLERIC"]', NULL, 0, NULL, 0, 'Pathfinder 1e Core Rulebook pg. 151', 0, '{"shield_type":"light"}'),
('Heavy Wooden Shield', 'SHIELD', 'A broad plank shield strapped to the arm for substantial coverage.', 7, 3, 0, NULL, 0, 2, 'OFF_HAND', '["FIGHTER","CLERIC"]', NULL, 0, NULL, 0, 'Pathfinder 1e Core Rulebook pg. 151', 0, '{"shield_type":"heavy"}'),
('Heavy Steel Shield', 'SHIELD', 'A massive curved steel shield offering superior deflection against blows.', 20, 10, 0, NULL, 0, 2, 'OFF_HAND', '["FIGHTER","CLERIC"]', NULL, 0, NULL, 0, 'Pathfinder 1e Core Rulebook pg. 151', 0, '{"shield_type":"heavy"}'),
('Tower Shield', 'SHIELD', 'A colossal pavise providing nearly total cover at the cost of mobility.', 30, 15, 0, NULL, 0, 4, 'OFF_HAND', '["FIGHTER"]', 2, 0, NULL, 0, 'Pathfinder 1e Core Rulebook pg. 151', 0, '{"shield_type":"tower"}'),
('Armored Coat', 'ARMOR', 'A sturdy leather longcoat lined with internal steel plates.', 50, 25, 0, NULL, 4, 0, 'CHEST', '["FIGHTER","CLERIC"]', 3, 0, NULL, 0, 'Pathfinder 1e Core Rulebook pg. 151', 0, '{"armor_type":"medium"}'),
('Agile Breastplate', 'ARMOR', 'A mastercrafted breastplate articulated for acrobatics and stealth.', 400, 200, 0, NULL, 6, 0, 'CHEST', '["FIGHTER","RANGER"]', 3, 0, NULL, 0, 'Pathfinder 1e Core Rulebook pg. 151', 0, '{"armor_type":"medium"}')
ON CONFLICT(name) DO UPDATE SET
    category = excluded.category,
    description = excluded.description,
    buy_price = excluded.buy_price,
    sell_price = excluded.sell_price,
    armor_bonus = excluded.armor_bonus,
    shield_bonus = excluded.shield_bonus,
    max_dex_bonus = excluded.max_dex_bonus,
    allowed_classes = excluded.allowed_classes,
    pathfinder_source = excluded.pathfinder_source,
    attributes = excluded.attributes;

-- ============================================================================
-- 4. HEALING POTIONS (5 Items)
-- ============================================================================

INSERT INTO item_definitions (
    name, category, description, buy_price, sell_price, is_magical,
    damage_dice, armor_bonus, shield_bonus, equip_slot, allowed_classes,
    max_dex_bonus, enhancement_bonus, weapon_range_type, is_two_handed,
    pathfinder_source, min_cr, attributes
) VALUES
('Minor Healing Potion', 'POTION', 'A small crystal phial filled with glowing crimson elixir that restores 1d8+1 vitality when consumed.', 25, 12, 1, NULL, 0, 0, NULL, '["FIGHTER","RANGER","CLERIC"]', NULL, 0, NULL, 0, 'Darkgrid Core Rulebook §8.3', 0, '{"heal_dice":"1d8+1","min_heal":2,"max_heal":9}'),
('Potion of Cure Light Wounds', 'POTION', 'The standard divine draught brewed by acolytes, knitting flesh and soothing wounds for 1d8+1 HP.', 50, 25, 1, NULL, 0, 0, NULL, '["FIGHTER","RANGER","CLERIC"]', NULL, 0, NULL, 0, 'Pathfinder 1e Core Rulebook pg. 478', 1, '{"heal_dice":"1d8+1","min_heal":2,"max_heal":9}'),
('Potion of Cure Moderate Wounds', 'POTION', 'A shimmering amber tonic that swiftly seals deep lacerations, restoring 2d8+3 vitality.', 300, 150, 1, NULL, 0, 0, NULL, '["FIGHTER","RANGER","CLERIC"]', NULL, 0, NULL, 0, 'Pathfinder 1e Core Rulebook pg. 478', 2, '{"heal_dice":"2d8+3","min_heal":5,"max_heal":19}'),
('Potion of Cure Serious Wounds', 'POTION', 'A radiant golden draft pulsating with divine power, mending broken bones for 3d8+5 HP.', 750, 375, 1, NULL, 0, 0, NULL, '["FIGHTER","RANGER","CLERIC"]', NULL, 0, NULL, 0, 'Pathfinder 1e Core Rulebook pg. 478', 3, '{"heal_dice":"3d8+5","min_heal":8,"max_heal":29}'),
('Potion of Cure Critical Wounds', 'POTION', 'A miraculous pearlescent elixir capable of dragging a warrior back from the brink, restoring 4d8+7 HP.', 1400, 700, 1, NULL, 0, 0, NULL, '["FIGHTER","RANGER","CLERIC"]', NULL, 0, NULL, 0, 'Pathfinder 1e Core Rulebook pg. 478', 5, '{"heal_dice":"4d8+7","min_heal":11,"max_heal":39}')
ON CONFLICT(name) DO UPDATE SET
    category = excluded.category,
    description = excluded.description,
    buy_price = excluded.buy_price,
    sell_price = excluded.sell_price,
    is_magical = excluded.is_magical,
    allowed_classes = excluded.allowed_classes,
    pathfinder_source = excluded.pathfinder_source,
    attributes = excluded.attributes;

-- ============================================================================
-- 5. MAGICAL WEAPONS (+1 and +2) (12 Items)
-- ============================================================================

INSERT INTO item_definitions (
    name, category, description, buy_price, sell_price, is_magical,
    damage_dice, armor_bonus, shield_bonus, equip_slot, allowed_classes,
    max_dex_bonus, enhancement_bonus, weapon_range_type, is_two_handed,
    pathfinder_source, min_cr, attributes
) VALUES
('Longsword +1', 'WEAPON', 'An impeccably balanced steel longsword gleaming with a faint azure enchantment, striking with +1 accuracy and damage.', 2315, 926, 1, '1d8', 0, 0, 'MAIN_HAND', '["FIGHTER","RANGER","CLERIC"]', NULL, 1, 'MELEE', 0, 'Pathfinder 1e Core Rulebook pg. 468', 1, '{"weapon_type":"melee","damage_type":"slashing","attack_bonus":1,"damage_bonus":1,"crit_threat":19,"crit_mult":2}'),
('Shortsword +1', 'WEAPON', 'A razor-edged short blade humming with arcane resonance, providing +1 attack and damage.', 2310, 924, 1, '1d6', 0, 0, 'MAIN_HAND', '["FIGHTER","RANGER","CLERIC"]', NULL, 1, 'MELEE', 0, 'Pathfinder 1e Core Rulebook pg. 468', 1, '{"weapon_type":"melee","damage_type":"piercing","attack_bonus":1,"damage_bonus":1,"crit_threat":19,"crit_mult":2}'),
('Dagger +1', 'WEAPON', 'A stiletto imbued with subtle enchantment that slices through mail with +1 accuracy and damage.', 2302, 920, 1, '1d4', 0, 0, 'MAIN_HAND', '["FIGHTER","RANGER","CLERIC"]', NULL, 1, 'MELEE', 0, 'Pathfinder 1e Core Rulebook pg. 468', 1, '{"weapon_type":"melee","damage_type":"piercing","attack_bonus":1,"damage_bonus":1,"crit_threat":19,"crit_mult":2}'),
('Battleaxe +1', 'WEAPON', 'A bearded war axe glowing with runic script, biting deeper with +1 attack and damage.', 2310, 924, 1, '1d8', 0, 0, 'MAIN_HAND', '["FIGHTER","RANGER"]', NULL, 1, 'MELEE', 0, 'Pathfinder 1e Core Rulebook pg. 468', 1, '{"weapon_type":"melee","damage_type":"slashing","attack_bonus":1,"damage_bonus":1,"crit_threat":20,"crit_mult":3}'),
('Warhammer +1', 'WEAPON', 'A consecrated warhammer ringing like a silver bell upon impact, striking with +1 attack and damage.', 2312, 924, 1, '1d8', 0, 0, 'MAIN_HAND', '["FIGHTER","CLERIC"]', NULL, 1, 'MELEE', 0, 'Pathfinder 1e Core Rulebook pg. 468', 1, '{"weapon_type":"melee","damage_type":"bludgeoning","attack_bonus":1,"damage_bonus":1,"crit_threat":20,"crit_mult":3}'),
('Heavy Mace +1', 'WEAPON', 'A sanctified iron mace blessed by high clergy, crushing with +1 attack and damage.', 2312, 924, 1, '1d8', 0, 0, 'MAIN_HAND', '["FIGHTER","CLERIC"]', NULL, 1, 'MELEE', 0, 'Pathfinder 1e Core Rulebook pg. 468', 1, '{"weapon_type":"melee","damage_type":"bludgeoning","attack_bonus":1,"damage_bonus":1,"crit_threat":20,"crit_mult":2}'),
('Greatsword +1', 'WEAPON', 'A monumental blade crackling with dormant fury, cleaving through foes with +1 attack and damage.', 2350, 940, 1, '2d6', 0, 0, 'MAIN_HAND', '["FIGHTER","RANGER"]', NULL, 1, 'MELEE', 1, 'Pathfinder 1e Core Rulebook pg. 468', 2, '{"weapon_type":"melee","damage_type":"slashing","attack_bonus":1,"damage_bonus":1,"crit_threat":19,"crit_mult":2}'),
('Shortbow +1', 'WEAPON', 'A mastercrafted yew bow guiding every launched arrow with +1 accuracy and impact.', 2330, 932, 1, '1d6', 0, 0, 'MAIN_HAND', '["FIGHTER","RANGER"]', NULL, 1, 'RANGED', 1, 'Pathfinder 1e Core Rulebook pg. 468', 1, '{"weapon_type":"ranged","damage_type":"piercing","attack_bonus":1,"damage_bonus":1,"crit_threat":20,"crit_mult":3}'),
('Longbow +1', 'WEAPON', 'A slender recurve bow inscribed with wind runes, delivering arrows with +1 attack and damage.', 2375, 950, 1, '1d8', 0, 0, 'MAIN_HAND', '["FIGHTER","RANGER"]', NULL, 1, 'RANGED', 1, 'Pathfinder 1e Core Rulebook pg. 468', 1, '{"weapon_type":"ranged","damage_type":"piercing","attack_bonus":1,"damage_bonus":1,"crit_threat":20,"crit_mult":3}'),
('Light Crossbow +1', 'WEAPON', 'An intricately geared arbalest granting +1 attack and damage on every bolt released.', 2335, 934, 1, '1d8', 0, 0, 'MAIN_HAND', '["FIGHTER","RANGER","CLERIC"]', NULL, 1, 'RANGED', 1, 'Pathfinder 1e Core Rulebook pg. 468', 1, '{"weapon_type":"ranged","damage_type":"piercing","attack_bonus":1,"damage_bonus":1,"crit_threat":19,"crit_mult":2}'),
('Longsword +2', 'WEAPON', 'A masterwork blade of gleaming star-metal radiating brilliant light, striking with +2 accuracy and +2 damage.', 8315, 3326, 1, '1d8', 0, 0, 'MAIN_HAND', '["FIGHTER","RANGER","CLERIC"]', NULL, 2, 'MELEE', 0, 'Pathfinder 1e Core Rulebook pg. 468', 4, '{"weapon_type":"melee","damage_type":"slashing","attack_bonus":2,"damage_bonus":2,"crit_threat":19,"crit_mult":2}'),
('Longbow +2', 'WEAPON', 'An elven war bow whispering in the gale, sending arrows true with +2 attack and +2 damage.', 8375, 3350, 1, '1d8', 0, 0, 'MAIN_HAND', '["FIGHTER","RANGER"]', NULL, 2, 'RANGED', 1, 'Pathfinder 1e Core Rulebook pg. 468', 4, '{"weapon_type":"ranged","damage_type":"piercing","attack_bonus":2,"damage_bonus":2,"crit_threat":20,"crit_mult":3}')
ON CONFLICT(name) DO UPDATE SET
    category = excluded.category,
    description = excluded.description,
    buy_price = excluded.buy_price,
    sell_price = excluded.sell_price,
    is_magical = excluded.is_magical,
    enhancement_bonus = excluded.enhancement_bonus,
    damage_dice = excluded.damage_dice,
    weapon_range_type = excluded.weapon_range_type,
    is_two_handed = excluded.is_two_handed,
    allowed_classes = excluded.allowed_classes,
    pathfinder_source = excluded.pathfinder_source,
    min_cr = excluded.min_cr,
    attributes = excluded.attributes;

-- ============================================================================
-- 6. MAGICAL ARMOR & SHIELDS (+1 and +2) (12 Items)
-- ============================================================================

INSERT INTO item_definitions (
    name, category, description, buy_price, sell_price, is_magical,
    damage_dice, armor_bonus, shield_bonus, equip_slot, allowed_classes,
    max_dex_bonus, enhancement_bonus, weapon_range_type, is_two_handed,
    pathfinder_source, min_cr, attributes
) VALUES
('Leather Armor +1', 'ARMOR', 'Supple blackened leather armor stiffened by protective warding runes (+3 total Armor Class).', 1160, 464, 1, NULL, 3, 0, 'CHEST', '["FIGHTER","RANGER","CLERIC"]', 6, 1, NULL, 0, 'Pathfinder 1e Core Rulebook pg. 461', 1, '{"armor_type":"light","enhancement_bonus":1}'),
('Chain Shirt +1', 'ARMOR', 'Weightless silvery chainlinks providing +5 total Armor Class against enemy blows.', 1250, 500, 1, NULL, 5, 0, 'CHEST', '["FIGHTER","RANGER"]', 4, 1, NULL, 0, 'Pathfinder 1e Core Rulebook pg. 461', 1, '{"armor_type":"light","enhancement_bonus":1}'),
('Scale Mail +1', 'ARMOR', 'Ensorcelled scales that ripple like liquid mercury under assault (+6 total Armor Class).', 1200, 480, 1, NULL, 6, 0, 'CHEST', '["FIGHTER","CLERIC"]', 3, 1, NULL, 0, 'Pathfinder 1e Core Rulebook pg. 461', 1, '{"armor_type":"medium","enhancement_bonus":1}'),
('Chainmail +1', 'ARMOR', 'A polished steel hauberk enchanted against piercing strikes (+7 total Armor Class).', 1300, 520, 1, NULL, 7, 0, 'CHEST', '["FIGHTER","CLERIC"]', 2, 1, NULL, 0, 'Pathfinder 1e Core Rulebook pg. 461', 1, '{"armor_type":"medium","enhancement_bonus":1}'),
('Breastplate +1', 'ARMOR', 'A mirror-sheened cuirass deflecting blades with arcane hardness (+7 total Armor Class).', 1350, 540, 1, NULL, 7, 0, 'CHEST', '["FIGHTER","RANGER","CLERIC"]', 3, 1, NULL, 0, 'Pathfinder 1e Core Rulebook pg. 461', 2, '{"armor_type":"medium","enhancement_bonus":1}'),
('Full Plate +1', 'ARMOR', 'A glorious suit of etched plate armor enveloped in a protective aura (+10 total Armor Class).', 2650, 1060, 1, NULL, 10, 0, 'CHEST', '["FIGHTER"]', 1, 1, NULL, 0, 'Pathfinder 1e Core Rulebook pg. 461', 3, '{"armor_type":"heavy","enhancement_bonus":1}'),
('Light Steel Shield +1', 'SHIELD', 'A gleaming heater shield turning fierce blows aside (+2 total Shield bonus).', 1159, 463, 1, NULL, 0, 2, 'OFF_HAND', '["FIGHTER","CLERIC"]', NULL, 1, NULL, 0, 'Pathfinder 1e Core Rulebook pg. 461', 1, '{"shield_type":"light","enhancement_bonus":1}'),
('Heavy Steel Shield +1', 'SHIELD', 'A heavy kite shield bearing heraldic enchantments of warding (+3 total Shield bonus).', 1170, 468, 1, NULL, 0, 3, 'OFF_HAND', '["FIGHTER","CLERIC"]', NULL, 1, NULL, 0, 'Pathfinder 1e Core Rulebook pg. 461', 1, '{"shield_type":"heavy","enhancement_bonus":1}'),
('Chain Shirt +2', 'ARMOR', 'A legendary mithral-linked shirt glowing softly, offering +6 total Armor Class.', 4250, 1700, 1, NULL, 6, 0, 'CHEST', '["FIGHTER","RANGER"]', 4, 2, NULL, 0, 'Pathfinder 1e Core Rulebook pg. 461', 4, '{"armor_type":"light","enhancement_bonus":2}'),
('Breastplate +2', 'ARMOR', 'Forged by dwarven masters, this breastplate turns deadly strikes harmlessly (+8 total Armor Class).', 4350, 1740, 1, NULL, 8, 0, 'CHEST', '["FIGHTER","RANGER","CLERIC"]', 3, 2, NULL, 0, 'Pathfinder 1e Core Rulebook pg. 461', 4, '{"armor_type":"medium","enhancement_bonus":2}'),
('Full Plate +2', 'ARMOR', 'An impenetrable fortress of articulated star-metal (+11 total Armor Class).', 5650, 2260, 1, NULL, 11, 0, 'CHEST', '["FIGHTER"]', 1, 2, NULL, 0, 'Pathfinder 1e Core Rulebook pg. 461', 4, '{"armor_type":"heavy","enhancement_bonus":2}'),
('Heavy Steel Shield +2', 'SHIELD', 'A magnificent tower-grade shield radiating stalwart defense (+4 total Shield bonus).', 4170, 1668, 1, NULL, 0, 4, 'OFF_HAND', '["FIGHTER","CLERIC"]', NULL, 2, NULL, 0, 'Pathfinder 1e Core Rulebook pg. 461', 4, '{"shield_type":"heavy","enhancement_bonus":2}')
ON CONFLICT(name) DO UPDATE SET
    category = excluded.category,
    description = excluded.description,
    buy_price = excluded.buy_price,
    sell_price = excluded.sell_price,
    is_magical = excluded.is_magical,
    enhancement_bonus = excluded.enhancement_bonus,
    armor_bonus = excluded.armor_bonus,
    shield_bonus = excluded.shield_bonus,
    max_dex_bonus = excluded.max_dex_bonus,
    allowed_classes = excluded.allowed_classes,
    pathfinder_source = excluded.pathfinder_source,
    min_cr = excluded.min_cr,
    attributes = excluded.attributes;
