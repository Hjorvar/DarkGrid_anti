/**
 * DARKGRID PHASE 10 — Agent D: 100 New Pathfinder 1e Monster Candidates (CR 1–8)
 * Automated Verification Suite
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const { runMigrations, runSeeds } = require('../../src/db/migrate');
const {
  MONSTER_FAMILIES,
  resolveMonsterFamily
} = require('../../src/domain/monsters/taxonomy');

const REPO_ROOT = path.resolve(__dirname, '../..');
const CANDIDATES_JSON_PATH = path.join(REPO_ROOT, 'docs/phase-10/monster-100-candidates.json');
const CANDIDATES_MD_PATH = path.join(REPO_ROOT, 'docs/phase-10/MONSTER-100-CANDIDATES.md');

const VALID_SIZES = new Set(['Tiny', 'Small', 'Medium', 'Large', 'Huge']);
const VALID_REGIONS = new Set([
  'GOBLIN_FOREST',
  'UNDEAD_LANDS',
  'RAVENCRAG_HIGHLANDS',
  'GOBLIN_CAVE',
  'ANCIENT_CRYPT'
]);
const VALID_TERRAINS = new Set([
  'AQUATIC',
  'BRIDGE',
  'CITY',
  'COAST',
  'DESERT',
  'EXTRAPLANAR',
  'FOREST',
  'HILLS',
  'JUNGLE',
  'MOUNTAINS',
  'OCEAN',
  'PLAINS',
  'RIVER_LAKE',
  'SWAMP',
  'UNDERGROUND_RUINS'
]);
const VALID_ENGINE_SUPPORT = new Set(['FULL', 'PARTIAL', 'NEEDS_NEW_MECHANIC']);
const VALID_COMPLEXITY = new Set(['LOW', 'MEDIUM', 'HIGH']);
const EXPECTED_XP_BY_CR = {
  1: 400,
  2: 600,
  3: 800,
  4: 1200,
  5: 1600,
  6: 2400,
  7: 3200,
  8: 4800
};

describe('Phase 10 — 100 New Pathfinder 1e Monster Candidates (CR 1–4 & CR 5–8)', () => {
  let db;
  let dbMonsters;
  let dbMonsterNamesNormalized;
  let candidates;
  let markdownReport;

  before(() => {
    db = new DatabaseSync(':memory:');
    runMigrations(db);
    runSeeds(db);
    dbMonsters = db.prepare('SELECT id, name, challenge_rating, creature_type, creature_subtype, monster_family FROM monsters ORDER BY id ASC').all();
    dbMonsterNamesNormalized = new Set(dbMonsters.map((m) => m.name.trim().toLowerCase()));

    assert.ok(fs.existsSync(CANDIDATES_JSON_PATH), 'docs/phase-10/monster-100-candidates.json must exist');
    assert.ok(fs.existsSync(CANDIDATES_MD_PATH), 'docs/phase-10/MONSTER-100-CANDIDATES.md must exist');

    candidates = JSON.parse(fs.readFileSync(CANDIDATES_JSON_PATH, 'utf8'));
    markdownReport = fs.readFileSync(CANDIDATES_MD_PATH, 'utf8');
  });

  after(() => {
    if (db) {
      db.close();
    }
  });

  it('preserves the 98 existing monsters in the SQLite database without unapproved auto-insertion', () => {
    assert.equal(dbMonsters.length, 98, 'Production seed should remain at 98 monsters');
  });

  it('contains exactly 100 new monster candidates with sequential ranks 1–100', () => {
    assert.ok(Array.isArray(candidates), 'Candidates JSON must be an array');
    assert.equal(candidates.length, 100, 'Must have exactly 100 candidates');

    const ranks = candidates.map((c) => c.rank);
    for (let i = 1; i <= 100; i++) {
      assert.equal(ranks[i - 1], i, `Expected rank ${i} at index ${i - 1}`);
    }
  });

  it('splits candidates into exactly 50 on CR 1–4 and 50 on CR 5–8 across all CRs 1..8', () => {
    const cr1to4 = candidates.filter((c) => c.tier === 'CR_1_4' && c.cr >= 1 && c.cr <= 4);
    const cr5to8 = candidates.filter((c) => c.tier === 'CR_5_8' && c.cr >= 5 && c.cr <= 8);

    assert.equal(cr1to4.length, 50, 'Must have exactly 50 candidates in CR 1–4');
    assert.equal(cr5to8.length, 50, 'Must have exactly 50 candidates in CR 5–8');

    for (let cr = 1; cr <= 8; cr++) {
      const countAtCr = candidates.filter((c) => c.cr === cr).length;
      assert.ok(countAtCr >= 10, `Expected at least 10 monsters at CR ${cr}, found ${countAtCr}`);
    }
  });

  it('guarantees 100 unique candidate names and 0 duplicates against the 98 existing DB monsters', () => {
    const seenCandidateNames = new Set();

    for (const c of candidates) {
      assert.equal(typeof c.name, 'string');
      const norm = c.name.trim().toLowerCase();
      assert.ok(norm.length > 0, `Rank ${c.rank} must have a non-empty name`);
      assert.ok(!seenCandidateNames.has(norm), `Duplicate candidate name within list: ${c.name}`);
      seenCandidateNames.add(norm);

      assert.ok(
        !dbMonsterNamesNormalized.has(norm),
        `Candidate "${c.name}" is already in the existing 98-monster SQLite database!`
      );
      assert.equal(c.already_in_db, false, `Candidate "${c.name}" must have already_in_db === false`);
    }

    assert.equal(seenCandidateNames.size, 100);
  });

  it('validates Pathfinder 1e stats, DarkGrid 22-family taxonomy, regions, AoN links, and complexity fields for all 100 monsters', () => {
    const familiesRepresented = new Set();
    const regionsRepresented = new Set();

    for (const c of candidates) {
      // Taxonomy & size
      assert.equal(typeof c.creature_type, 'string', `${c.name} missing creature_type`);
      assert.equal(typeof c.subtype, 'string', `${c.name} missing subtype`);
      assert.ok(MONSTER_FAMILIES.includes(c.monster_family), `${c.name} has invalid monster_family: ${c.monster_family}`);

      const resolvedFamily = resolveMonsterFamily(
        {
          name: c.name,
          creature_type: c.creature_type,
          creature_subtype: c.subtype
        },
        { strict: true }
      );
      assert.equal(
        resolvedFamily,
        c.monster_family,
        `${c.name} taxonomy mismatch: expected ${c.monster_family}, resolved ${resolvedFamily}`
      );
      familiesRepresented.add(c.monster_family);

      assert.ok(VALID_SIZES.has(c.size_category), `${c.name} has invalid size_category: ${c.size_category}`);

      // Stats object
      const s = c.stats;
      assert.ok(s && typeof s === 'object', `${c.name} missing stats object`);
      assert.ok(Number.isInteger(s.hp) && s.hp > 0, `${c.name} invalid hp`);
      assert.ok(Number.isInteger(s.ac) && s.ac > 0, `${c.name} invalid ac`);
      assert.ok(Number.isInteger(s.touch_ac) && s.touch_ac > 0, `${c.name} invalid touch_ac`);
      assert.ok(Number.isInteger(s.flat_footed_ac) && s.flat_footed_ac > 0, `${c.name} invalid flat_footed_ac`);
      assert.ok(Number.isInteger(s.initiative_bonus), `${c.name} invalid initiative_bonus`);
      assert.ok(Number.isInteger(s.attack_bonus), `${c.name} invalid attack_bonus`);
      assert.ok(typeof s.damage_dice === 'string' && /^\d+d\d+([+-]\d+)?$/.test(s.damage_dice), `${c.name} invalid damage_dice: ${s.damage_dice}`);
      assert.ok(Number.isInteger(s.damage_bonus), `${c.name} invalid damage_bonus`);
      assert.ok(Number.isInteger(s.fort_save), `${c.name} invalid fort_save`);
      assert.ok(Number.isInteger(s.ref_save), `${c.name} invalid ref_save`);
      assert.ok(Number.isInteger(s.will_save), `${c.name} invalid will_save`);
      assert.equal(s.xp_reward, EXPECTED_XP_BY_CR[c.cr], `${c.name} XP reward should match PF1e CR ${c.cr}`);

      // Special abilities
      assert.ok(Array.isArray(c.special_abilities) && c.special_abilities.length > 0, `${c.name} must list special_abilities`);

      // Terrains & recommended_regions
      assert.ok(Array.isArray(c.terrains) && c.terrains.length > 0, `${c.name} must list terrains`);
      for (const t of c.terrains) {
        assert.ok(VALID_TERRAINS.has(t), `${c.name} has invalid terrain: ${t}`);
      }

      assert.ok(Array.isArray(c.recommended_regions) && c.recommended_regions.length > 0, `${c.name} must list recommended_regions`);
      for (const r of c.recommended_regions) {
        assert.ok(VALID_REGIONS.has(r), `${c.name} has invalid recommended_region: ${r}`);
        regionsRepresented.add(r);
      }

      // Source & Archives of Nethys URL
      assert.ok(typeof c.source_book === 'string' && c.source_book.includes('Pathfinder RPG'), `${c.name} invalid source_book`);
      assert.ok(
        typeof c.aon_url === 'string' && c.aon_url.startsWith('https://www.aonprd.com/MonsterDisplay.aspx?ItemName='),
        `${c.name} invalid aon_url: ${c.aon_url}`
      );

      // Engine support & complexity
      assert.ok(VALID_ENGINE_SUPPORT.has(c.engine_support), `${c.name} invalid engine_support: ${c.engine_support}`);
      assert.ok(VALID_COMPLEXITY.has(c.implementation_complexity), `${c.name} invalid implementation_complexity: ${c.implementation_complexity}`);
      assert.ok(typeof c.complexity_reason === 'string' && c.complexity_reason.length > 5, `${c.name} missing complexity_reason`);
    }

    assert.equal(familiesRepresented.size, 22, 'All 22 DarkGrid monster families should be represented across the 100 candidates');
    assert.equal(regionsRepresented.size, 5, 'All 5 DarkGrid regions should be represented across the 100 candidates');
  });

  it('documents all 100 candidates in docs/phase-10/MONSTER-100-CANDIDATES.md in Icelandic', () => {
    for (const c of candidates) {
      assert.ok(
        markdownReport.includes(`[${c.name}]`),
        `MONSTER-100-CANDIDATES.md is missing entry for ${c.name}`
      );
    }
    for (const region of VALID_REGIONS) {
      assert.ok(
        markdownReport.includes(region),
        `MONSTER-100-CANDIDATES.md is missing region section ${region}`
      );
    }
  });
});
