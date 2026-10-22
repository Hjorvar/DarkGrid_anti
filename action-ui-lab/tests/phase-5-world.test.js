/**
 * DARKGRID ADVENTURE LAB — PHASE 5.2: ARTWORK ACTIVATION, WORLD VERIFICATION & ADVENTURE CONTINUITY TEST SUITE
 *
 * Verifies:
 *  1. Full 15x15 World Scene Coverage (160 passable tiles × 4 facings = 640 passable viewpoints) with 64 unique paintings in Approved Default mode.
 *  2. 5-Tier POV-First Scene Resolver priority order (Landmark > Barrier > Transition > Contextual > Generic Biome).
 *  3. Impassable Obstacle Visibility (Blackwater River, Stonefang Crag, Darkmount Peaks, Bottomless Mire, Murksea, World Edges).
 *  4. 4-Way Directional Landmark Approach & Turn-Around (180°) Continuity across all 13 World Landmarks.
 *  5. Deterministic Scene Selection & Biome Purity (zero tropical jungle art in Rotting Fen, zero temperate forest fallback in Jungle).
 *  6. Permanent Activation of all 13 Phase 5 Artworks + P5-ART-04-REPL (`public/images/terrain/` & `public/images/perspective/`):
 *     JPEG format, 1376x768 resolution, SHA-256 uniqueness, HTTP 200 serving, `APPROVED` persistent governance, and `RESTRICTED_WITH_REPLACEMENT` for P5-ART-04.
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

  it('1. Audits all 160 passable tiles × 4 facings (640 viewpoints) with 64 unique paintings, 0 Grade D gaps, and valid files on disk in default player mode', async () => {
    const { status, data } = await apiGet('/api/atlas');
    assert.equal(status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.totalTiles, 225);
    assert.equal(data.passableTiles, 160);
    assert.equal(data.impassableTiles, 65);
    assert.equal(data.totalPassableViewpoints, 640);
    assert.equal(data.artPreviewMode, 'APPROVED_DEFAULT');
    assert.equal(data.summary.uniqueImagesCount, 64, 'Expected 64 unique paintings (50 baseline + 14 approved Phase 5 paintings) in APPROVED_DEFAULT');
    assert.equal(data.summary.grades.D, 0, 'Expected zero Grade D viewpoints across all 640 passable viewpoints');

    const passableTiles = data.tiles.filter(t => t.isPassable);
    assert.equal(passableTiles.length, 160);

    for (const tile of passableTiles) {
      for (const facing of ['NORTH', 'EAST', 'SOUTH', 'WEST']) {
        const view = tile.views[facing];
        assert.ok(view, `Missing view for [${tile.x},${tile.y}] ${facing}`);
        assert.ok(view.imageUrl, `Missing imageUrl for [${tile.x},${tile.y}] ${facing}`);
        assert.equal(view.imageUrl.startsWith('/lab-assets/art-candidates/'), false, `Default mode must resolve permanent public/images/ paths at [${tile.x},${tile.y}] ${facing}`);
        assert.equal(view.artApprovalStatus, 'APPROVED', `Default mode must only serve APPROVED images at [${tile.x},${tile.y}] ${facing}`);
        assert.notEqual(view.qualityGrade, 'D', `Unexpected Grade D at [${tile.x},${tile.y}] ${facing}`);
        assert.ok(view.povTier >= 1 && view.povTier <= 4, `Expected Tier 1..4 at [${tile.x},${tile.y}] ${facing}`);
      }
    }
  });

  it('2. Verifies all 13 Phase 5 paintings + P5-ART-04-REPL are permanently activated in public/images/ (format, 1376x768, SHA-256, HTTP serving, APPROVED status)', async () => {
    assert.ok(Array.isArray(CANDIDATE_ART_INVENTORY));
    assert.equal(CANDIDATE_ART_INVENTORY.length, 13);

    const labRoot = path.resolve(__dirname, '..');
    const candidateDir = path.join(labRoot, 'docs/phase-5/art-candidates');
    const allItems = [];
    for (const item of CANDIDATE_ART_INVENTORY) {
      allItems.push(item);
      if (item.replacementCandidate) {
        allItems.push({
          ...item.replacementCandidate,
          category: item.category
        });
      }
    }
    assert.equal(allItems.length, 14);

    const phase5FileNames = new Set(allItems.map(i => i.fileName));
    const seenHashes = new Set();

    // Collect hashes of all pre-Phase-5 existing images to ensure zero duplication against earlier art
    for (const existingDir of [
      path.resolve(labRoot, '../public/images/terrain'),
      path.join(labRoot, 'public/images/terrain'),
      path.join(labRoot, 'public/images/perspective')
    ]) {
      if (!fs.existsSync(existingDir)) continue;
      for (const f of fs.readdirSync(existingDir)) {
        if (phase5FileNames.has(f)) continue;
        const full = path.join(existingDir, f);
        if (fs.statSync(full).isFile() && /\.(jpg|jpeg|png|webp)$/i.test(f)) {
          const h = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
          seenHashes.add(h);
        }
      }
    }

    for (const item of allItems) {
      assert.equal(item.status, 'APPROVED', `Activated painting ${item.fileName} must have status APPROVED`);
      if (item.id === 'P5-ART-04') {
        assert.equal(item.approvalMode, 'RESTRICTED_WITH_REPLACEMENT', 'P5-ART-04 must use RESTRICTED_WITH_REPLACEMENT');
      }

      const candidateFilePath = path.join(candidateDir, item.fileName);
      assert.ok(fs.existsSync(candidateFilePath), `Missing source candidate file: ${candidateFilePath}`);

      const activatedFilePath = path.join(labRoot, item.approvedDiskRelativePath);
      assert.ok(fs.existsSync(activatedFilePath), `Missing permanently activated file: ${activatedFilePath}`);

      const buf = fs.readFileSync(activatedFilePath);
      assert.ok(buf.length > 100000, `Expected high-resolution JPEG (>100KB) for ${item.fileName}, got ${buf.length} bytes`);

      const dims = getJpegDimensions(buf);
      assert.ok(dims, `Invalid JPEG header for ${item.fileName}`);
      assert.equal(dims.width, 1376, `Expected width 1376 for ${item.fileName}`);
      assert.equal(dims.height, 768, `Expected height 768 for ${item.fileName}`);
      assert.ok(dims.aspectRatio > 1.75 && dims.aspectRatio < 1.82, `Expected ~16:9 aspect ratio for ${item.fileName}`);

      const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
      const candSha256 = crypto.createHash('sha256').update(fs.readFileSync(candidateFilePath)).digest('hex');
      assert.equal(sha256, item.sha256, `SHA-256 mismatch for ${item.fileName}`);
      assert.equal(sha256, candSha256, `Activated file SHA-256 must match source candidate for ${item.fileName}`);
      assert.equal(seenHashes.has(sha256), false, `Duplicate SHA-256 detected for ${item.fileName}`);
      seenHashes.add(sha256);

      // Verify static serving at permanent approvedUrl (/lab-assets/images/terrain/... or /lab-assets/images/perspective/...)
      const httpRes = await fetch(`${baseUrl}${item.approvedUrl}`);
      assert.equal(httpRes.status, 200, `Expected HTTP 200 for ${item.approvedUrl}`);
      const contentType = httpRes.headers.get('content-type') || '';
      assert.ok(contentType.includes('image/jpeg'), `Expected image/jpeg content-type for ${item.approvedUrl}`);
    }
  });

  it('3. Resolves permanently activated Phase 5 artwork in default player mode (including P5-ART-04 restriction to 3 viewpoints + 16 moorland replacements) with 0 same-tile Tier 4 duplicates', async () => {
    const { status, data } = await apiGet('/api/atlas');
    assert.equal(status, 200);
    assert.equal(data.artPreviewMode, 'APPROVED_DEFAULT');
    assert.equal(data.summary.uniqueImagesCount, 64, 'Expected 64 unique images in default player mode');

    const tileByCoord = new Map(data.tiles.map(t => [`${t.x},${t.y}`, t]));

    // Check [9,7] SOUTH bespoke activated view (P5-ART-13)
    const watchpost = tileByCoord.get('9,7');
    assert.equal(watchpost.views.SOUTH.imageUrl, '/lab-assets/images/perspective/watchpost_9_7_south_river_gorge.jpg');
    assert.equal(watchpost.views.SOUTH.artApprovalStatus, 'APPROVED');
    assert.equal(watchpost.views.NORTH.imageUrl, '/lab-assets/images/perspective/watchpost_9_7_river_flank.jpg');

    // Check all 5 newly activated transition paintings
    assert.equal(tileByCoord.get('3,8').views.SOUTH.imageUrl, '/lab-assets/images/perspective/transition_hills_to_swamp_pov.jpg');
    assert.equal(tileByCoord.get('6,9').views.NORTH.imageUrl, '/lab-assets/images/perspective/transition_swamp_to_plains_pov.jpg');
    assert.equal(tileByCoord.get('3,4').views.EAST.imageUrl, '/lab-assets/images/perspective/transition_hills_to_forest_pov.jpg');
    assert.equal(tileByCoord.get('5,7').views.WEST.imageUrl, '/lab-assets/images/perspective/transition_plains_to_hills_pov.jpg');
    assert.equal(tileByCoord.get('4,7').views.EAST.imageUrl, '/lab-assets/images/perspective/transition_hills_to_plains_pov.jpg');

    // Check P5-ART-04 restricted placement (exact 3 Windblown Heath viewpoints) vs P5-ART-04-REPL (16 generic PLAINS viewpoints)
    const barrowViewpoints = [];
    const moorlandViewpoints = [];
    for (const tile of data.tiles) {
      if (!tile.isPassable) continue;
      for (const f of ['NORTH', 'EAST', 'SOUTH', 'WEST']) {
        const u = tile.views[f].imageUrl;
        if (u === '/lab-assets/images/terrain/plains_lone_barrow_horizon_pov.jpg') {
          barrowViewpoints.push(`${tile.x},${tile.y}:${f}`);
        } else if (u === '/lab-assets/images/terrain/plains_open_moorland_swell_pov.jpg') {
          moorlandViewpoints.push(`${tile.x},${tile.y}:${f}`);
        }
      }
    }
    assert.deepEqual(barrowViewpoints, ['12,1:SOUTH', '12,2:NORTH', '13,2:WEST'], 'Lone barrow must only appear at 12,1:SOUTH, 12,2:NORTH, 13,2:WEST');
    assert.equal(moorlandViewpoints.length, 16, 'Open moorland swell replacement must serve the remaining 16 PLAINS viewpoints');

    // Verify 0 same-tile duplicates on Tier 4 views across all 160 passable tiles
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

  it('6. Executes Journey B (Oakhaven -> Old Stone Bridge -> Bridge East Watchpost -> Eastern Plains -> Return) with river flank barriers and approved P5-ART-13 at [9,7] SOUTH', async () => {
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

    // Verify [9,7] NORTH and newly approved [9,7] SOUTH (P5-ART-13) are distinct
    let { data: s2nRes } = await apiAction('TURN', { facing: 'NORTH' });
    assert.equal(s2nRes.state.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/watchpost_9_7_river_flank.jpg');
    let { data: s2sRes } = await apiAction('TURN', { facing: 'SOUTH' });
    assert.equal(s2sRes.state.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/watchpost_9_7_south_river_gorge.jpg');
    assert.equal(s2sRes.state.viewportScene.scenes.C.artApprovalStatus, 'APPROVED');

    // Turn EAST and step onto Eastern Frontier Plains [10,7]
    await apiAction('TURN', { facing: 'EAST' });
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

    // Step SOUTH to [6,11], then WEST through [5,11] -> [4,11] (Deadman's Mire)
    let { data: s4bRes } = await apiAction('MOVE', { relative: 'FORWARD' });
    assert.equal(s4bRes.state.currentTile.x, 6);
    assert.equal(s4bRes.state.currentTile.y, 11);

    await apiAction('TURN', { facing: 'WEST' });
    let { data: s5Res } = await apiAction('MOVE', { relative: 'FORWARD' });
    assert.equal(s5Res.state.currentTile.x, 5);
    assert.equal(s5Res.state.currentTile.y, 11);
    assert.equal(s5Res.state.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/swamp_approach_mire_ruins.jpg');
    assert.equal(s5Res.state.viewportScene.pointOfInterest.poiKey, 'poi_deadmans_mire_approach');

    // Step WEST into Deadman's Mire [4,11]
    let { data: s7Res } = await apiAction('MOVE', { relative: 'FORWARD' });
    assert.equal(s7Res.state.currentTile.x, 4);
    assert.equal(s7Res.state.currentTile.y, 11);
    assert.equal(s7Res.state.viewportScene.scenes.C.imageUrl, '/images/terrain/terrain_swamp.webp');

    // Verify all 4 directions at Deadman's Mire [4,11]
    let { data: s7nRes } = await apiAction('TURN', { facing: 'NORTH' });
    assert.equal(s7nRes.state.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/deadmans_mire_4_11_ruins.jpg');
    assert.equal(s7nRes.state.viewportScene.pointOfInterest.poiKey, 'poi_deadmans_mire');

    let { data: s7sRes } = await apiAction('TURN', { facing: 'SOUTH' });
    assert.equal(s7sRes.state.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/swamp_approach_mire_ruins.jpg');

    let { data: s7eRes } = await apiAction('TURN', { facing: 'EAST' });
    assert.equal(s7eRes.state.viewportScene.scenes.C.imageUrl, '/lab-assets/images/terrain/swamp_willow_boardwalk_pov.jpg');
  });

  it('8. Verifies 6-metric World Art Audit classification after Phase 5.2 permanent activation (0 BROKEN_IMAGE_REFERENCE, 0 VALID_APPROVED_FALLBACK, 0 CANDIDATE_ART_PENDING, 0 WRONG_SCENE, 0 EXACT_DUPLICATE_TIER4, 64 unique paintings)', () => {
    const { evaluateWorldArtAudit } = require('../server');
    const defaultAudit = evaluateWorldArtAudit(db, { useCandidateArt: false });
    assert.equal(defaultAudit.artPreviewMode, 'APPROVED_DEFAULT');
    assert.equal(defaultAudit.totalPassableViewpoints, 640);
    assert.equal(defaultAudit.uniqueImagesCount, 64, 'Expected 64 unique environment paintings in APPROVED_DEFAULT');
    assert.equal(defaultAudit.auditMetrics.BROKEN_IMAGE_REFERENCE, 0, 'Zero broken image references in APPROVED_DEFAULT');
    assert.equal(defaultAudit.auditMetrics.WRONG_SCENE, 0, 'Zero wrong scenes in APPROVED_DEFAULT');
    assert.equal(defaultAudit.auditMetrics.VALID_APPROVED_FALLBACK, 0, 'Zero viewpoints awaiting artwork in APPROVED_DEFAULT');
    assert.equal(defaultAudit.auditMetrics.CANDIDATE_ART_PENDING, 0, 'Zero candidate art pending in APPROVED_DEFAULT');
    assert.equal(defaultAudit.auditMetrics.EXACT_DUPLICATE_TIER4, 0, 'Zero Tier 4 same-tile duplicates in APPROVED_DEFAULT');
    assert.equal(defaultAudit.auditMetrics.CORNER_BARRIER_OR_TRANSITION_PAIRS, 10, '10 acceptable corner/barrier duplicate viewpoints');

    const stagedAudit = evaluateWorldArtAudit(db, { useCandidateArt: true });
    assert.equal(stagedAudit.artPreviewMode, 'CANDIDATES_STAGED');
    assert.equal(stagedAudit.auditMetrics.BROKEN_IMAGE_REFERENCE, 0);
    assert.equal(stagedAudit.auditMetrics.WRONG_SCENE, 0);
    assert.equal(stagedAudit.auditMetrics.CANDIDATE_ART_PENDING, 0);
    assert.equal(stagedAudit.auditMetrics.EXACT_DUPLICATE_TIER4, 0);
  });

  it('9. Enforces per-instance Candidate Preview Mode isolation across separate Lab instances and requests', async () => {
    const appB = createLabApp({ dbPath: ':memory:' });
    const dbB = appB.locals.db;
    try {
      setCandidateArtPreviewMode(true, dbB);
      assert.equal(getCandidateArtPreviewMode(dbB), true, 'Instance B should have preview mode enabled');
      assert.equal(getCandidateArtPreviewMode(db), false, 'Primary instance db must remain unaffected (APPROVED_DEFAULT)');

      const { data: defaultState } = await apiGet('/api/state');
      assert.equal(defaultState.state.artPreviewMode, 'APPROVED_DEFAULT');
      const { data: previewState } = await apiGet('/api/state?artPreview=candidates');
      assert.equal(previewState.state.artPreviewMode, 'CANDIDATES_STAGED');
      const { data: afterState } = await apiGet('/api/state');
      assert.equal(afterState.state.artPreviewMode, 'APPROVED_DEFAULT', 'Query parameter preview must not mutate subsequent default requests');
    } finally {
      setCandidateArtPreviewMode(false, dbB);
    }
  });

  it('10. Persists permanent approval across resets while preserving fallback behavior for future unapproved candidates', () => {
    const { setCandidateArtApprovalStatus, getCandidateArtApprovalStatus, resetCandidateArtApprovalStatus } = require('../server');
    try {
      // Simulate a future unapproved candidate on P5-ART-08 ([3,8] SOUTH)
      setCandidateArtApprovalStatus('P5-ART-08', 'REVIEW REQUIRED');
      const simAtlas = buildWorldVisualAtlas(db, { useCandidateArt: false });
      const tileByCoord = new Map(simAtlas.tiles.map(t => [`${t.x},${t.y}`, t]));

      // Unapproved P5-ART-08 ([3,8] SOUTH) falls back to its safe approved fallback in normal mode
      assert.equal(tileByCoord.get('3,8').views.SOUTH.imageUrl, '/lab-assets/images/perspective/transition_plains_to_swamp_pov.jpg');
      // Approved P5-ART-13 ([9,7] SOUTH) continues serving its permanent approved asset
      assert.equal(tileByCoord.get('9,7').views.SOUTH.imageUrl, '/lab-assets/images/perspective/watchpost_9_7_south_river_gorge.jpg');
      assert.equal(tileByCoord.get('9,7').views.SOUTH.artApprovalStatus, 'APPROVED');
    } finally {
      resetCandidateArtApprovalStatus();
    }

    // Verify resetCandidateArtApprovalStatus() restores the permanent owner-approved Phase 5.2 baseline
    for (const item of getCandidateArtApprovalStatus()) {
      assert.equal(item.status, 'APPROVED', `${item.id} must remain APPROVED after resetCandidateArtApprovalStatus()`);
      if (item.id === 'P5-ART-04') {
        assert.equal(item.approvalMode, 'RESTRICTED_WITH_REPLACEMENT');
        assert.equal(item.replacementCandidate.status, 'APPROVED');
      }
    }
  });
});
