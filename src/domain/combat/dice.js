/**
 * Darkgrid Combat System — Dice Engine
 * Provides d20 and polyhedral dice rolling with support for custom RNG injection.
 */

/**
 * Rolls a single die with given number of sides.
 * @param {number} sides
 * @param {() => number} rng Optional RNG function (0 to 1), defaults to Math.random
 * @returns {number} Integer between 1 and sides inclusive
 */
function rollDie(sides, rng = Math.random) {
  if (sides <= 0) return 0;
  const raw = rng(sides);
  if (Number.isInteger(raw) && raw >= 1 && raw <= sides) {
    return raw;
  }
  return Math.floor(raw * sides) + 1;
}

/**
 * Rolls a standard d20.
 * @param {() => number} rng
 * @returns {number} Integer between 1 and 20
 */
function rollD20(rng = Math.random) {
  return rollDie(20, rng);
}

/**
 * Parses a dice formula string like '1d8', '2d6+3', '1d4-1', or flat number '5'.
 * @param {string|number} diceFormula
 * @returns {{ count: number, sides: number, modifier: number }}
 */
function parseDiceFormula(diceFormula) {
  if (typeof diceFormula === 'number') {
    return { count: 0, sides: 0, modifier: diceFormula };
  }

  const str = String(diceFormula || '').trim();
  if (!str) {
    return { count: 1, sides: 4, modifier: 0 };
  }

  // Check for flat number
  if (/^[+-]?\d+$/.test(str)) {
    return { count: 0, sides: 0, modifier: parseInt(str, 10) };
  }

  // Match NdM, NdM+K, NdM-K, dM+K
  const match = str.match(/^(\d*)d(\d+)(?:([+-])(\d+))?$/i);
  if (!match) {
    throw new Error(`Invalid dice formula: "${str}". Expected format like "1d8", "2d6+3", "1d4-1", or a flat number.`);
  }

  const count = match[1] === '' ? 1 : parseInt(match[1], 10);
  const sides = parseInt(match[2], 10);
  const sign = match[3] || '+';
  const modVal = match[4] ? parseInt(match[4], 10) : 0;
  const modifier = sign === '-' ? -modVal : modVal;

  return { count, sides, modifier };
}

/**
 * Rolls dice according to formula string and returns breakdown and total.
 * Minimum damage total is 1 unless minimum is explicitly overridden.
 * @param {string|number} diceFormula
 * @param {() => number} rng
 * @param {number} minTotal Minimum allowable result, defaults to 1
 * @returns {{ total: number, rolls: number[], modifier: number, formula: string }}
 */
function rollDice(diceFormula, rng = Math.random, minTotal = 1) {
  const parsed = parseDiceFormula(diceFormula);
  const rolls = [];

  for (let i = 0; i < parsed.count; i++) {
    rolls.push(rollDie(parsed.sides, rng));
  }

  const rollSum = rolls.reduce((acc, v) => acc + v, 0);
  const rawTotal = rollSum + parsed.modifier;
  const total = Math.max(minTotal, rawTotal);

  return {
    total,
    rolls,
    modifier: parsed.modifier,
    formula: String(diceFormula)
  };
}

module.exports = {
  rollDie,
  rollD20,
  parseDiceFormula,
  rollDice
};
