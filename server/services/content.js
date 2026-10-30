const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const uploadsRoot = path.join(__dirname, '..', '..', 'data', 'uploads');

function ensureUploadsDir() {
  if (!fs.existsSync(uploadsRoot)) {
    fs.mkdirSync(uploadsRoot, { recursive: true });
  }
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[а-яё]/gi, (ch) => {
      const map = {
        а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
        и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
        с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
        ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
      };
      return map[ch] || ch;
    })
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `item-${Date.now()}`;
}

function uniqueSlug(base, existsFn) {
  let slug = slugify(base);
  let n = 1;
  while (existsFn(slug)) {
    n += 1;
    slug = `${slugify(base)}-${n}`;
  }
  return slug;
}

function randomToken(bytes = 16) {
  return crypto.randomBytes(bytes).toString('hex');
}

function absolutePath(storageKey) {
  const key = path.posix.basename(String(storageKey || '').replace(/\\/g, '/'));
  if (!key || key === '.' || key === '..') {
    const err = new Error('Некорректное имя файла');
    err.status = 400;
    throw err;
  }
  const root = path.resolve(uploadsRoot);
  const abs = path.resolve(root, key);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    const err = new Error('Некорректное имя файла');
    err.status = 400;
    throw err;
  }
  return abs;
}

function parseJson(raw, fallback = {}) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

const BLOCK_TYPES = [
  'section',
  'heading',
  'markdown',
  'html',
  'video',
  'file',
  'presentation',
  'image',
  'code',
  'callout',
  'embed',
  'divider',
  'quiz',
  'checklist',
  'grade_info',
  'download',
];

module.exports = {
  uploadsRoot,
  ensureUploadsDir,
  slugify,
  uniqueSlug,
  randomToken,
  absolutePath,
  parseJson,
  BLOCK_TYPES,
};
