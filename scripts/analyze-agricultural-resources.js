#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "src", "_data");
const OUT_DIR = path.join(ROOT, "reports");
const PRIMARY_FILE = path.join(DATA_DIR, "agriculturalResources.json");
const SUPPLEMENT_FILE = path.join(DATA_DIR, "agriculturalResourcesSupplement.json");

const ISO_COUNTRIES = [
  "DZ","AO","BJ","BW","BF","BI","CV","CM","CF","TD","KM","CG","CD","CI","DJ",
  "EG","GQ","ER","SZ","ET","GA","GM","GH","GN","GW","KE","LS","LR","LY","MG",
  "MW","ML","MR","MU","MA","MZ","NA","NE","NG","RW","ST","SN","SC","SL","SO",
  "ZA","SS","SD","TZ","TG","TN","UG","ZM","ZW"
];

const TAXONOMY = new Set([
  "finance","grants","machinery","general","inputs","markets","insurance",
  "farmer-support","research","climate","data","livestock","fisheries"
]);

const today = new Date();
const daysBetween = (a, b) => Math.floor((b - a) / 86400000);
const norm = (v) => String(v ?? "").trim().toLowerCase();
const safeArray = (v) => Array.isArray(v) ? v : [];

function readRecords(file) {
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  return Array.isArray(raw.records) ? raw.records : Object.values(raw.countries || {}).flatMap(country =>
    Object.values(country || {}).flatMap(items => Array.isArray(items) ? items : [])
  );
}

const primary = readRecords(PRIMARY_FILE).map(r => ({...r, _dataset: "primary"}));
const supplement = readRecords(SUPPLEMENT_FILE).map(r => ({...r, _dataset: "supplement"}));
const records = [...primary, ...supplement];

const countryCounts = Object.fromEntries(ISO_COUNTRIES.map(c => [c, 0]));
const countryCategories = Object.fromEntries(ISO_COUNTRIES.map(c => [c, new Set()]));
const sourceCounts = new Map();
const tierCounts = new Map();
const categoryCounts = new Map();
const duplicateUrls = new Map();
const duplicateTitles = new Map();
const missing = {
  country_code: [], category: [], title: [], description: [], source: [], url: [], verified: []
};
const stale = [];
const invalidCategories = [];
const missingCountryCodes = [];
const sharedResources = [];

function add(map, key, value = 1) {
  map.set(key, (map.get(key) || 0) + value);
}

records.forEach((r, index) => {
  const cc = String(r.country_code || "").toUpperCase();
  const cat = norm(r.category);
  const url = norm(r.url);
  const title = norm(r.title);
  if (countryCounts[cc] !== undefined) {
    countryCounts[cc]++;
    if (cat) countryCategories[cc].add(cat);
  } else {
    missingCountryCodes.push({index, dataset: r._dataset, country_code: r.country_code || null, title: r.title || null});
  }

  if (!cat || !TAXONOMY.has(cat)) invalidCategories.push({index, dataset: r._dataset, category: r.category || null, title: r.title || null});
  if (url) add(duplicateUrls, url);
  if (title) add(duplicateTitles, title);
  if (r.source) add(sourceCounts, String(r.source).trim());
  if (r.source_tier !== undefined && r.source_tier !== null && r.source_tier !== "") add(tierCounts, String(r.source_tier));
  if (cat) add(categoryCounts, cat);

  for (const field of Object.keys(missing)) {
    if (r[field] === undefined || r[field] === null || String(r[field]).trim() === "") {
      missing[field].push({index, dataset: r._dataset, title: r.title || null, country_code: cc || null});
    }
  }

  const verified = r.verified || r.last_checked;
  if (verified) {
    const d = new Date(verified);
    if (!Number.isNaN(d.getTime()) && daysBetween(d, today) > 180) {
      stale.push({index, dataset: r._dataset, title: r.title || null, country_code: cc || null, verified, age_days: daysBetween(d, today)});
    }
  }

  if (url) {
    // Shared resources are legitimate when the same official page serves multiple countries.
    // We report them instead of treating them as duplicates.
  }
});

const sharedByUrl = new Map();
records.forEach((r, index) => {
  const url = norm(r.url);
  if (!url) return;
  if (!sharedByUrl.has(url)) sharedByUrl.set(url, []);
  sharedByUrl.get(url).push({
    index,
    dataset: r._dataset,
    country_code: String(r.country_code || "").toUpperCase(),
    title: r.title || null
  });
});
for (const [url, items] of sharedByUrl) {
  const countries = [...new Set(items.map(x => x.country_code).filter(Boolean))];
  if (countries.length > 1) sharedResources.push({url, countries, records: items});
}

const duplicateUrlGroups = [...duplicateUrls.entries()]
  .filter(([, count]) => count > 1)
  .map(([url, count]) => ({
    url,
    count,
    records: (sharedByUrl.get(url) || [])
  }));

const titleGroups = new Map();
records.forEach((r, index) => {
  const key = norm(r.title);
  if (!key) return;
  if (!titleGroups.has(key)) titleGroups.set(key, []);
  titleGroups.get(key).push({
    index, dataset: r._dataset,
    country_code: String(r.country_code || "").toUpperCase(),
    title: r.title || null,
    url: r.url || null
  });
});
const duplicateTitleGroups = [...titleGroups.entries()]
  .filter(([, items]) => items.length > 1)
  .map(([, items]) => ({title: items[0].title, count: items.length, records: items}));

function countryLevel(cc) {
  const count = countryCounts[cc] || 0;
  const cats = countryCategories[cc]?.size || 0;
  const countryRecords = records.filter(r => String(r.country_code || "").toUpperCase() === cc);
  const tiers = new Set(countryRecords.map(r => String(r.source_tier || "")).filter(Boolean));
  const sources = new Set(countryRecords.map(r => norm(r.source)).filter(Boolean));
  const verifiedCount = countryRecords.filter(r => r.verified || r.last_checked).length;
  const freshness = count ? verifiedCount / count : 0;

  let score = 0;
  score += Math.min(cats / 8, 1) * 35;
  score += Math.min(sources.size / 5, 1) * 25;
  score += Math.min(tiers.size / 3, 1) * 15;
  score += freshness * 25;

  if (count === 0) return "Foundation";
  if (score < 45) return "Foundation";
  if (score < 65) return "Developing";
  if (score < 82) return "Strong";
  return "Mature";
}

const countryCoverage = ISO_COUNTRIES.map(country_code => ({
  country_code,
  records: countryCounts[country_code],
  categories: [...(countryCategories[country_code] || [])].sort(),
  coverage_level: countryLevel(country_code)
}));

const lowCoverageCountries = [...countryCoverage]
  .sort((a,b) => a.records - b.records || a.categories.length - b.categories.length)
  .slice(0, 15);

const report = {
  generated_at: new Date().toISOString(),
  datasets: {primary: primary.length, supplement: supplement.length, combined: records.length},
  countries: {
    expected: ISO_COUNTRIES.length,
    covered: ISO_COUNTRIES.filter(c => countryCounts[c] > 0).length,
    uncovered: ISO_COUNTRIES.filter(c => countryCounts[c] === 0)
  },
  category_counts: Object.fromEntries([...categoryCounts.entries()].sort()),
  source_tier_counts: Object.fromEntries([...tierCounts.entries()].sort()),
  unique_sources: sourceCounts.size,
  source_counts: Object.fromEntries([...sourceCounts.entries()].sort((a,b) => b[1]-a[1])),
  missing_metadata: Object.fromEntries(Object.entries(missing).map(([k,v]) => [k, v.length])),
  invalid_categories: invalidCategories,
  records_missing_valid_country_code: missingCountryCodes,
  stale_records_over_180_days: stale,
  shared_resources: sharedResources,
  duplicate_url_groups: duplicateUrlGroups,
  duplicate_title_groups: duplicateTitleGroups,
  country_coverage: countryCoverage,
  low_coverage_countries: lowCoverageCountries
};

fs.mkdirSync(OUT_DIR, {recursive: true});
fs.writeFileSync(
  path.join(OUT_DIR, "agricultural-resources-quality.json"),
  JSON.stringify(report, null, 2) + "\n"
);

console.log("Agricultural resource quality report");
console.log("------------------------------------");
console.log("Primary records:   " + primary.length);
console.log("Supplement records:" + supplement.length);
console.log("Combined records:  " + records.length);
console.log("Countries covered: " + report.countries.covered + "/" + report.countries.expected);
console.log("Unique sources:    " + report.unique_sources);
console.log("Shared URL groups: " + sharedResources.length);
console.log("Duplicate URL groups: " + duplicateUrlGroups.length);
console.log("Duplicate title groups: " + duplicateTitleGroups.length);
console.log("Stale >180 days:   " + stale.length);
console.log("Report: reports/agricultural-resources-quality.json");
