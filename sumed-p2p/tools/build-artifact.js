#!/usr/bin/env node
/* Builds dist/sumed-artifact.html: one page with inlined CSS and app scripts (vendor parsers stay as separate files).
 * The page auto-starts Demo Mode and marks itself as a shared web view. Usage: node tools/build-artifact.js */
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const css = fs.readFileSync(path.join(root, 'css/app.css'), 'utf8');
const js = scripts.map((s) => `/* ${s} */\n` + fs.readFileSync(path.join(root, s), 'utf8').replace(/<\/script/gi, '<\\/script')).join('\n');
const out = `<title>SUMED Supplier Payments</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
${css}
</style>
<div id="app"><noscript>This application requires JavaScript.</noscript></div>
<script>window.SUMED_AUTODEMO = true; window.SUMED_ARTIFACT = true;</script>
<script>
${js}
</script>
`;
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/sumed-artifact.html'), out);
console.log('dist/sumed-artifact.html', (out.length / 1024).toFixed(0) + ' KB');
