// Build-time merge layer for curated agricultural intelligence.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const today = new Date().toISOString().slice(0, 10);

function merge(baseName, supplementName, countryField, listField, bucketed) {
  const basePath = path.join(root, 'src', '_data', baseName);
  const extraPath = path.join(root, 'src', '_data', supplementName);
  const base = JSON.parse(fs.readFileSync(basePath, 'utf8'));
  const extra = JSON.parse(fs.readFileSync(extraPath, 'utf8'));
  const countries = new Map(base.countries.map(c => [c.code, c]));
  for (const record of extra.records || []) {
    const country = countries.get(record[countryField]);
    if (!country) continue;
    if (bucketed) {
      country.records = country.records || {};
      const bucket = record.category || 'general';
      country.records[bucket] = country.records[bucket] || [];
      if (!country.records[bucket].some(r => r.url === record.url || r.title === record.title)) country.records[bucket].push(record);
    } else {
      country[listField] = country[listField] || [];
      // Supplemental news sources may use "headline" while the templates
      // consume "title". Normalize at merge time so no rendered card is blank.
      const normalized = { ...record, title: record.title || record.headline || "" };
      delete normalized.headline;
      if (!country[listField].some(r => r.url === normalized.url || r.title === normalized.title)) country[listField].push(normalized);
    }
  }
  base.last_updated = today;
  fs.writeFileSync(basePath, JSON.stringify(base, null, 2) + '\n');
  return extra.records ? extra.records.length : 0;
}

const resources = merge('agriculturalResources.json', 'agriculturalResourcesSupplement.json', 'country_code', 'records', true);
const news = merge('agriculturalNews.json', 'agriculturalNewsSupplement.json', 'country_code', 'articles', false);
console.log(`Agricultural intelligence merge: ${resources} resource records + ${news} news records.`);
