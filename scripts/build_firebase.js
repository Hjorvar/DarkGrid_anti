/**
 * Builds the Darkgrid Firebase Spark Plan distribution into `dist/`
 * 1. Copies static assets (`public/` and `images/`)
 * 2. Generates pre-seeded SQLite world database (`dist/seed.sqlite`)
 * 3. Pre-compiles EJS templates (`src/views/*.ejs`) for browser rendering
 * 4. Bundles `src/firebase/spark-client.js` and `src/domain/*` using esbuild
 * 5. Generates `dist/index.html` SPA shell
 */

const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const esbuild = require('esbuild');
const { DatabaseSync } = require('node:sqlite');
const { runMigrations, runSeeds } = require('../src/db/migrate');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function build() {
  console.log('--- Building Darkgrid for Firebase Spark Plan (dist/) ---');
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
  fs.mkdirSync(path.join(DIST, 'js'), { recursive: true });

  // 1. Copy public/ and images/ into dist/
  copyDirRecursive(path.join(ROOT, 'public'), DIST);
  copyDirRecursive(path.join(ROOT, 'images'), path.join(DIST, 'images'));

  // Remove internal dev review HTML files from production dist
  for (const devFile of ['monster_review.html', 'monster_comparison.html']) {
    const p = path.join(DIST, devFile);
    if (fs.existsSync(p)) fs.rmSync(p);
  }

  // 2. Copy sql.js WebAssembly runtime files
  const sqlJsDist = path.join(ROOT, 'node_modules/sql.js/dist');
  fs.copyFileSync(path.join(sqlJsDist, 'sql-wasm.js'), path.join(DIST, 'js/sql-wasm.js'));
  fs.copyFileSync(path.join(sqlJsDist, 'sql-wasm.wasm'), path.join(DIST, 'js/sql-wasm.wasm'));

  // 3. Generate pre-seeded SQLite binary (world map, 98 monsters, items, loot tables, terrain artworks)
  const memDb = new DatabaseSync(':memory:');
  runMigrations(memDb);
  runSeeds(memDb);
  const sqliteBytes = memDb.serialize();
  fs.writeFileSync(path.join(DIST, 'seed.sqlite'), sqliteBytes);
  memDb.close();
  console.log(`Generated dist/seed.sqlite (${sqliteBytes.byteLength} bytes)`);

  // 4. Compile EJS views into standalone JS functions (inlining partials/header and partials/footer)
  const viewsDir = path.join(ROOT, 'src/views');
  const headerSrc = fs.readFileSync(path.join(viewsDir, 'partials/header.ejs'), 'utf8');
  const footerSrc = fs.readFileSync(path.join(viewsDir, 'partials/footer.ejs'), 'utf8');

  const viewNames = ['login', 'register', 'create-character', 'game', 'fallen', 'victory', 'error'];
  let compiledModuleCode = '// Auto-generated compiled EJS templates\n';
  compiledModuleCode += 'function escapeFn(markup) {\n';
  compiledModuleCode += '  if (markup == null) return "";\n';
  compiledModuleCode += '  return String(markup).replace(/[&<>\\\'"]/g, function(c) {\n';
  compiledModuleCode += '    return {"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","\\\'":"&#39;"}[c];\n';
  compiledModuleCode += '  });\n';
  compiledModuleCode += '}\n';
  compiledModuleCode += 'module.exports = {\n';

  for (const name of viewNames) {
    let raw = fs.readFileSync(path.join(viewsDir, `${name}.ejs`), 'utf8');
    raw = raw
      .replace(/<%-\s*include\(['"]partials\/header['"]\)\s*%>/g, headerSrc)
      .replace(/<%-\s*include\(['"]partials\/footer['"]\)\s*%>/g, footerSrc);

    const templ = new ejs.Template(raw, {
      client: true,
      strict: false,
      _with: true,
      localsName: 'locals',
      compileDebug: false
    });
    templ.compile();

    compiledModuleCode += `  ${JSON.stringify(name)}: function(locals) {\n${templ.source}\n  },\n`;
  }
  compiledModuleCode += '};\n';

  const compiledTemplatesPath = path.join(ROOT, 'src/firebase/compiled-templates.js');
  fs.writeFileSync(compiledTemplatesPath, compiledModuleCode, 'utf8');
  console.log('Compiled EJS templates to src/firebase/compiled-templates.js');

  // 5. Bundle spark-client.js with esbuild, aliasing Node built-ins and connection.js
  const browserConnectionPath = path.join(ROOT, 'src/firebase/browser-connection.js');
  await esbuild.build({
    entryPoints: [path.join(ROOT, 'src/firebase/spark-client.js')],
    bundle: true,
    outfile: path.join(DIST, 'js/spark-bundle.js'),
    platform: 'browser',
    target: ['es2020'],
    minify: true,
    define: {
      '__dirname': '"/"',
      '__filename': '"/index.js"',
      'process.env.SESSION_SECRET': '"firebase-spark-managed-auth"'
    },
    banner: {
      js: 'window.process = window.process || { env: { NODE_ENV: "production", SESSION_SECRET: "firebase-spark-managed-auth" }, argv: [], execArgv: [] }; window.__dirname = "/"; window.__filename = "/index.js";'
    },
    alias: {
      'fs': path.join(ROOT, 'src/firebase/browser-fs.js'),
      'path': path.join(ROOT, 'src/firebase/browser-path.js'),
      'node:sqlite': browserConnectionPath
    },
    plugins: [
      {
        name: 'redirect-db-connection',
        setup(b) {
          b.onResolve({ filter: /db\/connection$/ }, () => ({
            path: browserConnectionPath
          }));
        }
      }
    ]
  });
  console.log('Bundled dist/js/spark-bundle.js');

  // 6. Generate dist/index.html SPA shell
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DARKGRID — Dark Fantasy RPG</title>
  <link rel="stylesheet" href="/css/style.css?v=${Date.now()}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700;800;900&family=Cinzel+Decorative:wght@700&display=swap" rel="stylesheet">
  <script src="/js/sql-wasm.js"></script>
  <script defer src="/js/spark-bundle.js?v=${Date.now()}"></script>
</head>
<body>
  <header class="site-header">
    <div class="header-container">
      <a href="/" class="logo-link">
        <span class="logo-emblem">⚔️</span>
        <div class="logo-text-group">
          <span class="logo-text">DARKGRID</span>
          <span class="tagline">Shared World RPG</span>
        </div>
      </a>
    </div>
  </header>
  <main class="main-content" style="display:flex;align-items:center;justify-content:center;min-height:60vh;">
    <div style="text-align:center;color:var(--accent-gold);font-family:'Cinzel',serif;">
      <div style="font-size:2rem;margin-bottom:0.5rem;">⚔️</div>
      <div>Entering the realm of Darkgrid...</div>
    </div>
  </main>
</body>
</html>`;

  fs.writeFileSync(path.join(DIST, 'index.html'), indexHtml, 'utf8');
  console.log('Generated dist/index.html');
  console.log('--- Build Complete! ---');
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
