// Build-time merge layer for curated agricultural intelligence.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const today = new Date().toISOString().slice(0, 10);

function normalizeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    parsed.hash = '';
    parsed.hostname = parsed.hostname.toLowerCase();
    if ((parsed.protocol === 'https:' && parsed.port === '443') ||
        (parsed.protocol === 'http:' && parsed.port === '80')) parsed.port = '';
    while (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    const serialized = parsed.toString();
    return parsed.pathname === '/'
      ? serialized
      : (serialized.endsWith('/') ? serialized.slice(0, -1) : serialized);
  } catch (_) {
    const hashIndex = raw.indexOf('#');
    let cleaned = hashIndex >= 0 ? raw.slice(0, hashIndex) : raw;
    while (cleaned.endsWith('/')) cleaned = cleaned.slice(0, -1);
    return cleaned.toLowerCase();
  }
}
function merge(baseName, supplementName, countryField, listField, bucketed) {
  const basePath = path.join(root, 'src', '_data', baseName);
  const extraPath = path.join(root, 'src', '_data', supplementName);
  const base = JSON.parse(fs.readFileSync(basePath, 'utf8'));
  const extra = JSON.parse(fs.readFileSync(extraPath, 'utf8'));
  const countries = new Map(base.countries.map(c => [c.code, c]));
  let added = 0;
  let skippedDuplicates = 0;

  for (const record of extra.records || []) {
    const country = countries.get(record[countryField]);
    if (!country) continue;

    // Compare across categories, but only skip when both the normalized URL and
    // normalized title match. Different records can legitimately share a programme
    // or overview page; the report-only audit flags those for editorial review.
    let existing;
    if (bucketed) {
      country.records = country.records || {};
      existing = Object.values(country.records).flatMap(items => Array.isArray(items) ? items : []);
    } else {
      country[listField] = country[listField] || [];
      existing = country[listField];
    }

    const candidateUrl = normalizeUrl(record.url);
    const normalizeTitle = value => String(value || '').trim().toLowerCase().replace(/\\s+/g, ' ');
    const candidateTitle = normalizeTitle(record.title || record.headline);
    const isDuplicate = candidateUrl && candidateTitle && existing.some(item =>
      normalizeUrl(item.url) === candidateUrl &&
      normalizeTitle(item.title || item.headline) === candidateTitle
    );
    if (isDuplicate) {
      skippedDuplicates++;
      continue;
    }

    if (bucketed) {
      const bucket = record.category || 'general';
      country.records[bucket] = country.records[bucket] || [];
      country.records[bucket].push(record);
    } else {
      country[listField].push(record);
    }
    added++;
  }

  base.last_updated = today;
  fs.writeFileSync(basePath, JSON.stringify(base, null, 2) + '\n');
  console.log(`${baseName}: added ${added}, skipped same-title/same-URL duplicates ${skippedDuplicates}.`);
  return added;
}

const resources = merge('agriculturalResources.json', 'agriculturalResourcesSupplement.json', 'country_code', 'records', true);
const news = merge('agriculturalNews.json', 'agriculturalNewsSupplement.json', 'country_code', 'articles', false);
console.log(`Agricultural intelligence merge complete: ${resources} resource records + ${news} news records added.`);
