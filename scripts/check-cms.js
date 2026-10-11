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

if (!settings.site_url) throw new Error("CMS site settings have no canonical URL.");
if (!languages.some(l => l.code === "en" && l.enabled !== false)) throw new Error("English runtime language is unavailable.");
if (!languages.some(l => l.code === "fr") || !languages.some(l => l.code === "ar") ||
    !languages.some(l => l.code === "pt") || !languages.some(l => l.code === "sw")) {
  throw new Error("One or more configured runtime languages are missing.");
}
if (!countries.some(c => c.available !== false)) throw new Error("CMS calculator has no active country.");
if (!Array.isArray(directory.listings)) throw new Error("Directory registry is malformed.");

const monitor = read("scripts/update-ag-data.py");
if (!monitor.includes("needs_review")) throw new Error("Agricultural data monitor does not enforce review status.");
if (!monitor.includes("ag-data-candidates-")) throw new Error("Agricultural data monitor does not create review batches.");

const workflow = read(".github/workflows/ag-data-monitor.yml");
if (!workflow.includes("schedule:")) throw new Error("Agricultural data monitor is not scheduled.");
if (!workflow.includes("workflow_dispatch:")) throw new Error("Agricultural data monitor has no manual trigger.");
if (!workflow.includes("contents: write")) throw new Error("Agricultural data monitor cannot save its review queue.");

// Automated news/opportunity discovery must create a human-review PR rather
// than writing candidates directly to the production branch.
const intelligenceWorkflow = read(".github/workflows/sync-agricultural-intelligence.yml");
if (!intelligenceWorkflow.includes("peter-evans/create-pull-request@v7")) {
  throw new Error("Agricultural intelligence sync must use a pull request for review.");
}
if (!intelligenceWorkflow.includes("draft: true")) {
  throw new Error("Agricultural intelligence sync pull requests must start as drafts.");
}
if (/\\bgit\\s+push\\b|\\bgit\\s+commit\\s+-m\\b/.test(intelligenceWorkflow)) {
  throw new Error("Agricultural intelligence sync must not commit or push directly to a production branch.");
}
if (!intelligenceWorkflow.includes("pull-requests: write")) {
  throw new Error("Agricultural intelligence sync needs permission to open review pull requests.");
}

const cmsSettings = JSON.parse(read("src/_data/cmsSettings.json"));
const governance = cmsSettings.content_governance || {};
const translation = cmsSettings.translation_control || {};
if (governance.allow_unreviewed_publication !== false) {
  throw new Error("CMS must not allow unreviewed content to be published.");
}
if (governance.require_translation_review_before_publication !== true) {
  throw new Error("Translations must require review before publication.");
}
if (translation.publish_machine_translations_automatically !== false) {
  throw new Error("Machine translations must not be published automatically.");
}

console.log("CMS end-to-end configuration and review-first publishing checks passed.");
