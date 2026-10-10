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
const resourceSeenByCountry = new Map();
const resources = [];
for (const record of [...primary, ...supplement]) {
  const code = String(record.country_code || "").toUpperCase();
  if (!resourceSeenByCountry.has(code)) resourceSeenByCountry.set(code, new Set());
  const seen = resourceSeenByCountry.get(code);
  const urlKey = String(record.url || "").trim().toLowerCase();
  const titleKey = String(record.title || "").trim().toLowerCase();
  if ((urlKey && seen.has("url:" + urlKey)) || (titleKey && seen.has("title:" + titleKey))) continue;
  if (urlKey) seen.add("url:" + urlKey);
  if (titleKey) seen.add("title:" + titleKey);
  resources.push(record);
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
    if (!nonempty(r[field])) warnings.push(`Resource ${i + 1} (${code}): missing ${field}`);
  }
  if (nonempty(r.url) && !/^https?:\/\//i.test(r.url)) errors.push(`Resource ${i + 1} (${code}): URL is not HTTP(S): ${r.url}`);
  if (nonempty(r.url)) {
    const key = code + "|" + String(r.url).trim().toLowerCase();
    if (resourceUrls.has(key)) warnings.push(`Resource ${i + 1} (${code}): duplicate URL within country: ${r.url}`);
    resourceUrls.set(key, true);
  }
  if (/\/news-keywords\/agriculture\/?$|\/news-stories\/news-detail\/?$|\/news-stories\/news-detail\/en\/?$|\/resources-repository\/news\/en\/?$|\/projects-list\/?$|\/sectors\/A\/?$/i.test(String(r.url || ""))) {
    warnings.push(`Resource ${i + 1} (${code}): generic source landing page should be replaced with a specific resource: ${r.url}`);
  }
});
summarizeCounts("Resources (country-specific plus shared)", resourceCounts, 5);
for (const [code, name] of EXPECTED) {
  if (resourceCategoryCounts[code].size < 3) warnings.push(`Resources: ${name} has only ${resourceCategoryCounts[code].size} populated categories`);
}


const newsData = readJson("src/_data/agriculturalNews.json");
const newsSupplement = readJson("src/_data/agriculturalNewsSupplement.json");
const newsCountries = safeArray(newsData.countries).map((country) => ({
  ...country,
  articles: safeArray(country.articles).slice()
}));
const newsByCode = new Map(newsCountries.map((country) => [String(country.code || "").toUpperCase(), country]));
for (const rawArticle of safeArray(newsSupplement.records)) {
  // Supplemental feeds use "headline"; normalize it to "title" for a consistent audit.
  const article = { ...rawArticle, title: rawArticle.title || rawArticle.headline || "" };
  const code = String(article.country_code || "").toUpperCase();
  const country = newsByCode.get(code);
  if (!country) continue;
  if (!country.articles.some((existing) =>
    existing.url === article.url ||
    (existing.title || existing.headline) === article.title
  )) {
    country.articles.push(article);
  }
}
const newsCodes = new Set(newsCountries.map((c) => String(c.code || "").toUpperCase()));
for (const [code, name] of EXPECTED) if (!newsCodes.has(code)) errors.push(`Agricultural News: country record missing for ${name} (${code})`);
for (const code of newsCodes) if (!EXPECTED_CODES.has(code)) errors.push(`Agricultural News: unexpected country code ${code}`);
const newsCounts = Object.fromEntries([...EXPECTED_CODES].map((c) => [c, 0]));
const translationCounts = Object.fromEntries(LANGS.map((l) => [l, 0]));
const newsUrls = new Map();
let newsTotal = 0;
newsCountries.forEach((country) => {
  const code = String(country.code || "").toUpperCase();
  for (const article of safeArray(country.articles)) {
    newsTotal++;
    if (EXPECTED_CODES.has(code)) newsCounts[code]++;
    for (const field of ["title", "summary", "source", "url", "published", "verified", "category"]) {
      if (!nonempty(article[field])) warnings.push(`News ${newsTotal} (${code}): missing ${field}`);
    }
    if (nonempty(article.url) && !/^https?:\/\//i.test(article.url)) errors.push(`News ${newsTotal} (${code}): URL is not HTTP(S): ${article.url}`);
    if (nonempty(article.url)) {
      const key = code + "|" + String(article.url).trim().toLowerCase();
      if (newsUrls.has(key)) warnings.push(`News ${newsTotal} (${code}): duplicate URL within country: ${article.url}`);
      newsUrls.set(key, true);
    }
    if (/\/news-keywords\/agriculture\/?$|\/news-stories\/news-detail\/?$|\/news-stories\/news-detail\/en\/?$|\/resources-repository\/news\/en\/?$|\/projects-list\/?$|\/sectors\/A\/?$/i.test(String(article.url || ""))) {
      warnings.push(`News ${newsTotal} (${code}): generic source landing page should be replaced with a specific article: ${article.url}`);
    }
    for (const lang of LANGS) {
      if (nonempty(article.translations && article.translations[lang] && article.translations[lang].title) &&
          nonempty(article.translations && article.translations[lang] && article.translations[lang].summary)) translationCounts[lang]++;
    }
  }
});
summarizeCounts("Agricultural News", newsCounts, 4);


const countryRegistry = readJson("src/_data/calculatorCountries.json").list || [];
const registryCodes = new Set(countryRegistry.map((c) => String(c.code || "").toUpperCase()));
for (const [code, name] of EXPECTED) if (!registryCodes.has(code)) errors.push(`Country registry missing ${name} (${code})`);
const translationData = readJson("src/_data/siteTranslations.json");
for (const lang of ["en", ...LANGS]) if (!translationData[lang]) errors.push(`Missing site UI translation dataset: ${lang}`);
if (translationData.ar && translationData.ar.dir !== "rtl") errors.push("Arabic UI dataset must declare dir=rtl");

console.log("GoOrganicAfrica agriculture coverage audit");
console.log(`Country registry: ${countryRegistry.length} entries; expected ${EXPECTED.length} African countries.`);
console.log(`Resources: ${primary.length} primary + ${supplement.length} supplemental; ${resources.length} unique records after country-level URL/title deduplication.`);
console.log(`Agricultural News: ${newsTotal} unique articles across ${newsCountries.length} country records after merge.`);
console.log("Resources by country: " + EXPECTED.map(([c,n]) => `${c}=${resourceCounts[c]}`).join("  "));
console.log("News by country: " + EXPECTED.map(([c,n]) => `${c}=${newsCounts[c]}`).join("  "));
console.log("News articles with title+summary translations: " + LANGS.map((l) => `${l}=${translationCounts[l]}/${newsTotal}`).join("  "));
for (const lang of LANGS) {
  const percent = newsTotal ? Math.round((translationCounts[lang] / newsTotal) * 100) : 0;
  if (percent < 80) warnings.push(`Translation coverage: ${lang} has ${translationCounts[lang]}/${newsTotal} articles translated (${percent}%), below the 80% review target.`);
}
warnings.forEach((w) => console.warn("WARNING: " + w));
if (errors.length) {
  console.error(`FAILED: ${errors.length} structural/data-quality errors:`);
  errors.forEach((e) => console.error(" - " + e));
  process.exit(1);
}
console.log(`Structural checks passed with ${warnings.length} coverage warning(s). Warnings indicate gaps to fix, not verified errors.`);
