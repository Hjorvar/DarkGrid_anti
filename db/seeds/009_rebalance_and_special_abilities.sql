-- 009_rebalance_and_special_abilities.sql:
-- 1. Reduce monster base_hp by 25% across all monsters
-- 2. Apply monster base stat adjustments (AC, Damage, Special Abilities) from report
-- 3. Clean item descriptions so weapons, armor, shields, accessories, and potions use atmospheric lore without numeric stat spoilers

-- 1. Reduce all monster base_hp by 25% (minimum 2 HP)
UPDATE monsters
SET base_hp = MAX(2, CAST(ROUND(base_hp * 0.75) AS INTEGER));

UPDATE monster_instances
SET max_hp = MAX(2, CAST(ROUND(max_hp * 0.75) AS INTEGER)),
    current_hp = MIN(current_hp, MAX(2, CAST(ROUND(max_hp * 0.75) AS INTEGER)))
WHERE status = 'ACTIVE';

-- 2. Monster Base Stat & Special Ability Adjustments from the Design Report
-- Grick (id=65): AC 16 -> 15
UPDATE monsters
SET armor_class = 15
WHERE name = 'Grick';

-- Giant Stag Beetle (id=59): AC 19 -> 17
UPDATE monsters
SET armor_class = 17
WHERE name = 'Giant Stag Beetle';

-- Gibbering Mouther (id=57): Damage 1d4 -> 2d4+2, add DR/bludgeoning, amorphous, blood_drain
UPDATE monsters
SET damage_dice = '2d4+2',
    special_abilities = '["gibbering", "spittle", "engulf", "ground_manipulation", "damage_reduction_bludgeoning", "amorphous", "blood_drain"]'
WHERE name = 'Gibbering Mouther';

-- Phase Spider (id=55): Damage 2d6+7 -> 2d6+4, add ethereal_ambush and grab
UPDATE monsters
SET damage_dice = '2d6+4',
    special_abilities = '["ethereal_jaunt", "ethereal_ambush", "poison", "grab", "climb"]'
WHERE name = 'Phase Spider';

-- Yeti (id=33): Add rend
UPDATE monsters
SET special_abilities = '["cold", "frightful_gaze", "rend", "climb"]'
WHERE name = 'Yeti';

-- Griffon (id=52): Add rake
UPDATE monsters
SET special_abilities = '["pounce", "rake", "scent", "flight"]'
WHERE name = 'Griffon';

-- Bunyip (id=67): Add bleed
UPDATE monsters
SET special_abilities = '["roar", "blood_frenzy", "bleed", "swim"]'
WHERE name = 'Bunyip';

-- Ghast (id=61): Add disease
UPDATE monsters
SET special_abilities = '["stench", "paralysis", "disease", "undead_traits"]'
WHERE name = 'Ghast';

-- 3. Update item descriptions to remove numeric dice/AC spoilers and provide rich dark-fantasy lore
UPDATE item_definitions SET description = 'A small crystal phial filled with glowing crimson elixir that knits minor wounds and restores flagging vitality.' WHERE name = 'Minor Healing Potion';
UPDATE item_definitions SET description = 'The standard divine draught brewed by temple acolytes, soothing pain and knitting torn flesh.' WHERE name = 'Potion of Cure Light Wounds';
UPDATE item_definitions SET description = 'A shimmering amber tonic that swiftly seals deep lacerations and steadies a battered warrior.' WHERE name = 'Potion of Cure Moderate Wounds';
UPDATE item_definitions SET description = 'A radiant golden draft pulsating with sacred warmth, mending fractured bones and severe battle trauma.' WHERE name = 'Potion of Cure Serious Wounds';
UPDATE item_definitions SET description = 'A miraculous pearlescent elixir capable of dragging a dying hero back from the brink of the abyss.' WHERE name = 'Potion of Cure Critical Wounds';

UPDATE item_definitions SET description = 'An impeccably balanced steel longsword gleaming with a faint azure enchantment along its fuller.' WHERE name = 'Longsword +1';
UPDATE item_definitions SET description = 'A razor-edged short blade humming with subtle arcane resonance, eager to dart past a foe''s guard.' WHERE name = 'Shortsword +1';
UPDATE item_definitions SET description = 'A shadowy stiletto imbued with keen enchantment that slips effortlessly between iron links.' WHERE name = 'Dagger +1';
UPDATE item_definitions SET description = 'A bearded war axe glowing with runic script along the cheek, biting deep into timber and bone.' WHERE name = 'Battleaxe +1';
UPDATE item_definitions SET description = 'A consecrated warhammer that rings like a silver temple bell whenever it crushes armor.' WHERE name = 'Warhammer +1';
UPDATE item_definitions SET description = 'A sanctified iron mace blessed by high clergy, weighted to shatter undead bone and heavy plate.' WHERE name = 'Heavy Mace +1';
UPDATE item_definitions SET description = 'A monumental two-handed blade crackling with dormant fury, cleaving through ranks with effortless momentum.' WHERE name = 'Greatsword +1';
UPDATE item_definitions SET description = 'A mastercrafted yew bow whispered over by woodland wardens, guiding every loosed arrow toward its mark.' WHERE name = 'Shortbow +1';
UPDATE item_definitions SET description = 'A tall recurve war bow inscribed with wind runes that lend uncanny speed and reach to every shaft.' WHERE name = 'Longbow +1';
UPDATE item_definitions SET description = 'An intricately geared arbalest etched with sighting sigils that steady every bolt released.' WHERE name = 'Light Crossbow +1';
UPDATE item_definitions SET description = 'A masterwork blade of gleaming star-metal radiating cold, unwavering brilliance in the dark.' WHERE name = 'Longsword +2';
UPDATE item_definitions SET description = 'An ancient elven war bow that whispers in the gale, driving arrows with terrifying force.' WHERE name = 'Longbow +2';

UPDATE item_definitions SET description = 'Supple blackened leather armor stiffened by protective warding runes stitched into the seams.' WHERE name = 'Leather Armor +1';
UPDATE item_definitions SET description = 'Feather-light silvery chainlinks that turn aside vicious cuts without slowing the wearer''s stride.' WHERE name = 'Chain Shirt +1';
UPDATE item_definitions SET description = 'Ensorcelled metal scales that ripple like liquid mercury to deflect incoming blows.' WHERE name = 'Scale Mail +1';
UPDATE item_definitions SET description = 'A polished steel hauberk enchanted to resist piercing thrusts and heavy cleaving strikes.' WHERE name = 'Chainmail +1';
UPDATE item_definitions SET description = 'A mirror-sheened cuirass hardened by abjuration magic to turn deadly blades aside.' WHERE name = 'Breastplate +1';
UPDATE item_definitions SET description = 'A glorious suit of etched plate armor enveloped in an invisible aura of stalwart protection.' WHERE name = 'Full Plate +1';
UPDATE item_definitions SET description = 'A gleaming heater shield whose runic boss instinctively nudges fierce blows off course.' WHERE name = 'Light Steel Shield +1';
UPDATE item_definitions SET description = 'A heavy kite shield bearing ancient heraldic enchantments of warding and fortitude.' WHERE name = 'Heavy Steel Shield +1';
UPDATE item_definitions SET description = 'A legendary mithral-linked shirt glowing softly under moonlight, offering extraordinary defense with effortless grace.' WHERE name = 'Chain Shirt +2';
UPDATE item_definitions SET description = 'Forged by dwarven runesmiths, this masterwork breastplate turns lethal strikes into harmless sparks.' WHERE name = 'Breastplate +2';
UPDATE item_definitions SET description = 'An impenetrable fortress of articulated star-metal plate, warding its champion against the deadliest horrors.' WHERE name = 'Full Plate +2';
UPDATE item_definitions SET description = 'A magnificent tower-grade steel shield radiating an unyielding barrier of arcane defense.' WHERE name = 'Heavy Steel Shield +2';

UPDATE item_definitions SET description = 'A thick, earthy draft tasting of moss and amber sap that toughens skin like seasoned oak bark.' WHERE name = 'Potion of Barkskin';
UPDATE item_definitions SET description = 'A radiant golden vintage that banishes dread, steeling heart and sinew with dauntless heroic courage.' WHERE name = 'Potion of Heroism';
UPDATE item_definitions SET description = 'An incandescent crimson serum that violently knits torn muscle and mends shattered bone with primal vigor.' WHERE name = 'Draught of Troll''s Blood';

UPDATE item_definitions SET description = 'A slender platinum ring shimmering with an abjuration aura that projects an invisible ward around the bearer.' WHERE name = 'Ring of Protection +1';
UPDATE item_definitions SET description = 'A heavy iron pendant carved with a ferocious bear skull, toughening the wearer''s flesh like beast hide.' WHERE name = 'Amulet of Natural Armor +1';
UPDATE item_definitions SET description = 'Finely tooled leather bracers reinforced with runic silver studs that surround the forearms in a tangible ward.' WHERE name = 'Bracers of Armor +1';
UPDATE item_definitions SET description = 'An ancient mithral broadsword radiating blazing sanctified light, forged to smite aberrations and the restless dead.' WHERE name = 'Holy Avenger +3';
UPDATE item_definitions SET description = 'A pristine white composite war bow crafted from sacred heartwood that whispers swift doom to its quarry.' WHERE name = 'Oathbow +3';
