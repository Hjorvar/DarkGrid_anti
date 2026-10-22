# DARKGRID ADVENTURE LAB — PHASE 5.1 ARTWORK APPROVAL & ACTIVATION PLAN

**Branch:** `phase_5_1_review`  
**Scope:** `action-ui-lab/`  
**Current Governance State:** **ALL 13 CANDIDATES (`P5-ART-01`..`P5-ART-13`) + `P5-ART-04-REPL` ARE `REVIEW REQUIRED`**

---

## 1. Per-Artwork ID Activation Mechanism (`Section 7`)

Phase 5.1 implements granular, per-artwork ID approval in [`action-ui-lab/scene-catalog.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/phase_5_1_review/action-ui-lab/scene-catalog.js) and a one-step verification CLI in [`action-ui-lab/scripts/verify-art-approval.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/phase_5_1_review/action-ui-lab/scripts/verify-art-approval.js).

### Programmatic API (`scene-catalog.js`)
- `getCandidateArtApprovalStatus()`: Returns the current approval status, recommendation, `approvalMode`, fallback URL, and `replacementCandidate` metadata for all 13 candidate paintings (`P5-ART-01`..`P5-ART-13`).
- `setCandidateArtApprovalStatus(idOrMap, status, options)`:
  - Supports approving a single ID (`setCandidateArtApprovalStatus('P5-ART-13', 'APPROVED')`), an array of IDs (`setCandidateArtApprovalStatus(['P5-ART-01', 'P5-ART-02'], 'APPROVED')`), or a status map (`{ 'P5-ART-01': 'APPROVED', 'P5-ART-04': 'REVIEW REQUIRED' }`).
  - Supports `options.approvalMode` for `P5-ART-04`:
    - `'DEFAULT'`: Unrestricted generic Tier 4 `PLAINS` pool (`19` viewpoints).
    - `'RESTRICTED'`: Restricts `plains_lone_barrow_horizon_pov.jpg` to the 3 northeastern `Windblown Heath` barrow viewpoints (`['12,1:SOUTH', '12,2:NORTH', '13,2:WEST']`), falling back to `plains_windblown_heath_pov.jpg` elsewhere.
    - `'REPLACEMENT'`: Uses landmark-free `plains_open_moorland_swell_pov.jpg` (`P5-ART-04-REPL`) across all 19 generic Tier 4 `PLAINS` viewpoints.
    - `'RESTRICTED_WITH_REPLACEMENT'` *(Recommended)*: Uses `plains_lone_barrow_horizon_pov.jpg` on `['12,1:SOUTH', '12,2:NORTH', '13,2:WEST']` (`3` viewpoints) and `plains_open_moorland_swell_pov.jpg` (`P5-ART-04-REPL`) on the remaining `16` generic Tier 4 `PLAINS` viewpoints.
- `resetCandidateArtApprovalStatus()`: Restores all candidate items and `P5-ART-04-REPL` to `REVIEW REQUIRED`.

---

## 2. Exact Steps After Owner Sign-Off

### Step 1 — Run the 640-Viewpoint Simulation & Verification Script
Before changing any permanent status, preview the exact 640-viewpoint audit outcome from the command line:

```bash
# Verify current default state (all 13 REVIEW REQUIRED)
node action-ui-lab/scripts/verify-art-approval.js

# Simulate the recommended Phase 5.1 approval configuration
node action-ui-lab/scripts/verify-art-approval.js --simulate-recommended

# Or simulate approving specific IDs only
node action-ui-lab/scripts/verify-art-approval.js --approve=P5-ART-01,P5-ART-02,P5-ART-13
```

### Step 2 — Copy Approved Candidate Files into `action-ui-lab/public/images/` (Upon Owner Approval)
When the owner approves specific artwork IDs:
1. Copy approved generic biome paintings (`P5-ART-01`..`P5-ART-07` and/or `P5-ART-04-REPL`) from `action-ui-lab/docs/phase-5/art-candidates/` to `action-ui-lab/public/images/terrain/`.
2. Copy approved transition and landmark paintings (`P5-ART-08`..`P5-ART-13`) from `action-ui-lab/docs/phase-5/art-candidates/` to `action-ui-lab/public/images/perspective/`.
3. Update the approved item's `status` from `'REVIEW REQUIRED'` to `'APPROVED'` in `CANDIDATE_ART_INVENTORY` (and set `approvalMode: 'RESTRICTED_WITH_REPLACEMENT'` on `P5-ART-04` if the recommended Option B + Option C configuration is approved).

### Step 3 — Verify 640/640 PASS & Full Test Suite
```bash
node action-ui-lab/scripts/verify-art-approval.js
node --test action-ui-lab/tests/*.test.js
```

---

## 3. Expected Audit Outcome Upon Owner Approval (`--simulate-recommended`)

| Metric | Before Approval (`APPROVED_DEFAULT`) | After Recommended Owner Approval |
|---|---:|---:|
| **`BROKEN_IMAGE_REFERENCE`** | `0` | **`0`** |
| **`WRONG_SCENE` (`Grade D`)** | `0` | **`0`** |
| **`VALID_APPROVED_FALLBACK`** | `175` | **`0`** |
| **`CANDIDATE_ART_PENDING`** | `175` | **`0`** |
| **`EXACT_DUPLICATE_TIER4`** | `186` | **`0`** |
| **`ACCEPTABLE_REUSE` (+ Single-Use)** | `440` (`418 + 22`) | **`630` (`604 + 26`)** |
| **Unique Environment Paintings Active** | `51` | **`64`** |
| **Passable Viewpoints Passing (`PASS`)** | `412 / 640` | **`640 / 640`** |
