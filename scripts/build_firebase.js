/**
 * Builds the Darkgrid Firebase Hosting static asset distribution into `dist/`
 * for the Main DarkGrid Game (backed by Cloud Run `darkgrid-api` in `europe-west1`).
 *
 * Copies:
 *   1. `public/` and `images/` -> `dist/`
 *   2. Main game frontend assets (`action-ui-lab/public/css`, `js`, `images`, `monster-size-catalog.js`) -> `dist/lab-assets/`
 *   3. Removes any static `dist/index.html` so `/` and `/api/*` route cleanly to Cloud Run `darkgrid-api`.
 */

const { prepareStaticHostingAssets } = require('./deploy_blaze');

async function build() {
  console.log('--- Building Darkgrid Static Hosting Assets (dist/) for Main Game + Cloud Run ---');
  prepareStaticHostingAssets();
  console.log('--- Build Complete! Static assets staged in dist/ ---');
}

if (require.main === module) {
  build().catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
  });
}

module.exports = { build };
