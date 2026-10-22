# DARKGRID — PHASE 6.1: PRODUCTION SECURITY REVIEW

**Date:** 2026-10-22  
**Branch:** `darkgrid_legacy_integration`  
**Scope:** Production Authentication, Authorization, Session Management, Anti-Tamper, Ownership, and Replay/Concurrency Protection

---

## 1. Security Requirements Verification Matrix

| Security Requirement | Audit Finding (Pre-6.1) | Phase 6.1 Implementation & Hardening | Verification |
|---|---|---|---|
| **1. Authentication is mandatory in production** | Unauthenticated requests fell back to `defaultUserId` unless `req.session.loggedOut === true`. | `resolveRequestUserId` (`legacy-compatibility-service.js`) enforces strict authentication when `isAuthRequired(options)` (`NODE_ENV === 'production'` or `options.requireAuth === true`). All unauthenticated mutations (`POST /api/action`) return `401 Unauthorized`. | `phase-6-1-hardening.test.js` Test 2 |
| **2. Zero anonymous sandbox-user fallback in production** | `action_hero` sandbox account was seeded by default and returned to anonymous visitors. | In production/auth mode, `initSandboxDb` disables `seedSandboxHero` (`false`) and enables `preserveExistingMap` (`true`). Even if `action_hero` exists in a DB, `resolveRequestUserId` explicitly blocks the synthetic `action_hero` user in production mode. | `phase-6-1-hardening.test.js` Test 2 |
| **3. Lab scenario/debug actions inaccessible to normal players** | `LAB_SCENARIO`, `TELEPORT_TO_TILE`, `REVIVE`, `FORCE_DISCOVERY`, `SET_DETERMINISTIC_SEED`, `SET_ART_PREVIEW_MODE`, and `MOVE` (`testForceEncounter`) were callable by any session. | `isLabToolsAllowedForUser` denies access unless `allowLabTools` is enabled outside production or the user is an explicit non-production admin. All 7 debug/staging vectors return `403 Forbidden` for normal players. Also locked down `START_EXPEDITION`/`RESET_EXPEDITION` so players cannot escape combat (`400 Bad Request`), teleport, or heal in the wilderness. | `phase-6-1-hardening.test.js` Test 3 & Test 5 |
| **4. `/api/legacy-audit` cannot leak DB information** | `GET /api/legacy-audit` was publicly accessible without authentication. | `getLegacyAudit` (`auth-character-controller.js`) returns `401 Authentication required` for unauthenticated requests and `403 Forbidden` in production or for non-admin players. | `phase-6-1-hardening.test.js` Test 3 |
| **5. Session cookies and session secrets configured securely** | Fallback secret `config.sessionSecret` (`'darkgrid-dev-secret-key-change-in-production'`) did not fail closed in production. | `createLabApp` (`server.js`) fails closed (`throw new Error(...)`) if started in production without a strong `SESSION_SECRET` ($\ge 16$ characters, not default). Sets `app.set('trust proxy', 1)` and configures `__session` with `httpOnly: true`, `sameSite: 'lax'`, `secure: 'auto'` (or explicit boolean override). | `phase-6-1-hardening.test.js` Test 1 & Test 3 |
| **6. All player mutations enforce character ownership** | `EQUIP`, `UNEQUIP`, `SELL`, `POTION` (`potionInstanceId`), `ACCEPT_BOUNTY`, and `ABANDON_BOUNTY` relied on domain errors (`400`) or lacked explicit pre-check ownership verification (`403`). | Explicit `403 Forbidden` ownership checks added in `character-town-controller.js` (`item_instances.owner_type === 'CHARACTER' && item_instances.owner_character_id === character.id` and `hunting_contracts.character_id === character.id`) and `combat-controller.js` (`potionInstanceId` ownership check). | `phase-6-1-hardening.test.js` Test 5 |
| **7. Replayed or concurrent requests cannot duplicate rewards, purchases, or gameplay actions** | `idempotencyKey` middleware cached responses, and SQLite transactions guarded market/bounties, but combat actions lacked `expectedRound` stale-round protection. | Added `expectedRound` verification to `ATTACK`, `POTION`, and `FLEE` in `combat-controller.js` (returns `200 OK` with `staleRoundIgnored: true` without re-executing combat). Verified `idempotencyKey` replay caching and concurrent market purchase rejection when a consigned item in `market_listings` is bought by two parallel requests. | `phase-6-1-hardening.test.js` Test 5 |
| **8. Security failures default to denying access** | `retireCurrentHero` allowed bypassing the 1-living-character lock; `startingGold` override was accepted in `executeCreateCharacterForUser`. | Removed `retireCurrentHero` deletion backdoor and `startingGold` override. Expanded `labAntiTamperMiddleware` to reject `startingGold`, `starting_gold`, `isAdmin`, `is_admin` (including nested `payload.createCharacter`) with `400 Bad Request`. Unknown actions or unauthorized states default to `400`/`401`/`403`. | `phase-6-1-hardening.test.js` Test 1–5 |

---

## 2. Detailed Code Changes by Security Control

### 2.1 Fail-Closed Production Session Secret & Cookie Configuration (`action-ui-lab/server.js`)
- When `NODE_ENV === 'production'` (or `options.production === true`), `createLabApp` validates `process.env.SESSION_SECRET` (or `options.sessionSecret`) before binding any routes. If missing, shorter than 16 characters, or equal to the default development secret (`'darkgrid-dev-secret-key-change-in-production'`), server startup immediately throws:
  ```
  Production security error: A strong SESSION_SECRET (minimum 16 characters, not the default development secret) is required in production.
  ```
- Configured `app.set('trust proxy', 1)` and session cookie attributes:
  - `name: '__session'`
  - `httpOnly: true`
  - `sameSite: 'lax'`
  - `secure: options.secureCookies !== undefined ? options.secureCookies : (isProd ? 'auto' : false)`

### 2.2 Elimination of Anonymous Sandbox Fallback (`legacy-compatibility-service.js` & `sandbox-db-service.js`)
- `resolveRequestUserId(req, db, defaultUserId, options)`:
  - When `req.session?.userId` is present, verifies the user exists in `users` and rejects the synthetic `action_hero` user if running in production/auth-required mode.
  - When `isAuthRequired(options)` is true or `req.session?.loggedOut` is true, returns `null` immediately—never falling back to `defaultUserId`.
- `initSandboxDb(customDbPath, options)`:
  - Defaults `preserveExistingMap` to `true` and `seedSandboxHero` to `false` whenever `prodOrAuth` (`isProductionMode(options) || isAuthRequired(options)`) is active, ensuring canonical tiles `(6,5)`, `(8,6)`, `(8,8)`, and `(9,7)` are never overwritten and no synthetic hero is injected.

### 2.3 Lockdown of Debug, Scenario, and Audit Endpoints
- `action-controller.js`:
  - Rejects all mutations except `LOGIN` and `REGISTER` with `401 Authentication required` when `!userId`.
  - Rejects `LAB_SCENARIO`, `TELEPORT_TO_TILE`, `REVIVE`, `FORCE_DISCOVERY`, `SET_DETERMINISTIC_SEED`, and `SET_ART_PREVIEW_MODE` with `403 Forbidden` when `!labToolsAllowed`.
- `navigation-controller.js`:
  - Rejects `MOVE` payloads containing `testForceEncounter: true` with `403 Forbidden` when `!labToolsAllowed`.
- `adventure-scenario-controller.js`:
  - Rejects `START_EXPEDITION` and `RESET_EXPEDITION` for normal players (`!labToolsAllowed`) if the hero is in an active encounter (`400 Bad Request`: `Cannot start or reset an expedition while engaged in an encounter.`), rejects `deterministicSeed` (`403 Forbidden`), and only updates in-memory expedition journal metadata without teleporting or healing normal players.
- `auth-character-controller.js`:
  - `GET /api/legacy-audit` (`getLegacyAudit`) requires an authenticated session (`401`) and `isLabToolsAllowedForUser` (`403`).
