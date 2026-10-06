// Loads the classic browser scripts into a Node VM context for testing.
const fs = require('fs'), path = require('path'), vm = require('vm');
const FILES = ['js/core/util.js', 'js/core/config.js', 'js/data/schema.js', 'js/core/store.js', 'js/data/ingest.js', 'js/data/demo.js',
  'js/engines/core.js', 'js/engines/matching.js', 'js/engines/finance.js', 'js/engines/supplier.js', 'js/engines/fraud.js', 'js/engines/controls.js', 'js/engines/insights.js'];
module.exports = function load(extra = []) {
  const ctx = vm.createContext({ console, setTimeout, clearTimeout, Intl, Date, Math, JSON, TextEncoder, Uint8Array, Uint32Array, Blob: global.Blob });
  for (const f of FILES.concat(extra)) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
  return ctx.SUMED;
};
