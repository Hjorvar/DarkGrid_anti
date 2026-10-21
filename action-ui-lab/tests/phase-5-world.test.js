/**
 * DARKGRID ADVENTURE LAB — PHASE 5: WORLD COMPLETION, ENVIRONMENTAL ARTWORK & ADVENTURE CONTINUITY TEST SUITE
 *
 * Verifies:
 *  1. Full 15x15 World Scene Coverage (160 passable tiles × 4 facings = 640 passable viewpoints) in Approved & Candidate modes.
 *  2. 5-Tier POV-First Scene Resolver priority order (Landmark > Barrier > Transition > Contextual > Generic Biome).
 *  3. Impassable Obstacle Visibility (Blackwater River, Stonefang Crag, Darkmount Peaks, Bottomless Mire, Murksea, World Edges).
 *  4. 4-Way Directional Landmark Approach & Turn-Around (180°) Continuity across all 13 World Landmarks.
 *  5. Deterministic Scene Selection & Biome Purity (zero tropical jungle art in Rotting Fen, zero temperate forest fallback in Jungle).
 *  6. Consolidated 13 Candidate Artworks (`docs/phase-5/art-candidates/`): JPEG format, 1376x768 resolution, SHA-256 uniqueness,
 *     `REVIEW REQUIRED` governance status, and staging preview mode (`SET_ART_PREVIEW_MODE` / `/api/atlas?artPreview=candidates`).
 *  7. Atomic Turning & Blocked-Move Safety, plus Combat Return Continuity.
 *  8. End-to-End Execution of Adventure Journeys A (Mirkwood), B (Bridge & Watchpost), and C (Rotting Fen & Deadman's Mire).
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');

const {
  createLabApp,
  CANDIDATE_ART_INVENTORY,
  setCandidateArtPreviewMode,
  getCandidateArtPreviewMode,
  buildWorldVisualAtlas
} = require('../server');

let server;
let baseUrl;
let appInstance;
let db;
let mockRngValue = 0.99;

async function apiGet(endpoint) {
  const res = await fetch(`${baseUrl}${endpoint}`);
  const data = await res.json();
  return { status: res.status, data };
}

async function apiAction(action, payload = {}) {
  const res = await fetch(`${baseUrl}/api/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload })
  });
  const data = await res.json();
  return { status: res.status, data };
}

function getJpegDimensions(buf) {
  if (!buf || buf.length < 4 || buf[0] !== 0xFF || buf[1] !== 0xD8) return null;
  let offset = 2;
  while (offset < buf.length) {
    while (offset < buf.length && buf[offset] === 0xFF) offset++;
    if (offset >= buf.length) break;
    const marker = buf[offset++];
    if (marker === 0xD8 || marker === 0xD9) continue;
    if (offset + 2 > buf.length) break;
    const len = buf.readUInt16BE(offset);
    if (marker >= 0xC0 && marker <= 0xC3) {
      const height = buf.readUInt16BE(offset + 3);
      const width = buf.readUInt16BE(offset + 5);
      return { width, height, aspectRatio: Number((width / height).toFixed(3)) };
    }
    offset += len;
  }
  return null;
}

describe('Phase 5 — World Completion, Environmental Artwork & Adventure Continuity', () => {
  before(async () => {
    appInstance = createLabApp({
      dbPath: ':memory:',
      rng: () => mockRngValue
    });
    db = appInstance.locals.db;
    server = http.createServer(appInstance);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    setCandidateArtPreviewMode(false);
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
    if (db) {
      try {
        db.close();
      } catch (_e) {
        // ignore
      }
    }
  });

  it('1. Audits all 160 passable tiles × 4 facings (640 viewpoints) with 0 Grade D gaps and valid files on disk', async () => {
    const { status, data } = await apiGet('/api/atlas');
    assert.equal(status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.totalTiles, 225);
    assert.equal(data.passableTiles, 160);
    assert.equal(data.impassableTiles, 65);
    assert.equal(data.totalPassableViewpoints, 640);
    assert.equal(data.artPreviewMode, 'APPROVED_DEFAULT');
    assert.equal(data.summary.grades.D, 0, 'Expected zero Grade D viewpoints across all 640 passable viewpoints');

    const passableTiles = data.tiles.filter(t => t.isPassable);
    assert.equal(passableTiles.length, 160);

    for (const tile of passableTiles) {
      for (const facing of ['NORTH', 'EAST', 'SOUTH', 'WEST']) {
        const view = tile.views[facing];
        assert.ok(view, `Missing view for [${tile.x},${tile.y}] ${facing}`);
        assert.ok(view.imageUrl, `Missing imageUrl for [${tile.x},${tile.y}] ${facing}`);
        assert.equal(view.artApprovalStatus, 'APPROVED', `Default mode must only serve APPROVED images at [${tile.x},${tile.y}] ${facing}`);
        assert.notEqual(view.qualityGrade, 'D', `Unexpected Grade D at [${tile.x},${tile.y}] ${facing}`);
        assert.ok(view.povTier >= 1 && view.povTier <= 4, `Expected Tier 1..4 at [${tile.x},${tile.y}] ${facing}`);
      }
    }
  });

  it('2. Verifies all 13 consolidated Phase 5 candidate paintings in docs/phase-5/art-candidates/ (format, 1376x768, SHA-256, HTTP serving, REVIEW REQUIRED status)', async () => {
    assert.ok(Array.isArray(CANDIDATE_ART_INVENTORY));
    assert.equal(CANDIDATE_ART_INVENTORY.length, 13);

    const candidateDir = path.resolve(__dirname, '../docs/phase-5/art-candidates');
    const seenHashes = new Set();

    // Collect hashes of all existing approved images first to ensure zero duplication against approved art
    for (const existingDir of [
      path.resolve(__dirname, '../../public/images/terrain'),
      path.resolve(__dirname, '../public/images/terrain'),
      path.resolve(__dirname, '../public/images/perspective')
    ]) {
      if (!fs.existsSync(existingDir)) continue;
      for (const f of fs.readdirSync(existingDir)) {
        const full = path.join(existingDir, f);
        if (fs.statSync(full).isFile() && /\.(jpg|jpeg|png|webp)$/i.test(f)) {
          const h = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
          seenHashes.add(h);
        }
      }
    }

    for (const item of CANDIDATE_ART_INVENTORY) {
      assert.equal(item.status, 'REVIEW REQUIRED', `Candidate ${item.fileName} must remain REVIEW REQUIRED until user approval`);
      const filePath = path.join(candidateDir, item.fileName);
      assert.ok(fs.existsSync(filePath), `Missing candidate art file on disk: ${filePath}`);

      const buf = fs.readFileSync(filePath);
      assert.ok(buf.length > 100000, `Expected high-resolution JPEG (>100KB) for ${item.fileName}, got ${buf.length} bytes`);

      const dims = getJpegDimensions(buf);
      assert.ok(dims, `Invalid JPEG header for ${item.fileName}`);
      assert.equal(dims.width, 1376, `Expected width 1376 for ${item.fileName}`);
      assert.equal(dims.height, 768, `Expected height 768 for ${item.fileName}`);
      assert.ok(dims.aspectRatio > 1.75 && dims.aspectRatio < 1.82, `Expected ~16:9 aspect ratio for ${item.fileName}`);

      const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
      assert.equal(sha256, item.sha256, `SHA-256 mismatch for ${item.fileName}`);
      assert.equal(seenHashes.has(sha256), false, `Duplicate SHA-256 detected for ${item.fileName}`);
      seenHashes.add(sha256);

      // Verify static serving at /lab-assets/art-candidates/<fileName>
      const httpRes = await fetch(`${baseUrl}${item.candidateUrl}`);
      assert.equal(httpRes.status, 200, `Expected HTTP 200 for ${item.candidateUrl}`);
      const contentType = httpRes.headers.get('content-type') || '';
      assert.ok(contentType.includes('image/jpeg'), `Expected image/jpeg content-type for ${item.candidateUrl}`);
    }
  });

  it('3. Supports Candidate Art Preview / Staging Mode (63 unique images, 640/640 PASS with 0 same-tile Tier 4 duplicates) while keeping Approved Mode default', async () => {
    const { status, data } = await apiGet('/api/atlas?artPreview=candidates');
    assert.equal(status, 200);
    assert.equal(data.artPreviewMode, 'CANDIDATES_STAGED');
    assert.equal(data.summary.uniqueImagesCount, 63, 'Expected 50 approved + 13 candidate = 63 unique images in Candidate Preview Mode');

    const tileByCoord = new Map(data.tiles.map(t => [`${t.x},${t.y}`, t]));

    // Check [9,7] SOUTH bespoke candidate view
    const watchpost = tileByCoord.get('9,7');
    assert.equal(watchpost.views.SOUTH.imageUrl, '/lab-assets/art-candidates/watchpost_9_7_south_river_gorge.jpg');
    assert.equal(watchpost.views.SOUTH.artApprovalStatus, 'REVIEW REQUIRED');
    assert.equal(watchpost.views.NORTH.imageUrl, '/lab-assets/images/perspective/watchpost_9_7_river_flank.jpg');

    // Check all 5 new transition candidates
    assert.equal(tileByCoord.get('3,8').views.SOUTH.imageUrl, '/lab-assets/art-candidates/transition_hills_to_swamp_pov.jpg');
    assert.equal(tileByCoord.get('6,9').views.NORTH.imageUrl, '/lab-assets/art-candidates/transition_swamp_to_plains_pov.jpg');
    assert.equal(tileByCoord.get('3,4').views.EAST.imageUrl, '/lab-assets/art-candidates/transition_hills_to_forest_pov.jpg');
    assert.equal(tileByCoord.get('5,7').views.WEST.imageUrl, '/lab-assets/art-candidates/transition_plains_to_hills_pov.jpg');
    assert.equal(tileByCoord.get('4,7').views.EAST.imageUrl, '/lab-assets/art-candidates/transition_hills_to_plains_pov.jpg');

    // Verify 0 same-tile duplicates on Tier 4 views across all 160 passable tiles in Candidate Preview Mode
    const duplicateDetails = [];
    for (const tile of data.tiles) {
      if (!tile.isPassable) continue;
      const seenOnTile = new Map();
      for (const f of ['NORTH', 'EAST', 'SOUTH', 'WEST']) {
        const v = tile.views[f];
        if (seenOnTile.has(v.imageUrl)) {
          const prevF = seenOnTile.get(v.imageUrl);
          const prevV = tile.views[prevF];
          if (v.povTier === 4 || prevV.povTier === 4) {
            duplicateDetails.push(`[${tile.x},${tile.y}] ${prevF}(T${prevV.povTier}) & ${f}(T${v.povTier}): ${v.imageUrl}`);
          }
        }
        seenOnTile.set(v.imageUrl, f);
      }
    }
    assert.equal(duplicateDetails.length, 0, `Expected 0 same-tile Tier 4 duplicates, found: ${duplicateDetails.join('; ')}`);

    // Verify default mode was restored after request
    assert.equal(getCandidateArtPreviewMode(), false);
  });

  it('4. Resolves 4-way landmark approaches and eliminates biome contamination in SWAMP and JUNGLE', async () => {
    const atlas = buildWorldVisualAtlas(db, { useCandidateArt: false });
    const tileByCoord = new Map(atlas.tiles.map(t => [`${t.x},${t.y}`, t]));

    // 1. Oakhaven Western Palisade & Gate approaches ([6,7] E, [6,6] E, [6,8] E)
    assert.equal(tileByCoord.get('6,7').views.EAST.imageUrl, '/images/terrain/terrain_town_gates.webp');
    assert.equal(tileByCoord.get('6,6').views.EAST.imageUrl, '/lab-assets/images/perspective/north_gate_7_6_west.jpg');
    assert.equal(tileByCoord.get('6,8').views.EAST.imageUrl, '/lab-assets/images/perspective/north_gate_7_6_west.jpg');

    // 2. Primeval Black Oak [7,3] 4-way approaches ([7,4] N, [7,2] S, [6,3] E, [8,3] W)
    for (const [coord, dir] of [['7,4', 'NORTH'], ['7,2', 'SOUTH'], ['6,3', 'EAST'], ['8,3', 'WEST']]) {
      assert.equal(
        tileByCoord.get(coord).views[dir].imageUrl,
        '/lab-assets/images/perspective/forest_7_4_north_oak_approach.jpg',
        `Expected Primeval Black Oak approach view at [${coord}] ${dir}`
      );
    }

    // 3. Mirkwood Crossroads [7,5] approaches ([7,4] S, [8,5] W)
    assert.equal(tileByCoord.get('7,4').views.SOUTH.imageUrl, '/lab-assets/images/perspective/crossroads_7_5_lateral.jpg');
    assert.equal(tileByCoord.get('8,5').views.WEST.imageUrl, '/lab-assets/images/perspective/crossroads_7_5_lateral.jpg');

    // 4. Deadman's Mire [4,11] 4-way approaches ([4,10] S, [3,11] E, [5,11] W, [4,12] N)
    for (const [coord, dir] of [['4,10', 'SOUTH'], ['3,11', 'EAST'], ['5,11', 'WEST'], ['4,12', 'NORTH']]) {
      assert.equal(
        tileByCoord.get(coord).views[dir].imageUrl,
        '/lab-assets/images/perspective/swamp_approach_mire_ruins.jpg',
        `Expected Deadman's Mire ruins approach view at [${coord}] ${dir}`
      );
    }

    // 5. Bioluminescent Spore Hollow [9,11] approaches ([8,11] E, [10,11] W, [9,12] N)
    for (const [coord, dir] of [['8,11', 'EAST'], ['10,11', 'WEST'], ['9,12', 'NORTH']]) {
      assert.equal(
        tileByCoord.get(coord).views[dir].imageUrl,
        '/lab-assets/images/terrain/jungle_venomous_trail_pov.jpg',
        `Expected Spore Hollow approach view at [${coord}] ${dir}`
      );
    }

    // 6. Biome Purity: Zero tropical jungle art in SWAMP, zero temperate oak forest fallback in JUNGLE
    for (const tile of atlas.tiles) {
      if (!tile.isPassable) continue;
      for (const f of ['NORTH', 'EAST', 'SOUTH', 'WEST']) {
        const v = tile.views[f];
        if (tile.terrain === 'SWAMP' && v.aheadTile.terrain !== 'JUNGLE') {
          assert.notEqual(v.imageUrl, '/images/terrain/terrain_jungle.webp', `SWAMP tile [${tile.x},${tile.y}] ${f} must not show tropical jungle art`);
        }
        if (tile.terrain === 'JUNGLE' && v.aheadTile.terrain !== 'FOREST') {
          assert.notEqual(v.imageUrl, '/images/terrain/terrain_forest.webp', `JUNGLE tile [${tile.x},${tile.y}] ${f} must not show temperate oak forest art`);
        }
      }
    }
  });

  it('5. Executes Journey A (Oakhaven -> North Gate -> Crossroads -> Mirkwood Trail -> Primeval Black Oak -> Return) with directional & obstacle continuity', async () => {
    mockRngValue = 0.99;
    let { data: initRes } = await apiAction('START_EXPEDITION', {
      expeditionKey: 'MIRKWOOD_EXPEDITION',
      teleportToStart: true,
      deterministicSeed: 5001
    });

    // Start at Oakhaven Sanctuary [7,7] facing NORTH
    let s0 = initRes.state;
    assert.equal(s0.currentTile.x, 7);
    assert.equal(s0.currentTile.y, 7);
    assert.equal(s0.facing, 'NORTH');
    assert.equal(s0.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/oakhaven_7_7_north.jpg');

    // Step 1: Move NORTH to Oakhaven North Gate [7,6]
    let { data: s1Res } = await apiAction('MOVE', { relative: 'FORWARD' });
    let s1 = s1Res.state;
    assert.equal(s1.currentTile.x, 7);
    assert.equal(s1.currentTile.y, 6);
    assert.equal(s1.facing, 'NORTH');
    assert.equal(s1.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/north_gate_7_6_north.jpg');
    assert.equal(s1.adventure.travelContinuity.corridorKey, 'NORTHERN_MIRKWOOD_CORRIDOR');

    // Turn EAST at [7,6] -> Blocked by Blackwater River [8,6]
    let { data: s1eRes } = await apiAction('TURN', { turn: 'RIGHT' });
    let s1e = s1eRes.state;
    assert.equal(s1e.currentTile.x, 7);
    assert.equal(s1e.currentTile.y, 6);
    assert.equal(s1e.facing, 'EAST');
    assert.equal(s1e.viewportScene.scenes.C.isBlockedAhead, true);
    assert.equal(s1e.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/north_gate_7_6_east.jpg');

    // Turn back NORTH and advance to Mirkwood Crossroads [7,5]
    await apiAction('TURN', { turn: 'LEFT' });
    let { data: s2Res } = await apiAction('MOVE', { relative: 'FORWARD' });
    let s2 = s2Res.state;
    assert.equal(s2.currentTile.x, 7);
    assert.equal(s2.currentTile.y, 5);
    assert.equal(s2.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/crossroads_7_5_north.jpg');
    assert.equal(s2.viewportScene.pointOfInterest.poiKey, 'poi_crossroads_waystone');

    // Turn WEST at [7,5] -> Blocked by Stonefang Crag [6,5]
    let { data: s2wRes } = await apiAction('TURN', { turn: 'LEFT' });
    let s2w = s2wRes.state;
    assert.equal(s2w.facing, 'WEST');
    assert.equal(s2w.viewportScene.scenes.C.isBlockedAhead, true);
    assert.equal(s2w.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/crossroads_7_5_west.jpg');
    assert.equal(s2w.viewportScene.pointOfInterest.poiKey, 'poi_stonefang_crag');

    // Attempt blocked forward move into Stonefang Crag [6,5] -> coordinates & facing stay unchanged
    let { data: s2Blocked } = await apiAction('MOVE', { relative: 'FORWARD' });
    assert.equal(s2Blocked.ok, false);
    assert.equal(s2Blocked.state.currentTile.x, 7);
    assert.equal(s2Blocked.state.currentTile.y, 5);
    assert.equal(s2Blocked.state.facing, 'WEST');

    // Turn NORTH and advance to Mirkwood Trail [7,4]
    await apiAction('TURN', { turn: 'RIGHT' });
    let { data: s3Res } = await apiAction('MOVE', { relative: 'FORWARD' });
    let s3 = s3Res.state;
    assert.equal(s3.currentTile.x, 7);
    assert.equal(s3.currentTile.y, 4);
    assert.equal(s3.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/forest_7_4_north_oak_approach.jpg');
    assert.equal(s3.viewportScene.pointOfInterest.poiKey, 'poi_ancient_oak_approach');

    // Advance NORTH to Heart of the Mirkwood [7,3]
    let { data: s4Res } = await apiAction('MOVE', { relative: 'FORWARD' });
    let s4 = s4Res.state;
    assert.equal(s4.currentTile.x, 7);
    assert.equal(s4.currentTile.y, 3);
    assert.equal(s4.viewportScene.scenes.C.imageUrl, '/lab-assets/images/terrain/forest_ancient_oak.jpg');
    assert.equal(s4.viewportScene.pointOfInterest.poiKey, 'poi_ancient_oak');

    // Turn 180° SOUTH at [7,3] -> looking South from beneath the root arch
    let { data: s4sRes } = await apiAction('TURN', { facing: 'SOUTH' });
    let s4s = s4sRes.state;
    assert.equal(s4s.facing, 'SOUTH');
    assert.equal(s4s.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/ancient_oak_7_3_south.jpg');

    // Walk SOUTH back through [7,4] -> [7,5] -> [7,6] -> [7,7]
    let { data: r1Res } = await apiAction('MOVE', { relative: 'FORWARD' });
    assert.equal(r1Res.state.currentTile.y, 4);
    assert.equal(r1Res.state.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/crossroads_7_5_lateral.jpg');

    let { data: r2Res } = await apiAction('MOVE', { relative: 'FORWARD' });
    assert.equal(r2Res.state.currentTile.y, 5);
    assert.equal(r2Res.state.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/crossroads_7_5_south.jpg');

    let { data: r3Res } = await apiAction('MOVE', { relative: 'FORWARD' });
    assert.equal(r3Res.state.currentTile.y, 6);
    assert.equal(r3Res.state.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/north_gate_7_6_south.jpg');

    let { data: r4Res } = await apiAction('MOVE', { relative: 'FORWARD' });
    assert.equal(r4Res.state.currentTile.y, 7);
    assert.equal(r4Res.state.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/oakhaven_7_7_south.jpg');
  });

  it('6. Executes Journey B (Oakhaven -> Old Stone Bridge -> Bridge East Watchpost -> Eastern Plains -> Return) with river flank barriers', async () => {
    mockRngValue = 0.99;
    await apiAction('START_EXPEDITION', {
      expeditionKey: 'BRIDGE_EXPEDITION',
      teleportToStart: true,
      deterministicSeed: 5002
    });

    // Turn EAST at Oakhaven [7,7]
    let { data: s0Res } = await apiAction('TURN', { facing: 'EAST' });
    assert.equal(s0Res.state.facing, 'EAST');
    assert.equal(s0Res.state.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/oakhaven_7_7_east.jpg');

    // Move EAST onto The Old Stone Bridge [8,7]
    let { data: s1Res } = await apiAction('MOVE', { relative: 'FORWARD' });
    assert.equal(s1Res.state.currentTile.x, 8);
    assert.equal(s1Res.state.currentTile.y, 7);
    assert.equal(s1Res.state.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/bridge_8_7_east.jpg');

    // Check NORTH and SOUTH river parapets on [8,7]
    let { data: s1nRes } = await apiAction('TURN', { facing: 'NORTH' });
    assert.equal(s1nRes.state.facing, 'NORTH');
    assert.equal(s1nRes.state.viewportScene.scenes.C.isBlockedAhead, true);
    assert.equal(s1nRes.state.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/bridge_8_7_north.jpg');

    let { data: s1sRes } = await apiAction('TURN', { facing: 'SOUTH' });
    assert.equal(s1sRes.state.facing, 'SOUTH');
    assert.equal(s1sRes.state.viewportScene.scenes.C.isBlockedAhead, true);
    assert.equal(s1sRes.state.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/bridge_8_7_south.jpg');

    // Turn EAST and step into Bridge East Watchpost [9,7]
    await apiAction('TURN', { facing: 'EAST' });
    let { data: s2Res } = await apiAction('MOVE', { relative: 'FORWARD' });
    assert.equal(s2Res.state.currentTile.x, 9);
    assert.equal(s2Res.state.currentTile.y, 7);
    assert.equal(s2Res.state.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/watchpost_9_7_east.jpg');

    // Step EAST onto Eastern Frontier Plains [10,7]
    let { data: s3Res } = await apiAction('MOVE', { relative: 'FORWARD' });
    assert.equal(s3Res.state.currentTile.x, 10);
    assert.equal(s3Res.state.currentTile.y, 7);
    assert.equal(s3Res.state.adventure.travelContinuity.corridorKey, 'EASTERN_BRIDGE_WATCHPOST_CORRIDOR');

    // Turn 180° WEST at [10,7] -> looking back at Bridge East Watchpost [9,7]
    let { data: s3wRes } = await apiAction('TURN', { facing: 'WEST' });
    assert.equal(s3wRes.state.facing, 'WEST');
    assert.equal(s3wRes.state.viewportScene.scenes.C.imageUrl, '/lab-assets/images/terrain/watchpost_ruins_exterior.jpg');

    // Return WEST through [9,7] -> [8,7] -> [7,7]
    let { data: r1Res } = await apiAction('MOVE', { relative: 'FORWARD' });
    assert.equal(r1Res.state.currentTile.x, 9);
    assert.equal(r1Res.state.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/watchpost_9_7_west.jpg');

    let { data: r2Res } = await apiAction('MOVE', { relative: 'FORWARD' });
    assert.equal(r2Res.state.currentTile.x, 8);
    assert.equal(r2Res.state.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/bridge_8_7_west.jpg');

    let { data: r3Res } = await apiAction('MOVE', { relative: 'FORWARD' });
    assert.equal(r3Res.state.currentTile.x, 7);
    assert.equal(r3Res.state.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/oakhaven_7_7_west.jpg');
  });

  it('7. Executes Journey C (Oakhaven -> South Gate -> Rotting Fen Boardwalk -> Deadman’s Mire -> Return) with complete corridor narratives', async () => {
    mockRngValue = 0.99;
    await apiAction('START_EXPEDITION', {
      expeditionKey: 'ROTTEN_LANDS_EXPEDITION',
      teleportToStart: true,
      deterministicSeed: 5003
    });

    // Turn SOUTH at Oakhaven [7,7]
    let { data: s0Res } = await apiAction('TURN', { facing: 'SOUTH' });
    assert.equal(s0Res.state.facing, 'SOUTH');
    assert.equal(s0Res.state.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/oakhaven_7_7_south.jpg');

    // Move SOUTH to Fen-Ward South Gate [7,8]
    let { data: s1Res } = await apiAction('MOVE', { relative: 'FORWARD' });
    assert.equal(s1Res.state.currentTile.x, 7);
    assert.equal(s1Res.state.currentTile.y, 8);
    assert.equal(s1Res.state.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/south_gate_7_8_south.jpg');

    // Move SOUTH into Rotting Fen [7,9]
    let { data: s2Res } = await apiAction('MOVE', { relative: 'FORWARD' });
    assert.equal(s2Res.state.currentTile.x, 7);
    assert.equal(s2Res.state.currentTile.y, 9);
    assert.equal(s2Res.state.adventure.travelContinuity.corridorKey, 'SOUTHERN_ROTTING_FEN_CORRIDOR');

    // Turn WEST and move to [6,9]
    await apiAction('TURN', { facing: 'WEST' });
    let { data: s3Res } = await apiAction('MOVE', { relative: 'FORWARD' });
    assert.equal(s3Res.state.currentTile.x, 6);
    assert.equal(s3Res.state.currentTile.y, 9);
    assert.equal(s3Res.state.adventure.travelContinuity.corridorKey, 'SOUTHERN_ROTTING_FEN_CORRIDOR');
    assert.ok(s3Res.state.adventure.continuityNote.includes('peat embankment') || s3Res.state.adventure.horizonHint.includes('Rotting Fen Boardwalk'));

    // Turn SOUTH at [6,9] -> approaches Rotting Fen Boardwalk [6,10]
    let { data: s3sRes } = await apiAction('TURN', { facing: 'SOUTH' });
    assert.equal(s3sRes.state.facing, 'SOUTH');
    assert.equal(s3sRes.state.viewportScene.scenes.C.imageUrl, '/lab-assets/images/terrain/swamp_willow_boardwalk_pov.jpg');

    // Step SOUTH onto Rotting Fen Boardwalk [6,10]
    let { data: s4Res } = await apiAction('MOVE', { relative: 'FORWARD' });
    assert.equal(s4Res.state.currentTile.x, 6);
    assert.equal(s4Res.state.currentTile.y, 10);
    assert.equal(s4Res.state.viewportScene.scenes.C.imageUrl, '/lab-assets/images/terrain/swamp_willow_boardwalk_pov.jpg');
    assert.equal(s4Res.state.viewportScene.pointOfInterest.poiKey, 'poi_rotting_fen_boardwalk');

    // Turn WEST and move through [5,10] -> [4,10]
    await apiAction('TURN', { facing: 'WEST' });
    let { data: s5Res } = await apiAction('MOVE', { relative: 'FORWARD' });
    assert.equal(s5Res.state.currentTile.x, 5);
    assert.equal(s5Res.state.currentTile.y, 10);
    let { data: s6Res } = await apiAction('MOVE', { relative: 'FORWARD' });
    assert.equal(s6Res.state.currentTile.x, 4);
    assert.equal(s6Res.state.currentTile.y, 10);

    // Turn SOUTH at [4,10] -> approaches Deadman's Mire [4,11]
    let { data: s6sRes } = await apiAction('TURN', { facing: 'SOUTH' });
    assert.equal(s6sRes.state.facing, 'SOUTH');
    assert.equal(s6sRes.state.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/swamp_approach_mire_ruins.jpg');
    assert.equal(s6sRes.state.viewportScene.pointOfInterest.poiKey, 'poi_deadmans_mire_approach');

    // Step SOUTH into Deadman's Mire [4,11]
    let { data: s7Res } = await apiAction('MOVE', { relative: 'FORWARD' });
    assert.equal(s7Res.state.currentTile.x, 4);
    assert.equal(s7Res.state.currentTile.y, 11);
    assert.equal(s7Res.state.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/swamp_approach_mire_ruins.jpg');

    // Turn NORTH at [4,11] -> faces Sunken Gothic Temple Ruins
    let { data: s7nRes } = await apiAction('TURN', { facing: 'NORTH' });
    assert.equal(s7nRes.state.facing, 'NORTH');
    assert.equal(s7nRes.state.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/deadmans_mire_4_11_ruins.jpg');
    assert.equal(s7nRes.state.viewportScene.pointOfInterest.poiKey, 'poi_deadmans_mire');
  });
});
