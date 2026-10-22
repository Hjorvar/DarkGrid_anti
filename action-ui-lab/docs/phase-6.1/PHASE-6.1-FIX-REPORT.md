# DARKGRID — PHASE 6.1: CONFIRMED DEFECTS & FIX REPORT

**Date:** 2026-10-22  
**Branch:** `darkgrid_legacy_integration`  
**Scope:** Complete Engineering Record of Confirmed Phase 6 Defects, Root Causes, Fixes, and Regression Tests

---

## 1. Summary of Fixes Implemented

### Fix 1: Character Creation Contradiction & Destructive Pre-Validation Deletion (`F-01`)
- **Root Cause:**
  - `action-ui-lab/public/js/ui/character-ui.js` displayed *"Submitting a new hero will retire the current active hero in this session"* and sent `retireCurrentHero: true` when a living character existed.
  - `action-ui-lab/server/controllers/auth-character-controller.js` (`executeCreateCharacterForUser`) executed `DELETE FROM characters WHERE id = ?` **before** calling `createCharacter(db, ...)` to validate the new hero's 71-point ability allocation and name.
- **Fix Applied:**
  - Removed the `retireCurrentHero` deletion block and `startingGold` override from `executeCreateCharacterForUser`. The controller now delegates directly to canonical `createCharacter(db, ...)`, which strictly enforces `One living character per account` (`HTTP 409 Conflict`) without ever deleting an existing living character.
  - Updated `character-ui.js` to detect `hasLivingHero = Boolean(char && Number(char.is_alive) === 1)`, render an explicit `.forge-living-lock-banner` warning, disable the Forge submit button, and never send `retireCurrentHero`.
- **Automated Test:** `action-ui-lab/tests/phase-6-1-hardening.test.js` (Test 4 & Test 7).

### Fix 2: Mandatory Production Authentication & Zero Anonymous Sandbox Fallback (`F-02`, `F-07`)
- **Root Cause:**
  - `resolveRequestUserId` in `action-ui-lab/server/services/legacy-compatibility-service.js` fell back to `defaultUserId` (`action_hero`) whenever `req.session?.userId` was unset and `req.session?.loggedOut` was falsy.
  - `createSandboxDb` in `action-ui-lab/server/services/sandbox-db-service.js` defaulted `preserveExistingMap = false` and `seedSandboxHero = true`, overwriting 4 canonical world tiles (`(6,5)`, `(8,6)`, `(8,8)`, `(9,7)`) and creating a synthetic level-3 hero.
- **Fix Applied:**
  - Added `isProductionMode(options)` and `isAuthRequired(options)` helpers.
  - Hardened `resolveRequestUserId` so that in production or `requireAuth` mode:
    1. Unauthenticated requests always resolve `userId = null`.
    2. Even if an `action_hero` row exists in the database, it is rejected in production/auth mode.
  - Hardened `createSandboxDb` so that when `isProd || requireAuth` is true, `preserveExistingMap` defaults to `true` and `seedSandboxHero` defaults to `false`.
  - Updated `action-controller.js` so all mutations except `LOGIN` and `REGISTER` return `401 Authentication required` when `!userId`.
- **Automated Test:** `action-ui-lab/tests/phase-6-1-hardening.test.js` (Test 2).

### Fix 3: Lockdown of Lab Scenario, Debug, Expedition Escape, and Audit Vectors (`F-03`, `F-04`, `F-05`)
- **Root Cause:**
  - `LAB_SCENARIO`, `TELEPORT_TO_TILE`, `REVIVE`, `FORCE_DISCOVERY`, `SET_DETERMINISTIC_SEED`, `SET_ART_PREVIEW_MODE`, and `MOVE` (`testForceEncounter: true`) were accessible to any player session.
  - `START_EXPEDITION` and `RESET_EXPEDITION` allowed teleporting to `(7,6)`/`(7,7)`, clearing active encounters, and restoring full HP.
  - `GET /api/legacy-audit` was publicly callable without authentication.
- **Fix Applied:**
  - Added `isLabToolsAllowedForUser(db, userId, options)` (`false` in production; requires explicit non-production mode or admin flag).
  - Blocked all 6 debug actions in `action-controller.js` and `testForceEncounter` in `navigation-controller.js` with `403 Forbidden` when `!labToolsAllowed`.
  - Restricted `START_EXPEDITION` and `RESET_EXPEDITION` in `adventure-scenario-controller.js` so normal players cannot invoke them during active encounters (`409 Conflict`) or outside Oakhaven Sanctuary (`403 Forbidden`), and `RESET_EXPEDITION` only clears expedition tracking metadata for normal players without teleporting or healing.
  - Locked down `GET /api/legacy-audit` in `auth-character-controller.js` (`401` unauthenticated, `403` in production or for non-admin users).
- **Automated Test:** `action-ui-lab/tests/phase-6-1-hardening.test.js` (Test 3 & Test 5).

### Fix 4: Fail-Closed Session Secret & Secure Cookie Configuration (`F-06`)
- **Root Cause:**
  - `action-ui-lab/server.js` used `'darkgrid-action-ui-lab-secret'` as a fallback session secret and lacked explicit `httpOnly`, `sameSite`, `secure`, and `trust proxy` settings.
- **Fix Applied:**
  - `createLabApp` throws a fatal error on startup in production mode if `SESSION_SECRET` is missing, shorter than 16 characters, or matches default development strings.
  - Added `app.set('trust proxy', 1)` and configured `__session` with `httpOnly: true`, `sameSite: 'lax'`, and `secure: options.secureCookies !== undefined ? Boolean(options.secureCookies) : (isProd ? 'auto' : false)`.
- **Automated Test:** `action-ui-lab/tests/phase-6-1-hardening.test.js` (Test 1 & Test 3).

### Fix 5: Explicit Ownership Enforcement, Anti-Tamper Expansion & Combat Stale-Round Protection (`F-08`, `F-09`)
- **Root Cause:**
  - `EQUIP`, `UNEQUIP`, `SELL`, `POTION` (`potionInstanceId`), `ACCEPT_BOUNTY`, and `ABANDON_BOUNTY` lacked explicit `403 Forbidden` ownership checks before invoking domain functions.
  - `labAntiTamperMiddleware` did not block `startingGold`, `starting_gold`, `isAdmin`, `is_admin`, or inspect nested `payload.createCharacter`.
  - Combat actions (`ATTACK`, `POTION`, `FLEE`) did not check `payload.expectedRound` against `activeEnc.current_round`.
- **Fix Applied:**
  - Added explicit `403 Forbidden` ownership checks in `character-town-controller.js` and `combat-controller.js`.
  - Expanded `FORBIDDEN_CLIENT_FIELDS` and nested payload inspection in `legacy-compatibility-service.js`.
  - Added `expectedRound` verification in `combat-controller.js` (returns `200 OK` with `staleRoundIgnored: true` when `expectedRound !== current_round`).
- **Automated Test:** `action-ui-lab/tests/phase-6-1-hardening.test.js` (Test 4 & Test 5).

### Fix 6: Player-Facing UI Polish & Contract/Market Data Formatting (`F-10`)
- **Root Cause:**
  - Market rows rendered raw `it.allowed_classes` JSON strings (`["FIGHTER","RANGER","CLERIC"]`).
  - Watcher's Board referenced `c.title` and `c.region_name` (`undefined`) and displayed unnormalized `"a Assassin Vine"` grammar.
  - Top HUD `.dm-hero-name` had `max-width: 128px`, truncating `"VAELEN IRONHAND"`.
- **Fix Applied:**
  - Normalized `bountyContracts` and `wildernessThreats` in `client-state-service.js`.
  - Added structured stat chips (`buildItemStatChipsHtml`, `formatAllowedClassesLabel`, `formatPanoplyBonusSummary`) in `inventory-ui.js`.
  - Polished CSS in `components.css`, `character.css`, `inventory.css`, and `responsive.css`.
- **Automated Test:** `action-ui-lab/tests/phase-6-1-hardening.test.js` (Test 5 & Test 7).
