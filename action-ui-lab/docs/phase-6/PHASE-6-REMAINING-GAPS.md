# DARKGRID — PHASE 6: REMAINING GAPS & PRE-CUTOVER NOTES

**Date:** 2026-10-22  
**Status:** Zero Functional Gameplay Gaps Remaining; Production Cutover Intentionally Deferred per Phase 6 Mandate

---

## 1. Gameplay & Feature Parity Gaps

**None (`0` remaining gameplay gaps).** Every gameplay system, database table, character rule, combat rule, item/market mechanic, bounty system, permadeath/persistent monster rule, and security middleware from the original Darkgrid application has been integrated and verified in `action-ui-lab/`.

---

## 2. Intentionally Deferred Cutover Tasks (Out of Scope for Phase 6)

Per the Phase 6 mission restrictions (*"Phase 6 is NOT permission to perform a production cutover"*), the following operational cutover steps were intentionally not executed and remain for a dedicated Cutover Phase once approved by the owner:

1. **Production Entrypoint & Route Cutover (`src/app.js` / `firebase.json`):**
   - Currently, the original Express SSR (`EJS`) app (`src/app.js` on port `3000`) and the integrated Adventure Lab SPA (`action-ui-lab/server.js` on port `3199`) remain separate entrypoints so the original game is untouched.
   - During a future approved cutover, `src/app.js` (or the root `package.json` `start` script) can mount `createLabApp({ dbPath: config.dbPath, requireAuth: true })` as the primary application.
2. **Production SQLite Backup & Additive Adapter Execution:**
   - Before pointing the new entrypoint at the live production SQLite database, take a full snapshot backup of `darkgrid.db` (`sqlite3 darkgrid.db ".backup 'darkgrid_pre_cutover.db'"`).
   - Upon startup, `ensureNonDestructiveLabAdapter(db)` will automatically and non-destructively add `facing`, `pending_victory_encounter_id`, `scene_mode`, and `trg_cleanup_market_listings_before_item_delete` while preserving all existing `users`, `characters`, `item_instances`, `monster_instances`, `market_listings`, and `hunting_contracts`.
3. **Production Auth Default (`requireAuth: true`):**
   - In development/test mode, `createLabApp` defaults to `requireAuth: false` so automated test suites can use the default `'action_hero'` sandbox user without logging in first.
   - For production deployment, pass `requireAuth: true` (or set `NODE_ENV=production` cutover flag) so unauthenticated visitors default to `mode: 'UNAUTHENTICATED'` and are prompted to sign in or register.
4. **Lab Developer Drawer Visibility in Production:**
   - The `🧪 Lab Tools` toggle in the top header is already collapsed by default (`Player Mode`). In a production cutover, the `🧪 Lab Tools` button and `LAB_SCENARIO` debug action can be gated behind an admin/development environment flag (`ENABLE_LAB_DIRECTOR=true`).

---

## 3. Obsolete Legacy Components (Recommended for Retirement Only After Cutover)

Once the Adventure Lab SPA is promoted to production in a future cutover, the following legacy SSR view templates and CSS files will be superseded and can be archived:
- `src/views/*.ejs` (`game.ejs`, `victory.ejs`, `fallen.ejs`, `character-create.ejs`, `login.ejs`, `register.ejs`)
- `src/routes/game.js` and `src/routes/character.js` (HTML form-post redirect controllers, superseded by `action-ui-lab/server/controllers/*`)
- Legacy overview-style CSS rules in `public/css/style.css` (superseded by `action-ui-lab/public/css/*`)
*(Note: None of these files were modified or removed in Phase 6.)*
