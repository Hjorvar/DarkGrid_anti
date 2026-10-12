/**
 * Darkgrid Combat Narrative Generator
 * Generates descriptive, atmospheric English combat log entries without leaking numeric data.
 * Context-aware: respects equipped weapon types and monster physiology.
 */

/**
 * Returns flavor descriptors for the hero's weapon.
 */
function getWeaponDescriptor(equippedWeapon) {
  if (!equippedWeapon) {
    return { name: 'fist', type: 'unarmed', verb: 'strike', hitVerb: 'strikes' };
  }

  const name = equippedWeapon.name.toLowerCase();
  if (name.includes('bow')) {
    return { name: 'arrow', type: 'ranged', verb: 'release an arrow', hitVerb: 'pierces' };
  }
  if (name.includes('mace') || name.includes('hammer') || name.includes('flail')) {
    return { name: 'mace', type: 'bludgeoning', verb: 'swing your mace', hitVerb: 'crushes into' };
  }
  return { name: 'blade', type: 'slashing', verb: 'slash with your blade', hitVerb: 'cleaves into' };
}

/**
 * Returns natural attack descriptors for a monster.
 */
function getMonsterAttackDescriptor(monster) {
  const name = (monster.name || '').toLowerCase();
  const type = (monster.creature_type || '').toLowerCase();

  if (type === 'plant' || name.includes('vine') || name.includes('creeper')) {
    return { weapon: 'barbed tendrils', verb: 'lashes out with thorny vines', hitVerb: 'constrict and tear' };
  }
  if (type === 'undead' && name.includes('skeleton')) {
    return { weapon: 'rusted blade', verb: 'swings a notched sword', hitVerb: 'hacks into' };
  }
  if (name.includes('wolf') || name.includes('dog') || name.includes('hyena')) {
    return { weapon: 'feral jaws', verb: 'lunges forward with snapping teeth', hitVerb: 'sink deep into your flesh' };
  }
  if (name.includes('spider') || name.includes('choker') || name.includes('crab')) {
    return { weapon: 'chitinous pincers', verb: 'snaps its wicked appendages', hitVerb: 'grip and crush' };
  }
  if (type === 'giant' || name.includes('ogre') || name.includes('troll')) {
    return { weapon: 'crude club', verb: 'swings a massive bludgeon', hitVerb: 'smashes violently against' };
  }
  return { weapon: 'claws and teeth', verb: 'attacks with savage fury', hitVerb: 'strike with vicious force' };
}

/**
 * Generates hero attack narrative.
 */
function describeHeroAttack(equippedWeapon, attackResult) {
  const w = getWeaponDescriptor(equippedWeapon);

  if (attackResult.isCrit) {
    if (w.type === 'ranged') {
      return `CRITICAL HIT! Your arrow finds an exposed seam, striking a vital organ with devastating force!`;
    }
    if (w.type === 'bludgeoning') {
      return `CRITICAL HIT! Your heavy mace connects with thunderous impact, splintering bone and crushing armor!`;
    }
    return `CRITICAL HIT! You find a lethal opening and drive your blade deep into a vital weak point!`;
  }

  if (attackResult.isFumble) {
    if (w.type === 'ranged') {
      return `FUMBLE! The bowstring slips against your fingers as your shot goes wildly astray.`;
    }
    return `FUMBLE! Your footing betrays you as your swing misses completely, leaving you off-balance.`;
  }

  if (attackResult.isHit) {
    if (w.type === 'ranged') {
      return `Your arrow strikes home, embedding itself deep into the creature's flank.`;
    }
    if (w.type === 'bludgeoning') {
      return `Your mace crashes heavily into the monster, staggering it with a dull thud.`;
    }
    return `Your blade bites deep into the creature's guard, leaving a bloody wound.`;
  }

  // Miss
  if (w.type === 'ranged') {
    return `You let loose a shaft, but the creature dodges aside as the arrow clatters against stone.`;
  }
  return `You lunge forward with your ${w.name}, but the creature parries the blow into empty air.`;
}

/**
 * Generates monster attack narrative.
 */
function describeMonsterAttack(monster, attackResult) {
  const m = getMonsterAttackDescriptor(monster);

  if (attackResult.isCrit) {
    return `CRITICAL STRIKE! The beast's attack lands with devastating ferocity, inflicting a grievous wound!`;
  }

  if (attackResult.isFumble) {
    return `The creature lunges clumsily, overextending itself and stumbling harmlessly past your guard.`;
  }

  if (attackResult.isHit) {
    return `The monster ${m.verb}; its ${m.weapon} ${m.hitVerb} you painfully!`;
  }

  // Miss
  return `The creature strikes toward you, but your armor holds firm and turns the attack aside.`;
}

/**
 * Generates potion drinking narrative.
 */
function describePotionDrink() {
  return `You uncork a phial of crimson elixir and drink it down. A warm glow spreads through your chest as vitality returns to your body.`;
}

/**
 * Generates flee narrative.
 */
function describeFleeAttempt(freeAttackResult, survived) {
  if (!survived) {
    return `You turn to flee, exposing your back! The creature strikes you down with a fatal blow from behind!`;
  }
  if (freeAttackResult.isHit) {
    return `You break away into a desperate retreat! The monster lashes out with a parting blow, but you endure the pain and slip into the shadows.`;
  }
  return `You disengage with seasoned reflexes! The creature snaps its claws in vain as you escape into the wilderness.`;
}

module.exports = {
  getWeaponDescriptor,
  getMonsterAttackDescriptor,
  describeHeroAttack,
  describeMonsterAttack,
  describePotionDrink,
  describeFleeAttempt
};
