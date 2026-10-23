/**
 * Darkgrid Combat Narrative Generator
 * Generates descriptive, atmospheric English combat log entries without leaking numeric data.
 * Context-aware: respects equipped weapon types and monster physiology.
 */

/**
 * Returns flavor descriptors for the hero's weapon.
 */
/**
 * Returns flavor descriptors for the hero's weapon.
 */
function getWeaponDescriptor(equippedWeapon) {
  if (!equippedWeapon) {
    return { name: 'fist', type: 'unarmed', verb: 'strike', hitVerb: 'strikes' };
  }

  const name = (equippedWeapon.name || '').toLowerCase();
  if (name.includes('sling')) {
    return { name: 'bullet', type: 'sling', verb: 'hurl a stone bullet', hitVerb: 'hammers into' };
  }
  if (name.includes('crossbow')) {
    return { name: 'bolt', type: 'crossbow', verb: 'release a heavy bolt', hitVerb: 'punches into' };
  }
  if (name.includes('bow')) {
    return { name: 'arrow', type: 'ranged', verb: 'release an arrow', hitVerb: 'pierces' };
  }
  if (name.includes('mace') || name.includes('hammer') || name.includes('flail') || name.includes('club') || name.includes('staff')) {
    return { name: 'bludgeon', type: 'bludgeoning', verb: 'swing your weapon', hitVerb: 'crushes into' };
  }
  if (name.includes('spear')) {
    return { name: 'spear', type: 'piercing', verb: 'thrust your spear', hitVerb: 'impales' };
  }
  return { name: 'blade', type: 'slashing', verb: 'slash with your blade', hitVerb: 'cleaves into' };
}

/**
 * Returns natural attack descriptors for a monster.
 */
function getMonsterAttackDescriptor(monster) {
  const name = (monster.base_monster_name || monster.monster_name || monster.name || '').toLowerCase();
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
    if (w.type === 'crossbow') {
      return `CRITICAL HIT! Your heavy bolt punches through armor with thunderous force!`;
    }
    if (w.type === 'sling') {
      return `CRITICAL HIT! Your hurled bullet strikes with crushing precision directly into a vital spot!`;
    }
    if (w.type === 'bludgeoning') {
      return `CRITICAL HIT! Your heavy weapon connects with thunderous impact, splintering bone!`;
    }
    if (w.type === 'piercing') {
      return `CRITICAL HIT! Your spear pierces cleanly through the monster's vital defenses!`;
    }
    return `CRITICAL HIT! You find a lethal opening and drive your blade deep into a vital weak point!`;
  }

  if (attackResult.isFumble) {
    if (w.type === 'ranged') {
      return `FUMBLE! The bowstring slips against your fingers as your shot goes wildly astray.`;
    }
    if (w.type === 'crossbow') {
      return `FUMBLE! The crossbow mechanism jams slightly as your bolt fires wide.`;
    }
    if (w.type === 'sling') {
      return `FUMBLE! The sling leather tangles around your wrist, sending your stone wide!`;
    }
    return `FUMBLE! Your footing betrays you as your swing misses completely, leaving you off-balance.`;
  }

  if (attackResult.isHit) {
    if (w.type === 'ranged') {
      return `Your arrow strikes home, embedding itself deep into the creature's flank.`;
    }
    if (w.type === 'crossbow') {
      return `Your crossbow bolt hits with a sharp crack, penetrating the creature's outer guard.`;
    }
    if (w.type === 'sling') {
      return `Your sling bullet strikes home, staggering the beast with a dull impact.`;
    }
    if (w.type === 'bludgeoning') {
      return `Your weapon crashes heavily into the monster, staggering it with a dull thud.`;
    }
    if (w.type === 'piercing') {
      return `Your spear drives forward into the creature, inflicting a deep puncture.`;
    }
    return `Your blade bites deep into the creature's guard, leaving a bloody wound.`;
  }

  // Miss
  if (w.type === 'ranged') {
    return `You let loose a shaft, but the creature dodges aside as the arrow clatters against stone.`;
  }
  if (w.type === 'crossbow') {
    return `Your bolt whistles past the creature as it shifts its stance.`;
  }
  if (w.type === 'sling') {
    return `You loose a stone bullet, but it skips harmlessly off the uneven ground.`;
  }
  return `You lunge forward with your ${w.name}, but the creature parries the blow into empty air.`;
}

/**
 * Generates monster attack narrative.
 */
function describeMonsterAttack(monster, attackResult) {
  const m = getMonsterAttackDescriptor(monster);
  const namedActor = monster && (monster.bounty_custom_name || monster.custom_title);

  if (attackResult.isCrit) {
    if (namedActor) {
      return `CRITICAL STRIKE! ${namedActor}'s attack lands with devastating ferocity, inflicting a grievous wound!`;
    }
    return `CRITICAL STRIKE! The beast's attack lands with devastating ferocity, inflicting a grievous wound!`;
  }

  if (attackResult.isFumble) {
    if (namedActor) {
      return `${namedActor} lunges clumsily, overextending itself and stumbling harmlessly past your guard.`;
    }
    return `The creature lunges clumsily, overextending itself and stumbling harmlessly past your guard.`;
  }

  if (attackResult.isHit) {
    const actorSubject = namedActor || 'The monster';
    if (m.hitVerb.includes('flesh') || m.hitVerb.includes('against') || m.hitVerb.includes('into') || m.hitVerb.includes('force')) {
      return `${actorSubject} ${m.verb}; its ${m.weapon} ${m.hitVerb}!`;
    }
    return `${actorSubject} ${m.verb}; its ${m.weapon} ${m.hitVerb} you painfully!`;
  }

  // Miss
  if (namedActor) {
    return `${namedActor} strikes toward you, but your defenses turn the attack aside.`;
  }
  return `The creature strikes toward you, but your defenses turn the attack aside.`;
}

/**
 * Generates potion drinking narrative.
 */
function describePotionDrink() {
  return `You uncork a phial of crimson elixir and drink it down. A warm glow spreads through your chest as vitality returns to your body.`;
}

/**
 * Generates Cleric Battle Prayer narrative (no raw numbers).
 */
function describeBattlePrayer(equippedWeapon, attackResult) {
  if (attackResult && attackResult.isCrit) {
    return `CRITICAL HIT! He cries out a prayer as his weapon strikes, drawing strength from his faith!`;
  }
  if (attackResult && attackResult.isHit) {
    return `He cries out a prayer as his weapon strikes, drawing strength from his faith.`;
  }
  if (attackResult && attackResult.isFumble) {
    return `FUMBLE! He cries out a prayer as he swings, but his footing slips and the sacred invocation dissipates.`;
  }
  return `He cries out a prayer as he strikes, but the blow misses its mark and no sacred strength is drawn.`;
}

/**
 * Generates Cleric Smite narrative (no raw numbers).
 */
function describeSmite(equippedWeapon, attackResult, isUndead = false) {
  if (attackResult && attackResult.isCrit) {
    return isUndead
      ? `CRITICAL HIT! His weapon erupts with sacred light, punishing the enemy with divine wrath as searing radiance purges the undead abomination!`
      : `CRITICAL HIT! His weapon erupts with sacred light, punishing the enemy with divine wrath!`;
  }
  if (attackResult && attackResult.isHit) {
    return isUndead
      ? `His weapon erupts with sacred light, punishing the enemy with divine wrath as searing radiance scorches the undead!`
      : `His weapon erupts with sacred light, punishing the enemy with divine wrath.`;
  }
  if (attackResult && attackResult.isFumble) {
    return `FUMBLE! His weapon flares with sacred light, but the swing goes wide and the divine wrath spends itself in empty air.`;
  }
  return `His weapon flares with sacred light, but the strike is turned aside and the divine charge is spent.`;
}

/**
 * Generates Cleric Divine Shield narrative (no raw numbers).
 */
function describeDivineShield() {
  return `A radiant barrier surrounds the Cleric, shielding him from the enemy's assault.`;
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
  describeBattlePrayer,
  describeSmite,
  describeDivineShield,
  describeFleeAttempt
};
