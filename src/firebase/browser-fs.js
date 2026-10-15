/**
 * Browser polyfill for `fs` (used by src/domain/encounters/engine.js to check if monster art exists)
 */
const existingAssets = window.__DARKGRID_EXISTING_ASSETS__ || new Set();

module.exports = {
  existsSync(filePath) {
    if (!filePath || typeof filePath !== 'string') return false;
    const norm = filePath.replace(/\\/g, '/');
    const idx = norm.indexOf('/images/');
    if (idx !== -1) {
      const rel = norm.substring(idx);
      if (existingAssets.size > 0) {
        return existingAssets.has(rel);
      }
      return true;
    }
    return false;
  },
  readFileSync() {
    return '';
  },
  readdirSync() {
    return [];
  },
  mkdirSync() {}
};
