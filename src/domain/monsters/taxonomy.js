/**
 * DARKGRID — Phase 7B: 22-Family Monster Taxonomy & Ranger Favored Enemy Registry
 *
 * Implements the locked Phase 7A.4 Owner Decision (OC-1 Option A):
 * - 22 valid monster families across all 98 monsters
 * - 14 initial selectable Ranger Favored Enemy families (Tier 1)
 * - 5 reserved families (Tier 2: FEY, AMPHIBIAN_HUMANOIDS, MONSTROUS_HUMANOIDS, ABERRATIONS, SUBTERRANEAN_HUMANOIDS)
 * - 2 non-selectable families (Tier 3: OOZES, CONSTRUCTS)
 * - 1 strictly forbidden family (UNDEAD)
 *
 * Never silently defaults an unidentified monster to ANIMALS.
 */

const MONSTER_FAMILY_META = {
  // ===========================================================================
  // TIER 1: 14 INITIAL SELECTABLE RANGER FAVORED ENEMY FAMILIES
  // ===========================================================================
  ANIMALS: {
    code: 'ANIMALS',
    label: 'Animals & Beasts',
    tier: 'SELECTABLE',
    rangerSelectable: true,
    description: 'Natural wild predators, boars, serpents, amphibians, and birds of prey.'
  },
  LUPINE_CANINE_BEASTS: {
    code: 'LUPINE_CANINE_BEASTS',
    label: 'Wolves, Hounds & Magical Canines',
    tier: 'SELECTABLE',
    rangerSelectable: true,
    description: 'Pack-hunting wolves, hyenas, worgs, blink dogs, death dogs, and winter wolves.'
  },
  AVIAN_CHIMERAS: {
    code: 'AVIAN_CHIMERAS',
    label: 'Winged Chimeras & Avian Beasts',
    tier: 'SELECTABLE',
    rangerSelectable: true,
    description: 'Winged chimeric hunters including griffons, hippogriffs, cockatrices, perytons, and manticores.'
  },
  TERRESTRIAL_MAGICAL_BEASTS: {
    code: 'TERRESTRIAL_MAGICAL_BEASTS',
    label: 'Other Magical Beasts',
    tier: 'SELECTABLE',
    rangerSelectable: true,
    description: 'Non-canine, non-avian magical beasts such as owlbears, basilisks, displacer beasts, girallons, and catoblepas.'
  },
  ARACHNIDS: {
    code: 'ARACHNIDS',
    label: 'Spiders, Scorpions & Arachnids',
    tier: 'SELECTABLE',
    rangerSelectable: true,
    description: 'Venomous web-spinners and stinging arachnids including giant spiders, scorpions, ettercaps, and phase spiders.'
  },
  VERMIN_INSECTS: {
    code: 'VERMIN_INSECTS',
    label: 'Giant Insects, Centipedes & Vermin',
    tier: 'SELECTABLE',
    rangerSelectable: true,
    description: 'Chitinous arthropods, centipedes, beetles, mantises, stirges, and burrowing ankhegs.'
  },
  DANGEROUS_PLANTS: {
    code: 'DANGEROUS_PLANTS',
    label: 'Carnivorous Plants & Fungi',
    tier: 'SELECTABLE',
    rangerSelectable: true,
    description: 'Predatory flora, strangling vines, toxic fungi, vegepygmies, and shambling mounds.'
  },
  DRAGONS_DRAKES: {
    code: 'DRAGONS_DRAKES',
    label: 'Drakes, Wyverns & Dragons',
    tier: 'SELECTABLE',
    rangerSelectable: true,
    description: 'Draconic predators including forest drakes and venomous wyverns.'
  },
  GOBLINOIDS: {
    code: 'GOBLINOIDS',
    label: 'Goblinoids (Goblins, Hobgoblins & Bugbears)',
    tier: 'SELECTABLE',
    rangerSelectable: true,
    description: 'Goblins, disciplined hobgoblin soldiers and captains, and brutal bugbear ambushers.'
  },
  ORCS: {
    code: 'ORCS',
    label: 'Orcs',
    tier: 'SELECTABLE',
    rangerSelectable: true,
    description: 'Savage orc raiders, berserkers, and warband warchiefs.'
  },
  GNOLLS: {
    code: 'GNOLLS',
    label: 'Gnolls',
    tier: 'SELECTABLE',
    rangerSelectable: true,
    description: 'Hyena-headed gnoll marauders and packmasters.'
  },
  REPTILIAN_HUMANOIDS: {
    code: 'REPTILIAN_HUMANOIDS',
    label: 'Reptilian Humanoids (Kobolds, Lizardfolk & Troglodytes)',
    tier: 'SELECTABLE',
    rangerSelectable: true,
    description: 'Scaled humanoids of marsh, cavern, and forest including kobolds, lizardfolk, and troglodytes.'
  },
  TROLLS: {
    code: 'TROLLS',
    label: 'Trolls',
    tier: 'SELECTABLE',
    rangerSelectable: true,
    description: 'Regenerating giant-kin trolls of mountain crags and fens.'
  },
  GIANTS: {
    code: 'GIANTS',
    label: 'Giants & Ogres',
    tier: 'SELECTABLE',
    rangerSelectable: true,
    description: 'Hulking ogres and giant-kin brutes.'
  },

  // ===========================================================================
  // TIER 2: 5 RESERVED FAMILIES (VALID IN TAXONOMY, NOT INITIAL RANGER CHOICES)
  // ===========================================================================
  FEY: {
    code: 'FEY',
    label: 'Fey',
    tier: 'RESERVED',
    rangerSelectable: false,
    description: 'Capricious woodland and subterranean fey such as mites and spriggans.'
  },
  AMPHIBIAN_HUMANOIDS: {
    code: 'AMPHIBIAN_HUMANOIDS',
    label: 'Amphibian & Aquatic Humanoids',
    tier: 'RESERVED',
    rangerSelectable: false,
    description: 'Swamp and coastal amphibious peoples including boggards, grippli, and sahuagin.'
  },
  MONSTROUS_HUMANOIDS: {
    code: 'MONSTROUS_HUMANOIDS',
    label: 'Monstrous Humanoids',
    tier: 'RESERVED',
    rangerSelectable: false,
    description: 'Bestial and cursed humanoids including minotaurs, harpies, gargoyles, yetis, doppelgangers, and hags.'
  },
  ABERRATIONS: {
    code: 'ABERRATIONS',
    label: 'Aberrations',
    tier: 'RESERVED',
    rangerSelectable: false,
    description: 'Alien and unnatural horrors including chokers, rust monsters, gricks, gibbering mouthers, cloakers, otyughs, and will-o\'-wisps.'
  },
  SUBTERRANEAN_HUMANOIDS: {
    code: 'SUBTERRANEAN_HUMANOIDS',
    label: 'Subterranean Humanoids',
    tier: 'RESERVED',
    rangerSelectable: false,
    description: 'Deep-dwelling humanoids including drow, duergar, and morlocks.'
  },

  // ===========================================================================
  // TIER 3: 2 NON-SELECTABLE FAMILIES
  // ===========================================================================
  OOZES: {
    code: 'OOZES',
    label: 'Oozes',
    tier: 'NON_SELECTABLE',
    rangerSelectable: false,
    description: 'Mindless protoplasmic slimes and jellies.'
  },
  CONSTRUCTS: {
    code: 'CONSTRUCTS',
    label: 'Constructs',
    tier: 'NON_SELECTABLE',
    rangerSelectable: false,
    description: 'Artificially animated guardians and clockwork constructs.'
  },

  // ===========================================================================
  // FORBIDDEN FAMILY: UNDEAD (CLERIC SACRED DOMAIN)
  // ===========================================================================
  UNDEAD: {
    code: 'UNDEAD',
    label: 'Undead',
    tier: 'FORBIDDEN',
    rangerSelectable: false,
    description: 'Unliving horrors animated by necromancy — the sacred domain of the Cleric.'
  }
};

const MONSTER_FAMILIES = Object.freeze(Object.keys(MONSTER_FAMILY_META));

const RANGER_SELECTABLE_FAMILIES = Object.freeze([
  'ANIMALS',
  'LUPINE_CANINE_BEASTS',
  'AVIAN_CHIMERAS',
  'TERRESTRIAL_MAGICAL_BEASTS',
  'ARACHNIDS',
  'VERMIN_INSECTS',
  'DANGEROUS_PLANTS',
  'DRAGONS_DRAKES',
  'GOBLINOIDS',
  'ORCS',
  'GNOLLS',
  'REPTILIAN_HUMANOIDS',
  'TROLLS',
  'GIANTS'
]);

const RANGER_RESERVED_FAMILIES = Object.freeze([
  'FEY',
  'AMPHIBIAN_HUMANOIDS',
  'MONSTROUS_HUMANOIDS',
  'ABERRATIONS',
  'SUBTERRANEAN_HUMANOIDS'
]);

const RANGER_NON_SELECTABLE_FAMILIES = Object.freeze([
  'OOZES',
  'CONSTRUCTS'
]);

const RANGER_FORBIDDEN_FAMILIES = Object.freeze([
  'UNDEAD'
]);

/**
 * Canonical geographic surface terrains (includes River/Bridge per Phase 7A.4 OD-7A4-01).
 */
const CANONICAL_SURFACE_TERRAINS = Object.freeze([
  'FOREST',
  'HILLS',
  'PLAINS',
  'SWAMP',
  'JUNGLE',
  'MOUNTAINS',
  'DESERT',
  'COAST',
  'CITY',
  'RIVER_LAKE',
  'BRIDGE'
]);

/**
 * Deterministic monster-name to family mapping.
 * Covers all 98 actual SQLite seeded monsters AND all alternate monster names referenced
 * in the Phase 7A.4 design table (PHASE-7A4-RANGER-TAXONOMY.md §6).
 */
const EXPLICIT_MONSTER_NAME_TO_FAMILY = Object.freeze({
  // 1. ANIMALS
  'giant frog': 'ANIMALS',
  'boar': 'ANIMALS',
  'dire rat': 'ANIMALS',
  'viper': 'ANIMALS',
  'giant bat': 'ANIMALS',
  'blood hawk': 'ANIMALS',
  'jungle viper': 'ANIMALS',
  'giant toad': 'ANIMALS',
  'cheetah': 'ANIMALS',
  'dire boar': 'ANIMALS',
  'eagle': 'ANIMALS',
  'hawk': 'ANIMALS',
  'black bear': 'ANIMALS',
  'grizzly bear': 'ANIMALS',
  'dire bear': 'ANIMALS',
  'crocodile': 'ANIMALS',
  'giant crocodile': 'ANIMALS',
  'constrictor snake': 'ANIMALS',
  'venomous snake': 'ANIMALS',
  'wolverine': 'ANIMALS',
  'dire wolverine': 'ANIMALS',
  'leopard': 'ANIMALS',
  'lion': 'ANIMALS',
  'tiger': 'ANIMALS',
  'dire tiger': 'ANIMALS',
  'shark': 'ANIMALS',
  'dire badger': 'ANIMALS',
  'giant gecko': 'ANIMALS',
  'riding dog': 'LUPINE_CANINE_BEASTS',

  // 2. LUPINE_CANINE_BEASTS
  'wolf': 'LUPINE_CANINE_BEASTS',
  'feral wolf [dev-placeholder]': 'LUPINE_CANINE_BEASTS',
  'hyena': 'LUPINE_CANINE_BEASTS',
  'dire hyena': 'LUPINE_CANINE_BEASTS',
  'death dog': 'LUPINE_CANINE_BEASTS',
  'winter wolf': 'LUPINE_CANINE_BEASTS',
  'blink dog': 'LUPINE_CANINE_BEASTS',
  'worg': 'LUPINE_CANINE_BEASTS',
  'dire wolf': 'LUPINE_CANINE_BEASTS',

  // 3. AVIAN_CHIMERAS
  'manticore': 'AVIAN_CHIMERAS',
  'cockatrice': 'AVIAN_CHIMERAS',
  'griffon': 'AVIAN_CHIMERAS',
  'peryton': 'AVIAN_CHIMERAS',
  'hippogriff': 'AVIAN_CHIMERAS',
  'chimera': 'AVIAN_CHIMERAS',

  // 4. TERRESTRIAL_MAGICAL_BEASTS ("Other Magical Beasts")
  'darkmantle': 'TERRESTRIAL_MAGICAL_BEASTS',
  'owlbear': 'TERRESTRIAL_MAGICAL_BEASTS',
  'basilisk': 'TERRESTRIAL_MAGICAL_BEASTS',
  'krenshar': 'TERRESTRIAL_MAGICAL_BEASTS',
  'bunyip': 'TERRESTRIAL_MAGICAL_BEASTS',
  'carbuncle': 'TERRESTRIAL_MAGICAL_BEASTS',
  'displacer beast': 'TERRESTRIAL_MAGICAL_BEASTS',
  'leucrotta': 'TERRESTRIAL_MAGICAL_BEASTS',
  'girallon': 'TERRESTRIAL_MAGICAL_BEASTS',
  'catoblepas': 'TERRESTRIAL_MAGICAL_BEASTS',
  'bulette': 'TERRESTRIAL_MAGICAL_BEASTS',
  'gorgon': 'TERRESTRIAL_MAGICAL_BEASTS',
  'pegasus': 'TERRESTRIAL_MAGICAL_BEASTS',
  'unicorn': 'TERRESTRIAL_MAGICAL_BEASTS',
  'shocker lizard': 'TERRESTRIAL_MAGICAL_BEASTS',

  // 5. ARACHNIDS
  'giant spider': 'ARACHNIDS',
  'ettercap': 'ARACHNIDS',
  'giant scorpion': 'ARACHNIDS',
  'phase spider': 'ARACHNIDS',

  // 6. VERMIN_INSECTS
  'marsh leech [dev-placeholder]': 'VERMIN_INSECTS',
  'giant crab': 'VERMIN_INSECTS',
  'ankheg': 'VERMIN_INSECTS',
  'stirge': 'VERMIN_INSECTS',
  'giant centipede': 'VERMIN_INSECTS',
  'giant stag beetle': 'VERMIN_INSECTS',
  'bog strider': 'VERMIN_INSECTS',
  'giant mantis': 'VERMIN_INSECTS',
  'fire beetle': 'VERMIN_INSECTS',
  'giant ant': 'VERMIN_INSECTS',
  'giant wasp': 'VERMIN_INSECTS',
  'giant leech': 'VERMIN_INSECTS',

  // 7. DANGEROUS_PLANTS
  'assassin vine': 'DANGEROUS_PLANTS',
  'shadow bramble [dev-placeholder]': 'DANGEROUS_PLANTS',
  'yellow musk creeper': 'DANGEROUS_PLANTS',
  'vegepygmy': 'DANGEROUS_PLANTS',
  'violet fungus': 'DANGEROUS_PLANTS',
  'phantom fungus': 'DANGEROUS_PLANTS',
  'shambling mound': 'DANGEROUS_PLANTS',
  'shrieker': 'DANGEROUS_PLANTS',
  'tendriculos': 'DANGEROUS_PLANTS',
  'treant': 'DANGEROUS_PLANTS',

  // 8. DRAGONS_DRAKES
  'forest drake': 'DRAGONS_DRAKES',
  'wyvern': 'DRAGONS_DRAKES',
  'river drake': 'DRAGONS_DRAKES',
  'pseudodragon': 'DRAGONS_DRAKES',

  // 9. GOBLINOIDS
  'goblin': 'GOBLINOIDS',
  'hobgoblin': 'GOBLINOIDS',
  'bugbear': 'GOBLINOIDS',
  'hobgoblin captain': 'GOBLINOIDS',
  'goblin commando': 'GOBLINOIDS',
  'hobgoblin sergeant': 'GOBLINOIDS',
  'bugbear stalker': 'GOBLINOIDS',

  // 10. ORCS
  'orc': 'ORCS',
  'orc warchief': 'ORCS',
  'orc berserker': 'ORCS',

  // 11. GNOLLS
  'gnoll': 'GNOLLS',
  'gnoll packmaster': 'GNOLLS',
  'gnoll sergeant': 'GNOLLS',

  // 12. REPTILIAN_HUMANOIDS
  'kobold': 'REPTILIAN_HUMANOIDS',
  'troglodyte': 'REPTILIAN_HUMANOIDS',
  'lizardfolk': 'REPTILIAN_HUMANOIDS',
  'lizardfolk champion': 'REPTILIAN_HUMANOIDS',

  // 13. TROLLS
  'troll': 'TROLLS',
  'grave troll [dev-placeholder]': 'TROLLS',
  'troll berserker': 'TROLLS',

  // 14. GIANTS
  'ogre': 'GIANTS',
  'hill giant': 'GIANTS',
  'ettin': 'GIANTS',

  // 15. FEY
  'mite': 'FEY',
  'spriggan': 'FEY',
  'dryad': 'FEY',
  'nymph': 'FEY',
  'satyr': 'FEY',

  // 16. AMPHIBIAN_HUMANOIDS
  'boggard': 'AMPHIBIAN_HUMANOIDS',
  'sahuagin': 'AMPHIBIAN_HUMANOIDS',
  'grippli scout': 'AMPHIBIAN_HUMANOIDS',
  'boggard priest': 'AMPHIBIAN_HUMANOIDS',
  'sahuagin mutant': 'AMPHIBIAN_HUMANOIDS',

  // 17. MONSTROUS_HUMANOIDS
  'minotaur': 'MONSTROUS_HUMANOIDS',
  'yeti': 'MONSTROUS_HUMANOIDS',
  'gargoyle': 'MONSTROUS_HUMANOIDS',
  'harpy': 'MONSTROUS_HUMANOIDS',
  'doppelganger': 'MONSTROUS_HUMANOIDS',
  'green hag': 'MONSTROUS_HUMANOIDS',
  'centaur': 'MONSTROUS_HUMANOIDS',
  'medusa': 'MONSTROUS_HUMANOIDS',
  'gargoyle alpha': 'MONSTROUS_HUMANOIDS',

  // 18. ABERRATIONS
  'choker': 'ABERRATIONS',
  'rust monster': 'ABERRATIONS',
  'cloaker': 'ABERRATIONS',
  'gibbering mouther': 'ABERRATIONS',
  'grick': 'ABERRATIONS',
  "will-o'-wisp": 'ABERRATIONS',
  'otyugh': 'ABERRATIONS',
  'mimic': 'ABERRATIONS',
  'chuul': 'ABERRATIONS',
  'drider': 'ABERRATIONS',

  // 19. SUBTERRANEAN_HUMANOIDS
  'duergar': 'SUBTERRANEAN_HUMANOIDS',
  'drow': 'SUBTERRANEAN_HUMANOIDS',
  'morlock': 'SUBTERRANEAN_HUMANOIDS',

  // 20. OOZES
  'ochre jelly': 'OOZES',
  'gelatinous cube': 'OOZES',
  'black pudding': 'OOZES',
  'gray ooze': 'OOZES',

  // 21. CONSTRUCTS
  'iron cobra': 'CONSTRUCTS',
  'animated armor': 'CONSTRUCTS',

  // 22. UNDEAD
  'ghoul': 'UNDEAD',
  'human skeleton': 'UNDEAD',
  'skeleton': 'UNDEAD',
  'human zombie': 'UNDEAD',
  'zombie': 'UNDEAD',
  'shadow': 'UNDEAD',
  'mummy': 'UNDEAD',
  'skeletal champion': 'UNDEAD',
  'wight': 'UNDEAD',
  'wraith': 'UNDEAD',
  'ghast': 'UNDEAD',
  'plague zombie': 'UNDEAD',
  'draugr': 'UNDEAD',
  'barrow wight': 'UNDEAD',
  'spectre': 'UNDEAD'
});

/**
 * Strips Named Bounty / Persistent Monster title suffixes or prefixes if needed
 * to match a base monster identity.
 */
function normalizeMonsterNameKey(name) {
  return String(name || '').trim().toLowerCase();
}

/**
 * Deterministically resolves the canonical 22-family classification for a monster object.
 * Priority:
 *  1. Explicit monster_family column if already set to a valid non-default family (or verified against name/type)
 *  2. Exact normalized monster name lookup
 *  3. Deterministic creature_type + creature_subtype + anatomical keyword rules
 *  4. If strict = true and still unmatched, throws an explicit error (NEVER silently defaults to ANIMALS).
 */
function resolveMonsterFamily(monster, { strict = false } = {}) {
  if (!monster || typeof monster !== 'object') {
    if (strict) {
      throw new Error('Cannot classify null or non-object monster.');
    }
    return null;
  }

  const rawName = monster.base_monster_name || monster.name || monster.monsterName || '';
  const nameKey = normalizeMonsterNameKey(rawName);

  // 1. Check explicit name dictionary first (most specific and authoritative)
  if (nameKey && EXPLICIT_MONSTER_NAME_TO_FAMILY[nameKey]) {
    return EXPLICIT_MONSTER_NAME_TO_FAMILY[nameKey];
  }

  // 2. If monster already carries an explicit valid monster_family (and name is empty or synthetic test stub)
  const existingFamily = String(monster.monster_family || monster.monsterFamily || '').trim().toUpperCase();
  if (existingFamily && MONSTER_FAMILY_META[existingFamily] && (!nameKey || existingFamily !== 'ANIMALS')) {
    return existingFamily;
  }

  // 3. Deterministic creature_type + creature_subtype + name keyword classification
  const cType = String(monster.creature_type || monster.creatureType || '').trim().toUpperCase();
  const cSub = String(monster.creature_subtype || monster.creatureSubtype || '').trim().toLowerCase();

  if (cType === 'UNDEAD') return 'UNDEAD';
  if (cType === 'OOZE') return 'OOZES';
  if (cType === 'CONSTRUCT') return 'CONSTRUCTS';
  if (cType === 'PLANT') return 'DANGEROUS_PLANTS';
  if (cType === 'DRAGON') return 'DRAGONS_DRAKES';
  if (cType === 'FEY') return 'FEY';

  if (cType === 'HUMANOID') {
    if (cSub === 'goblinoid' || nameKey.includes('goblin') || nameKey.includes('bugbear')) return 'GOBLINOIDS';
    if (cSub === 'orc' || nameKey.includes('orc')) return 'ORCS';
    if (cSub === 'gnoll' || nameKey.includes('gnoll')) return 'GNOLLS';
    if (cSub === 'reptilian' || nameKey.includes('kobold') || nameKey.includes('lizardfolk') || nameKey.includes('troglodyte')) {
      return 'REPTILIAN_HUMANOIDS';
    }
    if (cSub === 'boggard' || cSub === 'grippli' || cSub === 'aquatic') return 'AMPHIBIAN_HUMANOIDS';
    if (cSub === 'duergar' || cSub === 'drow' || cSub === 'dwarf' || cSub === 'elf') return 'SUBTERRANEAN_HUMANOIDS';
    if (cSub === 'giant') {
      if (nameKey.includes('troll')) return 'TROLLS';
      return 'GIANTS';
    }
  }

  if (cType === 'MONSTROUS HUMANOID' || cType === 'MONSTROUS_HUMANOID') {
    if (cSub === 'aquatic' || nameKey.includes('sahuagin')) return 'AMPHIBIAN_HUMANOIDS';
    if (nameKey.includes('morlock')) return 'SUBTERRANEAN_HUMANOIDS';
    return 'MONSTROUS_HUMANOIDS';
  }

  if (cType === 'ABERRATION') {
    if (nameKey.includes('ettercap') || nameKey.includes('spider') || nameKey.includes('scorpion')) {
      return 'ARACHNIDS';
    }
    return 'ABERRATIONS';
  }

  if (cType === 'VERMIN') {
    if (nameKey.includes('spider') || nameKey.includes('scorpion') || nameKey.includes('arachnid') || nameKey.includes('tick')) {
      return 'ARACHNIDS';
    }
    return 'VERMIN_INSECTS';
  }

  if (cType === 'MAGICAL BEAST' || cType === 'MAGICAL_BEAST') {
    if (nameKey.includes('wolf') || nameKey.includes('dog') || nameKey.includes('worg') || nameKey.includes('hound') || nameKey.includes('hyena')) {
      return 'LUPINE_CANINE_BEASTS';
    }
    if (nameKey.includes('spider') || nameKey.includes('scorpion')) {
      return 'ARACHNIDS';
    }
    if (nameKey.includes('ankheg') || nameKey.includes('stirge') || nameKey.includes('beetle') || nameKey.includes('mantis')) {
      return 'VERMIN_INSECTS';
    }
    if (
      nameKey.includes('manticore') ||
      nameKey.includes('cockatrice') ||
      nameKey.includes('griffon') ||
      nameKey.includes('peryton') ||
      nameKey.includes('hippogriff') ||
      nameKey.includes('chimera')
    ) {
      return 'AVIAN_CHIMERAS';
    }
    return 'TERRESTRIAL_MAGICAL_BEASTS';
  }

  if (cType === 'ANIMAL' || cType === 'BEAST') {
    if (nameKey.includes('wolf') || nameKey.includes('hyena') || nameKey.includes('hound') || nameKey.includes('dog')) {
      return 'LUPINE_CANINE_BEASTS';
    }
    return 'ANIMALS';
  }

  if (existingFamily && MONSTER_FAMILY_META[existingFamily]) {
    return existingFamily;
  }

  if (strict) {
    throw new Error(
      `Unclassified monster: name="${rawName}", creature_type="${monster.creature_type}", creature_subtype="${monster.creature_subtype}"`
    );
  }

  return null;
}

/**
 * Returns metadata for a single monster family code.
 */
function getFamilyMetadata(familyCode) {
  if (!familyCode) return null;
  const key = String(familyCode).trim().toUpperCase();
  const meta = MONSTER_FAMILY_META[key];
  if (!meta) return null;
  return {
    key,
    value: key,
    ...meta
  };
}

/**
 * Returns the UI-ready list of 14 initial selectable Ranger Favored Enemy families.
 */
function getRangerSelectableFamilies() {
  return RANGER_SELECTABLE_FAMILIES.map(code => ({
    key: code,
    value: code,
    label: MONSTER_FAMILY_META[code].label,
    description: MONSTER_FAMILY_META[code].description
  }));
}

function getRangerSelectableFamilyOptions() {
  return getRangerSelectableFamilies();
}

/**
 * Maps legacy Ranger favored_enemy_type / favored_enemy_subtype or new favored_enemy_family
 * into a canonical structure `{ family, legacyType, legacySubtype }`.
 */
function normalizeRangerFavoredEnemyDetails(input = {}, subtypeArg = null) {
  const isObj = input && typeof input === 'object';
  const rawFamily = String(
    isObj
      ? (input.favored_enemy_family ||
         input.favoredEnemyFamily ||
         input.favored_enemy_type ||
         input.favoredEnemyType ||
         '')
      : (input || '')
  ).trim();
  const rawSubtype = String(
    isObj
      ? (input.favored_enemy_subtype ||
         input.favoredEnemySubtype ||
         subtypeArg ||
         '')
      : (subtypeArg || '')
  ).trim().toLowerCase();

  const upper = rawFamily.toUpperCase();

  // Direct 22-family match
  if (MONSTER_FAMILY_META[upper]) {
    return {
      family: upper,
      legacyType: upper,
      legacySubtype: rawSubtype || null
    };
  }

  // Legacy HUMANOID:subtype combined format
  if (upper.startsWith('HUMANOID:')) {
    const sub = upper.split(':')[1].trim().toLowerCase();
    return normalizeRangerFavoredEnemyDetails({
      favored_enemy_type: 'HUMANOID',
      favored_enemy_subtype: sub
    });
  }

  // Legacy type + subtype mappings
  if (upper === 'ANIMAL' || upper === 'BEAST') {
    return { family: 'ANIMALS', legacyType: upper, legacySubtype: null };
  }
  if (upper === 'PLANT') {
    return { family: 'DANGEROUS_PLANTS', legacyType: 'PLANT', legacySubtype: null };
  }
  if (upper === 'VERMIN') {
    return { family: 'VERMIN_INSECTS', legacyType: 'VERMIN', legacySubtype: null };
  }
  if (upper === 'DRAGON') {
    return { family: 'DRAGONS_DRAKES', legacyType: 'DRAGON', legacySubtype: null };
  }
  if (upper === 'GIANT') {
    return { family: 'GIANTS', legacyType: 'GIANT', legacySubtype: null };
  }
  if (upper === 'OUTSIDER') {
    return { family: 'ELEMENTALS_OUTSIDERS', legacyType: 'OUTSIDER', legacySubtype: null };
  }
  if (upper === 'MAGICAL BEAST' || upper === 'MAGICAL_BEAST') {
    return { family: 'TERRESTRIAL_MAGICAL_BEASTS', legacyType: 'MAGICAL BEAST', legacySubtype: null };
  }
  if (upper === 'MONSTROUS HUMANOID' || upper === 'MONSTROUS_HUMANOID') {
    return { family: 'MONSTROUS_HUMANOIDS', legacyType: 'MONSTROUS HUMANOID', legacySubtype: null };
  }
  if (upper === 'ABERRATION') {
    return { family: 'ABERRATIONS', legacyType: 'ABERRATION', legacySubtype: null };
  }
  if (upper === 'OOZE') {
    return { family: 'OOZES', legacyType: 'OOZE', legacySubtype: null };
  }
  if (upper === 'CONSTRUCT') {
    return { family: 'CONSTRUCTS', legacyType: 'CONSTRUCT', legacySubtype: null };
  }
  if (upper === 'HUMANOID') {
    if (rawSubtype === 'goblinoid') return { family: 'GOBLINOIDS', legacyType: 'HUMANOID', legacySubtype: 'goblinoid' };
    if (rawSubtype === 'reptilian') return { family: 'REPTILIAN_HUMANOIDS', legacyType: 'HUMANOID', legacySubtype: 'reptilian' };
    if (rawSubtype === 'orc') return { family: 'ORCS', legacyType: 'HUMANOID', legacySubtype: 'orc' };
    if (rawSubtype === 'gnoll') return { family: 'GNOLLS', legacyType: 'HUMANOID', legacySubtype: 'gnoll' };
    if (rawSubtype === 'giant') return { family: 'GIANTS', legacyType: 'HUMANOID', legacySubtype: 'giant' };
    if (rawSubtype === 'boggard' || rawSubtype === 'grippli' || rawSubtype === 'aquatic') {
      return { family: 'AMPHIBIAN_HUMANOIDS', legacyType: 'HUMANOID', legacySubtype: rawSubtype };
    }
    if (rawSubtype === 'drow' || rawSubtype === 'duergar') {
      return { family: 'SUBTERRANEAN_HUMANOIDS', legacyType: 'HUMANOID', legacySubtype: rawSubtype };
    }
    return { family: null, legacyType: 'HUMANOID', legacySubtype: rawSubtype || null };
  }

  return { family: upper || null, legacyType: upper || null, legacySubtype: rawSubtype || null };
}

/**
 * Normalizes a Ranger Favored Enemy input (either string/subtype or object) to its canonical 22-family key (or null).
 */
function normalizeRangerFavoredEnemy(input = {}, subtypeArg = null) {
  const details = normalizeRangerFavoredEnemyDetails(input, subtypeArg);
  return details && details.family && MONSTER_FAMILY_META[details.family]
    ? details.family
    : null;
}

/**
 * Validates a Ranger Favored Enemy selection at Character Creation.
 * Enforces the 14 initial selectable families and strictly forbids UNDEAD, reserved families, and non-selectable families.
 */
function validateRangerFavoredEnemyChoice(input, subtypeOrOpts = null, maybeOpts = {}) {
  let raw = {};
  let opts = {};

  if (typeof input === 'string' || input === null || input === undefined) {
    if (subtypeOrOpts && typeof subtypeOrOpts === 'object') {
      raw = { favored_enemy_family: input || '' };
      opts = subtypeOrOpts;
    } else {
      raw = {
        favored_enemy_family: input || '',
        favored_enemy_subtype: typeof subtypeOrOpts === 'string' ? subtypeOrOpts : ''
      };
      opts = maybeOpts || {};
    }
  } else if (input && typeof input === 'object') {
    raw = input;
    opts = (subtypeOrOpts && typeof subtypeOrOpts === 'object') ? subtypeOrOpts : (maybeOpts || {});
  }

  const allowLegacyAliases = opts.allowLegacyAliases !== undefined
    ? Boolean(opts.allowLegacyAliases)
    : (opts.allowLegacy !== undefined ? Boolean(opts.allowLegacy) : true);

  const rawUpper = String(
    raw.favored_enemy_family ||
    raw.favoredEnemyFamily ||
    raw.favored_enemy_type ||
    raw.favoredEnemyType ||
    ''
  ).trim().toUpperCase();

  if (!rawUpper) {
    return {
      valid: false,
      code: 'RANGER_FAVORED_ENEMY_REQUIRED',
      error: 'Rangers must select a Favored Enemy family.'
    };
  }

  if (rawUpper === 'UNDEAD') {
    return {
      valid: false,
      code: 'RANGER_FAVORED_ENEMY_FORBIDDEN',
      error: 'Undead is not permitted as a Favored Enemy; Undead are the sacred domain of the Cleric.'
    };
  }

  if (rawUpper === 'HUMANOID' && !String(raw.favored_enemy_subtype || raw.favoredEnemySubtype || '').trim()) {
    return {
      valid: false,
      code: 'RANGER_FAVORED_ENEMY_SUBTYPE_REQUIRED',
      error: 'Humanoid Favored Enemy requires a subtype or specific family (e.g., Goblinoids, Orcs, Gnolls, Reptilian Humanoids).'
    };
  }

  const normalized = normalizeRangerFavoredEnemyDetails(raw);
  const family = normalized.family;

  if (family === 'UNDEAD') {
    return {
      valid: false,
      code: 'RANGER_FAVORED_ENEMY_FORBIDDEN',
      error: 'Undead is not permitted as a Favored Enemy.'
    };
  }

  if (RANGER_RESERVED_FAMILIES.includes(family)) {
    return {
      valid: false,
      code: 'RANGER_FAVORED_ENEMY_RESERVED',
      error: `${MONSTER_FAMILY_META[family].label} (${family}) is a reserved family and cannot be chosen at Character Creation.`
    };
  }

  if (RANGER_NON_SELECTABLE_FAMILIES.includes(family)) {
    return {
      valid: false,
      code: 'RANGER_FAVORED_ENEMY_NON_SELECTABLE',
      error: `${MONSTER_FAMILY_META[family].label} (${family}) cannot be selected as a Ranger Favored Enemy.`
    };
  }

  if (!RANGER_SELECTABLE_FAMILIES.includes(family)) {
    return {
      valid: false,
      code: 'RANGER_FAVORED_ENEMY_INVALID',
      error: `Invalid Favored Enemy family: "${rawUpper}".`
    };
  }

  if (!allowLegacyAliases && !RANGER_SELECTABLE_FAMILIES.includes(rawUpper)) {
    return {
      valid: false,
      code: 'RANGER_FAVORED_ENEMY_INVALID',
      error: `Invalid Favored Enemy family code: "${rawUpper}".`
    };
  }

  return {
    valid: true,
    family,
    meta: MONSTER_FAMILY_META[family],
    legacyType: normalized.legacyType,
    legacySubtype: normalized.legacySubtype
  };
}

/**
 * Updates all rows in the SQLite monsters table with their deterministic monster_family.
 * Throws if any monster in the database cannot be deterministically classified.
 */
function applyMonsterTaxonomyToDatabase(db) {
  const hasMonsterTable = db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'monsters'"
  ).get();
  if (!hasMonsterTable) return { updated: 0 };

  const cols = db.prepare('PRAGMA table_info(monsters)').all().map(c => c.name);
  if (!cols.includes('monster_family')) {
    return { updated: 0 };
  }

  const monsters = db.prepare(
    'SELECT id, name, creature_type, creature_subtype, monster_family FROM monsters ORDER BY id ASC'
  ).all();

  const updateStmt = db.prepare('UPDATE monsters SET monster_family = ? WHERE id = ?');
  let updated = 0;

  for (const m of monsters) {
    const family = resolveMonsterFamily(m, { strict: true });
    if (m.monster_family !== family) {
      updateStmt.run(family, m.id);
      updated++;
    }
  }

  return { total: monsters.length, updated };
}

/**
 * Audits the SQLite monsters table against the Phase 7A.4 22-family taxonomy specification.
 */
function auditDatabaseMonsterTaxonomy(db) {
  const monsters = db.prepare(`
    SELECT m.id, m.name, m.creature_type, m.creature_subtype, m.monster_family,
           m.base_hp, m.armor_class, m.attack_bonus, m.damage_dice, m.challenge_rating, m.solo_level,
           GROUP_CONCAT(mt.terrain) as terrains
    FROM monsters m
    LEFT JOIN monster_terrains mt ON mt.monster_id = m.id
    GROUP BY m.id
    ORDER BY m.id ASC
  `).all();

  const passableTerrains = new Set(
    db.prepare('SELECT DISTINCT terrain FROM map_tiles WHERE is_passable = 1 AND is_safe = 0')
      .all()
      .map(r => r.terrain)
  );
  const surfaceSet = new Set(CANONICAL_SURFACE_TERRAINS);

  const familyCounts = {};
  for (const fam of MONSTER_FAMILIES) {
    familyCounts[fam] = 0;
  }

  const unmatched = [];
  const mismatchedColumn = [];
  const seenNames = new Set();
  const duplicates = [];
  let surfaceMonsterCount = 0;
  let reachablePassableCount = 0;

  for (const m of monsters) {
    const normName = normalizeMonsterNameKey(m.name);
    if (seenNames.has(normName)) {
      duplicates.push(m.name);
    }
    seenNames.add(normName);

    let resolved = null;
    try {
      resolved = resolveMonsterFamily(m, { strict: true });
    } catch (err) {
      unmatched.push({ id: m.id, name: m.name, error: err.message });
    }

    if (resolved) {
      familyCounts[resolved] = (familyCounts[resolved] || 0) + 1;
      if (m.monster_family !== resolved) {
        mismatchedColumn.push({ id: m.id, name: m.name, actual: m.monster_family, expected: resolved });
      }
    }

    const terrainList = m.terrains ? m.terrains.split(',').filter(Boolean) : [];
    if (terrainList.some(t => surfaceSet.has(t))) {
      surfaceMonsterCount++;
    }
    if (terrainList.some(t => passableTerrains.has(t))) {
      reachablePassableCount++;
    }
  }

  const mummyRow = monsters.find(m => normalizeMonsterNameKey(m.name) === 'mummy') || null;

  return {
    totalMonsters: monsters.length,
    validFamiliesCount: MONSTER_FAMILIES.length,
    selectableFamiliesCount: RANGER_SELECTABLE_FAMILIES.length,
    reservedFamiliesCount: RANGER_RESERVED_FAMILIES.length,
    nonSelectableFamiliesCount: RANGER_NON_SELECTABLE_FAMILIES.length,
    forbiddenFamiliesCount: RANGER_FORBIDDEN_FAMILIES.length,
    undeadCountInDb: familyCounts.UNDEAD || 0,
    designTaxonomyUndeadCount: 11,
    designTaxonomySurfaceCount: 88,
    actualSurfaceMonsterCount: surfaceMonsterCount,
    reachablePassableMonsterCount: reachablePassableCount,
    familyCounts,
    unmatched,
    mismatchedColumn,
    duplicates,
    mummyVerification: mummyRow
      ? {
          id: mummyRow.id,
          name: mummyRow.name,
          family: mummyRow.monster_family,
          base_hp: mummyRow.base_hp,
          armor_class: mummyRow.armor_class,
          attack_bonus: mummyRow.attack_bonus,
          damage_dice: mummyRow.damage_dice,
          challenge_rating: mummyRow.challenge_rating,
          solo_level: mummyRow.solo_level,
          statsPreserved:
            mummyRow.base_hp === 45 &&
            mummyRow.armor_class === 20 &&
            mummyRow.attack_bonus === 14 &&
            mummyRow.damage_dice === '1d8+10' &&
            mummyRow.challenge_rating === 5 &&
            mummyRow.solo_level === 5 &&
            mummyRow.monster_family === 'UNDEAD'
        }
      : null
  };
}

module.exports = {
  MONSTER_FAMILY_META,
  MONSTER_FAMILIES,
  RANGER_SELECTABLE_FAMILIES,
  RANGER_RESERVED_FAMILIES,
  RANGER_NON_SELECTABLE_FAMILIES,
  RANGER_FORBIDDEN_FAMILIES,
  CANONICAL_SURFACE_TERRAINS,
  EXPLICIT_MONSTER_NAME_TO_FAMILY,
  getFamilyMetadata,
  resolveMonsterFamily,
  getRangerSelectableFamilies,
  getRangerSelectableFamilyOptions,
  normalizeRangerFavoredEnemyDetails,
  normalizeRangerFavoredEnemy,
  validateRangerFavoredEnemyChoice,
  applyMonsterTaxonomyToDatabase,
  auditDatabaseMonsterTaxonomy
};
