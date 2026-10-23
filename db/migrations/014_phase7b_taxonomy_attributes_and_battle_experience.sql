-- 014_phase7b_taxonomy_attributes_and_battle_experience.sql
-- Phase 7B: 22-Family Monster Taxonomy, Free Attribute Allocation & Milestones,
-- Ranger Favored Enemy Families, Fighter Second Wind State, and INT/WIS Battle Experience

-- =============================================================================
-- 1. Monster Taxonomy (22 Canonical Families)
-- =============================================================================
ALTER TABLE monsters ADD COLUMN monster_family TEXT NOT NULL DEFAULT 'ANIMALS';

CREATE INDEX IF NOT EXISTS idx_monsters_family ON monsters(monster_family);

-- Deterministic classification by creature identity, type, and subtype (never blind numeric IDs)
UPDATE monsters
SET monster_family = CASE
  -- 1. UNDEAD
  WHEN LOWER(name) IN (
    'ghoul', 'human skeleton', 'skeleton', 'human zombie', 'zombie',
    'shadow', 'mummy', 'skeletal champion', 'wight', 'wraith',
    'ghast', 'plague zombie', 'draugr', 'barrow wight', 'spectre'
  ) OR UPPER(COALESCE(creature_type, '')) = 'UNDEAD'
    THEN 'UNDEAD'

  -- 2. OOZES
  WHEN LOWER(name) IN ('ochre jelly', 'gelatinous cube', 'black pudding', 'gray ooze')
    OR UPPER(COALESCE(creature_type, '')) = 'OOZE'
    THEN 'OOZES'

  -- 3. CONSTRUCTS
  WHEN LOWER(name) IN ('iron cobra', 'animated armor')
    OR UPPER(COALESCE(creature_type, '')) = 'CONSTRUCT'
    THEN 'CONSTRUCTS'

  -- 4. DANGEROUS_PLANTS
  WHEN LOWER(name) IN (
    'assassin vine', 'shadow bramble [dev-placeholder]', 'yellow musk creeper',
    'vegepygmy', 'violet fungus', 'phantom fungus', 'shambling mound',
    'shrieker', 'tendriculos', 'treant'
  ) OR UPPER(COALESCE(creature_type, '')) = 'PLANT'
    THEN 'DANGEROUS_PLANTS'

  -- 5. DRAGONS_DRAKES
  WHEN LOWER(name) IN ('forest drake', 'wyvern', 'river drake', 'pseudodragon')
    OR UPPER(COALESCE(creature_type, '')) = 'DRAGON'
    THEN 'DRAGONS_DRAKES'

  -- 6. FEY
  WHEN LOWER(name) IN ('mite', 'spriggan', 'dryad', 'nymph', 'satyr')
    OR UPPER(COALESCE(creature_type, '')) = 'FEY'
    THEN 'FEY'

  -- 7. ARACHNIDS
  WHEN LOWER(name) IN ('giant spider', 'ettercap', 'giant scorpion', 'phase spider')
    THEN 'ARACHNIDS'

  -- 8. VERMIN_INSECTS
  WHEN LOWER(name) IN (
    'marsh leech [dev-placeholder]', 'giant crab', 'ankheg', 'stirge',
    'giant centipede', 'giant stag beetle', 'bog strider', 'giant mantis',
    'fire beetle', 'giant ant', 'giant wasp', 'giant leech'
  ) OR UPPER(COALESCE(creature_type, '')) = 'VERMIN'
    THEN 'VERMIN_INSECTS'

  -- 9. LUPINE_CANINE_BEASTS
  WHEN LOWER(name) IN (
    'wolf', 'feral wolf [dev-placeholder]', 'hyena', 'dire hyena',
    'death dog', 'winter wolf', 'blink dog', 'worg', 'dire wolf', 'riding dog'
  )
    THEN 'LUPINE_CANINE_BEASTS'

  -- 10. AVIAN_CHIMERAS
  WHEN LOWER(name) IN ('manticore', 'cockatrice', 'griffon', 'peryton', 'hippogriff', 'chimera')
    THEN 'AVIAN_CHIMERAS'

  -- 11. TERRESTRIAL_MAGICAL_BEASTS ("Other Magical Beasts")
  WHEN LOWER(name) IN (
    'darkmantle', 'owlbear', 'basilisk', 'krenshar', 'bunyip',
    'carbuncle', 'displacer beast', 'leucrotta', 'girallon', 'catoblepas',
    'bulette', 'gorgon', 'pegasus', 'unicorn', 'shocker lizard'
  ) OR UPPER(COALESCE(creature_type, '')) = 'MAGICAL BEAST'
    THEN 'TERRESTRIAL_MAGICAL_BEASTS'

  -- 12. GOBLINOIDS
  WHEN LOWER(name) IN ('goblin', 'hobgoblin', 'bugbear', 'hobgoblin captain', 'goblin commando', 'hobgoblin sergeant', 'bugbear stalker')
    OR LOWER(COALESCE(creature_subtype, '')) = 'goblinoid'
    THEN 'GOBLINOIDS'

  -- 13. ORCS
  WHEN LOWER(name) IN ('orc', 'orc warchief', 'orc berserker')
    OR LOWER(COALESCE(creature_subtype, '')) = 'orc'
    THEN 'ORCS'

  -- 14. GNOLLS
  WHEN LOWER(name) IN ('gnoll', 'gnoll packmaster', 'gnoll sergeant')
    OR LOWER(COALESCE(creature_subtype, '')) = 'gnoll'
    THEN 'GNOLLS'

  -- 15. REPTILIAN_HUMANOIDS
  WHEN LOWER(name) IN ('kobold', 'troglodyte', 'lizardfolk', 'lizardfolk champion')
    OR LOWER(COALESCE(creature_subtype, '')) = 'reptilian'
    THEN 'REPTILIAN_HUMANOIDS'

  -- 16. TROLLS
  WHEN LOWER(name) IN ('troll', 'grave troll [dev-placeholder]', 'troll berserker')
    THEN 'TROLLS'

  -- 17. GIANTS
  WHEN LOWER(name) IN ('ogre', 'hill giant', 'ettin')
    OR (UPPER(COALESCE(creature_type, '')) = 'HUMANOID' AND LOWER(COALESCE(creature_subtype, '')) = 'giant')
    THEN 'GIANTS'

  -- 18. AMPHIBIAN_HUMANOIDS
  WHEN LOWER(name) IN ('boggard', 'sahuagin', 'grippli scout', 'boggard priest', 'sahuagin mutant')
    OR LOWER(COALESCE(creature_subtype, '')) IN ('boggard', 'grippli')
    THEN 'AMPHIBIAN_HUMANOIDS'

  -- 19. SUBTERRANEAN_HUMANOIDS
  WHEN LOWER(name) IN ('duergar', 'drow', 'morlock')
    OR LOWER(COALESCE(creature_subtype, '')) IN ('duergar', 'drow')
    THEN 'SUBTERRANEAN_HUMANOIDS'

  -- 20. MONSTROUS_HUMANOIDS
  WHEN LOWER(name) IN ('minotaur', 'yeti', 'gargoyle', 'harpy', 'doppelganger', 'green hag', 'centaur', 'medusa', 'gargoyle alpha')
    OR UPPER(COALESCE(creature_type, '')) = 'MONSTROUS HUMANOID'
    THEN 'MONSTROUS_HUMANOIDS'

  -- 21. ABERRATIONS
  WHEN LOWER(name) IN ('choker', 'rust monster', 'cloaker', 'gibbering mouther', 'grick', 'will-o''-wisp', 'otyugh', 'mimic', 'chuul', 'drider')
    OR UPPER(COALESCE(creature_type, '')) = 'ABERRATION'
    THEN 'ABERRATIONS'

  -- 22. ANIMALS
  ELSE 'ANIMALS'
END;

-- =============================================================================
-- 2. Character Attribute Progression & Ranger Favored Enemy Family
-- =============================================================================
ALTER TABLE characters ADD COLUMN attribute_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN initial_attributes_json TEXT DEFAULT NULL;
ALTER TABLE characters ADD COLUMN favored_enemy_family TEXT DEFAULT NULL;

-- Backfill favored_enemy_family for existing Ranger characters
UPDATE characters
SET favored_enemy_family = CASE
  WHEN UPPER(COALESCE(favored_enemy_type, '')) IN ('ANIMAL', 'BEAST', 'ANIMALS') THEN 'ANIMALS'
  WHEN UPPER(COALESCE(favored_enemy_type, '')) IN ('PLANT', 'DANGEROUS_PLANTS') THEN 'DANGEROUS_PLANTS'
  WHEN UPPER(COALESCE(favored_enemy_type, '')) IN ('VERMIN', 'VERMIN_INSECTS') THEN 'VERMIN_INSECTS'
  WHEN UPPER(COALESCE(favored_enemy_type, '')) IN ('DRAGON', 'DRAGONS_DRAKES') THEN 'DRAGONS_DRAKES'
  WHEN UPPER(COALESCE(favored_enemy_type, '')) IN ('MAGICAL BEAST', 'MAGICAL_BEAST', 'TERRESTRIAL_MAGICAL_BEASTS') THEN 'TERRESTRIAL_MAGICAL_BEASTS'
  WHEN UPPER(COALESCE(favored_enemy_type, '')) IN ('MONSTROUS HUMANOID', 'MONSTROUS_HUMANOID', 'MONSTROUS_HUMANOIDS') THEN 'MONSTROUS_HUMANOIDS'
  WHEN UPPER(COALESCE(favored_enemy_type, '')) IN ('ABERRATION', 'ABERRATIONS') THEN 'ABERRATIONS'
  WHEN UPPER(COALESCE(favored_enemy_type, '')) = 'HUMANOID' AND LOWER(COALESCE(favored_enemy_subtype, '')) = 'goblinoid' THEN 'GOBLINOIDS'
  WHEN UPPER(COALESCE(favored_enemy_type, '')) = 'HUMANOID' AND LOWER(COALESCE(favored_enemy_subtype, '')) = 'reptilian' THEN 'REPTILIAN_HUMANOIDS'
  WHEN UPPER(COALESCE(favored_enemy_type, '')) = 'HUMANOID' AND LOWER(COALESCE(favored_enemy_subtype, '')) = 'orc' THEN 'ORCS'
  WHEN UPPER(COALESCE(favored_enemy_type, '')) = 'HUMANOID' AND LOWER(COALESCE(favored_enemy_subtype, '')) = 'gnoll' THEN 'GNOLLS'
  WHEN UPPER(COALESCE(favored_enemy_type, '')) = 'HUMANOID' AND LOWER(COALESCE(favored_enemy_subtype, '')) = 'giant' THEN 'GIANTS'
  WHEN UPPER(COALESCE(favored_enemy_type, '')) = 'HUMANOID' AND LOWER(COALESCE(favored_enemy_subtype, '')) IN ('boggard', 'grippli', 'aquatic') THEN 'AMPHIBIAN_HUMANOIDS'
  WHEN UPPER(COALESCE(favored_enemy_type, '')) = 'HUMANOID' AND LOWER(COALESCE(favored_enemy_subtype, '')) IN ('drow', 'duergar') THEN 'SUBTERRANEAN_HUMANOIDS'
  ELSE favored_enemy_family
END
WHERE class = 'RANGER' AND favored_enemy_family IS NULL;

-- =============================================================================
-- 3. INT/WIS Battle Experience Tracking Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS character_monster_knowledge (
    character_id INTEGER NOT NULL,
    monster_id INTEGER NOT NULL,
    encounters INTEGER NOT NULL DEFAULT 0,
    victories INTEGER NOT NULL DEFAULT 0,
    first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_fought_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (character_id, monster_id),
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (monster_id) REFERENCES monsters(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cmk_character ON character_monster_knowledge(character_id);

-- =============================================================================
-- 4. Fighter Second Wind Persistence on Encounters
-- =============================================================================
ALTER TABLE encounters ADD COLUMN second_wind_used INTEGER NOT NULL DEFAULT 0;
