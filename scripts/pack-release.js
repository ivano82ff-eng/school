/**
 * Pack a portable release folder after local build.
 * Usage: node scripts/pack-release.js
 * Output: release/it-scool/
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'release', 'it-scool');

function rm(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function copyDir(src, dest, filter) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    if (filter && !filter(name, src)) continue;
    const from = path.join(src, name);
    const to = path.join(dest, name);
    const st = fs.statSync(from);
    if (st.isDirectory()) copyDir(from, to, filter);
    else fs.copyFileSync(from, to);
  }
}

const dist = path.join(root, 'client', 'dist');
if (!fs.existsSync(dist)) {
  console.error('Нет client/dist. Сначала: npm run build  (или npm run setup)');
  process.exit(1);
}

rm(out);
fs.mkdirSync(out, { recursive: true });

copyDir(path.join(root, 'server'), path.join(out, 'server'), (name) => name !== 'node_modules');
copyDir(dist, path.join(out, 'client', 'dist'));

const dataSrc = path.join(root, 'data');
if (fs.existsSync(dataSrc)) {
  copyDir(dataSrc, path.join(out, 'data'), (name) => !name.endsWith('-wal') && !name.endsWith('-shm'));
} else {
  fs.mkdirSync(path.join(out, 'data'), { recursive: true });
}

for (const f of ['package.json', 'package-lock.json', 'README.md', 'DEPLOY.md']) {
  const p = path.join(root, f);
  if (fs.existsSync(p)) fs.copyFileSync(p, path.join(out, f));
}

fs.writeFileSync(
  path.join(out, 'START.txt'),
  [
    'IT-Scool — портативный релиз',
    '',
    '1) Нужен Node.js 22.5+',
    '2) npm install --omit=dev',
    '3) JWT_SECRET=... PORT=3000 npm start',
    '4) Открыть http://SERVER:3000',
    '',
    'Подробнее: DEPLOY.md',
    '',
  ].join('\n'),
  'utf8'
);

console.log('Готово:', out);
console.log('Скопируйте эту папку на хост с Node 22.5+, затем:');
console.log('  cd it-scool');
console.log('  npm install --omit=dev');
console.log('  npm start');
