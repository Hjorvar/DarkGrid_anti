/**
 * Browser polyfill for `path`
 */
function normalize(p) {
  return String(p || '').replace(/\\/g, '/');
}

function join(...parts) {
  return parts
    .filter(Boolean)
    .map(p => normalize(p))
    .join('/')
    .replace(/\/+/g, '/');
}

function resolve(...parts) {
  return '/' + join(...parts).replace(/^\/+/, '');
}

function dirname(p) {
  const norm = normalize(p);
  const idx = norm.lastIndexOf('/');
  return idx === -1 ? '.' : norm.slice(0, idx) || '/';
}

function basename(p) {
  const norm = normalize(p);
  const idx = norm.lastIndexOf('/');
  return idx === -1 ? norm : norm.slice(idx + 1);
}

module.exports = {
  join,
  resolve,
  dirname,
  basename,
  normalize,
  sep: '/'
};
