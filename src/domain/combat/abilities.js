/**
 * Darkgrid Monster Special Abilities & Permadeath-Safe Combat Mechanics
 * Implements the 12 reusable Pathfinder 1e ability archetypes across all 68 monsters,
 * Hero Saving Throws (Fortitude, Reflex, Will, Physical), and all 9 Permadeath Safety Rules.
 *
 * Strictly adheres to Darkgrid's Hidden Math Policy:
 * - Public combat event text (`public_text`) uses atmospheric dark-fantasy prose without raw numbers, dice formulas, or DCs.
 * - Structured details are recorded in event `details` JSON and `encounters.combat_state_json`.
 */

const { getHeroSavingThrows } = require('../character/rules');
const { rollD20, rollDice } = require('./dice');

/**
 * Parses encounter.combat_state_json into a normalized state object.
 */
function parseCombatStateJson(rawJson) {
  let parsed = {};
  if (typeof rawJson === 'string' && rawJson.trim()) {
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      parsed = {};
    }
  } else if (rawJson && typeof rawJson === 'object') {
    parsed = { ...rawJson };
  }

  return {
    auraResolved: Boolean(parsed.auraResolved),
    ferocityTriggered: Boolean(parsed.ferocityTriggered),
    bloodFrenzyActive: Boolean(parsed.bloodFrenzyActive),
    stirgeAttached: Boolean(parsed.stirgeAttached),
    stirgeDrainCount: Number(parsed.stirgeDrainCount || 0),
    poisonDosesUsed: Number(parsed.poisonDosesUsed || 0),
    paralysisCooldown: Number(parsed.paralysisCooldown || 0),
    breathCooldown: Number(parsed.breathCooldown || 0),
    heroStatuses: {
      poison: parsed.heroStatuses?.poison || null,       // { rounds, dmgFormula, atkPenalty, acPenalty, label }
      disease: parsed.heroStatuses?.disease || null,     // { atkPenalty, dmgPenalty, label }
      bleed: parsed.heroStatuses?.bleed || null,         // { rounds, dmgFormula, label }
      tripped: Number(parsed.heroStatuses?.tripped || 0),
      grabbed: parsed.heroStatuses?.grabbed || null,     // { acPenalty, atkPenalty, constrictFormula, label }
      entangled: Number(parsed.heroStatuses?.entangled || 0),
      shaken: Number(parsed.heroStatuses?.shaken || 0),
      sickened: Number(parsed.heroStatuses?.sickened || 0),
      paralyzed: Number(parsed.heroStatuses?.paralyzed || 0),
      calcifyStacks: Number(parsed.heroStatuses?.calcifyStacks || 0),
      corroded: Boolean(parsed.heroStatuses?.corroded),
      drainStacks: Number(parsed.heroStatuses?.drainStacks || 0)
    }
  };
}

/**
 * Serializes combat state object to JSON string.
 */
function serializeCombatStateJson(state) {
  return JSON.stringify(state || {});
}

/**
 * Determines the damage types ('B', 'S', 'P') and magical status of a hero's attack.
 */
function getWeaponCombatTraits(character, activeWeapon = null, monster = null) {
  const types = new Set();
  let isMagical = false;

  if (activeWeapon) {
    if (Number(activeWeapon.is_magical) === 1 || Number(activeWeapon.enhancement_bonus || 0) > 0) {
      isMagical = true;
    }
    if (activeWeapon.attributes) {
      let attrs = activeWeapon.attributes;
      if (typeof attrs === 'string') {
        try { attrs = JSON.parse(attrs); } catch { attrs = {}; }
      }
      const dt = (attrs.damage_type || '').toLowerCase();
      if (dt.includes('bludgeon')) types.add('B');
      if (dt.includes('slash')) types.add('S');
      if (dt.includes('pierc')) types.add('P');
    }
    const name = (activeWeapon.name || '').toLowerCase();
    if (
      name.includes('mace') || name.includes('club') || name.includes('hammer') ||
      name.includes('staff') || name.includes('flail') || name.includes('sling') ||
      name.includes('morningstar')
    ) {
      types.add('B');
    }
    if (
      name.includes('sword') || name.includes('axe') || name.includes('scimitar') ||
      name.includes('falchion') || name.includes('glaive') || name.includes('halberd') ||
      name.includes('scythe') || name.includes('dagger')
    ) {
      types.add('S');
    }
    if (
      name.includes('bow') || name.includes('spear') || name.includes('rapier') ||
      name.includes('dagger') || name.includes('dart') || name.includes('javelin') ||
      name.includes('morningstar') || name.includes('halberd') || name.includes('scythe')
    ) {
      types.add('P');
    }
  } else {
    // Unarmed strike is bludgeoning
    types.add('B');
  }

  // Cleric Holy Radiance imbues attacks with sacred energy against Undead
  const isUndead = Boolean(
    monster && (
      (monster.creature_type || '').toUpperCase() === 'UNDEAD' ||
      (monster.creature_subtype || '').toLowerCase().includes('undead')
    )
  );
  if (character && (character.class || '').toUpperCase() === 'CLERIC' && isUndead) {
    isMagical = true;
  }

  if (types.size === 0) {
    types.add('S');
  }

  return { types, isMagical };
}

/**
 * Returns the Pathfinder 1e Darkgrid-adapted ability profile for any of the 68 monsters.
 */
function getMonsterAbilityProfile(monster) {
  const name = (monster && (monster.base_monster_name || monster.monster_name || monster.name) ? (monster.base_monster_name || monster.monster_name || monster.name) : '').trim();
  const p = {
    dr: null,               // { amount, bypass: 'B'|'S'|'B_OR_S'|'MAGIC'|'NONE', label }
    splitMitigation: false, // Ochre Jelly: blades part protoplasm (-2 dmg from S/P)
    amorphous: false,       // Gibbering Mouther: resistant to critical precision
    evasion: null,          // { type: 'BLINK'|'SHADOW_SHIFT'|'ETHEREAL'|'INCORPOREAL', margin: 1 }
    regeneration: 0,        // HP regenerated per round while alive
    ferocity: false,        // Survives at 1 HP once if not overkill
    bloodFrenzy: false,     // +2 Atk, +2 Dmg, -2 AC when wounded
    combatStartAura: null,  // { type: 'STENCH'|'FEAR'|'ENTANGLE', save: 'FORT'|'WILL'|'REF', dc, rounds, label }
    openingStrike: null,    // { atkBonus, bonusDmgFormula, label } on Round 1
    rend: null,             // { bonusDmgFormula, margin: 4, label }
    cooldownSpecial: null,  // { interval, dmgFormula, refDc, label }
    elementalRider: null,   // { dmgFormula, element, label }
    poison: null,           // { dc, dmgFormula, rounds: 3, atkPenalty, acPenalty, maxDoses, label }
    disease: null,          // { dc, atkPenalty, dmgPenalty, label }
    bleed: null,            // { dmgFormula, rounds: 2, label }
    trip: null,             // { dc, label }
    grab: null,             // { dc, constrictFormula, label }
    paralysis: null,        // { dc, label }
    attachDrain: null,      // { drainFormula, label }
    drain: null,            // { dc, healAmt, label }
    calcify: null,          // { dc, stage2DmgFormula, label }
    rust: null              // { dc, label }
  };

  switch (name) {
    case 'Assassin Vine':
      p.combatStartAura = { type: 'ENTANGLE', save: 'REF', dc: 13, rounds: 2, label: 'Entangling Vines' };
      p.grab = { dc: 14, constrictFormula: '1d6+2', label: 'Crushing Vines' };
      break;
    case 'Wolf':
      p.trip = { dc: 12, label: 'Tripping Bite' };
      break;
    case 'Troll':
      p.regeneration = 3;
      p.rend = { bonusDmgFormula: '1d6+3', margin: 4, label: 'Claw Rend' };
      break;
    case 'Ghoul':
      p.paralysis = { dc: 12, label: 'Paralyzing Touch' };
      p.disease = { dc: 12, atkPenalty: 1, dmgPenalty: 1, label: 'Ghoul Fever' };
      break;
    case 'Giant Spider':
      p.combatStartAura = { type: 'ENTANGLE', save: 'REF', dc: 12, rounds: 2, label: 'Sticky Webbing' };
      p.poison = { dc: 13, dmgFormula: '1d2', rounds: 3, atkPenalty: 1, acPenalty: 0, label: 'Arachnid Venom' };
      break;
    case 'Choker':
      p.openingStrike = { atkBonus: 2, bonusDmgFormula: null, label: 'Supernatural Quickness' };
      p.grab = { dc: 13, constrictFormula: '1d4+2', label: 'Strangling Tentacles' };
      break;
    case 'Rust Monster':
      p.rust = { dc: 14, label: 'Corrosive Antennae' };
      break;
    case 'Manticore':
      p.cooldownSpecial = { interval: 2, dmgFormula: '2d6+3', refDc: 15, label: 'Tail Spike Volley' };
      break;
    case 'Kobold':
      p.openingStrike = { atkBonus: 1, bonusDmgFormula: null, label: 'Crafty Skirmish' };
      break;
    case 'Goblin':
      p.openingStrike = { atkBonus: 1, bonusDmgFormula: '1d2', label: 'Goblin Ambush' };
      break;
    case 'Human Skeleton':
      p.dr = { amount: 3, bypass: 'B', label: 'Skeletal Bones' };
      break;
    case 'Hobgoblin':
      p.openingStrike = { atkBonus: 1, bonusDmgFormula: '1d3', label: 'Disciplined Phalanx Strike' };
      break;
    case 'Human Zombie':
      p.dr = { amount: 2, bypass: 'S', label: 'Dead Flesh' };
      break;
    case 'Troglodyte':
      p.combatStartAura = { type: 'STENCH', save: 'FORT', dc: 13, rounds: 3, label: 'Reptilian Stench' };
      break;
    case 'Darkmantle':
      p.combatStartAura = { type: 'ENTANGLE', save: 'REF', dc: 12, rounds: 2, label: 'Cloak of Darkness' };
      p.grab = { dc: 12, constrictFormula: '1d4+2', label: 'Constricting Mantle' };
      break;
    case 'Lizardfolk':
      p.rend = { bonusDmgFormula: '1d4+1', margin: 4, label: 'Savaging Bite Follow-up' };
      break;
    case 'Hyena':
      p.trip = { dc: 12, label: 'Bone-Snapping Trip' };
      break;
    case 'Gnoll':
      p.openingStrike = { atkBonus: 1, bonusDmgFormula: '1d4', label: 'Savagery Charge' };
      break;
    case 'Giant Frog':
      p.grab = { dc: 12, constrictFormula: null, label: 'Sticky Tongue Lash' };
      break;
    case 'Boar':
      p.ferocity = true;
      break;
    case 'Yellow Musk Creeper':
      p.paralysis = { dc: 13, label: 'Hypnotic Pollen Spray' };
      break;
    case 'Bugbear':
      p.openingStrike = { atkBonus: 2, bonusDmgFormula: '1d4+1', label: 'Stalker Surprise' };
      break;
    case 'Boggard':
      p.combatStartAura = { type: 'FEAR', save: 'WILL', dc: 13, rounds: 2, label: 'Terrifying Croak' };
      p.grab = { dc: 12, constrictFormula: null, label: 'Sticky Tongue' };
      break;
    case 'Death Dog':
      p.trip = { dc: 13, label: 'Twin-Jaw Knockdown' };
      p.disease = { dc: 13, atkPenalty: 1, dmgPenalty: 1, label: 'Carrion Rot' };
      p.rend = { bonusDmgFormula: '1d4+1', margin: 4, label: 'Twin-Headed Tear' };
      break;
    case 'Giant Crab':
      p.grab = { dc: 13, constrictFormula: '1d4+2', label: 'Crushing Pincers' };
      break;
    case 'Ettercap':
      p.combatStartAura = { type: 'ENTANGLE', save: 'REF', dc: 14, rounds: 2, label: 'Barbed Web Snare' };
      p.poison = { dc: 14, dmgFormula: '1d3', rounds: 3, atkPenalty: 0, acPenalty: 1, label: 'Ettercap Neurotoxin' };
      break;
    case 'Cockatrice':
      p.calcify = { dc: 12, stage2DmgFormula: '2d6', label: 'Calcifying Peck' };
      break;
    case 'Ankheg':
      p.elementalRider = { dmgFormula: '1d4', element: 'acid', label: 'Acidic Mandibles' };
      p.grab = { dc: 14, constrictFormula: null, label: 'Mandible Clamp' };
      p.cooldownSpecial = { interval: 3, dmgFormula: '3d4', refDc: 14, label: 'Caustic Acid Spray' };
      break;
    case 'Ogre':
      p.openingStrike = { atkBonus: 1, bonusDmgFormula: '1d6', label: 'Overhead Greatclub Smash' };
      break;
    case 'Shadow':
      p.evasion = { type: 'INCORPOREAL', margin: 1 };
      p.drain = { dc: 13, healAmt: 3, label: 'Strength-Draining Touch' };
      break;
    case 'Owlbear':
      p.grab = { dc: 15, constrictFormula: '1d6+2', label: 'Crushing Bear Hug' };
      break;
    case 'Minotaur':
      p.openingStrike = { atkBonus: 2, bonusDmgFormula: '1d6+2', label: 'Powerful Gore Charge' };
      break;
    case 'Yeti':
      p.combatStartAura = { type: 'FEAR', save: 'WILL', dc: 13, rounds: 2, label: 'Frightful Gaze' };
      p.elementalRider = { dmgFormula: '1d4', element: 'cold', label: 'Freezing Claws' };
      p.rend = { bonusDmgFormula: '1d6+3', margin: 4, label: 'Frozen Rend' };
      break;
    case 'Gargoyle':
      p.dr = { amount: 3, bypass: 'MAGIC', label: 'Stone Hide' };
      p.openingStrike = { atkBonus: 2, bonusDmgFormula: '1d4', label: 'Statue Ambush Swoop' };
      break;
    case 'Basilisk':
      p.calcify = { dc: 15, stage2DmgFormula: '2d6', label: 'Petrifying Gaze' };
      break;
    case 'Mummy':
      p.dr = { amount: 3, bypass: 'NONE', label: 'Ancient Wrappings' };
      p.combatStartAura = { type: 'FEAR', save: 'WILL', dc: 15, rounds: 2, label: 'Aura of Despair' };
      p.disease = { dc: 15, atkPenalty: 2, dmgPenalty: 2, label: 'Mummy Rot Curse' };
      break;
    case 'Ochre Jelly':
      p.splitMitigation = true;
      p.elementalRider = { dmgFormula: '1d4', element: 'acid', label: 'Digestive Acid' };
      p.grab = { dc: 14, constrictFormula: '1d4+2', label: 'Protoplasmic Engulf' };
      break;
    case 'Winter Wolf':
      p.elementalRider = { dmgFormula: '1d4', element: 'cold', label: 'Frostbite Jaws' };
      p.trip = { dc: 15, label: 'Glacial Knockdown' };
      p.cooldownSpecial = { interval: 3, dmgFormula: '3d6', refDc: 15, label: 'Cone of Freezing Breath' };
      break;
    case 'Stirge':
      p.attachDrain = { drainFormula: '1d3', label: 'Blood-Draining Proboscis' };
      break;
    case 'Dire Rat':
      p.disease = { dc: 11, atkPenalty: 1, dmgPenalty: 1, label: 'Filth Fever' };
      break;
    case 'Viper':
      p.poison = { dc: 11, dmgFormula: '1d2', rounds: 3, atkPenalty: 1, acPenalty: 0, label: 'Viper Hemotoxin' };
      break;
    case 'Giant Centipede':
      p.poison = { dc: 12, dmgFormula: '1d2', rounds: 3, atkPenalty: 0, acPenalty: 1, label: 'Centipede Venom' };
      break;
    case 'Iron Cobra':
      p.dr = { amount: 2, bypass: 'MAGIC', label: 'Iron Construct Plating' };
      p.poison = { dc: 13, dmgFormula: '1d2', rounds: 3, atkPenalty: 1, acPenalty: 0, maxDoses: 3, label: 'Reservoir Fangs' };
      break;
    case 'Skeletal Champion':
      p.dr = { amount: 3, bypass: 'B', label: 'Armored Bone' };
      p.rend = { bonusDmgFormula: '1d4+1', margin: 4, label: 'Masterwork Riposte' };
      break;
    case 'Blink Dog':
      p.evasion = { type: 'BLINK', margin: 0 };
      break;
    case 'Duergar':
      p.bloodFrenzy = true; // Enlarge Person giant growth when bloodied
      break;
    case 'Drow':
      p.poison = { dc: 12, dmgFormula: '1d2', rounds: 2, atkPenalty: 1, acPenalty: 0, label: 'Drow Lethargy Bolt' };
      break;
    case 'Orc':
      p.ferocity = true;
      break;
    case 'Wight':
      p.drain = { dc: 14, healAmt: 3, label: 'Life-Draining Slam' };
      break;
    case 'Harpy':
      p.combatStartAura = { type: 'FEAR', save: 'WILL', dc: 15, rounds: 2, label: 'Captivating Siren Song' };
      break;
    case 'Doppelganger':
      p.openingStrike = { atkBonus: 2, bonusDmgFormula: '1d6', label: 'Mind-Reading Feint' };
      break;
    case 'Griffon':
      p.openingStrike = { atkBonus: 2, bonusDmgFormula: '1d6+2', label: 'Diving Pounce & Rake' };
      break;
    case 'Giant Scorpion':
      p.grab = { dc: 15, constrictFormula: '1d4+2', label: 'Pincer Constrict' };
      p.poison = { dc: 15, dmgFormula: '1d3', rounds: 3, atkPenalty: 1, acPenalty: 0, label: 'Scorpion Sting Venom' };
      break;
    case 'Cloaker':
      p.evasion = { type: 'SHADOW_SHIFT', margin: 1 };
      p.combatStartAura = { type: 'FEAR', save: 'WILL', dc: 15, rounds: 2, label: 'Infrasonic Moan' };
      p.grab = { dc: 15, constrictFormula: '1d6+2', label: 'Smothering Engulf' };
      break;
    case 'Phase Spider':
      p.openingStrike = { atkBonus: 2, bonusDmgFormula: '1d6', label: 'Ethereal Ambush' };
      p.evasion = { type: 'ETHEREAL', margin: 0 };
      p.poison = { dc: 16, dmgFormula: '1d4', rounds: 3, atkPenalty: 1, acPenalty: 0, label: 'Phase Venom' };
      p.grab = { dc: 15, constrictFormula: null, label: 'Ethereal Bite Grab' };
      break;
    case 'Wraith':
      p.evasion = { type: 'INCORPOREAL', margin: 1 };
      p.drain = { dc: 15, healAmt: 4, label: 'Constitution Drain' };
      break;
    case 'Gibbering Mouther':
      p.amorphous = true;
      p.dr = { amount: 4, bypass: 'B', label: 'Amorphous Flesh' };
      p.combatStartAura = { type: 'FEAR', save: 'WILL', dc: 13, rounds: 2, label: 'Maddening Gibbering' };
      p.grab = { dc: 14, constrictFormula: '1d4+1', label: 'Maw Engulf & Blood Drain' };
      break;
    case 'Peryton':
      p.dr = { amount: 3, bypass: 'MAGIC', label: 'Cursed Hide' };
      p.combatStartAura = { type: 'FEAR', save: 'WILL', dc: 13, rounds: 2, label: 'Shadow Mark' };
      break;
    case 'Giant Stag Beetle':
      p.openingStrike = { atkBonus: 2, bonusDmgFormula: '1d6+2', label: 'Crushing Trample' };
      break;
    case 'Vegepygmy':
      p.dr = { amount: 2, bypass: 'B_OR_S', label: 'Fibrous Mold Flesh' };
      break;
    case 'Ghast':
      p.combatStartAura = { type: 'STENCH', save: 'FORT', dc: 14, rounds: 3, label: 'Carrion Stench' };
      p.paralysis = { dc: 14, label: 'Ghast Paralysis' };
      p.disease = { dc: 14, atkPenalty: 1, dmgPenalty: 1, label: 'Ghast Fever' };
      break;
    case 'Giant Bat':
      p.openingStrike = { atkBonus: 2, bonusDmgFormula: '1d4', label: 'Echolocation Swoop' };
      break;
    case 'Morlock':
      p.openingStrike = { atkBonus: 2, bonusDmgFormula: '1d6', label: 'Ceiling Leap Sneak Attack' };
      break;
    case 'Violet Fungus':
      p.poison = { dc: 14, dmgFormula: '1d3', rounds: 3, atkPenalty: 1, acPenalty: 0, label: 'Necrotic Rot Spores' };
      break;
    case 'Grick':
      p.dr = { amount: 3, bypass: 'MAGIC', label: 'Rubber-Hide Resilience' };
      p.rend = { bonusDmgFormula: '1d4+1', margin: 4, label: 'Tentacle Flurry' };
      break;
    case 'Krenshar':
      p.combatStartAura = { type: 'FEAR', save: 'WILL', dc: 12, rounds: 2, label: 'Skullface Screech' };
      break;
    case 'Bunyip':
      p.combatStartAura = { type: 'FEAR', save: 'WILL', dc: 13, rounds: 2, label: 'Terrifying Roar' };
      p.bleed = { dmgFormula: '1d4', rounds: 2, label: 'Ragged Shark-Tooth Bleed' };
      p.bloodFrenzy = true;
      break;
    case 'Sahuagin':
      p.bloodFrenzy = true;
      break;
    // --- 30 New Night-Work Monsters (Levels 1-5) ---
    case 'Mite':
      p.openingStrike = { atkBonus: 1, bonusDmgFormula: null, label: 'Underbrush Dart' };
      break;
    case 'Bog Strider':
      p.openingStrike = { atkBonus: 1, bonusDmgFormula: null, label: 'Skimming Lunge' };
      break;
    case 'Blood Hawk':
      p.bleed = { dmgFormula: '1d2', rounds: 2, label: 'Razor Talon Bleed' };
      break;
    case 'Jungle Viper':
      p.poison = { dc: 11, dmgFormula: '1d2', rounds: 3, atkPenalty: 1, acPenalty: 0, label: 'Canopy Viper Venom' };
      break;
    case 'Plague Zombie':
      p.dr = { amount: 2, bypass: 'S', label: 'Rotting Flesh' };
      p.disease = { dc: 11, atkPenalty: 1, dmgPenalty: 1, label: 'Zombie Rot' };
      break;
    case 'Grippli Scout':
      p.openingStrike = { atkBonus: 2, bonusDmgFormula: '1d2', label: 'Camouflaged Dart Volley' };
      break;
    case 'Worg':
      p.trip = { dc: 13, label: 'Savaging Knockdown' };
      break;
    case 'Hippogriff':
      p.openingStrike = { atkBonus: 2, bonusDmgFormula: '1d4', label: 'Diving Wing Slash' };
      break;
    case 'Giant Toad':
      p.grab = { dc: 13, constrictFormula: '1d4', label: 'Cavernous Maw Gulp' };
      p.poison = { dc: 12, dmgFormula: '1d2', rounds: 2, atkPenalty: 1, acPenalty: 0, label: 'Noxious Skin Secretions' };
      break;
    case 'Carbuncle':
      p.dr = { amount: 2, bypass: 'B', label: 'Mineral Shell Plates' };
      p.combatStartAura = { type: 'FEAR', save: 'WILL', dc: 12, rounds: 2, label: 'Discordant Ruby Pulse' };
      break;
    case 'Phantom Fungus':
      p.evasion = { type: 'BLINK', margin: 0 };
      p.poison = { dc: 12, dmgFormula: '1d2', rounds: 2, atkPenalty: 1, acPenalty: 0, label: 'Hallucinogenic Spores' };
      break;
    case 'Gnoll Packmaster':
      p.openingStrike = { atkBonus: 2, bonusDmgFormula: '1d4', label: 'Barbed Whip Lash' };
      p.trip = { dc: 12, label: 'Entangling Whip Trip' };
      break;
    case 'Giant Mantis':
      p.openingStrike = { atkBonus: 2, bonusDmgFormula: '1d4', label: 'Camouflaged Raptorial Strike' };
      p.grab = { dc: 14, constrictFormula: '1d4+2', label: 'Serrated Forelimb Vise' };
      break;
    case 'Spriggan':
      p.bloodFrenzy = true;
      p.openingStrike = { atkBonus: 1, bonusDmgFormula: '1d4', label: 'Feral Size Surge' };
      break;
    case "Will-o'-Wisp":
      p.evasion = { type: 'INCORPOREAL', margin: 1 };
      p.elementalRider = { dmgFormula: '1d4', element: 'electricity', label: 'Crackling Marsh Arc' };
      break;
    case 'Cheetah':
      p.openingStrike = { atkBonus: 3, bonusDmgFormula: '1d6+1', label: 'Blinding Sprint Pounce' };
      p.trip = { dc: 13, label: 'High-Speed Takedown' };
      break;
    case 'Draugr':
      p.dr = { amount: 2, bypass: 'S', label: 'Waterlogged Corpse-Hide' };
      p.combatStartAura = { type: 'STENCH', save: 'FORT', dc: 13, rounds: 2, label: 'Brine-Rot Reek' };
      break;
    case 'Hobgoblin Captain':
      p.openingStrike = { atkBonus: 2, bonusDmgFormula: '1d4+1', label: 'Commander Tactical Assault' };
      p.rend = { bonusDmgFormula: '1d4+1', margin: 4, label: 'Shield Bash Follow-up' };
      break;
    case 'Displacer Beast':
      p.evasion = { type: 'SHADOW_SHIFT', margin: 1 };
      p.rend = { bonusDmgFormula: '1d6+2', margin: 4, label: 'Twin Tentacle Lash' };
      break;
    case 'Shambling Mound':
      p.dr = { amount: 3, bypass: 'S', label: 'Dense Bog-Vine Mass' };
      p.grab = { dc: 15, constrictFormula: '1d6+2', label: 'Smothering Vines' };
      break;
    case 'Leucrotta':
      p.combatStartAura = { type: 'FEAR', save: 'WILL', dc: 14, rounds: 2, label: 'Mocking Voice Lure' };
      p.bleed = { dmgFormula: '1d4', rounds: 2, label: 'Bone-Shearing Bite' };
      break;
    case 'Dire Boar':
      p.ferocity = true;
      p.openingStrike = { atkBonus: 2, bonusDmgFormula: '1d6+2', label: 'Thunderous Tusk Gore' };
      p.bleed = { dmgFormula: '1d3', rounds: 2, label: 'Goring Tusk Wound' };
      break;
    case 'Forest Drake':
      p.cooldownSpecial = { interval: 3, dmgFormula: '2d6+2', refDc: 14, label: 'Caustic Acid Cloud' };
      p.elementalRider = { dmgFormula: '1d4', element: 'acid', label: 'Venom-Acid Jaws' };
      break;
    case 'Otyugh':
      p.combatStartAura = { type: 'STENCH', save: 'FORT', dc: 14, rounds: 2, label: 'Offal Pit Stench' };
      p.grab = { dc: 14, constrictFormula: '1d4+2', label: 'Barbed Tentacle Grip' };
      p.disease = { dc: 14, atkPenalty: 1, dmgPenalty: 1, label: 'Filth Fever' };
      break;
    case 'Wyvern':
      p.grab = { dc: 15, constrictFormula: null, label: 'Raking Talons' };
      p.poison = { dc: 15, dmgFormula: '1d4', rounds: 3, atkPenalty: 1, acPenalty: 1, label: 'Wyvern Stinger Venom' };
      break;
    case 'Girallon':
      p.rend = { bonusDmgFormula: '1d6+4', margin: 3, label: 'Four-Armed Fury Rend' };
      p.bleed = { dmgFormula: '1d4', rounds: 2, label: 'Savaged Flesh' };
      break;
    case 'Catoblepas':
      p.combatStartAura = { type: 'STENCH', save: 'FORT', dc: 15, rounds: 3, label: 'Fetid Swamp Miasma' };
      p.cooldownSpecial = { interval: 3, dmgFormula: '3d6', refDc: 15, label: 'Noxious Death-Fume Breath' };
      break;
    case 'Barrow Wight':
      p.dr = { amount: 3, bypass: 'MAGIC', label: 'Wight-King Panoply' };
      p.combatStartAura = { type: 'FEAR', save: 'WILL', dc: 15, rounds: 2, label: 'Dread Barrow Presence' };
      p.drain = { dc: 15, healAmt: 4, label: 'Soul-Chilling Blade' };
      break;
    case 'Green Hag':
      p.evasion = { type: 'SHADOW_SHIFT', margin: 0 };
      p.drain = { dc: 15, healAmt: 3, label: 'Weakening Crone Claw' };
      p.combatStartAura = { type: 'FEAR', save: 'WILL', dc: 14, rounds: 2, label: 'Cackling Hex' };
      break;
    case 'Orc Warchief':
      p.ferocity = true;
      p.bloodFrenzy = true;
      p.openingStrike = { atkBonus: 2, bonusDmgFormula: '1d6+2', label: 'Warlord Cleaving Charge' };
      break;
    default:
      break;
  }

  return p;
}

/**
 * Computes current Hero Attack, Damage, and AC modifiers from active combat status effects.
 */
function getActiveStatusModifiers(combatState) {
  const s = combatState.heroStatuses;
  let atkMod = 0;
  let dmgMod = 0;
  let acMod = 0;

  if (s.poison) {
    atkMod -= Number(s.poison.atkPenalty || 0);
    acMod -= Number(s.poison.acPenalty || 0);
  }
  if (s.disease) {
    atkMod -= Number(s.disease.atkPenalty || 0);
    dmgMod -= Number(s.disease.dmgPenalty || 0);
  }
  if (s.tripped > 0) {
    atkMod -= 2;
    acMod -= 2;
  }
  if (s.grabbed) {
    atkMod -= 2;
    acMod -= 2;
  }
  if (s.entangled > 0) {
    atkMod -= 2;
    acMod -= 2;
  }
  if (s.shaken > 0) {
    atkMod -= 2;
    dmgMod -= 1;
  }
  if (s.sickened > 0) {
    atkMod -= 2;
    dmgMod -= 2;
  }
  if (s.calcifyStacks > 0) {
    atkMod -= 2;
    acMod -= 2;
  }
  if (s.corroded) {
    dmgMod -= 2;
    acMod -= 2;
  }
  if (s.drainStacks > 0) {
    atkMod -= s.drainStacks;
    dmgMod -= s.drainStacks;
  }

  return { atkMod, dmgMod, acMod };
}

/**
 * Returns an array of human-readable status badges for the UI (no raw numbers).
 */
function getPublicHeroStatusBadges(combatState) {
  if (!combatState || !combatState.heroStatuses) return [];
  const s = combatState.heroStatuses;
  const badges = [];

  if (s.paralyzed > 0) {
    badges.push({ key: 'PARALYZED', label: 'Paralyzed (Drink Potion or Flee still available!)', severity: 'danger' });
  }
  if (s.calcifyStacks > 0) {
    badges.push({ key: 'CALCIFYING', label: 'Limbs Stiffening to Stone', severity: 'danger' });
  }
  if (s.poison) {
    badges.push({ key: 'POISONED', label: s.poison.label || 'Poisoned', severity: 'warning' });
  }
  if (s.bleed) {
    badges.push({ key: 'BLEEDING', label: s.bleed.label || 'Bleeding', severity: 'warning' });
  }
  if (s.grabbed) {
    badges.push({ key: 'GRABBED', label: s.grabbed.label || 'Grappled', severity: 'warning' });
  }
  if (s.entangled > 0) {
    badges.push({ key: 'ENTANGLED', label: 'Entangled', severity: 'warning' });
  }
  if (s.tripped > 0) {
    badges.push({ key: 'TRIPPED', label: 'Knocked Off-Balance', severity: 'warning' });
  }
  if (s.sickened > 0) {
    badges.push({ key: 'SICKENED', label: 'Sickened', severity: 'info' });
  }
  if (s.shaken > 0) {
    badges.push({ key: 'SHAKEN', label: 'Shaken', severity: 'info' });
  }
  if (s.disease) {
    badges.push({ key: 'DISEASED', label: s.disease.label || 'Afflicted', severity: 'info' });
  }
  if (s.corroded) {
    badges.push({ key: 'CORRODED', label: 'Gear Corroded', severity: 'warning' });
  }
  if (s.drainStacks > 0) {
    badges.push({ key: 'DRAINED', label: 'Life Force Drained', severity: 'danger' });
  }

  return badges;
}

/**
 * Resolves Combat-Start Auras (Stench, Fear, Web/Entangle) when combat begins.
 */
function resolveCombatStartAura(character, equipment, encounter, combatState, rng, logEvent) {
  if (combatState.auraResolved) return;
  combatState.auraResolved = true;

  const profile = getMonsterAbilityProfile(encounter);
  const aura = profile.combatStartAura;
  if (!aura) return;

  const saves = getHeroSavingThrows(character, equipment);
  const saveBonus = aura.save === 'FORT' ? saves.fort : aura.save === 'REF' ? saves.ref : saves.will;
  const d20 = rollD20(rng);
  const total = d20 + saveBonus;
  const saved = d20 === 20 || (d20 !== 1 && total >= aura.dc);
  const monsterName = encounter.monster_name || encounter.name || 'the creature';

  if (saved) {
    if (aura.type === 'STENCH') {
      logEvent('MONSTER_ABILITY', `A waves of putrid stench rolls off the ${monsterName}, but you steel your stomach and resist the nausea.`, {
        ability: aura.label, saveType: aura.save, saved: true
      });
    } else if (aura.type === 'ENTANGLE') {
      logEvent('MONSTER_ABILITY', `The ${monsterName} lashes out to snare you in ${aura.label.toLowerCase()}, but you twist free before the bonds tighten!`, {
        ability: aura.label, saveType: aura.save, saved: true
      });
    } else {
      logEvent('MONSTER_ABILITY', `The ${monsterName} unleashes its ${aura.label.toLowerCase()}, yet your resolve holds firm against the dread!`, {
        ability: aura.label, saveType: aura.save, saved: true
      });
    }
    return;
  }

  if (aura.type === 'STENCH') {
    combatState.heroStatuses.sickened = aura.rounds;
    logEvent('MONSTER_ABILITY', `The overpowering stench of the ${monsterName} churns your stomach, leaving you sickened and unsteady!`, {
      ability: aura.label, status: 'SICKENED', rounds: aura.rounds, saved: false
    });
  } else if (aura.type === 'ENTANGLE') {
    combatState.heroStatuses.entangled = aura.rounds;
    logEvent('MONSTER_ABILITY', `Grasping ${aura.label.toLowerCase()} coil around your limbs, hampering your movement and guard!`, {
      ability: aura.label, status: 'ENTANGLED', rounds: aura.rounds, saved: false
    });
  } else {
    combatState.heroStatuses.shaken = aura.rounds;
    logEvent('MONSTER_ABILITY', `A cold tremor of dread grips your heart from the ${monsterName}'s ${aura.label.toLowerCase()}, leaving you shaken!`, {
      ability: aura.label, status: 'SHAKEN', rounds: aura.rounds, saved: false
    });
  }
}

/**
 * Applies Damage Reduction, Split Mitigation, Evasion/Incorporeal, and Ferocity when the hero attacks the monster.
 */
function modifyHeroAttackDamageAndState({
  character,
  activeWeapon,
  encounter,
  combatState,
  heroAttackRoll,
  rawHeroDamage,
  currentMonsterHp,
  monsterMaxHp,
  logEvent
}) {
  const profile = getMonsterAbilityProfile(encounter);
  const monsterName = encounter.monster_name || encounter.name || 'the creature';
  const monsterAC = encounter.monster_ac || encounter.armor_class || 12;
  const traits = getWeaponCombatTraits(character, activeWeapon, encounter);

  if (!heroAttackRoll.isHit) {
    return { finalDamage: 0, newMonsterHp: currentMonsterHp, evaded: false };
  }

  // 1. Evasion / Concealment / Incorporeal phase check on glancing hits (deterministic, consumes 0 extra RNG calls)
  if (profile.evasion && !heroAttackRoll.isCrit) {
    const margin = heroAttackRoll.total - monsterAC;
    const maxGlance = profile.evasion.margin || 0;
    const bypassed = profile.evasion.type === 'INCORPOREAL' && traits.isMagical;
    if (!bypassed && margin >= 0 && margin <= maxGlance) {
      logEvent('MONSTER_ABILITY', `Your strike passes through empty air as the ${monsterName} flickers out of phase at the last instant!`, {
        ability: profile.evasion.type, evaded: true
      });
      return { finalDamage: 0, newMonsterHp: currentMonsterHp, evaded: true };
    }
  }

  let damage = rawHeroDamage;

  // 2. Amorphous critical resistance (Gibbering Mouther)
  if (profile.amorphous && heroAttackRoll.isCrit) {
    damage = Math.max(1, Math.ceil(damage * 0.75));
  }

  // 3. Incorporeal non-magical damage reduction (Permadeath Safety Rule #7: 50% damage, min 1)
  if (profile.evasion && profile.evasion.type === 'INCORPOREAL' && !traits.isMagical) {
    damage = Math.max(1, Math.floor(damage * 0.5));
    logEvent('MONSTER_ABILITY', `Your non-magical weapon passes partially through the spectral form of the ${monsterName}, inflicting diminished harm.`, {
      ability: 'INCORPOREAL', mitigated: true
    });
  }

  // 4. Ochre Jelly Split Mitigation (blades part protoplasm without full force; bludgeoning deals full damage)
  if (profile.splitMitigation && !traits.types.has('B')) {
    damage = Math.max(1, damage - 2);
    logEvent('MONSTER_ABILITY', `Your blade slices through the ${monsterName}'s gelatinous mass, which Flows and reforms around the cut!`, {
      ability: 'SPLIT_MITIGATION', mitigated: true
    });
  }

  // 5. Damage Reduction (DR X/bludgeoning, slashing, magic, or —; Permadeath Safety Rule #7: min 1 damage)
  if (profile.dr && profile.dr.amount > 0) {
    let bypassed = false;
    if (profile.dr.bypass === 'B' && traits.types.has('B')) bypassed = true;
    if (profile.dr.bypass === 'S' && traits.types.has('S')) bypassed = true;
    if (profile.dr.bypass === 'B_OR_S' && (traits.types.has('B') || traits.types.has('S'))) bypassed = true;
    if (profile.dr.bypass === 'MAGIC' && traits.isMagical) bypassed = true;

    if (!bypassed && damage > 1) {
      damage = Math.max(1, damage - profile.dr.amount);
      logEvent('MONSTER_ABILITY', `The ${monsterName}'s ${profile.dr.label.toLowerCase()} absorbs part of the blow's impact!`, {
        ability: 'DAMAGE_REDUCTION', bypass: profile.dr.bypass
      });
    }
  }

  let newMonsterHp = currentMonsterHp - damage;

  // 6. Ferocity (Orc, Boar) — Permadeath Safety Rule #9: survives at 1 HP once unless overkill or low-HP test
  if (
    profile.ferocity &&
    !combatState.ferocityTriggered &&
    newMonsterHp <= 0 &&
    monsterMaxHp >= 4 &&
    currentMonsterHp > 1 &&
    Math.abs(newMonsterHp) < Math.ceil(monsterMaxHp * 0.5) &&
    Number(character.level || 1) >= 1 &&
    Number(character.current_hp || 10) > 3
  ) {
    combatState.ferocityTriggered = true;
    newMonsterHp = 1;
    logEvent('MONSTER_ABILITY', `Though mortally wounded, the ${monsterName} snarls with savage ferocity and refuses to fall!`, {
      ability: 'FEROCITY', remainingHp: 1
    });
  } else {
    newMonsterHp = Math.max(0, newMonsterHp);
  }

  // 7. Blood Frenzy / Giant Growth trigger when monster is wounded
  if (profile.bloodFrenzy && !combatState.bloodFrenzyActive && newMonsterHp > 0 && newMonsterHp < monsterMaxHp) {
    combatState.bloodFrenzyActive = true;
    logEvent('MONSTER_ABILITY', `The scent of blood drives the ${monsterName} into a reckless frenzy!`, {
      ability: 'BLOOD_FRENZY'
    });
  }

  return { finalDamage: damage, newMonsterHp, evaded: false };
}

/**
 * Resolves start-of-monster-turn effects (Troll Regeneration, Stirge attached drain, Constrict)
 * and computes monster attack/damage adjustments for the round.
 */
function resolveMonsterTurnSpecials({
  character,
  equipment,
  encounter,
  combatState,
  roundNumber,
  currentHeroHp,
  currentMonsterHp,
  monsterMaxHp,
  rng,
  logEvent
}) {
  const profile = getMonsterAbilityProfile(encounter);
  const monsterName = encounter.monster_name || encounter.name || 'the creature';
  let newHeroHp = currentHeroHp;
  let newMonsterHp = currentMonsterHp;

  // 1. Troll Regeneration (heals while alive on round >= 2)
  if (profile.regeneration > 0 && roundNumber >= 2 && newMonsterHp > 0 && newMonsterHp < monsterMaxHp) {
    newMonsterHp = Math.min(monsterMaxHp, newMonsterHp + profile.regeneration);
    logEvent('MONSTER_ABILITY', `Torn sinew and flesh knit back together as the ${monsterName} regenerates before your eyes!`, {
      ability: 'REGENERATION', healed: profile.regeneration
    });
  }

  // 2. Stirge Attached Automatic Blood Drain
  if (profile.attachDrain && combatState.stirgeAttached && newMonsterHp > 0 && newHeroHp > 0) {
    const drainRoll = rollDice(profile.attachDrain.drainFormula || '1d3', rng, 1);
    newHeroHp = Math.max(0, newHeroHp - drainRoll.total);
    combatState.stirgeDrainCount += 1;
    logEvent('MONSTER_ABILITY', `The attached ${monsterName} siphons hot blood through its barbed proboscis!`, {
      ability: 'BLOOD_DRAIN', damage: drainRoll.total
    });
    if (combatState.stirgeDrainCount >= 2) {
      combatState.stirgeAttached = false;
    }
  }

  // 3. Constrict damage while hero is Grabbed
  if (combatState.heroStatuses.grabbed && combatState.heroStatuses.grabbed.constrictFormula && newMonsterHp > 0 && newHeroHp > 0) {
    const constrictRoll = rollDice(combatState.heroStatuses.grabbed.constrictFormula, rng, 1);
    newHeroHp = Math.max(0, newHeroHp - constrictRoll.total);
    logEvent('MONSTER_ABILITY', `The ${monsterName} tightens its crushing hold around you!`, {
      ability: 'CONSTRICT', damage: constrictRoll.total
    });
  }

  // 4. Cooldown Breath Weapon / Tail Spike Volley (only on round >= 2 when cooldown is 0)
  let usedBreathOrVolley = false;
  if (profile.cooldownSpecial && roundNumber >= 2 && combatState.breathCooldown <= 0 && newMonsterHp > 0 && newHeroHp > 0) {
    usedBreathOrVolley = true;
    combatState.breathCooldown = profile.cooldownSpecial.interval;
    const saves = getHeroSavingThrows(character, equipment);
    const rawBreath = rollDice(profile.cooldownSpecial.dmgFormula, rng, 1).total;
    const d20 = rollD20(rng);
    const saved = d20 === 20 || (d20 !== 1 && d20 + saves.ref >= profile.cooldownSpecial.refDc);
    const breathDmg = saved ? Math.max(1, Math.floor(rawBreath * 0.5)) : rawBreath;
    newHeroHp = Math.max(0, newHeroHp - breathDmg);

    if (saved) {
      logEvent('MONSTER_ABILITY', `The ${monsterName} unleashes its ${profile.cooldownSpecial.label.toLowerCase()}, but you dive aside to avoid the worst of the blast!`, {
        ability: profile.cooldownSpecial.label, saved: true, damage: breathDmg
      });
    } else {
      logEvent('MONSTER_ABILITY', `The ${monsterName} engulfs you in a devastating ${profile.cooldownSpecial.label.toLowerCase()}!`, {
        ability: profile.cooldownSpecial.label, saved: false, damage: breathDmg
      });
    }
  } else if (combatState.breathCooldown > 0) {
    combatState.breathCooldown -= 1;
  }

  // 5. Compute Monster Attack Bonus & Bonus Damage for standard attack
  let monsterAbBonus = 0;
  let bonusDamageFormula = null;

  if (profile.openingStrike && roundNumber === 1) {
    monsterAbBonus += Number(profile.openingStrike.atkBonus || 0);
    bonusDamageFormula = profile.openingStrike.bonusDmgFormula || null;
  }
  if (combatState.bloodFrenzyActive) {
    monsterAbBonus += 2;
  }
  if (combatState.ferocityTriggered) {
    monsterAbBonus -= 2; // Wounded ferocity penalty
  }

  return {
    newHeroHp,
    newMonsterHp,
    usedBreathOrVolley,
    monsterAbBonus,
    bonusDamageFormula,
    bloodFrenzyDmgBonus: combatState.bloodFrenzyActive ? 2 : 0
  };
}

/**
 * Resolves Monster On-Hit effects (Elemental Rider, Rend, Poison, Disease, Bleed, Trip, Grab, Paralysis, Drain, Calcify, Rust)
 * AFTER the monster's primary attack hits and deals its base damage.
 */
function resolveMonsterOnHitEffects({
  character,
  equipment,
  encounter,
  combatState,
  monsterAttackRoll,
  heroAC,
  currentHeroHp,
  currentMonsterHp,
  monsterMaxHp,
  rng,
  logEvent
}) {
  if (!monsterAttackRoll || !monsterAttackRoll.isHit || currentHeroHp <= 0) {
    return { newHeroHp: currentHeroHp, newMonsterHp: currentMonsterHp };
  }

  const profile = getMonsterAbilityProfile(encounter);
  const saves = getHeroSavingThrows(character, equipment);
  const monsterName = encounter.monster_name || encounter.name || 'the creature';
  let newHeroHp = currentHeroHp;
  let newMonsterHp = currentMonsterHp;

  // 1. Elemental Rider (Acid / Cold)
  if (profile.elementalRider && newHeroHp > 0) {
    const elemDmg = rollDice(profile.elementalRider.dmgFormula, rng, 1).total;
    newHeroHp = Math.max(0, newHeroHp - elemDmg);
    logEvent('MONSTER_ABILITY', `Searing ${profile.elementalRider.element} from the ${monsterName}'s ${profile.elementalRider.label.toLowerCase()} burns into the wound!`, {
      ability: profile.elementalRider.label, damage: elemDmg
    });
  }

  // 2. High-Roll Rend / Multiattack Follow-up (triggers when attack roll >= heroAC + 4 or Crit)
  if (profile.rend && newHeroHp > 0 && (monsterAttackRoll.isCrit || monsterAttackRoll.total >= heroAC + (profile.rend.margin || 4))) {
    const rendDmg = rollDice(profile.rend.bonusDmgFormula, rng, 1).total;
    newHeroHp = Math.max(0, newHeroHp - rendDmg);
    logEvent('MONSTER_ABILITY', `With vicious momentum, the ${monsterName} follows through with a tearing ${profile.rend.label.toLowerCase()}!`, {
      ability: profile.rend.label, damage: rendDmg
    });
  }

  if (newHeroHp <= 0) {
    return { newHeroHp, newMonsterHp };
  }

  // 3. Stirge Attach on hit
  if (profile.attachDrain && !combatState.stirgeAttached) {
    combatState.stirgeAttached = true;
    combatState.stirgeDrainCount = 0;
    logEvent('MONSTER_ABILITY', `The ${monsterName} latches onto your flesh, driving its proboscis deep!`, {
      ability: 'ATTACH'
    });
  }

  // 4. On-Hit Bleed (stopped by drinking any healing potion)
  if (profile.bleed && !combatState.heroStatuses.bleed) {
    combatState.heroStatuses.bleed = {
      rounds: profile.bleed.rounds || 2,
      dmgFormula: profile.bleed.dmgFormula || '1d4',
      label: profile.bleed.label
    };
    logEvent('MONSTER_ABILITY', `The serrated bite leaves a jagged, profusely bleeding wound!`, {
      ability: profile.bleed.label, status: 'BLEEDING'
    });
  }

  // 5. On-Hit Poison (Permadeath Safety Rule #3: max 3 rounds, cure on 1 save, non-stacking)
  if (
    profile.poison &&
    !combatState.heroStatuses.poison &&
    (!profile.poison.maxDoses || combatState.poisonDosesUsed < profile.poison.maxDoses)
  ) {
    combatState.poisonDosesUsed += 1;
    const d20 = rollD20(rng);
    const saved = d20 === 20 || (d20 !== 1 && d20 + saves.fort >= profile.poison.dc);
    if (!saved) {
      combatState.heroStatuses.poison = {
        rounds: Math.min(3, profile.poison.rounds || 3),
        dmgFormula: profile.poison.dmgFormula || '1d2',
        dc: profile.poison.dc,
        atkPenalty: profile.poison.atkPenalty || 0,
        acPenalty: profile.poison.acPenalty || 0,
        label: profile.poison.label
      };
      logEvent('MONSTER_ABILITY', `Burning venom from the ${monsterName} courses through your veins!`, {
        ability: profile.poison.label, status: 'POISONED', saved: false
      });
    }
  }

  // 6. On-Hit Disease / Curse
  if (profile.disease && !combatState.heroStatuses.disease) {
    const d20 = rollD20(rng);
    const saved = d20 === 20 || (d20 !== 1 && d20 + saves.fort >= profile.disease.dc);
    if (!saved) {
      combatState.heroStatuses.disease = {
        atkPenalty: profile.disease.atkPenalty || 1,
        dmgPenalty: profile.disease.dmgPenalty || 1,
        label: profile.disease.label
      };
      logEvent('MONSTER_ABILITY', `Foul contagion takes hold in the wound — you are afflicted with ${profile.disease.label}!`, {
        ability: profile.disease.label, status: 'DISEASED', saved: false
      });
    }
  }

  // 7. On-Hit Trip (Physical Save = max(Fort, Ref))
  if (profile.trip && combatState.heroStatuses.tripped <= 0) {
    const d20 = rollD20(rng);
    const saved = d20 === 20 || (d20 !== 1 && d20 + saves.physical >= profile.trip.dc);
    if (!saved) {
      combatState.heroStatuses.tripped = 1;
      logEvent('MONSTER_ABILITY', `The ${monsterName}'s jaws wrench your footing away, knocking you off-balance!`, {
        ability: profile.trip.label, status: 'TRIPPED', saved: false
      });
    }
  }

  // 8. On-Hit Grab (Physical Save = max(Fort, Ref))
  if (profile.grab && !combatState.heroStatuses.grabbed) {
    const d20 = rollD20(rng);
    const saved = d20 === 20 || (d20 !== 1 && d20 + saves.physical >= profile.grab.dc);
    if (!saved) {
      combatState.heroStatuses.grabbed = {
        acPenalty: 2,
        atkPenalty: 2,
        dc: profile.grab.dc,
        constrictFormula: profile.grab.constrictFormula || null,
        label: profile.grab.label
      };
      logEvent('MONSTER_ABILITY', `The ${monsterName} seizes you in its ${profile.grab.label.toLowerCase()}!`, {
        ability: profile.grab.label, status: 'GRABBED', saved: false
      });
    }
  }

  // 9. On-Hit Paralysis (Permadeath Safety Rule #1: 1-round stun, Potion/Flee allowed, 3-round immunity cooldown)
  if (profile.paralysis && combatState.heroStatuses.paralyzed <= 0 && combatState.paralysisCooldown <= 0) {
    const d20 = rollD20(rng);
    const saved = d20 === 20 || (d20 !== 1 && d20 + saves.fort >= profile.paralysis.dc);
    if (!saved) {
      combatState.heroStatuses.paralyzed = 1;
      combatState.paralysisCooldown = 3;
      logEvent('MONSTER_ABILITY', `Numbing paralysis seizes your limbs from the ${monsterName}'s strike! You cannot attack next turn, though you may still drink a potion or flee!`, {
        ability: profile.paralysis.label, status: 'PARALYZED', saved: false
      });
    }
  }

  // 10. On-Hit Life / Ability Drain (Permadeath Safety Rule #4: encounter-scoped drain + monster leech)
  if (profile.drain && combatState.heroStatuses.drainStacks < 3) {
    const d20 = rollD20(rng);
    const saved = d20 === 20 || (d20 !== 1 && d20 + saves.fort >= profile.drain.dc);
    if (!saved) {
      combatState.heroStatuses.drainStacks += 1;
      newMonsterHp = Math.min(monsterMaxHp, newMonsterHp + (profile.drain.healAmt || 3));
      logEvent('MONSTER_ABILITY', `Freezing necrotic energy drains your strength as the ${monsterName} feeds upon your vitality!`, {
        ability: profile.drain.label, status: 'DRAINED', saved: false
      });
    }
  }

  // 11. On-Hit Progressive Calcification (Permadeath Safety Rule #2: 2-stage progressive, never 1-roll instant death)
  if (profile.calcify) {
    const d20 = rollD20(rng);
    const saved = d20 === 20 || (d20 !== 1 && d20 + saves.fort >= profile.calcify.dc);
    if (!saved) {
      if (combatState.heroStatuses.calcifyStacks === 0) {
        combatState.heroStatuses.calcifyStacks = 1;
        logEvent('MONSTER_ABILITY', `Warning! Your flesh begins stiffening into gray stone from the ${monsterName}'s ${profile.calcify.label.toLowerCase()}!`, {
          ability: profile.calcify.label, status: 'CALCIFYING', stage: 1, saved: false
        });
      } else {
        const stoneDmg = rollDice(profile.calcify.stage2DmgFormula || '2d6', rng, 1).total;
        newHeroHp = Math.max(0, newHeroHp - stoneDmg);
        combatState.heroStatuses.calcifyStacks = 0;
        logEvent('MONSTER_ABILITY', `Stone creeps across your limbs before cracking violently as you wrench yourself free in agony!`, {
          ability: profile.calcify.label, status: 'CALCIFIED_BURST', stage: 2, damage: stoneDmg, saved: false
        });
      }
    }
  }

  // 12. On-Hit Rust Corrosion (Permadeath Safety Rule #6: temporary encounter debuff, never deletes items)
  if (profile.rust && !combatState.heroStatuses.corroded) {
    const d20 = rollD20(rng);
    const saved = d20 === 20 || (d20 !== 1 && d20 + saves.ref >= profile.rust.dc);
    if (!saved) {
      combatState.heroStatuses.corroded = true;
      logEvent('MONSTER_ABILITY', `The ${monsterName}'s antennae lash your gear, coating metal in flaky orange rust and weakening its protection for this battle!`, {
        ability: profile.rust.label, status: 'CORRODED', saved: false
      });
    }
  }

  return { newHeroHp, newMonsterHp };
}

/**
 * Resolves end-of-round ongoing status ticks (Poison DoT + cure 1 save, Bleed DoT, Grab break-free, duration countdowns).
 */
function resolveEndOfRoundStatusTicks({
  character,
  equipment,
  combatState,
  currentHeroHp,
  rng,
  logEvent
}) {
  const s = combatState.heroStatuses;
  const saves = getHeroSavingThrows(character, equipment);
  let newHeroHp = currentHeroHp;

  if (combatState.paralysisCooldown > 0) {
    combatState.paralysisCooldown -= 1;
  }

  // 1. Poison tick & Cure-1-Save check (Permadeath Safety Rule #3)
  if (s.poison && newHeroHp > 0) {
    const d20 = rollD20(rng);
    const cured = d20 === 20 || (d20 !== 1 && d20 + saves.fort >= (s.poison.dc || 12));
    if (cured) {
      logEvent('STATUS_EFFECT', `Your body purges the ${s.poison.label.toLowerCase()}!`, {
        status: 'POISON_CURED'
      });
      s.poison = null;
    } else {
      const poisonDmg = rollDice(s.poison.dmgFormula || '1d2', rng, 1).total;
      newHeroHp = Math.max(0, newHeroHp - poisonDmg);
      s.poison.rounds -= 1;
      logEvent('STATUS_EFFECT', `Venom burns through your bloodstream!`, {
        status: 'POISON_TICK', damage: poisonDmg, remainingRounds: s.poison.rounds
      });
      if (s.poison.rounds <= 0) {
        s.poison = null;
      }
    }
  }

  // 2. Bleed tick
  if (s.bleed && newHeroHp > 0) {
    const bleedDmg = rollDice(s.bleed.dmgFormula || '1d4', rng, 1).total;
    newHeroHp = Math.max(0, newHeroHp - bleedDmg);
    s.bleed.rounds -= 1;
    logEvent('STATUS_EFFECT', `Warm blood continues to flow from your ragged wound!`, {
      status: 'BLEED_TICK', damage: bleedDmg, remainingRounds: s.bleed.rounds
    });
    if (s.bleed.rounds <= 0) {
      s.bleed = null;
    }
  }

  // 3. Grab break-free check at end of round
  if (s.grabbed && newHeroHp > 0) {
    const d20 = rollD20(rng);
    if (d20 === 20 || d20 + saves.physical >= (s.grabbed.dc || 13)) {
      logEvent('STATUS_EFFECT', `You wrench yourself free from the creature's grasp!`, {
        status: 'GRAB_ESCAPED'
      });
      s.grabbed = null;
    }
  }

  // 4. Decrement round-based debuffs
  if (s.tripped > 0) s.tripped -= 1;
  if (s.entangled > 0) s.entangled -= 1;
  if (s.shaken > 0) s.shaken -= 1;
  if (s.sickened > 0) s.sickened -= 1;

  return { newHeroHp };
}

module.exports = {
  parseCombatStateJson,
  serializeCombatStateJson,
  getWeaponCombatTraits,
  getMonsterAbilityProfile,
  getActiveStatusModifiers,
  getPublicHeroStatusBadges,
  resolveCombatStartAura,
  modifyHeroAttackDamageAndState,
  resolveMonsterTurnSpecials,
  resolveMonsterOnHitEffects,
  resolveEndOfRoundStatusTicks
};
