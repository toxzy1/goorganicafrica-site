const fs = require('fs');
const path = require('path');
const translations = require('../src/_data/siteTranslations.json');
const required = ['en', 'fr', 'ar', 'pt', 'sw'];
const files = ['src/js/calculator-app.js', 'src/js/calculator-advice.js'];
const keys = new Set();
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/(?:\bT|\.t)\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']/g)) keys.add(`${match[1]}.${match[2]}`);
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
if (missing.length) throw new Error(`Missing localization keys:\n${missing.join('\n')}`);
console.log(`Localization completeness passed: ${required.length} languages, ${keys.size} referenced keys.`);
