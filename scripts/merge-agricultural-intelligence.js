// Build-time merge layer for curated agricultural intelligence.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const today = new Date().toISOString().slice(0, 10);

// Normalize URLs for duplicate comparison only. Original source URLs remain
// unchanged in the published records.
function normalizeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    if ((url.protocol === 'https:' && url.port === '443') ||
        (url.protocol === 'http:' && url.port === '80')) url.port = '';
    while (url.pathname.length > 1 && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1);
    }
    return url.toString();
  } catch (_) {
    return raw.split('#')[0].replace(/\/+$/, '').toLowerCase();
  }
}

function normalizeTitle(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function merge(baseName, supplementNames, countryField, listField, bucketed) {
  const basePath = path.join(root, 'src', '_data', baseName);
  const base = JSON.parse(fs.readFileSync(basePath, 'utf8'));
  const countries = new Map(base.countries.map(country => [country.code, country]));
  let added = 0;
  let skippedDuplicates = 0;

  for (const supplementName of supplementNames) {
    const extraPath = path.join(root, 'src', '_data', supplementName);
    if (!fs.existsSync(extraPath)) {
      throw new Error('Agricultural intelligence source file is missing: ' + supplementName);
    }
    const extra = JSON.parse(fs.readFileSync(extraPath, 'utf8'));

    for (const record of extra.records || []) {
      const country = countries.get(record[countryField]);
      if (!country) continue;

      let existing;
      if (bucketed) {
        country.records = country.records || {};
        existing = Object.values(country.records).flatMap(items => Array.isArray(items) ? items : []);
      } else {
        country[listField] = country[listField] || [];
        existing = country[listField];
      }

      const candidateUrl = normalizeUrl(record.url);
      const candidateTitle = normalizeTitle(record.title || record.headline);
      // Skip only a same-country record with both the same normalized URL
      // and title. A shared regional/project page alone is not enough to
      // declare two differently titled records duplicates.
      const duplicate = candidateUrl && candidateTitle && existing.some(item =>
        normalizeUrl(item.url) === candidateUrl &&
        normalizeTitle(item.title || item.headline) === candidateTitle
      );
      if (duplicate) {
        skippedDuplicates++;
        continue;
      }

      if (bucketed) {
        const category = record.category || 'general';
        country.records[category] = country.records[category] || [];
        country.records[category].push(record);
      } else {
        country[listField].push(record);
      }
      added++;
    }
  }

  base.last_updated = today;
  fs.writeFileSync(basePath, JSON.stringify(base, null, 2) + '\n');
  console.log(baseName + ': added ' + added + ', skipped exact normalized duplicates ' + skippedDuplicates + '.');
  return added;
}

const resourceGapFiles = fs.readdirSync(path.join(root, 'src', '_data'))
  .filter(name => /^agriculturalResourcesGap(?:[A-Z]{2}|Batch)\.json$/.test(name))
  .sort();
const resources = merge(
  'agriculturalResources.json',
  ['agriculturalResourcesSupplement.json', ...resourceGapFiles],
  'country_code',
  'records',
  true
);
const news = merge(
  'agriculturalNews.json',
  ['agriculturalNewsSupplement.json', 'agriculturalNewsExpansion.json'],
  'country_code',
  'articles',
  false
);
console.log('Agricultural intelligence merge complete: ' + resources + ' resource records + ' + news + ' news records added.');
