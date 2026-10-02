// Bundle the dashboard into one self-contained HTML file (CSS and app JS inlined; libraries stay on cdnjs).
//   node cfo-dashboard/tools/build-single.mjs                -> cfo-dashboard/dist/cfo-lens.html
//   node cfo-dashboard/tools/build-single.mjs out.html --fragment
//        --fragment drops <!doctype>/<html>/<head>/<body> for hosts that supply their own page skeleton.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const fragment = args.includes('--fragment');
const out = resolve(args.find(a => !a.startsWith('--')) || `${root}/dist/cfo-lens.html`);

let html = readFileSync(`${root}/index.html`, 'utf8');
html = html.replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, (_, f) => `<style>\n${readFileSync(`${root}/${f}`, 'utf8')}\n</style>`);
html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (_, f) => `<script>\n${readFileSync(`${root}/${f}`, 'utf8').replace(/<\/script/gi, '<\\/script')}\n</script>`);
if (fragment) {
  html = html.replace(/<!doctype html>\s*/i, '').replace(/<html[^>]*>\s*/i, '').replace(/<\/html>\s*/i, '')
    .replace(/<head>\s*/i, '').replace(/<\/head>\s*/i, '').replace(/<body>\s*/i, '').replace(/<\/body>\s*/i, '')
    .replace(/<meta charset[^>]*>\s*/i, '').replace(/<meta name="viewport"[^>]*>\s*/i, '');
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
