#!/usr/bin/env node
/**
 * DARKGRID ADVENTURE LAB — PHASE 5.2 ARTWORK ACTIVATION & 640-VIEWPOINT VERIFICATION CLI
 *
 * Usage:
 *   node action-ui-lab/scripts/verify-art-approval.js
 *   node action-ui-lab/scripts/verify-art-approval.js --simulate-unapproved
 *   node action-ui-lab/scripts/verify-art-approval.js --simulate-ids=P5-ART-01,P5-ART-13
 *
 * Governance Guarantee:
 *   - Default player mode permanently serves all 13 approved Phase 5 paintings + P5-ART-04-REPL
 *     with P5-ART-04 in RESTRICTED_WITH_REPLACEMENT mode (3 Windblown Heath viewpoints only).
 *   - Always restores the permanent owner-approved state after any optional simulation runs.
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  createLabApp,
  CANDIDATE_ART_INVENTORY,
  setCandidateArtApprovalStatus,
  getCandidateArtApprovalStatus,
  resetCandidateArtApprovalStatus,
  evaluateWorldArtAudit,
  buildWorldVisualAtlas
} = require('../server');

function verifyDiskAssets(db, options = {}) {
  const atlas = buildWorldVisualAtlas(db, options);
  const labRoot = path.resolve(__dirname, '..');
  const repoRoot = path.resolve(labRoot, '..');
  let missingOnDisk = 0;

  for (const tile of atlas.tiles) {
    if (!tile.isPassable) continue;
    for (const dir of ['NORTH', 'EAST', 'SOUTH', 'WEST']) {
      const url = tile.views[dir].imageUrl;
      let diskPath;
      if (url.startsWith('/lab-assets/art-candidates/')) {
        diskPath = path.join(labRoot, 'docs/phase-5/art-candidates', url.replace('/lab-assets/art-candidates/', ''));
      } else if (url.startsWith('/lab-assets/')) {
        diskPath = path.join(labRoot, 'public', url.replace('/lab-assets/', ''));
      } else {
        diskPath = path.join(repoRoot, 'public', url.replace(/^\//, ''));
      }
      if (!fs.existsSync(diskPath)) {
        missingOnDisk++;
      }
    }
  }
  return missingOnDisk;
}

function verifyP5Art04Restriction(db) {
  const atlas = buildWorldVisualAtlas(db, { useCandidateArt: false });
  const barrowUrl = '/lab-assets/images/terrain/plains_lone_barrow_horizon_pov.jpg';
  const moorlandUrl = '/lab-assets/images/terrain/plains_open_moorland_swell_pov.jpg';
  const barrowViewpoints = [];
  const moorlandViewpoints = [];

  for (const tile of atlas.tiles) {
    if (!tile.isPassable) continue;
    for (const dir of ['NORTH', 'EAST', 'SOUTH', 'WEST']) {
      const u = tile.views[dir].imageUrl;
      if (u === barrowUrl) barrowViewpoints.push(`${tile.x},${tile.y}:${dir}`);
      if (u === moorlandUrl) moorlandViewpoints.push(`${tile.x},${tile.y}:${dir}`);
    }
  }
  return { barrowViewpoints, moorlandViewpoints };
}

function printAuditSection(title, audit, missingOnDisk) {
  console.log(`\n=======================================================================`);
  console.log(` ${title}`);
  console.log(`=======================================================================`);
  console.log(`  Art Mode                  : ${audit.artPreviewMode}`);
  console.log(`  Passable Viewpoints       : ${audit.totalPassableViewpoints} / 640`);
  console.log(`  Unique Paintings Used     : ${audit.uniqueImagesCount}`);
  console.log(`  Quality Grades (A/B/C/D)  : A=${audit.grades.A} | B=${audit.grades.B} | C=${audit.grades.C} | D=${audit.grades.D}`);
  console.log(`  --- 6-Metric Audit Classification ---`);
  console.log(`  1. BROKEN_IMAGE_REFERENCE : ${audit.auditMetrics.BROKEN_IMAGE_REFERENCE + missingOnDisk}`);
  console.log(`  2. VALID_APPROVED_FALLBACK: ${audit.auditMetrics.VALID_APPROVED_FALLBACK}`);
  console.log(`  3. CANDIDATE_ART_PENDING  : ${audit.auditMetrics.CANDIDATE_ART_PENDING}`);
  console.log(`  4. WRONG_SCENE            : ${audit.auditMetrics.WRONG_SCENE}`);
  console.log(`  5. EXACT_DUPLICATE (Tile) : ${audit.auditMetrics.EXACT_DUPLICATE} (Tier 4 Same-Tile: ${audit.auditMetrics.EXACT_DUPLICATE_TIER4}, Corner Barrier/Transition Pairs: ${audit.auditMetrics.CORNER_BARRIER_OR_TRANSITION_PAIRS})`);
  console.log(`  6. ACCEPTABLE_REUSE       : ${audit.auditMetrics.ACCEPTABLE_REUSE} (Bespoke Single-Use: ${audit.auditMetrics.BESPOKE_SINGLE_USE})`);
}

function main() {
  const args = process.argv.slice(2);
  const app = createLabApp({ dbPath: ':memory:' });
  const db = app.locals.db;

  try {
    resetCandidateArtApprovalStatus();

    const defaultAudit = evaluateWorldArtAudit(db, { useCandidateArt: false });
    const defaultMissing = verifyDiskAssets(db, { useCandidateArt: false });
    printAuditSection('BASELINE 1: APPROVED_DEFAULT (Permanent Phase 5.2 Owner-Approved State)', defaultAudit, defaultMissing);

    const p5Art04Check = verifyP5Art04Restriction(db);
    console.log(`  --- P5-ART-04 Restricted Landmark Placement ---`);
    console.log(`  Lone Barrow Viewpoints (${p5Art04Check.barrowViewpoints.length}) : ${p5Art04Check.barrowViewpoints.join(', ')}`);
    console.log(`  Open Moorland Swell (${p5Art04Check.moorlandViewpoints.length})    : ${p5Art04Check.moorlandViewpoints.join(', ')}`);

    const stagedAudit = evaluateWorldArtAudit(db, { useCandidateArt: true });
    const stagedMissing = verifyDiskAssets(db, { useCandidateArt: true });
    printAuditSection('BASELINE 2: CANDIDATES_STAGED PREVIEW MODE', stagedAudit, stagedMissing);

    if (args.includes('--simulate-unapproved')) {
      resetCandidateArtApprovalStatus({ status: 'REVIEW REQUIRED', approvalMode: 'DEFAULT' });
      const unapprovedAudit = evaluateWorldArtAudit(db, { useCandidateArt: false });
      const unapprovedMissing = verifyDiskAssets(db, { useCandidateArt: false });
      printAuditSection('SIMULATION: PRE-APPROVAL FALLBACK STATE (All REVIEW REQUIRED)', unapprovedAudit, unapprovedMissing);
      resetCandidateArtApprovalStatus();
    } else {
      const idArg = args.find(a => a.startsWith('--simulate-ids='));
      if (idArg) {
        resetCandidateArtApprovalStatus({ status: 'REVIEW REQUIRED', approvalMode: 'DEFAULT' });
        const ids = idArg.replace('--simulate-ids=', '').split(',').map(s => s.trim()).filter(Boolean);
        setCandidateArtApprovalStatus(ids, 'APPROVED');
        const partAudit = evaluateWorldArtAudit(db, { useCandidateArt: false });
        const partMissing = verifyDiskAssets(db, { useCandidateArt: false });
        printAuditSection(`SIMULATION: PARTIAL APPROVAL (${ids.join(', ')})`, partAudit, partMissing);
        resetCandidateArtApprovalStatus();
      }
    }

    console.log(`\n=======================================================================`);
    console.log(` PHASE 5.2 ARTWORK GOVERNANCE STATUS TABLE (PERMANENTLY ACTIVATED)`);
    console.log(`=======================================================================`);
    for (const row of getCandidateArtApprovalStatus()) {
      const modeSuffix = row.approvalMode ? ` [${row.approvalMode}]` : '';
      console.log(`  ${row.id.padEnd(14)} | ${(row.status + modeSuffix).padEnd(40)} | ${row.fileName}`);
      if (row.replacementCandidate) {
        const rc = row.replacementCandidate;
        console.log(`  ${rc.id.padEnd(14)} | ${rc.status.padEnd(40)} | ${rc.fileName}`);
      }
    }
    console.log(`=======================================================================\n`);
  } finally {
    resetCandidateArtApprovalStatus();
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
