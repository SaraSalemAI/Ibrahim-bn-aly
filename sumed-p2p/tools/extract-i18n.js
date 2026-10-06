// Extracts i18n keys: static t('key', 'English') calls in js/** plus dynamic keys from S.i18n.en.
// Usage: node tools/extract-i18n.js [--missing]   (with --missing: list keys that have no Arabic translation)
const fs = require('fs'), path = require('path');
const load = require('../tests/load.js');
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js') && !/i18n(-ar)?\.js$/.test(p)) files.push(p); } })(path.join(__dirname, '..', 'js'));
const keys = new Map();
const re = /\bt\(\s*'([a-zA-Z0-9_.\-]+)'\s*,\s*'((?:[^'\\]|\\.)*)'/g;
for (const f of files) { const s = fs.readFileSync(f, 'utf8'); let m; while ((m = re.exec(s))) if (!/^[A-Z]{2}-\d{2}$/.test(m[1]) && !keys.has(m[1])) keys.set(m[1], m[2].replace(/\\'/g, "'")); }
const S = load(['js/core/i18n.js', 'js/core/i18n-ar.js']);
for (const [k, v] of Object.entries(S.i18n.en)) if (!keys.has(k)) keys.set(k, v);
module.exports = { keys, S };
if (require.main === module) {
  const miss = [...keys.entries()].filter(([k]) => S.i18n.ar[k] == null);
  if (process.argv.includes('--missing')) { console.log(JSON.stringify(Object.fromEntries(miss), null, 1)); console.error(`${miss.length} missing of ${keys.size}`); }
  else console.log(`${keys.size} keys, ${miss.length} without Arabic`);
}
