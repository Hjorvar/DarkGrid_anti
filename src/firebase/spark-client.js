/**
 * Darkgrid RPG — Firebase Spark Plan Client Engine
 * Runs the authentic Darkgrid domain engine (d20 rules, encounters, combat, economy, persistent monsters)
 * inside an in-browser SQLite engine (sql.js) backed by Firebase Auth and Cloud Firestore.
 */

const { initializeApp } = require('firebase/app');
const {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} = require('firebase/auth');
const {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs
} = require('firebase/firestore');

const config = require('../config');
const { SqlJsDatabaseWrapper, setDb } = require('./browser-connection');
const {
  getLivingCharacterByUserId,
  createCharacter,
  getModifier,
  formatModifier,
  getCharacterEquipment,
  getCharacterInventory,
  getCharacterPotions,
  equipItem,
  unequipItem,
  setPrimaryWeaponPreference,
  getActiveWeapon,
  performClericSelfHeal,
  performCityRest,
  getClericSelfHealInfo,
  getClericRemainingHealUses,
  useConsumable,
  getEffectiveStats
} = require('../domain/character/rules');
const {
  calculateHeroAC,
  calculateHeroAttackBonus
} = require('../domain/combat/rules');
const {
  getCityStoreStock,
  buyItem,
  sellItem
} = require('../domain/economy/shop');
const {
  getTileById,
  getMinimapData,
  getAvailableDirections,
  validateMovement
} = require('../domain/world/map');
const {
  checkTileEncounter,
  getActiveEncounterForCharacter,
  ignoreEncounter,
  investigateEncounter
} = require('../domain/encounters/engine');
const {
  getCombatState,
  executeCombatRound
} = require('../domain/combat/engine');
const { getVictoryData } = require('../domain/combat/victory');
const { getTerrainArtworkForTile } = require('../domain/world/artwork');
const {
  getOrGenerateContracts,
  getActiveContractForCharacter,
  acceptContract,
  abandonContract,
  autoClaimCompletedBounties,
  getWildernessThreats
} = require('../domain/bounties/board');
const templates = require('./compiled-templates');

// Firebase Web Configuration for darkgrid-rpg
const firebaseConfig = {
  projectId: 'darkgrid-rpg',
  appId: '1:402990596032:web:ac92bd004b03b323fb1225',
  storageBucket: 'darkgrid-rpg.firebasestorage.app',
  apiKey: 'AIzaSyBio45_bUjhJdNukfXC49ZECHSu7ptfc5s',
  authDomain: 'darkgrid-rpg.firebaseapp.com',
  messagingSenderId: '402990596032'
};

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const firestore = getFirestore(fbApp);

let sqlDb = null;
let currentAuthUser = null;
let currentLocalUserId = 1;
let currentUsername = '';

/**
 * Generates deterministic integer ID from Firebase UID string (fits SQLite INTEGER)
 */
function uidToNumericId(uid) {
  let hash = 5381;
  for (let i = 0; i < uid.length; i++) {
    hash = ((hash << 5) + hash) + uid.charCodeAt(i);
    hash = hash & 0x7fffffff;
  }
  return Math.max(1, hash);
}

/**
 * Initializes the in-browser SQLite database from the pre-seeded /seed.sqlite image
 */
async function initSqlEngine() {
  if (sqlDb) return sqlDb;
  const initSqlJs = window.initSqlJs;
  if (!initSqlJs) {
    throw new Error('SQLite WebAssembly runtime (sql.js) failed to load.');
  }
  const SQL = await initSqlJs({
    locateFile: file => `/js/${file}`
  });
  const resp = await fetch('/seed.sqlite');
  if (!resp.ok) {
    throw new Error('Failed to load world database seed.');
  }
  const buf = await resp.arrayBuffer();
  const rawDb = new SQL.Database(new Uint8Array(buf));
  sqlDb = new SqlJsDatabaseWrapper(rawDb);
  setDb(sqlDb);
  return sqlDb;
}

/**
 * Pulls shared-world state (persistent monsters & market listings) and user's character state from Firestore into local SQLite
 */
async function pullStateFromFirestore(uid, username) {
  const db = await initSqlEngine();
  const numericUserId = uidToNumericId(uid);
  currentLocalUserId = numericUserId;
  currentUsername = username;

  // Ensure user row exists in local SQLite
  db.prepare('INSERT OR IGNORE INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(
    numericUserId,
    username,
    'firebase-auth'
  );

  try {
    // 1. Pull Shared Persistent Monsters
    const pmSnap = await getDocs(collection(firestore, 'persistent_monsters'));
    for (const docSnap of pmSnap.docs) {
      const pm = docSnap.data();
      const pmId = Number(docSnap.id) || Number(pm.id);
      if (!pmId) continue;

      db.prepare(`
        INSERT OR REPLACE INTO monster_instances (
          id, monster_id, tile_id, current_hp, max_hp, held_gold, kill_count, custom_title, status, created_at, defeated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        pmId,
        Number(pm.monster_id),
        Number(pm.tile_id),
        Number(pm.current_hp ?? pm.max_hp ?? 10),
        Number(pm.max_hp ?? 10),
        Number(pm.held_gold ?? pm.gold_held ?? 0),
        Number(pm.kill_count ?? 1),
        pm.custom_title || null,
        pm.status || 'ACTIVE',
        pm.created_at || new Date().toISOString(),
        pm.defeated_at || null
      );

      // Sync items held by this persistent monster
      if (pm.items_held_json) {
        try {
          const items = JSON.parse(pm.items_held_json);
          db.prepare("DELETE FROM item_instances WHERE owner_type = 'MONSTER' AND owner_monster_id = ?").run(pmId);
          for (const it of items) {
            db.prepare(`
              INSERT OR REPLACE INTO item_instances (id, item_definition_id, owner_type, owner_character_id, owner_monster_id, equipped_slot, created_at)
              VALUES (?, ?, 'MONSTER', NULL, ?, NULL, ?)
            `).run(Number(it.id), Number(it.item_definition_id), pmId, it.created_at || new Date().toISOString());
          }
        } catch (e) {
          console.warn('Could not parse monster items_held_json:', e);
        }
      }
    }

    // 2. Pull Shared Market Listings
    const mlSnap = await getDocs(collection(firestore, 'market_listings'));
    for (const docSnap of mlSnap.docs) {
      const ml = docSnap.data();
      const listingId = Number(docSnap.id);
      if (!listingId) continue;

      if (ml.item_definition_id && ml.item_instance_id) {
        if (ml.status === 'ACTIVE') {
          db.prepare(`
            INSERT OR REPLACE INTO item_instances (id, item_definition_id, owner_type, owner_character_id, owner_monster_id, equipped_slot)
            VALUES (?, ?, 'MARKET', NULL, NULL, NULL)
          `).run(Number(ml.item_instance_id), Number(ml.item_definition_id));
        }
        db.prepare(`
          INSERT OR REPLACE INTO market_listings (id, item_instance_id, seller_character_id, buyer_character_id, price, status, created_at, completed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          listingId,
          Number(ml.item_instance_id),
          Number(ml.seller_character_id || 0) || null,
          Number(ml.buyer_character_id || 0) || null,
          Number(ml.price || 0),
          ml.status || 'ACTIVE',
          ml.created_at || new Date().toISOString(),
          ml.completed_at || null
        );
      }
    }

    // 3. Pull All Characters (for Fallen Heroes / Avenged attribution + current user's characters)
    const charSnap = await getDocs(collection(firestore, 'characters'));
    for (const docSnap of charSnap.docs) {
      const ch = docSnap.data();
      const charId = Number(docSnap.id);
      if (!charId) continue;
      const ownerNumericId = ch.user_id === uid ? numericUserId : uidToNumericId(ch.user_id || 'other');

      db.prepare('INSERT OR IGNORE INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(
        ownerNumericId,
        `user_${ownerNumericId}`,
        'firebase'
      );

      db.prepare(`
        INSERT OR REPLACE INTO characters (
          id, user_id, name, class, level, xp, gold,
          strength, constitution, dexterity, intelligence, wisdom, charisma,
          max_hp, current_hp, tile_id, is_alive, died_at,
          killed_by_monster_instance_id, primary_weapon,
          favored_enemy_type, favored_enemy_subtype, cleric_heal_uses, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        charId,
        ownerNumericId,
        ch.name,
        ch.class,
        Number(ch.level ?? 1),
        Number(ch.xp ?? 0),
        Number(ch.gold ?? 10),
        Number(ch.strength ?? 10),
        Number(ch.constitution ?? 10),
        Number(ch.dexterity ?? 10),
        Number(ch.intelligence ?? 10),
        Number(ch.wisdom ?? 10),
        Number(ch.charisma ?? 10),
        Number(ch.max_hp ?? 10),
        Number(ch.current_hp ?? 10),
        Number(ch.tile_id ?? 113),
        ch.is_alive !== undefined ? Number(ch.is_alive) : 1,
        ch.died_at || null,
        ch.killed_by_monster_instance_id ? Number(ch.killed_by_monster_instance_id) : null,
        ch.primary_weapon || 'MELEE',
        ch.favored_enemy_type || null,
        ch.favored_enemy_subtype || null,
        Number(ch.cleric_heal_uses ?? 0),
        ch.created_at || new Date().toISOString()
      );

      // If this character belongs to the current user, restore their inventory & encounters
      if (ch.user_id === uid) {
        if (ch.inventory_json) {
          try {
            const invItems = JSON.parse(ch.inventory_json);
            db.prepare("DELETE FROM item_instances WHERE owner_type = 'CHARACTER' AND owner_character_id = ?").run(charId);
            for (const it of invItems) {
              db.prepare(`
                INSERT OR REPLACE INTO item_instances (id, item_definition_id, owner_type, owner_character_id, owner_monster_id, equipped_slot, created_at)
                VALUES (?, ?, 'CHARACTER', ?, NULL, ?, ?)
              `).run(
                Number(it.id),
                Number(it.item_definition_id),
                charId,
                it.equipped_slot || null,
                it.created_at || new Date().toISOString()
              );
            }
          } catch (e) {
            console.warn('Could not parse inventory_json:', e);
          }
        }
      }
    }

    // 4. Pull Current User's Encounters & Hunting Contracts
    const encDocRef = doc(firestore, 'encounters', uid);
    const encDocSnap = await getDoc(encDocRef);
    if (encDocSnap.exists()) {
      const encData = encDocSnap.data();
      if (encData.combat_state_json) {
        try {
          const parsed = JSON.parse(encData.combat_state_json);
          if (Array.isArray(parsed.hunting_contracts)) {
            for (const hc of parsed.hunting_contracts) {
              db.prepare(`
                INSERT OR REPLACE INTO hunting_contracts (
                  id, character_id, base_monster_id, custom_name, title, description,
                  region_name, target_terrain, threat_label, boost_type, boost_label,
                  boosted_max_hp, attack_bonus_mod, damage_bonus_mod, reward_gold,
                  status, created_at_level, created_at_encounters, created_at, completed_at, claimed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).run(
                Number(hc.id),
                Number(hc.character_id),
                Number(hc.base_monster_id),
                hc.custom_name,
                hc.title,
                hc.description,
                hc.region_name,
                hc.target_terrain,
                hc.threat_label || 'Dangerous',
                hc.boost_type,
                hc.boost_label,
                Number(hc.boosted_max_hp || 10),
                Number(hc.attack_bonus_mod || 0),
                Number(hc.damage_bonus_mod || 0),
                Number(hc.reward_gold || 10),
                hc.status || 'AVAILABLE',
                Number(hc.created_at_level || 1),
                Number(hc.created_at_encounters || 0),
                hc.created_at || new Date().toISOString(),
                hc.completed_at || null,
                hc.claimed_at || null
              );
            }
          }
          if (Array.isArray(parsed.encounters)) {
            for (const e of parsed.encounters) {
              db.prepare(`
                INSERT OR REPLACE INTO encounters (
                  id, character_id, tile_id, monster_id, monster_instance_id, bounty_contract_id,
                  status, current_monster_hp, monster_max_hp, combat_round, initiative_winner,
                  last_health_bracket, spotted_by_hero, is_ambush, opening_shot_resolved,
                  combat_state_json, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).run(
                Number(e.id),
                Number(e.character_id),
                Number(e.tile_id),
                Number(e.monster_id),
                e.monster_instance_id ? Number(e.monster_instance_id) : null,
                e.bounty_contract_id ? Number(e.bounty_contract_id) : null,
                e.status,
                e.current_monster_hp !== null && e.current_monster_hp !== undefined ? Number(e.current_monster_hp) : null,
                e.monster_max_hp !== null && e.monster_max_hp !== undefined ? Number(e.monster_max_hp) : null,
                Number(e.combat_round ?? 0),
                e.initiative_winner || null,
                e.last_health_bracket || null,
                Number(e.spotted_by_hero ?? 1),
                Number(e.is_ambush ?? 0),
                Number(e.opening_shot_resolved ?? 0),
                e.combat_state_json || '{}',
                e.created_at || new Date().toISOString(),
                e.updated_at || new Date().toISOString()
              );
            }
          }
          if (Array.isArray(parsed.combat_events)) {
            for (const ce of parsed.combat_events) {
              db.prepare(`
                INSERT OR REPLACE INTO combat_events (id, encounter_id, round_number, event_type, public_text, details, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
              `).run(
                Number(ce.id),
                Number(ce.encounter_id),
                Number(ce.round_number ?? 1),
                ce.event_type,
                ce.public_text,
                ce.details || null,
                ce.created_at || new Date().toISOString()
              );
            }
          }
        } catch (e) {
          console.warn('Could not parse encounters combat_state_json:', e);
        }
      }
    }
  } catch (err) {
    console.warn('Firestore sync warning:', err);
  }
}

/**
 * Pushes local SQLite changes for the current user and shared world back to Cloud Firestore
 * while enforcing monotonic state rules (never resurrecting DEFEATED monsters or SOLD items).
 */
async function pushStateToFirestore() {
  if (!currentAuthUser || !sqlDb) return;
  const uid = currentAuthUser.uid;
  const db = sqlDb;

  try {
    // 1. Push user's characters & their inventory
    const myChars = db.prepare('SELECT * FROM characters WHERE user_id = ?').all(currentLocalUserId);
    for (const ch of myChars) {
      const charItems = db.prepare(`
        SELECT id, item_definition_id, equipped_slot, created_at
        FROM item_instances
        WHERE owner_type = 'CHARACTER' AND owner_character_id = ?
      `).all(ch.id);

      const charDocId = String(ch.id);
      await setDoc(doc(firestore, 'characters', charDocId), {
        user_id: uid,
        name: String(ch.name),
        class: String(ch.class),
        level: Number(ch.level || 1),
        xp: Number(ch.xp || 0),
        gold: Number(ch.gold || 0),
        current_hp: Number(ch.current_hp || 0),
        max_hp: Number(ch.max_hp || 1),
        is_alive: Number(ch.is_alive ?? 1),
        tile_id: Number(ch.tile_id || 113),
        strength: Number(ch.strength || 10),
        constitution: Number(ch.constitution || 10),
        dexterity: Number(ch.dexterity || 10),
        intelligence: Number(ch.intelligence || 10),
        wisdom: Number(ch.wisdom || 10),
        charisma: Number(ch.charisma || 10),
        favored_enemy_type: ch.favored_enemy_type || null,
        favored_enemy_subtype: ch.favored_enemy_subtype || null,
        cleric_heal_uses: Number(ch.cleric_heal_uses || 0),
        primary_weapon: ch.primary_weapon || 'MELEE',
        killed_by_monster_instance_id: ch.killed_by_monster_instance_id ? Number(ch.killed_by_monster_instance_id) : null,
        died_at: ch.died_at || null,
        inventory_json: JSON.stringify(charItems),
        created_at: ch.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    // 2. Push user's encounters, combat events, and hunting contracts
    if (myChars.length > 0) {
      const charIds = myChars.map(c => c.id);
      const placeholders = charIds.map(() => '?').join(',');
      const encounters = db.prepare(`
        SELECT * FROM encounters
        WHERE character_id IN (${placeholders})
        ORDER BY id DESC LIMIT 12
      `).all(...charIds);

      const huntingContracts = db.prepare(`
        SELECT * FROM hunting_contracts
        WHERE character_id IN (${placeholders})
        ORDER BY id DESC LIMIT 20
      `).all(...charIds);

      let combatEvents = [];
      if (encounters.length > 0) {
        const encIds = encounters.map(e => e.id);
        const encPlaceholders = encIds.map(() => '?').join(',');
        combatEvents = db.prepare(`
          SELECT * FROM combat_events
          WHERE encounter_id IN (${encPlaceholders})
          ORDER BY id ASC
        `).all(...encIds);
      }

      const latestEnc = encounters[0] || { character_id: myChars[myChars.length - 1].id, status: 'DISCOVERED' };
      const payloadStr = JSON.stringify({
        encounters,
        combat_events: combatEvents,
        hunting_contracts: huntingContracts
      });
      if (payloadStr.length < 48000) {
        await setDoc(doc(firestore, 'encounters', uid), {
          user_id: uid,
          character_id: Number(latestEnc.character_id),
          status: latestEnc.status || 'DISCOVERED',
          combat_state_json: payloadStr,
          created_at: latestEnc.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    }

    // 3. Push Shared Persistent Monsters (Monotonic: never overwrite a remote DEFEATED monster with ACTIVE)
    const pms = db.prepare('SELECT * FROM monster_instances').all();
    for (const pm of pms) {
      const pmRef = doc(firestore, 'persistent_monsters', String(pm.id));
      const existingSnap = await getDoc(pmRef);
      if (existingSnap.exists() && existingSnap.data().status === 'DEFEATED' && pm.status !== 'DEFEATED') {
        continue;
      }

      const pmItems = db.prepare(`
        SELECT id, item_definition_id, created_at
        FROM item_instances
        WHERE owner_type = 'MONSTER' AND owner_monster_id = ?
      `).all(pm.id);

      await setDoc(pmRef, {
        tile_id: Number(pm.tile_id),
        monster_id: Number(pm.monster_id),
        custom_title: pm.custom_title || null,
        status: pm.status || 'ACTIVE',
        held_gold: Number(pm.held_gold || 0),
        current_hp: Number(pm.current_hp || pm.max_hp || 10),
        max_hp: Number(pm.max_hp || 10),
        kill_count: Number(pm.kill_count || 1),
        items_held_json: JSON.stringify(pmItems),
        created_at: pm.created_at || new Date().toISOString(),
        defeated_at: pm.defeated_at || null,
        updated_at: new Date().toISOString()
      });
    }

    // 4. Push Shared Market Listings (Monotonic: never overwrite a remote SOLD listing with ACTIVE)
    const listings = db.prepare(`
      SELECT ml.*, ii.item_definition_id
      FROM market_listings ml
      LEFT JOIN item_instances ii ON ml.item_instance_id = ii.id
    `).all();
    for (const ml of listings) {
      const mlRef = doc(firestore, 'market_listings', String(ml.id));
      const existingMl = await getDoc(mlRef);
      if (existingMl.exists() && existingMl.data().status === 'SOLD' && ml.status !== 'SOLD') {
        continue;
      }

      await setDoc(mlRef, {
        item_instance_id: Number(ml.item_instance_id),
        item_definition_id: Number(ml.item_definition_id || 1),
        seller_character_id: ml.seller_character_id ? Number(ml.seller_character_id) : null,
        buyer_character_id: ml.buyer_character_id ? Number(ml.buyer_character_id) : null,
        price: Number(ml.price || 0),
        status: ml.status || 'ACTIVE',
        created_at: ml.created_at || new Date().toISOString(),
        completed_at: ml.completed_at || null,
        updated_at: new Date().toISOString()
      });
    }
  } catch (err) {
    console.warn('Firestore push warning:', err);
  }
}

/**
 * Generates unique random-ish integer ID for newly created rows so players don't collide in Firestore
 */
function ensureHighAutoIncrementOffsets(db, uid) {
  const baseOffset = (uidToNumericId(uid) % 90000) * 1000 + Math.floor(Math.random() * 500);
  const maxChar = db.prepare('SELECT MAX(id) as m FROM characters').get()?.m || 0;
  if (maxChar < baseOffset) {
    // Seed sqlite_sequence or keep offset via dummy row if needed
    try {
      db.prepare(`
        INSERT INTO characters (id, user_id, name, class, level, xp, gold, strength, constitution, dexterity, intelligence, wisdom, charisma, max_hp, current_hp, tile_id, is_alive)
        VALUES (?, ?, '__seq__', 'FIGHTER', 1, 0, 0, 10, 10, 10, 10, 10, 10, 10, 0, 113, 0)
      `).run(baseOffset, 0);
      db.prepare('DELETE FROM characters WHERE id = ?').run(baseOffset);
    } catch {}
  }
  const maxItem = db.prepare('SELECT MAX(id) as m FROM item_instances').get()?.m || 0;
  if (maxItem < baseOffset) {
    try {
      db.prepare(`
        INSERT INTO item_instances (id, item_definition_id, owner_type)
        VALUES (?, 1, 'MARKET')
      `).run(baseOffset);
      db.prepare('DELETE FROM item_instances WHERE id = ?').run(baseOffset);
    } catch {}
  }
  const maxPm = db.prepare('SELECT MAX(id) as m FROM monster_instances').get()?.m || 0;
  if (maxPm < baseOffset) {
    try {
      db.prepare(`
        INSERT INTO monster_instances (id, monster_id, tile_id, current_hp, max_hp, held_gold, kill_count, status)
        VALUES (?, 1, 1, 10, 10, 0, 1, 'DEFEATED')
      `).run(baseOffset);
      db.prepare('DELETE FROM monster_instances WHERE id = ?').run(baseOffset);
    } catch {}
  }
}

/**
 * Renders an EJS view template into the document
 */
function renderView(viewName, data = {}) {
  const locals = {
    currentUser: currentAuthUser ? { id: currentLocalUserId, username: currentUsername } : null,
    csrfToken: 'firebase-spark-csrf',
    ...data
  };
  const fn = templates[viewName];
  if (!fn) {
    throw new Error(`Template not found: ${viewName}`);
  }
  const html = fn(locals);
  const parser = new DOMParser();
  const docDom = parser.parseFromString(html, 'text/html');

  document.body.className = docDom.body.className;
  document.body.innerHTML = docDom.body.innerHTML;

  // Execute inline or external scripts inside rendered view (e.g. character-builder.js or modal scripts)
  const scripts = Array.from(document.body.querySelectorAll('script'));
  for (const oldScript of scripts) {
    if (oldScript.type && oldScript.type !== 'text/javascript' && oldScript.type !== '') {
      continue; // Skip application/json data blocks
    }
    const newScript = document.createElement('script');
    for (const attr of oldScript.attributes) {
      newScript.setAttribute(attr.name, attr.value);
    }
    if (oldScript.textContent) {
      // Transform DOMContentLoaded listeners in inline scripts to run immediately
      let scriptCode = oldScript.textContent.replace(
        /document\.addEventListener\(\s*['"]DOMContentLoaded['"]\s*,\s*function\s*\(\)\s*\{([\s\S]*?)\}\s*\)\s*;/g,
        '(function(){ $1 })();'
      );
      // Prevent duplicate document keydown listeners across SPA re-renders
      scriptCode = scriptCode.replace(
        /document\.addEventListener\(\s*['"]keydown['"]\s*,\s*function\s*\(e\)\s*\{/,
        'if (window.__dgKeydown) document.removeEventListener("keydown", window.__dgKeydown); document.addEventListener("keydown", window.__dgKeydown = function(e) {'
      );
      newScript.textContent = scriptCode;
    }
    oldScript.parentNode.replaceChild(newScript, oldScript);
  }

  window.scrollTo(0, 0);
}

/**
 * Client-side Router
 */
async function navigateTo(url, pushHistory = true) {
  const parsedUrl = new URL(url, window.location.origin);
  const pathname = parsedUrl.pathname.replace(/\/+$/, '') || '/';
  const searchParams = parsedUrl.searchParams;

  if (pushHistory && (window.location.pathname + window.location.search) !== (pathname + parsedUrl.search)) {
    window.history.pushState(null, '', pathname + parsedUrl.search + parsedUrl.hash);
  }

  // Public routes
  if (pathname === '/login') {
    if (currentAuthUser) return navigateTo('/game');
    return renderView('login', { error: null, success: null, username: '' });
  }

  if (pathname === '/register') {
    if (currentAuthUser) return navigateTo('/game');
    return renderView('register', { error: null, username: '' });
  }

  // Protected routes
  if (!currentAuthUser) {
    return navigateTo('/login');
  }

  const db = await initSqlEngine();

  if (pathname === '/') {
    const character = getLivingCharacterByUserId(db, currentLocalUserId);
    if (!character) {
      const fallen = db.prepare(`
        SELECT id FROM characters
        WHERE user_id = ? AND is_alive = 0
        ORDER BY id DESC LIMIT 1
      `).get(currentLocalUserId);
      if (fallen) return navigateTo('/game/fallen');
      return navigateTo('/character/create');
    }
    return navigateTo('/game');
  }

  if (pathname === '/character/create') {
    const existingCharacter = getLivingCharacterByUserId(db, currentLocalUserId);
    if (existingCharacter) return navigateTo('/game');

    return renderView('create-character', {
      error: null,
      errors: [],
      classBases: config.classBases,
      statRules: config.statRules,
      getModifier,
      formatModifier,
      formData: {
        name: '',
        classType: 'FIGHTER'
      }
    });
  }

  if (pathname === '/game/fallen') {
    const living = getLivingCharacterByUserId(db, currentLocalUserId);
    if (living) return navigateTo('/game');

    const fallen = db.prepare(`
      SELECT c.*, m.name as killer_name, mi.kill_count as killer_kills, t.name as tile_name
      FROM characters c
      LEFT JOIN monster_instances mi ON c.killed_by_monster_instance_id = mi.id
      LEFT JOIN monsters m ON mi.monster_id = m.id
      LEFT JOIN map_tiles t ON c.tile_id = t.id
      WHERE c.user_id = ? AND c.is_alive = 0
      ORDER BY c.id DESC LIMIT 1
    `).get(currentLocalUserId);

    if (!fallen) return navigateTo('/character/create');

    const lastEncounter = db.prepare(`
      SELECT id, combat_round
      FROM encounters
      WHERE character_id = ?
      ORDER BY id DESC LIMIT 1
    `).get(fallen.id);

    const combatEvents = lastEncounter
      ? db.prepare(`
          SELECT id, round_number, event_type, public_text
          FROM combat_events
          WHERE encounter_id = ?
          ORDER BY id ASC
        `).all(lastEncounter.id)
      : [];

    return renderView('fallen', { fallen, combatEvents });
  }

  if (pathname === '/game/victory') {
    const character = getLivingCharacterByUserId(db, currentLocalUserId);
    if (!character) {
      const fallen = db.prepare(`
        SELECT id FROM characters WHERE user_id = ? AND is_alive = 0 ORDER BY id DESC LIMIT 1
      `).get(currentLocalUserId);
      if (fallen) return navigateTo('/game/fallen');
      return navigateTo('/character/create');
    }

    let encounterId = searchParams.get('encounterId') ? parseInt(searchParams.get('encounterId'), 10) : null;
    if (!encounterId || isNaN(encounterId)) {
      const latestVictory = db.prepare(`
        SELECT id FROM encounters
        WHERE character_id = ? AND status = 'VICTORY'
        ORDER BY id DESC LIMIT 1
      `).get(character.id);
      if (!latestVictory) return navigateTo('/game');
      encounterId = latestVictory.id;
    }

    const victoryData = getVictoryData(db, character.id, encounterId);
    if (!victoryData) return navigateTo('/game');

    return renderView('victory', { ...victoryData });
  }

  if (pathname === '/game') {
    const character = getLivingCharacterByUserId(db, currentLocalUserId);
    if (!character) {
      const fallen = db.prepare(`
        SELECT id FROM characters WHERE user_id = ? AND is_alive = 0 ORDER BY id DESC LIMIT 1
      `).get(currentLocalUserId);
      if (fallen) return navigateTo('/game/fallen');
      return navigateTo('/character/create');
    }

    const currentTile = getTileById(db, character.tile_id);
    const terrainArtwork = getTerrainArtworkForTile(db, currentTile);
    const activeEncounter = getActiveEncounterForCharacter(db, character.id, character.class);

    let combatState = null;
    if (activeEncounter && activeEncounter.status === 'IN_COMBAT') {
      combatState = getCombatState(db, character.id, activeEncounter.id);
    }

    const equipment = getCharacterEquipment(db, character.id);
    const effectiveHero = getEffectiveStats(character, equipment);
    const inventory = getCharacterInventory(db, character.id);
    const potions = getCharacterPotions(db, character.id);
    const potionCount = potions.length;

    const revealedMonster = (activeEncounter && activeEncounter.status === 'IN_COMBAT') ? activeEncounter : null;
    const { activeWeapon, isRangedActive } = combatState ? combatState : getActiveWeapon(effectiveHero, equipment, revealedMonster);
    const meleeAttackBonus = calculateHeroAttackBonus(effectiveHero, equipment.meleeWeapon, revealedMonster, equipment);
    const rangedAttackBonus = calculateHeroAttackBonus(effectiveHero, equipment.rangedWeapon, revealedMonster, equipment);
    const heroAC = combatState ? combatState.heroAC : calculateHeroAC(effectiveHero, equipment, isRangedActive, revealedMonster, activeWeapon);

    let clericHealInfo = null;
    if ((character.class || '').toUpperCase() === 'CLERIC') {
      clericHealInfo = {
        ...getClericSelfHealInfo(character.level),
        remainingUses: getClericRemainingHealUses(character)
      };
    }

    const isSafeCity = (currentTile.terrain === 'CITY' && currentTile.is_safe === 1);
    let bountyClaimMessage = searchParams.get('bountyClaimed') || null;
    if (isSafeCity && (!activeEncounter || activeEncounter.status !== 'IN_COMBAT')) {
      const claimedList = autoClaimCompletedBounties(db, character.id);
      if (claimedList.length > 0) {
        const refreshedChar = getLivingCharacterByUserId(db, currentLocalUserId);
        if (refreshedChar) {
          effectiveHero.gold = refreshedChar.gold;
        }
        const summary = claimedList
          .map(c => `Bounty Completed: You slew ${c.customName} (${c.baseMonsterName}) in ${c.regionName} and received ${c.rewardGold} Gold from the Watchers of Oakhaven!`)
          .join(' ');
        bountyClaimMessage = bountyClaimMessage ? `${bountyClaimMessage} ${summary}` : summary;
      }
    }

    const shopStock = isSafeCity ? getCityStoreStock(db, effectiveHero) : null;
    const bountyContracts = isSafeCity ? getOrGenerateContracts(db, effectiveHero) : [];
    const wildernessThreats = isSafeCity ? getWildernessThreats(db) : [];
    const activeContract = getActiveContractForCharacter(db, character.id);
    const minimap = getMinimapData(db, currentTile, 2);
    const directions = getAvailableDirections(db, currentTile);

    const modifiers = {
      strength: formatModifier(effectiveHero.strength),
      constitution: formatModifier(effectiveHero.constitution),
      dexterity: formatModifier(effectiveHero.dexterity),
      intelligence: formatModifier(effectiveHero.intelligence),
      wisdom: formatModifier(effectiveHero.wisdom),
      charisma: formatModifier(effectiveHero.charisma)
    };

    const errorMessage = searchParams.get('error') || null;
    const infoMessage = searchParams.get('info') || null;
    const activeModal = searchParams.get('modal') || null;

    const journalEncounters = db.prepare(`
      SELECT e.id, e.status, e.combat_round, e.created_at,
             COALESCE(hc.custom_name, mi.custom_title, m.name) as monster_name,
             t.name as tile_name,
             (SELECT COUNT(*) FROM combat_events ce WHERE ce.encounter_id = e.id) as event_count,
             (SELECT ce.public_text FROM combat_events ce WHERE ce.encounter_id = e.id AND ce.event_type = 'VICTORY' LIMIT 1) as victory_text
      FROM encounters e
      LEFT JOIN monsters m ON e.monster_id = m.id
      LEFT JOIN monster_instances mi ON e.monster_instance_id = mi.id
      LEFT JOIN hunting_contracts hc ON e.bounty_contract_id = hc.id
      LEFT JOIN map_tiles t ON e.tile_id = t.id
      WHERE e.character_id = ? AND e.status IN ('VICTORY', 'ESCAPED', 'IN_COMBAT')
      ORDER BY e.id DESC
      LIMIT 10
    `).all(character.id);

    return renderView('game', {
      character: effectiveHero,
      currentTile,
      terrainArtwork,
      minimap,
      directions,
      encounter: activeEncounter,
      combatState,
      equipment,
      inventory,
      potions,
      potionCount,
      activeWeapon,
      isRangedActive,
      meleeAttackBonus,
      rangedAttackBonus,
      heroAC,
      clericHealInfo,
      isSafeCity,
      shopStock,
      bountyContracts,
      wildernessThreats,
      activeContract,
      bountyClaimMessage,
      modifiers,
      errorMessage,
      infoMessage,
      activeModal,
      journalEncounters
    });
  }

  return renderView('error', {
    title: '404 - Not Found',
    message: 'The page or path you sought does not exist in Darkgrid.'
  });
}

/**
 * Handles all POST form submissions cleanly in the browser
 */
async function handleFormSubmit(form) {
  const actionUrl = new URL(form.getAttribute('action') || window.location.pathname, window.location.origin);
  const pathname = actionUrl.pathname.replace(/\/+$/, '') || '/';
  const formData = new FormData(form);
  const body = {};
  for (const [k, v] of formData.entries()) {
    body[k] = v;
  }

  const db = await initSqlEngine();

  // 1. Auth: Register
  if (pathname === '/register') {
    const cleanUsername = (body.username || '').trim();
    const password = body.password || '';
    const confirmPassword = body.confirmPassword || '';

    try {
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
        throw new Error('Username must be 3-20 characters (letters, numbers, and underscores only).');
      }
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters.');
      }
      if (password !== confirmPassword) {
        throw new Error('Passwords do not match.');
      }

      const lowerUser = cleanUsername.toLowerCase();
      const unameSnap = await getDoc(doc(firestore, 'usernames', lowerUser));
      if (unameSnap.exists()) {
        throw new Error('This username is already taken.');
      }

      const synthEmail = `${lowerUser}@darkgrid-rpg.firebaseapp.com`;
      const cred = await createUserWithEmailAndPassword(auth, synthEmail, password);
      await updateProfile(cred.user, { displayName: cleanUsername });

      const nowIso = new Date().toISOString();
      await setDoc(doc(firestore, 'usernames', lowerUser), {
        uid: cred.user.uid,
        username: cleanUsername,
        created_at: nowIso
      });
      await setDoc(doc(firestore, 'users', cred.user.uid), {
        uid: cred.user.uid,
        username: cleanUsername,
        created_at: nowIso
      });

      currentAuthUser = cred.user;
      await pullStateFromFirestore(cred.user.uid, cleanUsername);
      ensureHighAutoIncrementOffsets(db, cred.user.uid);
      return navigateTo('/');
    } catch (err) {
      let msg = err.message || 'Registration failed.';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'This username is already taken.';
      }
      return renderView('register', { error: msg, username: cleanUsername });
    }
  }

  // 2. Auth: Login
  if (pathname === '/login') {
    const cleanUsername = (body.username || '').trim();
    const password = body.password || '';
    try {
      if (!cleanUsername || !password) {
        throw new Error('Please enter both username and password.');
      }
      const lowerUser = cleanUsername.toLowerCase();
      const synthEmail = `${lowerUser}@darkgrid-rpg.firebaseapp.com`;
      const cred = await signInWithEmailAndPassword(auth, synthEmail, password);
      currentAuthUser = cred.user;
      const displayName = cred.user.displayName || cleanUsername;
      await pullStateFromFirestore(cred.user.uid, displayName);
      ensureHighAutoIncrementOffsets(db, cred.user.uid);
      return navigateTo('/');
    } catch (err) {
      return renderView('login', {
        error: 'Invalid username or password.',
        success: null,
        username: cleanUsername
      });
    }
  }

  // 3. Auth: Logout
  if (pathname === '/logout') {
    await signOut(auth);
    currentAuthUser = null;
    return navigateTo('/login');
  }

  // Ensure authenticated for all game actions
  if (!currentAuthUser) {
    return navigateTo('/login');
  }

  // 4. Character Create
  if (pathname === '/character/create') {
    const stats = {
      strength: parseInt(body.strength, 10),
      constitution: parseInt(body.constitution, 10),
      dexterity: parseInt(body.dexterity, 10),
      intelligence: parseInt(body.intelligence, 10),
      wisdom: parseInt(body.wisdom, 10),
      charisma: parseInt(body.charisma, 10)
    };
    try {
      ensureHighAutoIncrementOffsets(db, currentAuthUser.uid);
      createCharacter(db, {
        userId: currentLocalUserId,
        name: body.name,
        classType: body.classType,
        stats,
        favoredEnemyType: body.favoredEnemyType || null,
        favoredEnemySubtype: body.favoredEnemySubtype || null
      });
      await pushStateToFirestore();
      return navigateTo('/game');
    } catch (err) {
      return renderView('create-character', {
        error: err.message,
        errors: err.validationErrors || [err.message],
        classBases: config.classBases,
        statRules: config.statRules,
        getModifier,
        formatModifier,
        formData: {
          name: body.name,
          classType: body.classType,
          favoredEnemyType: body.favoredEnemyType,
          favoredEnemySubtype: body.favoredEnemySubtype,
          ...stats
        }
      });
    }
  }

  const character = getLivingCharacterByUserId(db, currentLocalUserId);
  if (!character) {
    return navigateTo('/game');
  }

  // 5. Move
  if (pathname === '/game/move') {
    const validation = validateMovement(db, character, body.direction);
    if (!validation.allowed) {
      return navigateTo(`/game?error=${encodeURIComponent(validation.reason)}`);
    }
    const targetTile = validation.targetTile;
    db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(targetTile.id, character.id);
    checkTileEncounter(db, character, targetTile);
    await pushStateToFirestore();
    return navigateTo('/game');
  }

  // 6. Encounter Ignore
  if (pathname === '/game/encounter/ignore') {
    try {
      ignoreEncounter(db, character.id, parseInt(body.encounterId, 10));
      await pushStateToFirestore();
      return navigateTo('/game?info=' + encodeURIComponent('You slipped past the threat undetected, keeping your composure.'));
    } catch (err) {
      return navigateTo(`/game?error=${encodeURIComponent(err.message)}`);
    }
  }

  // 7. Encounter Investigate
  if (pathname === '/game/encounter/investigate') {
    const encounterId = parseInt(body.encounterId, 10);
    try {
      const result = investigateEncounter(db, character.id, encounterId, character.class);
      await pushStateToFirestore();
      if (result && (result.status === 'VICTORY' || result.monsterDied)) {
        return navigateTo(`/game/victory?encounterId=${encounterId}`);
      }
      return navigateTo('/game');
    } catch (err) {
      return navigateTo(`/game?error=${encodeURIComponent(err.message)}`);
    }
  }

  // 8. Combat Attack
  if (pathname === '/game/combat/attack') {
    const encounterId = parseInt(body.encounterId, 10);
    const round = body.round ? parseInt(body.round, 10) : undefined;
    try {
      const state = executeCombatRound(db, character.id, encounterId, 'ATTACK', { expectedRound: round });
      await pushStateToFirestore();
      if (state.character.is_alive === 0) {
        return navigateTo('/game/fallen');
      }
      if (state.encounter.status === 'VICTORY') {
        return navigateTo(`/game/victory?encounterId=${encounterId}`);
      }
      return navigateTo('/game');
    } catch (err) {
      return navigateTo(`/game?error=${encodeURIComponent(err.message)}`);
    }
  }

  // 9. Combat Drink Potion
  if (pathname === '/game/combat/potion') {
    const encounterId = parseInt(body.encounterId, 10);
    const round = body.round ? parseInt(body.round, 10) : undefined;
    const potionInstanceId = body.potionInstanceId ? parseInt(body.potionInstanceId, 10) : undefined;
    try {
      const state = executeCombatRound(db, character.id, encounterId, 'DRINK_POTION', {
        expectedRound: round,
        potionInstanceId
      });
      await pushStateToFirestore();
      if (state.character.is_alive === 0) {
        return navigateTo('/game/fallen');
      }
      if (state.encounter.status === 'VICTORY') {
        return navigateTo(`/game/victory?encounterId=${encounterId}`);
      }
      return navigateTo('/game');
    } catch (err) {
      return navigateTo(`/game?error=${encodeURIComponent(err.message)}`);
    }
  }

  // 10. Combat Flee
  if (pathname === '/game/combat/flee') {
    const encounterId = parseInt(body.encounterId, 10);
    const round = body.round ? parseInt(body.round, 10) : undefined;
    try {
      const state = executeCombatRound(db, character.id, encounterId, 'FLEE', { expectedRound: round });
      await pushStateToFirestore();
      if (state.character.is_alive === 0) {
        return navigateTo('/game/fallen');
      }
      if (state.encounter.status === 'ESCAPED') {
        return navigateTo('/game?info=' + encodeURIComponent('You broke away from the creature and escaped!'));
      }
      return navigateTo('/game');
    } catch (err) {
      return navigateTo(`/game?error=${encodeURIComponent(err.message)}`);
    }
  }

  // 11. City Rest
  if (pathname === '/game/rest') {
    const activeEncounter = getActiveEncounterForCharacter(db, character.id, character.class);
    if (activeEncounter && (activeEncounter.status === 'IN_COMBAT' || activeEncounter.status === 'DISCOVERED')) {
      return navigateTo('/game?error=' + encodeURIComponent('Cannot rest while engaged in active combat or an unresolved encounter!'));
    }
    try {
      const result = performCityRest(db, character.id);
      await pushStateToFirestore();
      return navigateTo('/game?info=' + encodeURIComponent(`You rested peacefully in the sanctuary. Vitality restored to full (${result.maxHp} HP) and abilities refreshed.`));
    } catch (err) {
      return navigateTo(`/game?error=${encodeURIComponent(err.message)}`);
    }
  }

  // 12. Cleric Self Heal
  if (pathname === '/game/cleric/heal') {
    const activeEncounter = getActiveEncounterForCharacter(db, character.id, character.class);
    if (activeEncounter && (activeEncounter.status === 'IN_COMBAT' || activeEncounter.status === 'DISCOVERED')) {
      return navigateTo('/game?error=' + encodeURIComponent('Cannot use meditative self-healing during active combat or an unresolved encounter!'));
    }
    try {
      const result = performClericSelfHeal(db, character.id);
      await pushStateToFirestore();
      return navigateTo('/game?info=' + encodeURIComponent(`Divine power flows through you, restoring ${result.healed} HP (${result.currentHp}/${result.maxHp} HP). ${result.remainingUses} uses remain.`));
    } catch (err) {
      return navigateTo(`/game?error=${encodeURIComponent(err.message)}`);
    }
  }

  // 13. Inventory Equip / Unequip / Use / Primary Weapon
  if (pathname === '/game/inventory/equip') {
    const returnModal = body.returnModal || 'backpack';
    try {
      equipItem(db, character.id, parseInt(body.itemInstanceId, 10), body.targetSlot || null);
      await pushStateToFirestore();
      return navigateTo(`/game?modal=${encodeURIComponent(returnModal)}&info=` + encodeURIComponent('Equipment updated.'));
    } catch (err) {
      return navigateTo(`/game?modal=${encodeURIComponent(returnModal)}&error=${encodeURIComponent(err.message)}`);
    }
  }

  if (pathname === '/game/inventory/unequip') {
    const returnModal = body.returnModal || 'backpack';
    try {
      unequipItem(db, character.id, parseInt(body.itemInstanceId, 10));
      await pushStateToFirestore();
      return navigateTo(`/game?modal=${encodeURIComponent(returnModal)}&info=` + encodeURIComponent('Item unequipped to backpack.'));
    } catch (err) {
      return navigateTo(`/game?modal=${encodeURIComponent(returnModal)}&error=${encodeURIComponent(err.message)}`);
    }
  }

  if (pathname === '/game/inventory/use') {
    const returnModal = body.returnModal || 'backpack';
    try {
      const result = useConsumable(db, character.id, parseInt(body.itemInstanceId, 10));
      await pushStateToFirestore();
      return navigateTo(`/game?modal=${encodeURIComponent(returnModal)}&info=` + encodeURIComponent(result.message));
    } catch (err) {
      return navigateTo(`/game?modal=${encodeURIComponent(returnModal)}&error=${encodeURIComponent(err.message)}`);
    }
  }

  if (pathname === '/game/character/primary-weapon') {
    const returnModal = body.returnModal || 'character';
    try {
      setPrimaryWeaponPreference(db, character.id, body.primaryWeapon);
      await pushStateToFirestore();
      const prefLabel = (body.primaryWeapon || '').toUpperCase() === 'RANGED' ? 'Ranged' : 'Melee';
      return navigateTo(`/game?modal=${encodeURIComponent(returnModal)}&info=` + encodeURIComponent(`Primary weapon preference set to ${prefLabel}.`));
    } catch (err) {
      return navigateTo(`/game?modal=${encodeURIComponent(returnModal)}&error=${encodeURIComponent(err.message)}`);
    }
  }

  // 14. Shop Buy / Sell
  if (pathname === '/game/shop/buy') {
    const returnModal = body.returnModal || 'market';
    const itemDefinitionId = body.itemDefinitionId ? parseInt(body.itemDefinitionId, 10) : null;
    const listingId = body.listingId ? parseInt(body.listingId, 10) : null;
    try {
      const result = buyItem(db, character.id, { itemDefinitionId, listingId });
      await pushStateToFirestore();
      return navigateTo(`/game?modal=${encodeURIComponent(returnModal)}&info=` + encodeURIComponent(`Purchased ${result.purchasedItem.name} for ${result.purchasedItem.price} gp. Remaining gold: ${result.remainingGold} gp.`));
    } catch (err) {
      return navigateTo(`/game?modal=${encodeURIComponent(returnModal)}&error=${encodeURIComponent(err.message)}`);
    }
  }

  if (pathname === '/game/shop/sell') {
    const returnModal = body.returnModal || 'market';
    try {
      const result = sellItem(db, character.id, parseInt(body.itemInstanceId, 10));
      await pushStateToFirestore();
      let msg = `Sold ${result.itemName} for ${result.goldEarned} gp.`;
      if (result.movedToMarket) {
        msg += ` The artifact is now listed in the global resale market for ${result.resalePrice} gp.`;
      }
      return navigateTo(`/game?modal=${encodeURIComponent(returnModal)}&info=` + encodeURIComponent(msg));
    } catch (err) {
      return navigateTo(`/game?modal=${encodeURIComponent(returnModal)}&error=${encodeURIComponent(err.message)}`);
    }
  }

  if (pathname === '/game/bounties/accept') {
    const returnModal = body.returnModal || 'bounties';
    const currentTile = getTileById(db, character.tile_id);
    if (!currentTile || currentTile.terrain !== 'CITY' || currentTile.is_safe !== 1) {
      return navigateTo('/game?error=' + encodeURIComponent("You must be in Oakhaven to accept a contract from The Watcher's Board."));
    }
    const contractId = parseInt(body.contractId, 10);
    const result = acceptContract(db, character.id, contractId);
    if (!result.success) {
      return navigateTo(`/game?modal=${encodeURIComponent(returnModal)}&error=${encodeURIComponent(result.error)}`);
    }
    await pushStateToFirestore();
    return navigateTo(`/game?modal=${encodeURIComponent(returnModal)}&info=${encodeURIComponent(result.message)}`);
  }

  if (pathname === '/game/bounties/abandon') {
    const returnModal = body.returnModal || '';
    const modalParam = returnModal ? `modal=${encodeURIComponent(returnModal)}&` : '';
    const contractId = body.contractId ? parseInt(body.contractId, 10) : null;
    const result = abandonContract(db, character.id, contractId);
    if (!result.success) {
      return navigateTo(`/game?${modalParam}error=${encodeURIComponent(result.error)}`);
    }
    await pushStateToFirestore();
    return navigateTo(`/game?${modalParam}info=${encodeURIComponent(result.message)}`);
  }
}

/**
 * Global Event Listeners for SPA form & link interception
 */
function setupGlobalInterceptors() {
  // Override HTMLFormElement.prototype.submit so keyboard shortcuts (e.g. WASD form.submit()) trigger SPA handler
  HTMLFormElement.prototype.submit = function () {
    handleFormSubmit(this);
  };

  document.addEventListener('submit', (e) => {
    const form = e.target;
    if (form && form.tagName === 'FORM') {
      e.preventDefault();
      handleFormSubmit(form);
    }
  });

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) return;
    e.preventDefault();
    navigateTo(href);
  });

  window.addEventListener('popstate', () => {
    navigateTo(window.location.pathname + window.location.search, false);
  });
}

/**
 * Bootstrap Application
 */
async function bootstrap() {
  setupGlobalInterceptors();
  await initSqlEngine();

  onAuthStateChanged(auth, async (user) => {
    currentAuthUser = user;
    if (user) {
      let uname = user.displayName;
      if (!uname && user.email) {
        uname = user.email.split('@')[0];
      }
      await pullStateFromFirestore(user.uid, uname || 'Player');
      ensureHighAutoIncrementOffsets(sqlDb, user.uid);
    }
    await navigateTo(window.location.pathname + window.location.search, false);
  });
}

bootstrap().catch((err) => {
  console.error('Darkgrid Bootstrap Error:', err);
});
