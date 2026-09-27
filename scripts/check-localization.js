const fs = require('fs');
const path = require('path');
const translations = require('../src/_data/siteTranslations.json');
const required = ['en', 'fr', 'ar', 'pt', 'sw'];
const files = ['src/js/calculator-app.js', 'src/js/calculator-advice.js'];
const keys = new Set();

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/(?:\bT|\.t)\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']/g)) {
    keys.add(`${match[1]}.${match[2]}`);
  }
}

for (const file of ['src/index.njk', 'src/_includes/partials/header.njk', 'src/_includes/partials/footer.njk', 'src/_includes/partials/language-switcher.njk']) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/data-i18n(?:-[\w-]+)?=["']([^"']+)["']/g)) keys.add(match[1]);
}

const missing = [];
for (const code of required) {
  if (!translations[code]) missing.push(`${code}: language dataset missing`);
  for (const key of keys) {
    const value = key.split('.').reduce((object, part) => object && object[part], translations[code]?.translations);
    if (typeof value !== 'string' || !value.trim()) missing.push(`${code}: ${key}`);
  }
}

if (translations.ar.dir !== 'rtl') missing.push('ar: expected rtl direction');

const contentRoots = [path.join(__dirname, '..', 'src', 'blog', 'posts'), path.join(__dirname, '..', 'src', 'ebooks')];
const badMarkers = [/GOA_TOKEN/i, /GoA TOKEN/i, /GA TOKEN/i, /BAR BAR/i, /\\\\pos\(/i, /\\\\fnAdobe Arabic/i];
for (const root of contentRoots) {
  if (!fs.existsSync(root)) continue;
  for (const file of fs.readdirSync(root)) {
    if (!/\\.md$/i.test(file) || !/-((fr)|(ar)|(pt)|(sw))\\.md$/i.test(file)) continue;
    const full = path.join(root, file);
    const source = fs.readFileSync(full, 'utf8');
    for (const marker of badMarkers) {
      if (marker.test(source)) missing.push(`content artifact in ${path.relative(path.join(__dirname, '..'), full)}: ${marker}`);
    }
  }
}

if (missing.length) throw new Error(`Localization checks failed:\n${missing.join('\n')}`);
console.log(`Localization checks passed: ${required.length} UI languages; translated blog/eBook files contain no known placeholder artifacts.`);
