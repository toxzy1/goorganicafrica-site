const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = p => fs.readFileSync(path.join(root, p), "utf8");
const exists = p => fs.existsSync(path.join(root, p));

const requiredFiles = [
  "admin/index.html",
  "admin/config.yml",
  "src/_data/siteSettings.json",
  "src/_data/categories.json",
  "src/_data/calculatorCountries.json",
  "src/_data/calculator/regions.json",
  "src/_data/translationSettings.json",
  "src/_data/cmsSettings.json",
  "src/_data/siteTranslations.json",
  "src/_data/siteLanguages.json",
  "config/ag-data-sources.json",
  "config/ag-data-policy.json",
  "src/_data/directoryListings.json",
  "src/_data/agriculturalGrants.json",
  "src/_data/africaCountries.json",
  "src/_data/agriculturalResourceCoverage.json",
  "src/agriculture-resources.njk",
  "src/agricultural-finance.njk",
  "src/agricultural-grants.njk",
  "src/farm-machinery.njk",
  "scripts/update-ag-data.py",
  ".github/workflows/ag-data-monitor.yml",
  "oauth-proxy/wrangler.toml",
  "oauth-proxy/package.json",
  "oauth-proxy/src/index.ts"
];

for (const file of requiredFiles) {
  if (!exists(file)) throw new Error("CMS dependency missing: " + file);
}

const config = read("admin/config.yml");
const requiredConfigMarkers = [
  'name: "site_settings"',
  'name: "categories"',
  'name: "ebooks"',
  'name: "blog_categories"',
  'name: "posts"',
  'name: "calculator_countries"',
  'name: "calculator_regions"',
  'name: "calculator_enterprises"',
  'name: "ag_data_sources"',
  'name: "data_quality"',
  'name: "translation_automation"',
  'name: "content_governance"',
  'name: "languages_and_translations"',
  'name: "language_runtime"',
  'name: "ag_data_pending"',
  'name: "directory_listings"',
  'name: "agricultural_grants"',
  'name: "africa_resource_countries"',
  'name: "agricultural_resource_coverage"',
  "Finance Type",
  "Equipment Category",
  "Verification Status",
  "Selar Checkout Link",
  "Search Terms / Synonyms",
  "Google AdSense",
  "seed_price",
  "translation_status",
  "source_profile",
  "manual_override"
];

for (const marker of requiredConfigMarkers) {
  if (!config.includes(marker)) throw new Error("CMS control missing: " + marker);
}

if (!config.includes("publish_mode: editorial_workflow")) {
  throw new Error("CMS editorial workflow is not enabled.");
}
if (!config.includes("base_url: https://goorganicafrica-cms-auth.goorganicafricans.workers.dev")) {
  throw new Error("CMS OAuth proxy is not configured.");
}

const settings = JSON.parse(read("src/_data/siteSettings.json"));
const languages = JSON.parse(read("src/_data/siteLanguages.json")).languages || [];
const countries = JSON.parse(read("src/_data/calculatorCountries.json")).list || [];
const directory = JSON.parse(read("src/_data/directoryListings.json"));
const africa = JSON.parse(read("src/_data/africaCountries.json"));
const coverage = JSON.parse(read("src/_data/agriculturalResourceCoverage.json"));

if (!settings.site_url) throw new Error("CMS site settings have no canonical URL.");
if (!languages.some(l => l.code === "en" && l.enabled !== false)) throw new Error("English runtime language is unavailable.");
if (!languages.some(l => l.code === "fr") || !languages.some(l => l.code === "ar") ||
    !languages.some(l => l.code === "pt") || !languages.some(l => l.code === "sw")) {
  throw new Error("One or more configured runtime languages are missing.");
}
if (!countries.some(c => c.available !== false)) throw new Error("CMS calculator has no active country.");
if (!Array.isArray(directory.listings)) throw new Error("Directory registry is malformed.");
if (!Array.isArray(africa.countries) || africa.countries.length !== 54) throw new Error("Africa resource country registry must contain exactly 54 countries.");
if (new Set(africa.countries.map(c => c.code)).size !== 54) throw new Error("Africa resource country codes must be unique.");
if (!Array.isArray(coverage.countries) || coverage.countries.length !== 54) throw new Error("Resource coverage tracker must contain exactly 54 countries.");
const registryCodes = new Set(africa.countries.map(c => c.code));
for (const row of coverage.countries) if (!registryCodes.has(row.country_code)) throw new Error("Coverage tracker contains a country outside the 54-country registry: " + row.country_code);

const monitor = read("scripts/update-ag-data.py");
if (!monitor.includes("needs_review")) throw new Error("Agricultural data monitor does not enforce review status.");
if (!monitor.includes("ag-data-candidates-")) throw new Error("Agricultural data monitor does not create review batches.");

const workflow = read(".github/workflows/ag-data-monitor.yml");
if (!workflow.includes("schedule:")) throw new Error("Agricultural data monitor is not scheduled.");
if (!workflow.includes("workflow_dispatch:")) throw new Error("Agricultural data monitor has no manual trigger.");
if (!workflow.includes("contents: write")) throw new Error("Agricultural data monitor cannot save its review queue.");

console.log("CMS end-to-end configuration checks passed.");
