# DARKGRID — PHASE 6: END-TO-END GAMEPLAY VALIDATION

**Date:** 2026-10-22  
**Test Suite:** `action-ui-lab/tests/phase-6-legacy-integration.test.js` (`11/11 PASS`)  
**Backend:** Real SQLite database with canonical Darkgrid migrations, seeds, and domain engines (zero mocked domain services).

---

## 1. Validated Complete Player Journeys

### Journey A — Account Registration, Session Lifecycle & Firebase Auth Upgrade Bridge
1. **Register (`POST /api/auth/register`):** Registered user `'ranger_kaelen'`, verified session cookie (`__session`) creation, `user_sessions` persistence, and transition to `mode: 'NO_CHARACTER'`.
2. **Logout (`POST /api/auth/logout`):** Signed out, verified transition to `mode: 'UNAUTHENTICATED'`.
3. **Login (`POST /api/auth/login`):** Signed back in as `'ranger_kaelen'`, verified session restoration.
4. **Firebase Auth Migration Bridge:** Created legacy user `'migrated_hero'` with `password_hash = 'firebase-auth'`, logged in with password, and verified automatic in-place upgrade to a `bcrypt` (`$2b$10$...`) hash.

### Journey B — Canonical 71-Point Character Creation & Class Rules
1. **Point-Buy Validation:** Verified HTTP `400` rejection when attribute sum is `68` instead of `71`.
2. **Ranger Favored Enemy Validation:** Verified HTTP `400` rejection when selecting `UNDEAD` or `HUMANOID` without a subtype.
3. **Valid Ranger Creation:** Created `'Kaelen Mistwalker'` (`RANGER`, `STR 12, CON 11, DEX 16, INT 10, WIS 12, CHA 10` = `71`, `favoredEnemyType: 'HUMANOID:goblinoid'`, `primaryWeapon: 'RANGED'`). Verified spawn at Oakhaven `(7, 7)`, `gold: 10`, `xpForNextLevel: 1300`, `savingThrows: { fort: 2, ref: 5, will: 1 }`, and starter equipment.
4. **1-Living-Hero Rule:** Verified HTTP `409 Conflict` when attempting to create a second living character on the same account.

### Journey C — Multi-User Isolation & Shared World Persistence
1. **Second Account (`cleric_aldric`):** Registered and created `'Brother Aldric'` (`CLERIC`, `STR 12, CON 10, DEX 9, INT 12, WIS 14, CHA 14` = `71`).
2. **Session Isolation:** Verified concurrent `GET /api/state` calls return `'Kaelen Mistwalker'` for Client A and `'Brother Aldric'` for Client B without cross-account leakage.

### Journey D — World Exploration, Stage 1 Secrecy, Ranger Keen Senses, Opening Shot & Favored Enemy
1. **Movement:** Walked Kaelen North out of Oakhaven `(7, 7)` to `(7, 6)` and `(7, 5)` Mirkwood Crossroads.
2. **Stage 1 Secrecy & Keen Senses:** Encountered a Goblin in `DISCOVERED` status. Verified `monsterName`, `monsterId`, and `imageUrl` are `undefined` in `/api/state`, while `isRangerSpecial: true` delivers the Ranger Keen Senses tracking clue.
3. **Opening Shot & Combat Victory:** Engaged (`INVESTIGATE`) in `RANGED` stance; verified `OPENING_SHOT` event recorded in `combat_events`, Favored Enemy bonus applied against `HUMANOID (goblinoid)`, and Goblin defeated with Victory presentation.

### Journey E — Cleric Holy Radiance vs. Undead, INT XP Scaling, Self-Heal & Sanctuary Rest
1. **Holy Radiance:** Engaged `'Brother Aldric'` (`CLERIC`) against a `'Human Skeleton'` (`UNDEAD`). Verified Sacred Defense immediately boosted `heroAC` by `+2` (`baseAC + 2`).
2. **INT-Scaled XP:** Defeated the Human Skeleton (`xp_reward = 135`) with `INT 12` (`+1` mod -> `+10%` XP) and verified `xpAwarded = 149` (`Math.round(135 * 1.10)`).
3. **Sacred Self-Heal (`CLERIC_HEAL`) & Rest (`REST`):** Wounded Brother Aldric outside combat, cast `CLERIC_HEAL` (restored HP, decremented `remainingUses` from `2` to `1`), returned to Oakhaven Sanctuary, and executed `REST` (restored full HP and recharged `remainingUses` back to `2`).

### Journey F — 9-Slot Equipment, Charisma Shop Pricing, Starter Gear Protection & Global Magical Resale Market
1. **Charisma Pricing:** Verified Brother Aldric (`CHA 14`, `+2` mod -> `-10%` buy price) pays less for `Chainmail` than Kaelen (`CHA 10`, `+0` mod).
2. **Starter Gear Protection:** Unequipped starter armor and verified `SELL` is rejected with starter-equipment protection error.
3. **9-Slot Magical Accessories:** Equipped `Belt of Giant Strength +2` (`+2 STR`, `is_str_boosted: true`), `Cloak of Resistance +1` (`+1` to `fort`, `ref`, `will`), and `Ring of Protection +1` (`+1 heroAC`).
4. **Shared Global Magical Resale Market:** Client A (`Kaelen`) unequipped and sold `Ring of Protection +1`; verified it appeared in `shopStock.resaleListings` at `125%` base price for Client B (`Brother Aldric`), who purchased it via `BUY { listingId }` and received the exact item instance in his inventory.

### Journey G — Watcher's Board Hunting Contracts & Auto-Claim
1. Verified 3 daily contracts generated in Oakhaven (`bountyContracts.length === 3`).
2. Accepted Contract 1 (`ACCEPT_BOUNTY`), abandoned it (`ABANDON_BOUNTY`), accepted Contract 2, completed the quarry (`READY_TO_CLAIM`), and verified returning to Oakhaven Sanctuary automatically paid `reward_gold` and surfaced the `Bounty Completed` notice.

### Journey H — Permadeath, Persistent Monster Creation, Wilderness Threat Bearing & Avenging
1. **Permadeath:** Brother Aldric (`300 gp`) was slain by a `Troll` on `(7, 5)`. Verified transition to `mode: 'FALLEN'`, killer attribution, and final battle `combatEvents`.
2. **Persistent Monster Promotion:** Verified `monster_instances` row created on `(7, 5)` with `status = 'ACTIVE'`, `kill_count = 1`, `max_hp = Math.ceil(base_hp * 1.10)`, and `held_gold = 150` (`50%` of fallen hero's `300 gp`).
3. **Wilderness Threats (Section B):** Verified Oakhaven's `wildernessThreats` reported the compass bearing (`North`) and `killCount: 1` while strictly concealing `monster_name`.
4. **New Hero Creation & Avenging:** Client B forged a new Fighter (`'Sir Galahad'`), traveled to `(7, 5)`, engaged and slew the persistent Troll, recovered the `150+ gp` held loot, and verified `'Brother Aldric'` was listed in `victory.persistentInfo.avengedHeroes`.

### Journey I — Anti-Tamper Security & Action Idempotency
1. Verified HTTP `400` rejection when client submits `gold` or `current_hp` in `req.body` or `req.body.payload`.
2. Verified replaying `BUY` with the same `X-Idempotency-Key` returns `X-Idempotent-Replay: true` and deducts gold / grants the item only once.
