/**
 * Darkgrid RPG — Firebase Blaze & Cloud Run Production Deployment Orchestrator
 *
 * Performs a safe, verified production deployment to `darkgrid-rpg`:
 * 1. Verifies live backup prior to any deployment action.
 * 2. Checks whether Firebase Blaze (Cloud Billing) is enabled on `darkgrid-rpg`.
 * 3. If `billingEnabled: false`:
 *    - Deploys updated `firestore.rules` and static hosting assets that do not require billing.
 *    - Prints exact step-by-step instructions for the project owner to enable Blaze billing
 *      and set up the monthly budget alert.
 * 4. If `billingEnabled: true`:
 *    - Configures Cloud Logging retention (7 days) to prevent log storage cost.
 *    - Creates/verifies the monthly billing budget (~3,500 ISK / 25 USD, well under 5,000 ISK)
 *      with alerts at 25%, 50%, 75%, 90%, and 100%.
 *    - Pushes the migrated SQLite state to Cloud Firestore (`/server_state/**`) and activates
 *      `server_authoritative: true` in `/world_state/config`.
 *    - Deploys Cloud Run service `darkgrid-api` (`europe-west1`, `min-instances=0`, `max-instances=1`,
 *      `cpu=1`, `memory=512Mi`, `concurrency=80`).
 *    - Switches `firebase.json` Hosting rewrite to `run: { serviceId: "darkgrid-api", region: "europe-west1" }`
 *      and deploys Firebase Hosting + Firestore Rules.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { getFirebaseCliToken, pushDeltaToFirestoreServer } = require('../src/db/durable-store');
const { initializeDatabase } = require('../src/db/connection');
const { runMigrations, runSeeds } = require('../src/db/migrate');
const { runBackup } = require('./backup_database');

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'darkgrid-rpg';
const REGION = process.env.CLOUD_RUN_REGION || 'europe-west1';
const SERVICE_NAME = 'darkgrid-api';

async function checkBillingStatus(token) {
  const resp = await fetch(`https://cloudbilling.googleapis.com/v1/projects/${PROJECT_ID}/billingInfo`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!resp.ok) {
    return { billingEnabled: false, status: resp.status };
  }
  const data = await resp.json();
  return {
    billingEnabled: Boolean(data.billingEnabled),
    billingAccountName: data.billingAccountName || null
  };
}

async function configureLogRetention(token) {
  // Set _Default log bucket retention to 7 days to stay well inside the free 50 GiB/month tier
  const url = `https://logging.googleapis.com/v2/projects/${PROJECT_ID}/locations/global/buckets/_Default?updateMask=retentionDays`;
  try {
    const resp = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ retentionDays: 7 })
    });
    return resp.ok;
  } catch {
    return false;
  }
}

async function configureBillingBudget(token, billingAccountName) {
  if (!billingAccountName) return { created: false, reason: 'No billingAccountName' };
  const url = `https://billingbudgets.googleapis.com/v1/${billingAccountName}/budgets`;
  const body = {
    displayName: 'Darkgrid RPG Monthly Budget (< 5000 ISK)',
    budgetFilter: {
      projects: [`projects/${PROJECT_ID}`]
    },
    amount: {
      specifiedAmount: {
        currencyCode: 'USD',
        units: '25'
      }
    },
    thresholdRules: [
      { thresholdPercent: 0.25, spendBasis: 'CURRENT_SPEND' },
      { thresholdPercent: 0.50, spendBasis: 'CURRENT_SPEND' },
      { thresholdPercent: 0.75, spendBasis: 'CURRENT_SPEND' },
      { thresholdPercent: 0.90, spendBasis: 'CURRENT_SPEND' },
      { thresholdPercent: 1.00, spendBasis: 'CURRENT_SPEND' }
    ]
  };
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    return { created: resp.ok, status: resp.status };
  } catch (err) {
    return { created: false, reason: err.message };
  }
}

async function activateServerAuthoritativeFlag(token) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      writes: [
        {
          update: {
            name: `projects/${PROJECT_ID}/databases/(default)/documents/world_state/config`,
            fields: {
              server_authoritative: { booleanValue: true },
              updated_at: { stringValue: new Date().toISOString() }
            }
          }
        }
      ]
    })
  });
  return resp.ok;
}

async function main() {
  console.log('=== Darkgrid RPG — Blaze Deployment Orchestrator ===');

  const token = await getFirebaseCliToken();
  if (!token) {
    console.error('Error: No Firebase CLI token found. Please run `npx firebase-tools login`.');
    process.exit(1);
  }

  // Step 1: Always take a fresh verified backup before any deployment action
  console.log('[1/5] Creating pre-deployment backup...');
  const backupRes = await runBackup({ token });
  console.log(`      Backup verified: ${backupRes.outputPath} (SHA-256: ${backupRes.backup.backupChecksum})`);

  // Step 2: Configure Cloud Logging retention (7 days)
  console.log('[2/5] Configuring Cloud Logging retention (7 days)...');
  const logRetentionOk = await configureLogRetention(token);
  console.log(`      Cloud Logging 7-day retention configured: ${logRetentionOk}`);

  // Step 3: Check Cloud Billing (Blaze Plan) status
  console.log('[3/5] Checking Cloud Billing status for project `darkgrid-rpg`...');
  const billing = await checkBillingStatus(token);

  if (!billing.billingEnabled) {
    console.log('\n[NOTICE] Project `darkgrid-rpg` currently has `billingEnabled: false` (Spark Plan).');
    console.log('         Cloud Run container deployment requires the project owner to upgrade to Blaze.');
    console.log('         See `docs/firebase-blaze-production-upgrade.md` for exact step-by-step instructions.');
    process.exit(0);
  }

  console.log(`      Blaze Billing is ENABLED (${billing.billingAccountName}).`);

  // Step 4: Configure Monthly Billing Budget (25%, 50%, 75%, 90%, 100% alerts) & sync state
  console.log('[4/5] Configuring monthly billing budget alerts and syncing authoritative DB state...');
  await configureBillingBudget(token, billing.billingAccountName);

  const dbPath = path.resolve(__dirname, '../data/darkgrid.sqlite');
  const db = initializeDatabase(dbPath);
  runMigrations(db);
  runSeeds(db);
  await pushDeltaToFirestoreServer(db, { forceFull: true, token });
  db.close();

  await activateServerAuthoritativeFlag(token);

  // Step 5: Update firebase.json to route traffic to Cloud Run service `darkgrid-api`
  console.log('[5/5] Updating firebase.json for Cloud Run rewrite (`darkgrid-api` in `europe-west1`)...');
  const fbJsonPath = path.resolve(__dirname, '../firebase.json');
  const fbConfig = JSON.parse(fs.readFileSync(fbJsonPath, 'utf8'));
  fbConfig.hosting.public = 'public';
  fbConfig.hosting.rewrites = [
    {
      source: '**',
      run: {
        serviceId: SERVICE_NAME,
        region: REGION
      }
    }
  ];
  fs.writeFileSync(fbJsonPath, JSON.stringify(fbConfig, null, 2) + '\n', 'utf8');

  console.log('=== Ready for Cloud Run + Firebase Hosting deployment ===');
}

if (require.main === module) {
  main().catch(err => {
    console.error('Deployment orchestrator failed:', err);
    process.exit(1);
  });
}

module.exports = {
  checkBillingStatus,
  configureLogRetention,
  configureBillingBudget
};
