#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));

const EXPECTED = [
  ["DZ","Algeria"],["AO","Angola"],["BJ","Benin"],["BW","Botswana"],["BF","Burkina Faso"],
  ["BI","Burundi"],["CV","Cabo Verde"],["CM","Cameroon"],["CF","Central African Republic"],
  ["TD","Chad"],["KM","Comoros"],["CG","Republic of the Congo"],["CI","Côte d’Ivoire"],
  ["CD","Democratic Republic of the Congo"],["DJ","Djibouti"],["EG","Egypt"],["GQ","Equatorial Guinea"],
  ["ER","Eritrea"],["SZ","Eswatini"],["ET","Ethiopia"],["GA","Gabon"],["GM","Gambia"],
  ["GH","Ghana"],["GN","Guinea"],["GW","Guinea-Bissau"],["KE","Kenya"],["LS","Lesotho"],
  ["LR","Liberia"],["LY","Libya"],["MG","Madagascar"],["MW","Malawi"],["ML","Mali"],
  ["MR","Mauritania"],["MU","Mauritius"],["MA","Morocco"],["MZ","Mozambique"],["NA","Namibia"],
  ["NE","Niger"],["NG","Nigeria"],["RW","Rwanda"],["ST","São Tomé and Príncipe"],
  ["SN","Senegal"],["SC","Seychelles"],["SL","Sierra Leone"],["SO","Somalia"],
  ["ZA","South Africa"],["SS","South Sudan"],["SD","Sudan"],["TZ","Tanzania"],["TG","Togo"],
  ["TN","Tunisia"],["UG","Uganda"],["ZM","Zambia"],["ZW","Zimbabwe"]
];
const EXPECTED_CODES = new Set(EXPECTED.map(([code]) => code));
const LANGS = ["fr", "ar", "pt", "sw"];
const errors = [];
const warnings = [];
const nonempty = (v) => v !== undefined && v !== null && String(v).trim() !== "";
const safeArray = (v) => Array.isArray(v) ? v : [];

function flattenResources(data) {
  if (Array.isArray(data.records)) return data.records;
  return safeArray(data.countries).flatMap((country) =>
    Object.entries(country.records || {}).flatMap(([category, records]) =>
      safeArray(records).map((record) => ({
        ...record,
        country_code: record.country_code || country.code,
        country: record.country || country.name,
        category: record.category || category
      }))
    )
  );
}
function summarizeCounts(label, counts, min, countryNames) {
  const zero = EXPECTED.filter(([code]) => (counts[code] || 0) === 0).map(([code,name]) => `${code} ${name}`);
  const low = EXPECTED.filter(([code]) => (counts[code] || 0) > 0 && (counts[code] || 0) < min)
    .map(([code,name]) => `${code} ${name} (${counts[code]})`);
  if (zero.length) warnings.push(`${label}: no records for ${zero.length} countries: ${zero.join(", ")}`);
  if (low.length) warnings.push(`${label}: below recommended minimum ${min}: ${low.join(", ")}`);
}

const primary = flattenResources(readJson("src/_data/agriculturalResources.json"));
const supplement = flattenResources(readJson("src/_data/agriculturalResourcesSupplement.json"));
const resources = [...primary, ...supplement];
const resourcePublishable = resources.filter((r) => {
  const status = String(r.status || "official").toLowerCase();
  const lifecycle = String(r.lifecycle || "").toLowerCase();
  const held = ["review", "needs_review", "draft", "rejected", "expired", "closed", "archived", "historical"];
  return nonempty(r.url) && !held.includes(status) && !held.includes(lifecycle);
});
const resourceTranslationCounts = Object.fromEntries(LANGS.map((lang) => [
  lang,
  resourcePublishable.filter((r) => r.localized && r.localized[lang] && nonempty(r.localized[lang].title) && nonempty(r.localized[lang].description)).length
]));
console.log("Resources with localized title+description: " + LANGS.map((lang) => lang + "=" + resourceTranslationCounts[lang] + "/" + resourcePublishable.length).join("  "));
if (LANGS.some((lang) => resourceTranslationCounts[lang] < resourcePublishable.length)) {
  warnings.push("Resources: some published records lack reviewed localized title/description; localized directories flag these cards as translation pending.");
}
const resourceCounts = Object.fromEntries([...EXPECTED_CODES].map((c) => [c, 0]));
const resourceCategoryCounts = Object.fromEntries([...EXPECTED_CODES].map((c) => [c, new Set()]));
const resourceUrls = new Map();
resources.forEach((r, i) => {
  const code = String(r.country_code || "").toUpperCase();
  if (!EXPECTED_CODES.has(code)) {
    if (code !== "SADC" && code !== "AFRICA") errors.push(`Resource ${i + 1}: unexpected country code "${code}" (${r.title || "untitled"})`);
    return;
  }
  resourceCounts[code]++;
  if (nonempty(r.category)) resourceCategoryCounts[code].add(String(r.category).toLowerCase());
  for (const field of ["title", "description", "source", "url", "verified", "category"]) {
    if (!nonempty(r[field])) errors.push(`Resource ${i + 1} (${code}): missing ${field}`);
  }
  if (nonempty(r.url) && !/^https?:\/\//i.test(r.url)) errors.push(`Resource ${i + 1} (${code}): URL is not HTTP(S): ${r.url}`);
  if (nonempty(r.url)) resourceUrls.set(r.url, (resourceUrls.get(r.url) || 0) + 1);
});
summarizeCounts("Resources (country-specific plus shared)", resourceCounts, 5);
for (const [code, name] of EXPECTED) {
  if (resourceCategoryCounts[code].size < 3) warnings.push(`Resources: ${name} has only ${resourceCategoryCounts[code].size} populated categories`);
}
const duplicateResourceUrls = [...resourceUrls.entries()].filter(([,count]) => count > 1).length;
if (duplicateResourceUrls) warnings.push(`Resources: ${duplicateResourceUrls} URLs are reused across records; verify shared-country applicability and avoid duplicate display where inappropriate.`);

const newsData = readJson("src/_data/agriculturalNews.json");
const newsCountries = safeArray(newsData.countries);
const newsSupplementalRecords = [
  ...safeArray(readJson("src/_data/agriculturalNewsSupplement.json").records),
  ...safeArray(readJson("src/_data/agriculturalNewsExpansion.json").records),
  ...safeArray(readJson("src/_data/agriculturalNewsEquatorialGuinea.json").records)
].map(record => ({...record, title: record.title || record.headline || record.name || ""}));
const newsCodes = new Set(newsCountries.map((c) => String(c.code || "").toUpperCase()));
for (const [code, name] of EXPECTED) if (!newsCodes.has(code)) errors.push(`Agricultural News: country record missing for ${name} (${code})`);
for (const code of newsCodes) if (!EXPECTED_CODES.has(code)) errors.push(`Agricultural News: unexpected country code ${code}`);
const newsCounts = Object.fromEntries([...EXPECTED_CODES].map((c) => [c, 0]));
const translationCounts = Object.fromEntries(LANGS.map((l) => [l, 0]));
const newsUrls = new Map();
let newsTotal = 0;
newsCountries.forEach((country) => {
  const code = String(country.code || "").toUpperCase();
  const countryArticles = safeArray(country.articles).concat(newsSupplementalRecords.filter(r => String(r.country_code || "").toUpperCase() === code));
  const seenCountryNews = new Set();
  for (const article of countryArticles) {
    const articleKey = String(article.url || "").trim().replace(/\/+$/, "").toLowerCase() + "|" + String(article.title || article.headline || "").trim().toLowerCase();
    if (articleKey !== "|" && seenCountryNews.has(articleKey)) continue;
    if (articleKey !== "|") seenCountryNews.add(articleKey);
    newsTotal++;
    if (EXPECTED_CODES.has(code)) newsCounts[code]++;
    const reviewOnly = ["review", "needs_review", "draft"].includes(String(article.status || "").toLowerCase()) ||
      ["review", "needs_review", "draft"].includes(String(article.lifecycle || "").toLowerCase());
    // Review-queue candidates must have usable content and a source URL, but
    // must not be marked verified before editorial review. Published/current
    // records must carry both verification and publication dates.
    const requiredNewsFields = ["title", "summary", "source", "url", "category"];
    if (!reviewOnly) requiredNewsFields.push("verified", "published");
    for (const field of requiredNewsFields) {
      if (!nonempty(article[field])) errors.push(`News ${newsTotal} (${code}): missing ${field}`);
    }
    if (nonempty(article.url) && !/^https?:\/\//i.test(article.url)) errors.push(`News ${newsTotal} (${code}): URL is not HTTP(S): ${article.url}`);
    if (nonempty(article.url)) newsUrls.set(article.url, (newsUrls.get(article.url) || 0) + 1);
    for (const lang of LANGS) {
      if (nonempty(article.translations && article.translations[lang] && article.translations[lang].title) &&
          nonempty(article.translations && article.translations[lang] && article.translations[lang].summary)) translationCounts[lang]++;
    }
  }
});
summarizeCounts("Agricultural News", newsCounts, 4);
const duplicateNewsUrls = [...newsUrls.entries()].filter(([,count]) => count > 1).length;
if (duplicateNewsUrls) warnings.push(`Agricultural News: ${duplicateNewsUrls} URLs are reused; check whether these are deliberate source/region records or accidental duplicates.`);

const monitorReportPath = path.join(root, "reports", "agricultural-data-monitor.json");
if (fs.existsSync(monitorReportPath)) {
  const monitorReport = JSON.parse(fs.readFileSync(monitorReportPath, "utf8"));
  const specificGaps = monitorReport.news_country_coverage?.under_four_country_specific_story_countries || [];
  if (specificGaps.length) {
    const examples = specificGaps.slice(0, 12).map(c => `${c.code}=${c.country_specific_story_count}`).join(", ");
    warnings.push(`Agricultural News: country-specific story coverage is below 4 in ${specificGaps.length} countries; examples: ${examples}`);
  }
  const sourceGaps = monitorReport.news_country_coverage?.under_three_country_specific_sources || [];
  if (sourceGaps.length) {
    const examples = sourceGaps.slice(0, 12).map(c => `${c.code}=${c.country_specific_source_count}`).join(", ");
    warnings.push(`Agricultural News: country-specific source diversity is below 3 in ${sourceGaps.length} countries; examples: ${examples}`);
  }
}

const countryRegistry = readJson("src/_data/calculatorCountries.json").list || [];
const registryCodes = new Set(countryRegistry.map((c) => String(c.code || "").toUpperCase()));
for (const [code, name] of EXPECTED) if (!registryCodes.has(code)) errors.push(`Country registry missing ${name} (${code})`);
const translationData = readJson("src/_data/siteTranslations.json");
for (const lang of ["en", ...LANGS]) if (!translationData[lang]) errors.push(`Missing site UI translation dataset: ${lang}`);
if (translationData.ar && translationData.ar.dir !== "rtl") errors.push("Arabic UI dataset must declare dir=rtl");

console.log("GoOrganicAfrica agriculture coverage audit");
console.log(`Country registry: ${countryRegistry.length} entries; expected ${EXPECTED.length} African countries.`);
console.log(`Resources: ${primary.length} primary + ${supplement.length} supplemental = ${resources.length} records.`);
console.log(`Agricultural News: ${newsTotal} articles across ${newsCountries.length} country records.`);
console.log("Resources by country: " + EXPECTED.map(([c,n]) => `${c}=${resourceCounts[c]}`).join("  "));
console.log("News by country: " + EXPECTED.map(([c,n]) => `${c}=${newsCounts[c]}`).join("  "));
console.log("News articles with title+summary translations: " + LANGS.map((l) => `${l}=${translationCounts[l]}/${newsTotal}`).join("  "));
warnings.forEach((w) => console.warn("WARNING: " + w));
if (errors.length) {
  console.error(`FAILED: ${errors.length} structural/data-quality errors:`);
  errors.forEach((e) => console.error(" - " + e));
  process.exit(1);
}
console.log(`Structural checks passed with ${warnings.length} coverage warning(s). Warnings indicate gaps to fix, not verified errors.`);
