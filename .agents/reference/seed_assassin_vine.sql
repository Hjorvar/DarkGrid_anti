-- User-authored custom descriptions for Darkgrid.
-- Pathfinder 1e reference: https://www.d20pfsrd.com/bestiary/monster-listings/plants/assassin-vine/
-- Note: damage_dice corrected to 1d8+7 (slam), whereas 4d8+12 are its hit dice.
-- Note: solo_level=3 is a TEST PLACEHOLDER (not proven balanced for solo play).
-- Note: habitat F/J/S comes from the game design example, not an exact reproduction
--       of the Pathfinder ecology entry. Jungle is a custom setting choice.
-- Require the monster schema to exist before running this seed.

INSERT INTO monsters (
    name, symbol, color, base_hp, xp_reward, damage_dice,
    initiative_bonus, armor_class, attack_bonus, challenge_rating,
    solo_level, spawn_weight, habitat, movement_type,
    special_abilities, descriptions, source_url
) VALUES (
    'Assassin Vine', 'P', '#006400', 30, 800, '1d8+7',
    0, 15, 7, 3,
    3, 10, '["F", "J", "S"]', 'WALK',
    '["grab", "constrict", "entangle", "camouflage"]',
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
    'https://www.d20pfsrd.com/bestiary/monster-listings/plants/assassin-vine/'
)
ON CONFLICT(name) DO NOTHING;
