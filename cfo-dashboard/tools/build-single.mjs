// Bundle the dashboard into one self-contained HTML file: CSS, app JS and the pinned libraries are inlined,
// so the file works offline and inside sandboxed viewers that cannot reach a CDN.
//   npm install --prefix cfo-dashboard                        (once: fetches the pinned libraries)
//   node cfo-dashboard/tools/build-single.mjs                 -> cfo-dashboard/dist/cfo-lens.html
//   node cfo-dashboard/tools/build-single.mjs out.html --fragment
//        --fragment drops <!doctype>/<html>/<head>/<body> for hosts that supply their own page skeleton.
//   --cdn keeps the libraries on cdnjs instead of inlining them.
//   --libs <dir> reads the libraries from another node_modules folder.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = f => args.includes(f);
const opt = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--libs');
const out = resolve(positional[0] || `${root}/dist/cfo-lens.html`);
const libs = resolve(opt('--libs') || `${root}/node_modules`);

// cdnjs file name -> file inside node_modules (same pinned versions as index.html / package.json)
const LIBS = {
  'xlsx.full.min.js': 'xlsx/dist/xlsx.full.min.js',
  'papaparse.min.js': 'papaparse/papaparse.min.js',
  'pdf.min.js': 'pdfjs-dist/build/pdf.min.js',
  'pdf.worker.min.js': 'pdfjs-dist/build/pdf.worker.min.js',
  'chart.umd.min.js': 'chart.js/dist/chart.umd.js',
};
const inlineScript = code => `<script>\n${code.replace(/<\/script/gi, '<\\/script')}\n</script>`;

let html = readFileSync(`${root}/index.html`, 'utf8');
if (!flag('--cdn')) {
  html = html.replace(/<script src="https:\/\/cdnjs\.cloudflare\.com\/[^"]+"><\/script>/g, tag => {
    const name = basename(tag.match(/src="([^"]+)"/)[1]);
    const file = `${libs}/${LIBS[name]}`;
    if (!LIBS[name] || !existsSync(file)) throw new Error(`Missing ${name}: run "npm install --prefix cfo-dashboard" or pass --cdn`);
    return inlineScript(readFileSync(file, 'utf8'));
  });
}
html = html.replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, (_, f) => `<style>\n${readFileSync(`${root}/${f}`, 'utf8')}\n</style>`);
html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (_, f) => inlineScript(readFileSync(`${root}/${f}`, 'utf8')));
if (flag('--fragment')) {
  html = html.replace(/<!doctype html>\s*/i, '').replace(/<html[^>]*>\s*/i, '').replace(/<\/html>\s*$/i, '')
    .replace(/<head>\s*/i, '').replace(/<\/head>\s*/i, '').replace(/<body>\s*/i, '').replace(/<\/body>\s*$/i, '')
    .replace(/<meta charset[^>]*>\s*/i, '').replace(/<meta name="viewport"[^>]*>\s*/i, '');
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`wrote ${out} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);
