-- 007_seed_expanded_items_and_loot_tables.sql: Expanded Items (Consumables, Treasures, Wondrous Items) & Loot Tables
-- Expands Darkgrid item catalog to 113 items across all required categories.

-- ============================================================================
-- 0. POPULATE AUTHENTIC RARITY AND SUBTYPES FOR BASE PATHFINDER ITEMS (83 items)
-- ============================================================================

UPDATE item_definitions SET rarity = 'COMMON', subtype = 'DAGGER' WHERE name = 'Dagger';
UPDATE item_definitions SET rarity = 'COMMON', subtype = 'SWORD' WHERE name = 'Shortsword';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'SWORD' WHERE name = 'Longsword';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'SWORD' WHERE name = 'Greatsword';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'AXE' WHERE name = 'Battleaxe';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'AXE' WHERE name = 'Greataxe';
UPDATE item_definitions SET rarity = 'COMMON', subtype = 'AXE' WHERE name = 'Handaxe';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'HAMMER' WHERE name = 'Warhammer';
UPDATE item_definitions SET rarity = 'COMMON', subtype = 'MACE' WHERE name = 'Light Mace';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'MACE' WHERE name = 'Heavy Mace';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'MACE' WHERE name = 'Morningstar';
UPDATE item_definitions SET rarity = 'COMMON', subtype = 'SPEAR' WHERE name = 'Spear';
UPDATE item_definitions SET rarity = 'COMMON', subtype = 'SPEAR' WHERE name = 'Shortspear';
UPDATE item_definitions SET rarity = 'COMMON', subtype = 'STAFF' WHERE name = 'Quarterstaff';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'POLEARM' WHERE name = 'Halberd';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'POLEARM' WHERE name = 'Scythe';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'FLAIL' WHERE name = 'Heavy Flail';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'FLAIL' WHERE name = 'Light Flail';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'SWORD' WHERE name = 'Scimitar';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'SWORD' WHERE name = 'Rapier';
UPDATE item_definitions SET rarity = 'COMMON', subtype = 'CLUB' WHERE name = 'Club';
UPDATE item_definitions SET rarity = 'COMMON', subtype = 'CLUB' WHERE name = 'Greatclub';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'POLEARM' WHERE name = 'Glaive';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'SWORD' WHERE name = 'Falchion';

UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'BOW' WHERE name = 'Shortbow';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'BOW' WHERE name = 'Longbow';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'BOW' WHERE name = 'Composite Shortbow';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'BOW' WHERE name = 'Composite Longbow';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'CROSSBOW' WHERE name = 'Light Crossbow';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'CROSSBOW' WHERE name = 'Heavy Crossbow';
UPDATE item_definitions SET rarity = 'RARE', subtype = 'CROSSBOW' WHERE name = 'Hand Crossbow';
UPDATE item_definitions SET rarity = 'COMMON', subtype = 'SLING' WHERE name = 'Sling';
UPDATE item_definitions SET rarity = 'COMMON', subtype = 'THROWN' WHERE name = 'Javelin';
UPDATE item_definitions SET rarity = 'COMMON', subtype = 'THROWN' WHERE name = 'Dart';

UPDATE item_definitions SET rarity = 'COMMON', subtype = 'LIGHT_ARMOR' WHERE name = 'Padded Armor';
UPDATE item_definitions SET rarity = 'COMMON', subtype = 'LIGHT_ARMOR' WHERE name = 'Leather Armor';
UPDATE item_definitions SET rarity = 'COMMON', subtype = 'LIGHT_ARMOR' WHERE name = 'Studded Leather Armor';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'LIGHT_ARMOR' WHERE name = 'Chain Shirt';
UPDATE item_definitions SET rarity = 'COMMON', subtype = 'MEDIUM_ARMOR' WHERE name = 'Hide Armor';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'MEDIUM_ARMOR' WHERE name = 'Scale Mail';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'MEDIUM_ARMOR' WHERE name = 'Chainmail';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'MEDIUM_ARMOR' WHERE name = 'Breastplate';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'HEAVY_ARMOR' WHERE name = 'Splint Mail';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'HEAVY_ARMOR' WHERE name = 'Banded Mail';
UPDATE item_definitions SET rarity = 'RARE', subtype = 'HEAVY_ARMOR' WHERE name = 'Half-Plate';
UPDATE item_definitions SET rarity = 'RARE', subtype = 'HEAVY_ARMOR' WHERE name = 'Full Plate';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'MEDIUM_ARMOR' WHERE name = 'Armored Coat';
UPDATE item_definitions SET rarity = 'RARE', subtype = 'MEDIUM_ARMOR' WHERE name = 'Agile Breastplate';

UPDATE item_definitions SET rarity = 'COMMON', subtype = 'SHIELD' WHERE name = 'Buckler';
UPDATE item_definitions SET rarity = 'COMMON', subtype = 'SHIELD' WHERE name = 'Light Wooden Shield';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'SHIELD' WHERE name = 'Light Steel Shield';
UPDATE item_definitions SET rarity = 'COMMON', subtype = 'SHIELD' WHERE name = 'Heavy Wooden Shield';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'SHIELD' WHERE name = 'Heavy Steel Shield';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'SHIELD' WHERE name = 'Tower Shield';

UPDATE item_definitions SET rarity = 'COMMON', subtype = 'HEALING_POTION' WHERE name = 'Minor Healing Potion';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'HEALING_POTION' WHERE name = 'Potion of Cure Light Wounds';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'HEALING_POTION' WHERE name = 'Potion of Cure Moderate Wounds';
UPDATE item_definitions SET rarity = 'RARE', subtype = 'HEALING_POTION' WHERE name = 'Potion of Cure Serious Wounds';
UPDATE item_definitions SET rarity = 'RARE', subtype = 'HEALING_POTION' WHERE name = 'Potion of Cure Critical Wounds';

UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'SWORD' WHERE name = 'Longsword +1';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'SWORD' WHERE name = 'Shortsword +1';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'DAGGER' WHERE name = 'Dagger +1';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'AXE' WHERE name = 'Battleaxe +1';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'HAMMER' WHERE name = 'Warhammer +1';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'MACE' WHERE name = 'Heavy Mace +1';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'SWORD' WHERE name = 'Greatsword +1';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'BOW' WHERE name = 'Shortbow +1';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'BOW' WHERE name = 'Longbow +1';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'CROSSBOW' WHERE name = 'Light Crossbow +1';
UPDATE item_definitions SET rarity = 'RARE', subtype = 'SWORD' WHERE name = 'Longsword +2';
UPDATE item_definitions SET rarity = 'RARE', subtype = 'BOW' WHERE name = 'Longbow +2';

UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'LIGHT_ARMOR' WHERE name = 'Leather Armor +1';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'LIGHT_ARMOR' WHERE name = 'Chain Shirt +1';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'MEDIUM_ARMOR' WHERE name = 'Scale Mail +1';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'MEDIUM_ARMOR' WHERE name = 'Chainmail +1';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'MEDIUM_ARMOR' WHERE name = 'Breastplate +1';
UPDATE item_definitions SET rarity = 'RARE', subtype = 'HEAVY_ARMOR' WHERE name = 'Full Plate +1';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'SHIELD' WHERE name = 'Light Steel Shield +1';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'SHIELD' WHERE name = 'Heavy Steel Shield +1';
UPDATE item_definitions SET rarity = 'RARE', subtype = 'LIGHT_ARMOR' WHERE name = 'Chain Shirt +2';
UPDATE item_definitions SET rarity = 'RARE', subtype = 'MEDIUM_ARMOR' WHERE name = 'Breastplate +2';
UPDATE item_definitions SET rarity = 'RARE', subtype = 'HEAVY_ARMOR' WHERE name = 'Full Plate +2';
UPDATE item_definitions SET rarity = 'RARE', subtype = 'SHIELD' WHERE name = 'Heavy Steel Shield +2';

-- ============================================================================
-- 1. EXPANDED POTIONS & CONSUMABLES (8 Items)
-- ============================================================================

INSERT INTO item_definitions (
    name, category, description, buy_price, sell_price, is_magical,
    damage_dice, armor_bonus, shield_bonus, equip_slot, allowed_classes,
    max_dex_bonus, enhancement_bonus, weapon_range_type, is_two_handed,
    pathfinder_source, min_cr, rarity, subtype, attributes
) VALUES
(
    'Potion of Barkskin',
    'POTION',
    'A thick, earthy draft tasting of moss and amber sap. Toughens the skin like seasoned oak bark, granting +2 AC protection.',
    300, 150, 1,
    NULL, 2, 0, NULL, '["FIGHTER","RANGER","CLERIC"]',
    NULL, 0, NULL, 0,
    'Pathfinder 1e Core Rulebook pg. 478', 1, 'UNCOMMON', 'BUFF_POTION',
    '{"potion_type":"buff","stat":"ac","bonus":2,"heal_dice":"0","description":"Toughens the skin like seasoned oak bark, restoring 0 HP and bolstering defense."}'
),
(
    'Potion of Bull''s Strength',
    'POTION',
    'A swirling crimson elixir emitting steam. Infuses the drinker with the brute vigor and ferocious strength of a minotaur.',
    300, 150, 1,
    NULL, 0, 0, NULL, '["FIGHTER","RANGER","CLERIC"]',
    NULL, 0, NULL, 0,
    'Pathfinder 1e Core Rulebook pg. 478', 1, 'UNCOMMON', 'BUFF_POTION',
    '{"potion_type":"buff","stat":"strength","bonus":4,"heal_dice":"0","description":"Infuses the drinker with the brute vigor of a minotaur."}'
),
(
    'Potion of Cat''s Grace',
    'POTION',
    'A silky silver tincture that glides smoothly down the throat, bestowing uncanny feline balance, agility, and lightning reflexes.',
    300, 150, 1,
    NULL, 0, 0, NULL, '["FIGHTER","RANGER","CLERIC"]',
    NULL, 0, NULL, 0,
    'Pathfinder 1e Core Rulebook pg. 478', 1, 'UNCOMMON', 'BUFF_POTION',
    '{"potion_type":"buff","stat":"dexterity","bonus":4,"heal_dice":"0","description":"Bestows uncanny feline balance and reflexes."}'
),
(
    'Potion of Shield of Faith',
    'POTION',
    'A pale luminescent water blessed in solemn rites, surrounding the drinker with a shimmering barrier of sacred deflection.',
    150, 75, 1,
    NULL, 2, 0, NULL, '["FIGHTER","RANGER","CLERIC"]',
    NULL, 0, NULL, 0,
    'Pathfinder 1e Core Rulebook pg. 479', 1, 'UNCOMMON', 'BUFF_POTION',
    '{"potion_type":"buff","stat":"ac","bonus":2,"heal_dice":"0","description":"Surrounds the drinker with shimmering divine deflection."}'
),
(
    'Potion of Heroism',
    'POTION',
    'A radiant golden vintage that banishes all dread, steeling heart and sinew with heroic courage (+2 Attack and Saves).',
    750, 375, 1,
    NULL, 0, 0, NULL, '["FIGHTER","RANGER","CLERIC"]',
    NULL, 0, NULL, 0,
    'Pathfinder 1e Core Rulebook pg. 478', 3, 'RARE', 'BUFF_POTION',
    '{"potion_type":"buff","stat":"attack","bonus":2,"heal_dice":"0","description":"Banishes all dread, steeling heart and sinew with heroic courage."}'
),
(
    'Elixir of Dragon''s Breath',
    'POTION',
    'An volatile orange draft trapped in blown glass. When consumed, searing flame wells up to unleash a devastating thermal burst.',
    800, 400, 1,
    NULL, 0, 0, NULL, '["FIGHTER","RANGER","CLERIC"]',
    NULL, 0, NULL, 0,
    'Pathfinder 1e Ultimate Equipment pg. 302', 3, 'RARE', 'OFFENSIVE_CONSUMABLE',
    '{"potion_type":"offensive","damage_dice":"3d6","damage_type":"fire","heal_dice":"0","description":"Searing flame wells up to unleash a devastating thermal burst (3d6 fire)."}'
),
(
    'Antitoxin',
    'POTION',
    'A bitter dark herbal draught brewed from bitterroot and charcoal to neutralize venoms and purge internal toxins.',
    50, 25, 0,
    NULL, 0, 0, NULL, '["FIGHTER","RANGER","CLERIC"]',
    NULL, 0, NULL, 0,
    'Pathfinder 1e Core Rulebook pg. 159', 0, 'COMMON', 'ALCHEMICAL',
    '{"potion_type":"alchemical","cure_type":"poison","heal_dice":"0","description":"Neutralizes venom and purges toxins. Poison mechanism pending future release."}'
),
(
    'Draught of Troll''s Blood',
    'POTION',
    'An incandescent crimson serum that violently knits torn muscle and mends shattered bone, restoring 5d8+10 Vitality HP.',
    1800, 900, 1,
    NULL, 0, 0, NULL, '["FIGHTER","RANGER","CLERIC"]',
    NULL, 0, NULL, 0,
    'Pathfinder 1e Ultimate Equipment pg. 305', 5, 'EPIC', 'HEALING_POTION',
    '{"potion_type":"healing","heal_dice":"5d8+10","min_heal":15,"max_heal":50,"description":"Violently knits torn muscle and mends bone, restoring 5d8+10 HP."}'
)
ON CONFLICT(name) DO UPDATE SET
    category = excluded.category,
    description = excluded.description,
    buy_price = excluded.buy_price,
    sell_price = excluded.sell_price,
    is_magical = excluded.is_magical,
    allowed_classes = excluded.allowed_classes,
    pathfinder_source = excluded.pathfinder_source,
    min_cr = excluded.min_cr,
    rarity = excluded.rarity,
    subtype = excluded.subtype,
    attributes = excluded.attributes;

-- ============================================================================
-- 2. TREASURE & VALUABLES (14 Items)
-- ============================================================================

INSERT INTO item_definitions (
    name, category, description, buy_price, sell_price, is_magical,
    damage_dice, armor_bonus, shield_bonus, equip_slot, allowed_classes,
    max_dex_bonus, enhancement_bonus, weapon_range_type, is_two_handed,
    pathfinder_source, min_cr, rarity, subtype, attributes
) VALUES
(
    'Uncut Garnet',
    'OTHER',
    'A raw, unpolished deep-red garnet recovered from mountain mineral veins, sparkling faintly in the firelight.',
    50, 25, 0,
    NULL, 0, 0, NULL, '["FIGHTER","RANGER","CLERIC"]',
    NULL, 0, NULL, 0,
    'Pathfinder 1e Core Rulebook pg. 399', 0, 'COMMON', 'TREASURE',
    '{"treasure_type":"gemstone","appraised_value":50}'
),
(
    'Polished Bloodstone',
    'OTHER',
    'A smooth, dark-green jasper pebble speckled with bright crimson iron oxide spots. Favored by ancient clerics as a talisman.',
    100, 50, 0,
    NULL, 0, 0, NULL, '["FIGHTER","RANGER","CLERIC"]',
    NULL, 0, NULL, 0,
    'Pathfinder 1e Core Rulebook pg. 399', 0, 'COMMON', 'TREASURE',
    '{"treasure_type":"gemstone","appraised_value":100}'
),
(
    'Rough Emerald',
    'OTHER',
    'A vivid green hexagonal beryl crystal extracted from deep underground caverns, prized by jewelers and arcanists alike.',
    250, 125, 0,
    NULL, 0, 0, NULL, '["FIGHTER","RANGER","CLERIC"]',
    NULL, 0, NULL, 0,
    'Pathfinder 1e Core Rulebook pg. 399', 1, 'UNCOMMON', 'TREASURE',
    '{"treasure_type":"gemstone","appraised_value":250}'
),
(
    'Flawless Sapphire',
    'OTHER',
    'A brilliant celestial-blue corundum gemstone without inclusions or flaws, refracting lantern light into piercing blue rays.',
    500, 250, 0,
    NULL, 0, 0, NULL, '["FIGHTER","RANGER","CLERIC"]',
    NULL, 0, NULL, 0,
    'Pathfinder 1e Core Rulebook pg. 399', 2, 'RARE', 'TREASURE',
    '{"treasure_type":"gemstone","appraised_value":500}'
),
(
    'Star Ruby',
    'OTHER',
    'An exceptionally rare cabochon ruby exhibiting a sharp, six-rayed asterism dancing across its blood-red surface.',
    1200, 600, 0,
    NULL, 0, 0, NULL, '["FIGHTER","RANGER","CLERIC"]',
    NULL, 0, NULL, 0,
    'Pathfinder 1e Core Rulebook pg. 399', 4, 'EPIC', 'TREASURE',
    '{"treasure_type":"gemstone","appraised_value":1200}'
),
(
    'Ancient Silver Chalice',
    'OTHER',
    'An ornate sterling drinking vessel salvaged from forgotten catacombs, engraved with the faded heraldry of an extinct dynasty.',
    150, 75, 0,
    NULL, 0, 0, NULL, '["FIGHTER","RANGER","CLERIC"]',
    NULL, 0, NULL, 0,
    'Pathfinder 1e Core Rulebook pg. 399', 1, 'UNCOMMON', 'TREASURE',
    '{"treasure_type":"art_object","appraised_value":150}'
),
(
    'Gilded Reliquary',
    'OTHER',
    'A heavy sandalwood casket overlaid with embossed gold leaf and ivory filigree, crafted to safeguard sacred saintly relics.',
    450, 225, 0,
    NULL, 0, 0, NULL, '["FIGHTER","RANGER","CLERIC"]',
    NULL, 0, NULL, 0,
    'Pathfinder 1e Core Rulebook pg. 399', 2, 'RARE', 'TREASURE',
    '{"treasure_type":"art_object","appraised_value":450}'
),
(
    'Carved Mammoth Tusk',
    'OTHER',
    'A heavy fossilized tusk from a prehistoric tundra beast, painstakingly etched with primeval hunting and war scenes.',
    200, 100, 0,
    NULL, 0, 0, NULL, '["FIGHTER","RANGER","CLERIC"]',
    NULL, 0, NULL, 0,
    'Pathfinder 1e Core Rulebook pg. 399', 1, 'UNCOMMON', 'TREASURE',
    '{"treasure_type":"trophy","appraised_value":200}'
),
(
    'Jeweled Ceremonial Dagger',
    'OTHER',
    'A ceremonial blade forged of soft gilded silver and studded with small rubies. Unsuited for combat, but highly valuable to collectors.',
    350, 175, 0,
    NULL, 0, 0, NULL, '["FIGHTER","RANGER","CLERIC"]',
    NULL, 0, NULL, 0,
    'Pathfinder 1e Core Rulebook pg. 399', 1, 'RARE', 'TREASURE',
    '{"treasure_type":"art_object","appraised_value":350}'
),
(
    'Amber Dragon Tear',
    'OTHER',
    'Petrified golden dragon resin enclosing a spark of dormant elemental heat, radiating faint warmth when cradled in hand.',
    600, 300, 0,
    NULL, 0, 0, NULL, '["FIGHTER","RANGER","CLERIC"]',
    NULL, 0, NULL, 0,
    'Pathfinder 1e Core Rulebook pg. 399', 3, 'RARE', 'TREASURE',
    '{"treasure_type":"relic","appraised_value":600}'
),
(
    'Royal Signet Ring',
    'OTHER',
    'A heavy electrum signet ring bearing an onyx intaglio crest from the shattered kingdoms of the North.',
    180, 90, 0,
    NULL, 0, 0, NULL, '["FIGHTER","RANGER","CLERIC"]',
    NULL, 0, NULL, 0,
    'Pathfinder 1e Core Rulebook pg. 399', 1, 'UNCOMMON', 'TREASURE',
    '{"treasure_type":"jewelry","appraised_value":180}'
),
(
    'Obsidian Runestone',
    'OTHER',
    'A dark, mirror-smooth volcanic tablet deeply etched with angular abyssal runes that absorb the surrounding torchlight.',
    120, 60, 0,
    NULL, 0, 0, NULL, '["FIGHTER","RANGER","CLERIC"]',
    NULL, 0, NULL, 0,
    'Pathfinder 1e Core Rulebook pg. 399', 1, 'UNCOMMON', 'TREASURE',
    '{"treasure_type":"relic","appraised_value":120}'
),
(
    'Silk Brocade Tapestry',
    'OTHER',
    'A rolled heirloom wall-hanging woven with silver threads and midnight-blue dyes, depicting celestial stars and astral paths.',
    400, 200, 0,
    NULL, 0, 0, NULL, '["FIGHTER","RANGER","CLERIC"]',
    NULL, 0, NULL, 0,
    'Pathfinder 1e Core Rulebook pg. 399', 2, 'RARE', 'TREASURE',
    '{"treasure_type":"art_object","appraised_value":400}'
),
(
    'Crown of the Sunken King',
    'OTHER',
    'An ancient coronet of tarnished platinum encrusted with black pearls, dredged from the fathomless deeps of lost sunken realms.',
    5000, 2500, 0,
    NULL, 0, 0, NULL, '["FIGHTER","RANGER","CLERIC"]',
    NULL, 0, NULL, 0,
    'Pathfinder 1e Core Rulebook pg. 400', 5, 'LEGENDARY', 'TREASURE',
    '{"treasure_type":"relic","appraised_value":5000}'
)
ON CONFLICT(name) DO UPDATE SET
    category = excluded.category,
    description = excluded.description,
    buy_price = excluded.buy_price,
    sell_price = excluded.sell_price,
    is_magical = excluded.is_magical,
    allowed_classes = excluded.allowed_classes,
    pathfinder_source = excluded.pathfinder_source,
    min_cr = excluded.min_cr,
    rarity = excluded.rarity,
    subtype = excluded.subtype,
    attributes = excluded.attributes;

-- ============================================================================
-- 3. MAGICAL EQUIPMENT & WONDROUS ACCESSORIES (8 Items)
-- ============================================================================

INSERT INTO item_definitions (
    name, category, description, buy_price, sell_price, is_magical,
    damage_dice, armor_bonus, shield_bonus, equip_slot, allowed_classes,
    max_dex_bonus, enhancement_bonus, weapon_range_type, is_two_handed,
    pathfinder_source, min_cr, rarity, subtype, attributes
) VALUES
(
    'Ring of Protection +1',
    'OTHER',
    'A slender platinum ring shimmering with an abjuration aura, projecting an invisible force field that deflects strikes (+1 Armor Class).',
    2000, 800, 1,
    NULL, 1, 0, 'RING', '["FIGHTER","RANGER","CLERIC"]',
    NULL, 1, NULL, 0,
    'Pathfinder 1e Core Rulebook pg. 479', 2, 'RARE', 'ACCESSORY',
    '{"equip_slot":"RING","armor_bonus":1,"description":"Projects an invisible deflection force field granting +1 AC."}'
),
(
    'Cloak of Resistance +1',
    'OTHER',
    'A weathered gray wool cloak inscribed with protective runes along the hem, warding the wearer against hazards and magical effects.',
    1000, 400, 1,
    NULL, 0, 0, 'CLOAK', '["FIGHTER","RANGER","CLERIC"]',
    NULL, 1, NULL, 0,
    'Pathfinder 1e Core Rulebook pg. 505', 1, 'UNCOMMON', 'ACCESSORY',
    '{"equip_slot":"CLOAK","description":"Wards the wearer against hazards and magical effects."}'
),
(
    'Amulet of Natural Armor +1',
    'OTHER',
    'A heavy iron pendant carved with a ferocious bear skull, magically toughening the wearer''s flesh and sinew (+1 Armor Class).',
    2000, 800, 1,
    NULL, 1, 0, 'NECK', '["FIGHTER","RANGER","CLERIC"]',
    NULL, 1, NULL, 0,
    'Pathfinder 1e Core Rulebook pg. 497', 2, 'RARE', 'ACCESSORY',
    '{"equip_slot":"NECK","armor_bonus":1,"description":"Magically toughens the wearers flesh granting +1 natural AC."}'
),
(
    'Bracers of Armor +1',
    'ARMOR',
    'Finely tooled leather bracers reinforced with runic silver studs, surrounding the wearer with tangible armor-like deflection (+1 AC).',
    1000, 400, 1,
    NULL, 1, 0, 'CHEST', '["FIGHTER","RANGER","CLERIC"]',
    NULL, 1, NULL, 0,
    'Pathfinder 1e Core Rulebook pg. 501', 1, 'UNCOMMON', 'LIGHT_ARMOR',
    '{"armor_type":"light","armor_bonus":1,"enhancement_bonus":1,"description":"Surrounds the wearer with tangible armor-like deflection (+1 AC)."}'
),
(
    'Belt of Giant Strength +2',
    'OTHER',
    'A broad, supple ox-hide girdle fastened with an iron buckle, imbuing the bearer with the raw physical muscle of a mountain giant.',
    4000, 1600, 1,
    NULL, 0, 0, 'BELT', '["FIGHTER","RANGER","CLERIC"]',
    NULL, 2, NULL, 0,
    'Pathfinder 1e Core Rulebook pg. 499', 3, 'RARE', 'ACCESSORY',
    '{"equip_slot":"BELT","strength_bonus":2,"description":"Broad ox-hide girdle imbuing the bearer with raw giant muscle."}'
),
(
    'Boots of Elvenkind',
    'OTHER',
    'Supple calfskin boots dyed the color of autumn leaves, muffling all footfalls and enabling uncanny stealth across harsh terrain.',
    2500, 1000, 1,
    NULL, 0, 0, 'FEET', '["FIGHTER","RANGER","CLERIC"]',
    NULL, 0, NULL, 0,
    'Pathfinder 1e Core Rulebook pg. 501', 2, 'UNCOMMON', 'ACCESSORY',
    '{"equip_slot":"FEET","description":"Supple calfskin boots muffling all footfalls across harsh terrain. Stealth system pending future release."}'
),
(
    'Holy Avenger +3',
    'WEAPON',
    'An ancient mithral broadsword radiating blazing sanctified light, cleaving evil aberrations and undead with +3 lethal fury.',
    18000, 7200, 1,
    '1d8', 0, 0, 'MAIN_HAND', '["FIGHTER","CLERIC"]',
    NULL, 3, 'MELEE', 0,
    'Pathfinder 1e Core Rulebook pg. 473', 5, 'LEGENDARY', 'SWORD',
    '{"weapon_type":"melee","damage_type":"slashing","attack_bonus":3,"damage_bonus":3,"crit_threat":19,"crit_mult":2,"description":"Radiates blazing sanctified light with +3 attack and damage."}'
),
(
    'Oathbow +3',
    'WEAPON',
    'A pristine white composite war bow crafted from sacred elven heartwood. It whispers death to hated quarry with +3 pinpoint accuracy.',
    18000, 7200, 1,
    '1d8', 0, 0, 'MAIN_HAND', '["FIGHTER","RANGER"]',
    NULL, 3, 'RANGED', 1,
    'Pathfinder 1e Core Rulebook pg. 473', 5, 'LEGENDARY', 'BOW',
    '{"weapon_type":"ranged","damage_type":"piercing","attack_bonus":3,"damage_bonus":3,"crit_threat":20,"crit_mult":3,"description":"Whispers death to hated quarry with +3 pinpoint accuracy and damage."}'
)
ON CONFLICT(name) DO UPDATE SET
    category = excluded.category,
    description = excluded.description,
    buy_price = excluded.buy_price,
    sell_price = excluded.sell_price,
    is_magical = excluded.is_magical,
    damage_dice = excluded.damage_dice,
    armor_bonus = excluded.armor_bonus,
    shield_bonus = excluded.shield_bonus,
    equip_slot = excluded.equip_slot,
    allowed_classes = excluded.allowed_classes,
    max_dex_bonus = excluded.max_dex_bonus,
    enhancement_bonus = excluded.enhancement_bonus,
    weapon_range_type = excluded.weapon_range_type,
    is_two_handed = excluded.is_two_handed,
    pathfinder_source = excluded.pathfinder_source,
    min_cr = excluded.min_cr,
    rarity = excluded.rarity,
    subtype = excluded.subtype,
    attributes = excluded.attributes;

-- ============================================================================
-- 4. DATA-DRIVEN LOOT TABLES
-- ============================================================================

INSERT INTO loot_tables (
    code, name, creature_type, min_cr, max_cr, gold_multiplier, item_chance, magic_chance_multiplier, description
) VALUES
(
    'HUMANOID_MUNDANE',
    'Humanoid Low Rank Loot',
    'HUMANOID',
    0.0, 2.0,
    1.0, 0.35, 0.8,
    'Scouts, bandits, and raiders carrying standard martial weapons, leather, potions, and coin.'
),
(
    'HUMANOID_ELITE',
    'Humanoid Veteran Loot',
    'HUMANOID',
    2.1, 99.0,
    1.5, 0.50, 1.5,
    'Captains, champions, and heavily armored warlords carrying quality arms, mail, and jewels.'
),
(
    'UNDEAD_HAUNT',
    'Undead Tomb Remains',
    'UNDEAD',
    0.0, 3.0,
    0.7, 0.25, 1.0,
    'Crypt skeletons, ghouls, and wraiths bearing ancient relics, grave jewelry, and old blades.'
),
(
    'UNDEAD_ANCIENT',
    'Undead Barrow Lord Hoard',
    'UNDEAD',
    3.1, 99.0,
    1.8, 0.45, 2.0,
    'Lichs, wights, and barrow kings preserving consecrated reliquaries, magical arms, and gemstones.'
),
(
    'MAGICAL_BEAST_LAIR',
    'Magical Beast Trophies',
    'MAGICAL BEAST',
    0.5, 99.0,
    1.2, 0.40, 1.2,
    'Primal predators whose lairs contain harvested tusks, dragon tears, gems, and devoured adventurer relics.'
),
(
    'DRAGON_HOARD',
    'Draconic Treasure Hoard',
    'DRAGON',
    3.0, 99.0,
    3.0, 0.80, 3.0,
    'Vast draconic hoards amassed over centuries, rich in legendary gemstones, gold, and enchanted arms.'
),
(
    'ABERRATION_CACHE',
    'Aberrant Void Relics',
    'ABERRATION',
    1.0, 99.0,
    1.0, 0.35, 1.5,
    'Otherworldly entities hoard strange obsidian tablets, alchemical tonics, and eldritch rings.'
),
(
    'GENERIC_WILDERNESS',
    'General Wilderness Remains',
    NULL,
    0.0, 99.0,
    1.0, 0.25, 1.0,
    'Fallback loot distribution representing remnants left by defeated wilderness perils.'
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
-- 5. LOOT TABLE ENTRIES (Linking Tables to Items with Weights)
-- ============================================================================

-- Clean up any entries for items that are temporarily inactive (buff potions, dragon breath, antitoxin, boots, cloak, bracers)
DELETE FROM loot_table_entries WHERE item_definition_id IN (
    SELECT id FROM item_definitions WHERE name IN (
        'Potion of Barkskin',
        'Potion of Bull''s Strength',
        'Potion of Cat''s Grace',
        'Potion of Shield of Faith',
        'Potion of Heroism',
        'Elixir of Dragon''s Breath',
        'Antitoxin',
        'Boots of Elvenkind',
        'Cloak of Resistance +1',
        'Bracers of Armor +1'
    )
);

-- Helper block using correlated subqueries
-- 5a. HUMANOID_MUNDANE Entries
INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 25, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'HUMANOID_MUNDANE' AND id.name IN ('Dagger', 'Shortsword', 'Handaxe', 'Shortbow', 'Leather Armor', 'Studded Leather Armor', 'Buckler');

INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 15, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'HUMANOID_MUNDANE' AND id.name IN ('Minor Healing Potion', 'Uncut Garnet', 'Polished Bloodstone');

-- 5b. HUMANOID_ELITE Entries
INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 20, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'HUMANOID_ELITE' AND id.name IN ('Longsword', 'Battleaxe', 'Heavy Crossbow', 'Chain Shirt', 'Breastplate', 'Heavy Steel Shield');

INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 15, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'HUMANOID_ELITE' AND id.name IN ('Longsword +1', 'Chain Shirt +1', 'Potion of Cure Moderate Wounds', 'Rough Emerald', 'Royal Signet Ring');

-- 5c. UNDEAD_HAUNT Entries
INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 25, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'UNDEAD_HAUNT' AND id.name IN ('Scythe', 'Heavy Flail', 'Morningstar', 'Ancient Silver Chalice', 'Obsidian Runestone', 'Polished Bloodstone');

INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 15, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'UNDEAD_HAUNT' AND id.name IN ('Potion of Cure Light Wounds', 'Uncut Garnet');

-- 5d. UNDEAD_ANCIENT Entries
INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 20, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'UNDEAD_ANCIENT' AND id.name IN ('Ancient Silver Chalice', 'Obsidian Runestone', 'Polished Bloodstone');

INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 15, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'UNDEAD_ANCIENT' AND id.name IN ('Gilded Reliquary', 'Greatsword +1', 'Heavy Mace +1', 'Full Plate +1');

INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 3, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'UNDEAD_ANCIENT' AND id.name = 'Star Ruby';

INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 15, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'UNDEAD_ANCIENT' AND id.name IN ('Ring of Protection +1', 'Potion of Cure Serious Wounds');

-- 5e. MAGICAL_BEAST_LAIR Entries
INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 25, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'MAGICAL_BEAST_LAIR' AND id.name IN ('Carved Mammoth Tusk', 'Amber Dragon Tear', 'Rough Emerald', 'Flawless Sapphire');

INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 15, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'MAGICAL_BEAST_LAIR' AND id.name IN ('Amulet of Natural Armor +1', 'Belt of Giant Strength +2', 'Potion of Cure Serious Wounds');

-- 5f. DRAGON_HOARD Entries
-- Common and Uncommon treasures: the foundation of draconic hoards
INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 25, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'DRAGON_HOARD' AND id.name IN ('Uncut Garnet', 'Polished Bloodstone');

INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 20, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'DRAGON_HOARD' AND id.name IN ('Ancient Silver Chalice', 'Royal Signet Ring', 'Rough Emerald', 'Carved Mammoth Tusk', 'Obsidian Runestone');

-- Rare treasures and valuables
INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 10, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'DRAGON_HOARD' AND id.name IN ('Flawless Sapphire', 'Silk Brocade Tapestry', 'Gilded Reliquary', 'Amber Dragon Tear', 'Jeweled Ceremonial Dagger');

-- Epic gemstones: genuinely scarce
INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 3, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'DRAGON_HOARD' AND id.name = 'Star Ruby';

-- Legendary relics: apex rarity
INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 1, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'DRAGON_HOARD' AND id.name = 'Crown of the Sunken King';

-- Magical Hoard Spoils
INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 20, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'DRAGON_HOARD' AND id.name IN ('Potion of Cure Moderate Wounds', 'Longsword +1', 'Chain Shirt +1', 'Heavy Steel Shield +1');

INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 10, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'DRAGON_HOARD' AND id.name IN ('Potion of Cure Serious Wounds', 'Potion of Cure Critical Wounds', 'Full Plate +1', 'Full Plate +2', 'Belt of Giant Strength +2', 'Ring of Protection +1');

INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 3, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'DRAGON_HOARD' AND id.name = 'Draught of Troll''s Blood';

INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 1, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'DRAGON_HOARD' AND id.name IN ('Holy Avenger +3', 'Oathbow +3');

-- 5g. ABERRATION_CACHE Entries
INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 25, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'ABERRATION_CACHE' AND id.name IN ('Obsidian Runestone', 'Amber Dragon Tear', 'Flawless Sapphire', 'Ring of Protection +1');

INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 15, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'ABERRATION_CACHE' AND id.name IN ('Amulet of Natural Armor +1', 'Belt of Giant Strength +2', 'Potion of Cure Serious Wounds');

-- 5h. GENERIC_WILDERNESS (Fallback) Entries
INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 20, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'GENERIC_WILDERNESS' AND id.name IN ('Shortsword', 'Dagger', 'Shortbow', 'Leather Armor', 'Minor Healing Potion', 'Uncut Garnet');

INSERT OR IGNORE INTO loot_table_entries (loot_table_id, item_definition_id, weight, min_quantity, max_quantity, rarity)
SELECT lt.id, id.id, 10, 1, 1, id.rarity FROM loot_tables lt, item_definitions id
WHERE lt.code = 'GENERIC_WILDERNESS' AND id.name IN ('Potion of Cure Light Wounds', 'Longsword +1', 'Rough Emerald');
