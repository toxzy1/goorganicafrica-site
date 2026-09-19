const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "../..");
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));

const settings = readJson("src/_data/siteSettings.json");
const normalizedSiteUrl = String(settings.site_url || "").replace(/\/+$/, "");
const countriesData = readJson("src/_data/calculatorCountries.json").list || [];
const regionsSource = readJson("src/_data/calculator/regions.json") || {};
const regionsData = Array.isArray(regionsSource.regions)
  ? Object.fromEntries(regionsSource.regions.map((r) => [r.country_code, r.regions || []]))
  : regionsSource;
const commoditiesDir = path.join(root, "src/_data/calculator/commodities");
const calculatorData = fs.readdirSync(commoditiesDir)
  .filter((name) => name.toLowerCase().endsWith(".json"))
  .map((name) => readJson(`src/_data/calculator/commodities/${name}`))
  .filter((c) => c.active !== false);
const sourceRegistry = readJson("config/ag-data-sources.json").sources || [];
const categoryRegistry = readJson("src/_data/categories.json").categories || [];

const directoryCountries = countriesData;
const activeCountries = countriesData.filter((c) => c.available !== false);
const activeCategories = categoryRegistry.filter((c) => c.active !== false);
const activeCountryCodes = new Set(activeCountries.map((c) => c.code));
const featuredCountryNames = activeCountries.slice(0, 3).map((c) => c.name);
const cropCount = calculatorData.filter((c) => c.category === "crop").length;
const livestockCount = calculatorData.filter((c) => c.category === "livestock" || c.category === "animal").length;
const varietyCount = new Set(calculatorData.flatMap((c) => {
  const rows = Array.isArray(c.country_data) ? c.country_data : Object.values(c.country_data || {});
  return rows.map((r) => r && (r.seed_variety || r.variety || r.brand)).filter(Boolean);
})).size;
const enterpriseCount = calculatorData.length;
const regionCount = activeCountries.reduce((sum, country) => sum + ((regionsData[country.code] || []).length), 0);

let priceRecords = 0;
let countriesWithPriceData = new Set();
let latestAsOf = "";
for (const commodity of calculatorData) {
  const countryRecords = Array.isArray(commodity.country_data)
    ? commodity.country_data.map((r) => [r.country_code, r])
    : Object.entries(commodity.country_data || {});
  for (const [code, data] of countryRecords) {
    if (!activeCountryCodes.has(code) || !data) continue;
    if (data.price_expected != null || data.price_low != null || data.price_high != null) {
      priceRecords += 1;
      countriesWithPriceData.add(code);
    }
    if (data.as_of && data.as_of > latestAsOf) latestAsOf = data.as_of;
  }
}

const enabledSources = sourceRegistry.filter((s) => s.enabled !== false);
const activeSources = enabledSources.filter((s) => s.status === "active" || s.status === "ready");
const priceCoveragePct = activeCountries.length ? Math.round((countriesWithPriceData.size / activeCountries.length) * 100) : 0;
const currentYear = new Date().getFullYear();

module.exports = {
  ...settings,
  site_url: normalizedSiteUrl,
  currentYear,
  name: settings.site_name,
  url: normalizedSiteUrl,
  tagline: settings.tagline,
  author: settings.author,
  description: settings.description,
  whatsapp: settings.whatsapp,
  email: settings.email,
  phone: settings.phone,
  calculator: {
    countryCount: activeCountries.length,
    directoryCountryCount: directoryCountries.length,
    categoryCount: activeCategories.length,
    regionCount,
    cropCount,
    livestockCount,
    enterpriseCount,
    varietyCount,
    priceRecordCount: priceRecords,
    countriesWithPriceData: countriesWithPriceData.size,
    priceCoveragePct,
    activeSourceCount: activeSources.length,
    configuredSourceCount: enabledSources.length,
    latestAsOf: latestAsOf || "Not yet recorded"
  },
  data: {
    activeCountries,
    directoryCountries,
    categories: activeCategories,
    countryCodes: activeCountries.map((c) => c.code),
    countryNames: Object.fromEntries(activeCountries.map((c) => [c.code, c.name])),
    featuredCountryNames,
    regions: regionsData,
    sources: enabledSources
  }
};
