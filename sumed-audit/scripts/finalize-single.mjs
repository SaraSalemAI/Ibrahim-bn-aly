import fs from 'fs';
fs.mkdirSync('release', { recursive: true });
fs.copyFileSync('release-tmp/index.html', 'release/SUMED-Audit-Platform.html');
fs.rmSync('release-tmp', { recursive: true, force: true });
const kb = Math.round(fs.statSync('release/SUMED-Audit-Platform.html').size / 1024);
console.log(`release/SUMED-Audit-Platform.html (${kb} KB)`);
