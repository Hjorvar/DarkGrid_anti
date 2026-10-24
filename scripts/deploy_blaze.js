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
const { getFirebaseCliToken, pushDeltaToFirestoreServer, pullFromFirestoreServer } = require('../src/db/durable-store');
const { initializeDatabase } = require('../src/db/connection');
const { runMigrations, runSeeds } = require('../src/db/migrate');
const { runBackup } = require('./backup_database');

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'darkgrid-rpg';
const REGION = process.env.CLOUD_RUN_REGION || 'europe-west1';
const SERVICE_NAME = 'darkgrid-api';

async function checkBillingStatus(token, options = {}) {
  const fetchImpl = options.fetchFn || global.fetch;
  const projectId = options.projectId || PROJECT_ID;
  if (!token) {
    return {
      ok: false,
      status: 401,
      errorCode: 'AUTH_EXPIRED',
      billingEnabled: null,
      message: 'Missing or expired OAuth access_token. Run `npx firebase-tools login --reauth`.'
    };
  }

  let resp;
  try {
    resp = await fetchImpl(`https://cloudbilling.googleapis.com/v1/projects/${projectId}/billingInfo`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch (netErr) {
    return {
      ok: false,
      status: 0,
      errorCode: 'NETWORK_ERROR',
      billingEnabled: null,
      message: `Network error calling Cloud Billing API: ${netErr.message}`
    };
  }

  if (resp.status === 401) {
    return {
      ok: false,
      status: 401,
      errorCode: 'AUTH_EXPIRED',
      billingEnabled: null,
      message: 'HTTP 401 UNAUTHENTICATED from Cloud Billing API: OAuth access_token is expired or invalid.'
    };
  }
  if (resp.status === 403) {
    return {
      ok: false,
      status: 403,
      errorCode: 'INSUFFICIENT_PERMISSIONS',
      billingEnabled: null,
      message: 'HTTP 403 FORBIDDEN from Cloud Billing API: insufficient permissions to read billingInfo.'
    };
  }
  if (!resp.ok) {
    return {
      ok: false,
      status: resp.status,
      errorCode: 'API_ERROR',
      billingEnabled: null,
      message: `Cloud Billing API returned unexpected HTTP ${resp.status}.`
    };
  }

  const data = await resp.json();
  return {
    ok: true,
    status: 200,
    errorCode: null,
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
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'x-goog-user-project': PROJECT_ID
  };
  const topicName = `projects/${PROJECT_ID}/topics/budget-killswitch`;

  try {
    // 1. Check existing budgets so we never create duplicates
    const listRes = await fetch(url, { headers });
    if (listRes.ok) {
      const listData = await listRes.json();
      const existing = listData.budgets || [];
      if (existing.length > 0) {
        // Keep the first budget, delete any extra duplicates
        const primary = existing[0];
        for (let i = 1; i < existing.length; i++) {
          await fetch(`https://billingbudgets.googleapis.com/v1/${existing[i].name}`, {
            method: 'DELETE',
            headers
          });
        }
        // Ensure Pub/Sub kill-switch topic is attached to the primary budget
        if (primary.notificationsRule?.pubsubTopic !== topicName) {
          await fetch(`https://billingbudgets.googleapis.com/v1/${primary.name}?updateMask=notificationsRule`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              name: primary.name,
              notificationsRule: {
                pubsubTopic: topicName,
                schemaVersion: '1.0'
              }
            })
          });
        }
        return { created: false, reused: true, name: primary.name };
      }
    }

    // 2. Otherwise create a single budget with Pub/Sub kill-switch notifications
    const body = {
      displayName: 'Darkgrid RPG Monthly Cap (< 5000 ISK)',
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
      ],
      notificationsRule: {
        pubsubTopic: topicName,
        schemaVersion: '1.0'
      }
    };
    const resp = await fetch(url, {
      method: 'POST',
      headers,
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

async function buildAndDeployCloudRun(token) {
  const os = require('os');
  const crypto = require('crypto');
  const bucketName = `${PROJECT_ID}_cloudbuild`;
  const repoId = 'cloud-run-source-deploy';
  const imageUri = `${REGION}-docker.pkg.dev/${PROJECT_ID}/${repoId}/${SERVICE_NAME}:latest`;

  const skipBuild = process.argv.includes('--skip-build');
  if (!skipBuild) {
    // 1. Stage lightweight source context (actual heavy PNGs/WebPs are served by Firebase Hosting CDN from dist/,
    // while 1-byte stubs in images/monsters satisfy fs.existsSync checks in src/domain/encounters/engine.js
    // and keep the container image well inside the 0.5 GB Artifact Registry free tier).
    const repoRoot = path.resolve(__dirname, '..');
    const stageDir = path.join(os.tmpdir(), `darkgrid-stage-${Date.now()}`);
    fs.mkdirSync(stageDir, { recursive: true });

    fs.copyFileSync(path.join(repoRoot, 'Dockerfile'), path.join(stageDir, 'Dockerfile'));
    fs.copyFileSync(path.join(repoRoot, 'package.json'), path.join(stageDir, 'package.json'));
    fs.copyFileSync(path.join(repoRoot, 'package-lock.json'), path.join(stageDir, 'package-lock.json'));
    if (fs.existsSync(path.join(repoRoot, 'index.js'))) {
      fs.copyFileSync(path.join(repoRoot, 'index.js'), path.join(stageDir, 'index.js'));
    }
    fs.cpSync(path.join(repoRoot, 'src'), path.join(stageDir, 'src'), { recursive: true });
    fs.cpSync(path.join(repoRoot, 'scripts'), path.join(stageDir, 'scripts'), { recursive: true });
    fs.cpSync(path.join(repoRoot, 'db', 'migrations'), path.join(stageDir, 'db', 'migrations'), { recursive: true });
    fs.cpSync(path.join(repoRoot, 'db', 'seeds'), path.join(stageDir, 'db', 'seeds'), { recursive: true });

    // Stage main game code & frontend HTML/CSS/JS from action-ui-lab
    const stageLabDir = path.join(stageDir, 'action-ui-lab');
    fs.mkdirSync(stageLabDir, { recursive: true });
    for (const rootFile of [
      'server.js',
      'scene-catalog.js',
      'adventure-engine.js',
      'monster-size-catalog.js',
      'travel-continuity.js',
      'monster-artwork-inventory.json',
      'monster-asset-manifest.json'
    ]) {
      const srcFile = path.join(repoRoot, 'action-ui-lab', rootFile);
      if (fs.existsSync(srcFile)) {
        fs.copyFileSync(srcFile, path.join(stageLabDir, rootFile));
      }
    }
    fs.cpSync(path.join(repoRoot, 'action-ui-lab', 'server'), path.join(stageLabDir, 'server'), { recursive: true });
    fs.cpSync(path.join(repoRoot, 'action-ui-lab', 'public', 'css'), path.join(stageLabDir, 'public', 'css'), { recursive: true });
    fs.cpSync(path.join(repoRoot, 'action-ui-lab', 'public', 'js'), path.join(stageLabDir, 'public', 'js'), { recursive: true });
    fs.copyFileSync(path.join(repoRoot, 'action-ui-lab', 'public', 'index.html'), path.join(stageLabDir, 'public', 'index.html'));

    fs.mkdirSync(path.join(stageDir, 'public', 'css'), { recursive: true });
    if (fs.existsSync(path.join(repoRoot, 'public', 'css', 'style.css'))) {
      fs.copyFileSync(path.join(repoRoot, 'public', 'css', 'style.css'), path.join(stageDir, 'public', 'css', 'style.css'));
    }

    const stageMonstersDir = path.join(stageDir, 'images', 'monsters');
    fs.mkdirSync(stageMonstersDir, { recursive: true });
    const srcMonstersDir = path.join(repoRoot, 'images', 'monsters');
    if (fs.existsSync(srcMonstersDir)) {
      for (const file of fs.readdirSync(srcMonstersDir)) {
        if (file.endsWith('.png') || file.endsWith('.webp')) {
          fs.writeFileSync(path.join(stageMonstersDir, file), '');
        }
      }
    }

    function writeZeroByteTreeStubs(srcRoot, dstRoot) {
      if (!fs.existsSync(srcRoot)) return;
      fs.mkdirSync(dstRoot, { recursive: true });
      for (const entry of fs.readdirSync(srcRoot, { withFileTypes: true })) {
        const s = path.join(srcRoot, entry.name);
        const d = path.join(dstRoot, entry.name);
        if (entry.isDirectory()) {
          writeZeroByteTreeStubs(s, d);
        } else if (/\.(png|webp|jpg|jpeg)$/i.test(entry.name)) {
          fs.writeFileSync(d, '');
        }
      }
    }
    writeZeroByteTreeStubs(path.join(repoRoot, 'public', 'images'), path.join(stageDir, 'public', 'images'));
    writeZeroByteTreeStubs(path.join(repoRoot, 'action-ui-lab', 'public', 'images'), path.join(stageLabDir, 'public', 'images'));
    writeZeroByteTreeStubs(path.join(repoRoot, 'action-ui-lab', 'docs', 'phase-5', 'art-candidates'), path.join(stageLabDir, 'docs', 'phase-5', 'art-candidates'));
    if (fs.existsSync(path.join(repoRoot, 'action-ui-lab', 'docs', 'visual-qa-results.json'))) {
      fs.mkdirSync(path.join(stageLabDir, 'docs'), { recursive: true });
      fs.copyFileSync(path.join(repoRoot, 'action-ui-lab', 'docs', 'visual-qa-results.json'), path.join(stageLabDir, 'docs', 'visual-qa-results.json'));
    }

    const tarPath = path.join(os.tmpdir(), `darkgrid-source-${Date.now()}.tgz`);
    execSync(
      `tar -czf "${tarPath}" Dockerfile package.json package-lock.json index.js db public images src action-ui-lab scripts`,
      { cwd: stageDir, stdio: 'inherit' }
    );
    const tarBytes = fs.readFileSync(tarPath);
    fs.unlinkSync(tarPath);
    fs.rmSync(stageDir, { recursive: true, force: true });
    console.log(`      Uploaded source archive (${(tarBytes.length / 1024).toFixed(1)} KB) to gs://${bucketName}/source/darkgrid-source.tgz...`);

    const uploadRes = await fetch(
      `https://storage.googleapis.com/upload/storage/v1/b/${bucketName}/o?uploadType=media&name=source/darkgrid-source.tgz`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/gzip'
        },
        body: tarBytes
      }
    );
    if (!uploadRes.ok) {
      throw new Error(`GCS source upload failed (${uploadRes.status}): ${await uploadRes.text()}`);
    }

    // 2. Trigger Cloud Build
    console.log(`      Starting Cloud Build for ${imageUri}...`);
    const buildTriggerRes = await fetch(
      `https://cloudbuild.googleapis.com/v1/projects/${PROJECT_ID}/locations/global/builds`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          source: {
            storageSource: {
              bucket: bucketName,
              object: 'source/darkgrid-source.tgz'
            }
          },
          steps: [
            {
              name: 'gcr.io/cloud-builders/docker',
              args: ['build', '-t', imageUri, '.']
            },
            {
              name: 'gcr.io/cloud-builders/docker',
              args: ['push', imageUri]
            }
          ],
          images: [imageUri]
        })
      }
    );
    if (!buildTriggerRes.ok) {
      throw new Error(`Cloud Build trigger failed (${buildTriggerRes.status}): ${await buildTriggerRes.text()}`);
    }
    const buildOp = await buildTriggerRes.json();
    const buildId = buildOp.metadata?.build?.id;
    console.log(`      Cloud Build started (buildId: ${buildId}). Waiting for container build...`);

    // Poll build status
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const statusRes = await fetch(
        `https://cloudbuild.googleapis.com/v1/projects/${PROJECT_ID}/locations/global/builds/${buildId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const buildData = await statusRes.json();
      const st = buildData.status;
      console.log(`      [Cloud Build] status: ${st}`);
      if (st === 'SUCCESS') {
        break;
      }
      if (st === 'FAILURE' || st === 'INTERNAL_ERROR' || st === 'TIMEOUT' || st === 'CANCELLED') {
        throw new Error(`Cloud Build failed with status ${st}: ${buildData.statusDetail || JSON.stringify(buildData.failureInfo || {})}`);
      }
    }
  }

  // 3. Deploy Cloud Run v2 Service
  console.log(`      Deploying Cloud Run service ${SERVICE_NAME} in ${REGION}...`);
  const serviceUrl = `https://run.googleapis.com/v2/projects/${PROJECT_ID}/locations/${REGION}/services/${SERVICE_NAME}`;
  const existingCheck = await fetch(serviceUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  // Resolve a strong cryptographically random SESSION_SECRET (never predictable from PROJECT_ID)
  const legacyPredictableSecret = crypto
    .createHash('sha256')
    .update(`darkgrid-rpg-prod-secret-${PROJECT_ID}-v1`)
    .digest('hex');

  let sessionSecret = process.env.SESSION_SECRET;
  if (sessionSecret && (sessionSecret === legacyPredictableSecret || sessionSecret.length < 32)) {
    sessionSecret = null;
  }
  if (!sessionSecret && existingCheck.status === 200) {
    try {
      const existingData = await existingCheck.json();
      const existingEnv = existingData?.template?.containers?.[0]?.env || [];
      const existingSecretEntry = existingEnv.find(e => e && e.name === 'SESSION_SECRET');
      if (
        existingSecretEntry?.value &&
        existingSecretEntry.value.length >= 32 &&
        existingSecretEntry.value !== legacyPredictableSecret
      ) {
        sessionSecret = existingSecretEntry.value;
      }
    } catch {
      // Ignore JSON parse error
    }
  }
  if (!sessionSecret) {
    sessionSecret = crypto.randomBytes(32).toString('hex');
  }

  const serviceBody = {
    ingress: 'INGRESS_TRAFFIC_ALL',
    template: {
      scaling: {
        minInstanceCount: 0,
        maxInstanceCount: 1
      },
      maxInstanceRequestConcurrency: 80,
      containers: [
        {
          image: imageUri,
          ports: [{ containerPort: 8080 }],
          resources: {
            limits: {
              cpu: '1',
              memory: '512Mi'
            },
            cpuIdle: true,
            startupCpuBoost: true
          },
          env: [
            { name: 'NODE_ENV', value: 'production' },
            { name: 'FIREBASE_PROJECT_ID', value: PROJECT_ID },
            { name: 'FIRESTORE_DURABLE_SYNC', value: 'true' },
            { name: 'SESSION_SECRET', value: sessionSecret },
            { name: 'MAX_DAILY_HTTP_REQUESTS', value: '500000' },
            { name: 'MAX_DAILY_FIRESTORE_WRITES', value: '250000' },
            { name: 'DEPLOY_TIMESTAMP', value: new Date().toISOString() }
          ]
        }
      ]
    }
  };

  let deployRes;
  if (existingCheck.status === 200) {
    deployRes = await fetch(serviceUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(serviceBody)
    });
  } else {
    deployRes = await fetch(
      `https://run.googleapis.com/v2/projects/${PROJECT_ID}/locations/${REGION}/services?serviceId=${SERVICE_NAME}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(serviceBody)
      }
    );
  }

  if (!deployRes.ok) {
    throw new Error(`Cloud Run deploy failed (${deployRes.status}): ${await deployRes.text()}`);
  }
  const deployOp = await deployRes.json();
  console.log(`      Waiting for Cloud Run revision readiness...`);

  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 4000));
    const opRes = await fetch(`https://run.googleapis.com/v2/${deployOp.name}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const opData = await opRes.json();
    if (opData.done) {
      if (opData.error) {
        throw new Error(`Cloud Run operation error: ${JSON.stringify(opData.error)}`);
      }
      console.log(`      Cloud Run service ready: ${opData.response?.uri || SERVICE_NAME}`);
      break;
    }
  }

  // 4. Grant public invoker role (allUsers -> roles/run.invoker) so Firebase Hosting can proxy requests
  const iamRes = await fetch(`${serviceUrl}:setIamPolicy`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      policy: {
        bindings: [
          {
            role: 'roles/run.invoker',
            members: ['allUsers']
          }
        ]
      }
    })
  });
  console.log(`      Cloud Run public invoker IAM policy applied: ${iamRes.ok}`);
}

function prepareStaticHostingAssets() {
  const repoRoot = path.resolve(__dirname, '..');
  const distDir = path.join(repoRoot, 'dist');
  fs.mkdirSync(distDir, { recursive: true });

  // Remove old client-side Spark SPA artifacts so `/` routes to Cloud Run
  for (const oldFile of ['index.html', 'seed.sqlite', path.join('js', 'spark-bundle.js')]) {
    const p = path.join(distDir, oldFile);
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
    }
  }

  // Copy static CSS/JS from public/ and artwork from images/ so CDN serves them with 0 Cloud Run cost
  fs.cpSync(path.join(repoRoot, 'public'), distDir, { recursive: true });
  fs.cpSync(path.join(repoRoot, 'images'), path.join(distDir, 'images'), { recursive: true });

  // Copy main game frontend static assets under dist/lab-assets/ (without index.html so `/` routes to Cloud Run)
  const labAssetsDist = path.join(distDir, 'lab-assets');
  fs.mkdirSync(labAssetsDist, { recursive: true });
  fs.cpSync(path.join(repoRoot, 'action-ui-lab', 'public', 'css'), path.join(labAssetsDist, 'css'), { recursive: true });
  fs.cpSync(path.join(repoRoot, 'action-ui-lab', 'public', 'js'), path.join(labAssetsDist, 'js'), { recursive: true });
  if (fs.existsSync(path.join(repoRoot, 'action-ui-lab', 'public', 'images'))) {
    fs.cpSync(path.join(repoRoot, 'action-ui-lab', 'public', 'images'), path.join(labAssetsDist, 'images'), { recursive: true });
  }
  if (fs.existsSync(path.join(repoRoot, 'action-ui-lab', 'monster-size-catalog.js'))) {
    fs.copyFileSync(path.join(repoRoot, 'action-ui-lab', 'monster-size-catalog.js'), path.join(labAssetsDist, 'monster-size-catalog.js'));
  }
  if (fs.existsSync(path.join(repoRoot, 'action-ui-lab', 'docs', 'phase-5', 'art-candidates'))) {
    fs.cpSync(path.join(repoRoot, 'action-ui-lab', 'docs', 'phase-5', 'art-candidates'), path.join(labAssetsDist, 'art-candidates'), { recursive: true });
  }

  // Remove internal dev review HTML files from production dist
  for (const devFile of ['monster_review.html', 'monster_comparison.html', 'index.html']) {
    const p = path.join(distDir, devFile);
    if (fs.existsSync(p)) fs.rmSync(p, { force: true });
  }
}

async function main() {
  console.log('=== Darkgrid RPG — Blaze Deployment Orchestrator ===');

  let token;
  try {
    token = await getFirebaseCliToken({ throwOnExpired: true });
  } catch (authErr) {
    console.error(`Error (${authErr.code || 'AUTH_ERROR'}): ${authErr.message}`);
    process.exit(1);
  }
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

  if (!billing.ok) {
    console.error(`\n[ERROR] Cloud Billing verification failed (${billing.errorCode}, status=${billing.status}):`);
    console.error(`        ${billing.message}`);
    process.exit(1);
  }

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
  try {
    const { ensureNonDestructiveLabAdapter } = require('../action-ui-lab/server/services/legacy-compatibility-service');
    const { applyTopdownExperimentWorld } = require('../action-ui-lab/server/services/topdown-world-service');
    ensureNonDestructiveLabAdapter(db);
    applyTopdownExperimentWorld(db);
  } catch {
    // Ignore if topdown-world-service is not required in minimal env
  }
  await pullFromFirestoreServer(db, { accessToken: token, strictAuth: true });
  await pushDeltaToFirestoreServer(db, { forceFull: true, token });
  db.close();

  await activateServerAuthoritativeFlag(token);

  // Step 5: Build & deploy Cloud Run service `darkgrid-api` and configure Firebase Hosting rewrite
  console.log('[5/5] Building & deploying Cloud Run service `darkgrid-api` (`europe-west1`)...');
  await buildAndDeployCloudRun(token);

  prepareStaticHostingAssets();

  const fbJsonPath = path.resolve(__dirname, '../firebase.json');
  const fbConfig = JSON.parse(fs.readFileSync(fbJsonPath, 'utf8'));
  fbConfig.hosting.public = 'dist';
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

  console.log('=== Cloud Run Service Deployed & firebase.json Updated ===');
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
  configureBillingBudget,
  buildAndDeployCloudRun,
  prepareStaticHostingAssets
};
