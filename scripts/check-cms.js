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
  "src/_data/agriculturalNewsSupplement.json",
  "src/_data/agriculturalNewsExpansion.json",
  "src/_data/agriculturalResourcesSupplement.json",
  "src/_data/agriculturalOpportunities.json",
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
  'name: "agricultural_news_supplement"',
  'name: "agricultural_news_expansion"',
  'name: "agricultural_resources_supplement"',
  'name: "agricultural_opportunities"',
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

const reviewCollections = [
  ["agricultural_news_supplement", "src/_data/agriculturalNewsSupplement.json"],
  ["agricultural_news_expansion", "src/_data/agriculturalNewsExpansion.json"],
  ["agricultural_resources_supplement", "src/_data/agriculturalResourcesSupplement.json"],
  ["agricultural_opportunities", "src/_data/agriculturalOpportunities.json"]
];
for (const [name, file] of reviewCollections) {
  const start = config.indexOf(`name: "${name}"`);
  const next = config.indexOf("\n  - name: ", start + 1);
  const block = start >= 0 ? config.slice(start, next > start ? next : config.length) : "";
  if (!block.includes(file) || !block.includes('default: "review"')) {
    throw new Error("Agricultural review queue must be editable in CMS with review as the default status: " + name);
  }
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
if (/\bgit\s+push\b|\bgit\s+commit\s+-m\b/.test(intelligenceWorkflow)) {
  throw new Error("Agricultural intelligence sync must not commit or push directly to a production branch.");
}
if (!intelligenceWorkflow.includes("pull-requests: write")) {
  throw new Error("Agricultural intelligence sync needs permission to open review pull requests.");
}

for (const [name, file] of [
  ["news", ".github/workflows/agricultural-news.yml"],
  ["opportunities", ".github/workflows/agricultural-opportunities.yml"],
  ["agricultural data", ".github/workflows/ag-data-monitor.yml"]
]) {
  const workflowText = read(file);
  if (!workflowText.includes("peter-evans/create-pull-request@v7") || !workflowText.includes("draft: true") || !workflowText.includes("actions/checkout@v4") || !workflowText.includes("actions/setup-node@v4") || !workflowText.includes("npm ci") || /\bgit\s+push\b/.test(workflowText)) {
    throw new Error("Scheduled " + name + " discovery must use a draft review PR and must not push directly.");
  }
  if ((workflowText.match(/^\s*delete-branch:/gm) || []).length !== 1) {
    throw new Error("Scheduled " + name + " workflow must define delete-branch exactly once.");
  }
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

// Verify that discovery scripts explicitly label newly collected items as
// unreviewed candidates; a draft PR alone is not a content approval.
const newsSync = read("scripts/sync-agricultural-news.js");
const opportunitySync = read("scripts/sync-agricultural-opportunities.js");
const opportunitiesTemplate = read("src/_includes/opportunities-directory.njk");
const newsCountryTemplate = read("src/agricultural-news-country.njk");
const newsIndexTemplate = read("src/agricultural-news.njk");
for (const [name, script] of [["news", newsSync], ["opportunities", opportunitySync]]) {
  if (!script.includes('status: "review"') || !script.includes('lifecycle: "needs_review"')) {
    throw new Error("Agricultural " + name + " sync must mark new records as needs_review.");
  }
}
if (!['record.status == "open"', 'record.status == "active"', 'record.status == "closed"', 'record.status == "expired"', 'record.status == "archived"', 'record.lifecycle != "review"', 'record.lifecycle != "needs_review"', 'record.lifecycle != "draft"'].every(marker => opportunitiesTemplate.includes(marker))) {
  throw new Error("Opportunity directory must allow only recognized publication/archive statuses and hide review-state candidates.");
}
if (!newsCountryTemplate.includes('candidate.lifecycle == "current"') || !newsCountryTemplate.includes("publishedArticles")) {
  throw new Error("Country news pages must show only current verified stories.");
}
if (!newsIndexTemplate.includes('article.lifecycle == "current"')) {
  throw new Error("News index must exclude historical and expired stories from current listings.");
}
if (!opportunitiesTemplate.includes('record.lifecycle or record.status')) {
  throw new Error("Opportunity directory must fall back to the existing status field when lifecycle is absent.");
}
if (!opportunitySync.includes("discovered: today") || !opportunitySync.includes("country: country.name") || !opportunitySync.includes("code: country.code")) {
  throw new Error("Opportunity candidates must use the existing country schema and must not claim to be verified before review.");
}
if (!newsSync.includes("ageDays > 30")) {
  throw new Error("Agricultural news discovery must reject stories older than its 30-day freshness window.");
}
if (!opportunitySync.includes("age > 90")) {
  throw new Error("Opportunity discovery must reject items older than its 90-day discovery window.");
}
if (!opportunitySync.includes('candidate.hostname === "news.google.com"') ||
    !opportunitySync.includes('hostname !== feed.host && !hostname.endsWith("." + feed.host)')) {
  throw new Error("Opportunity discovery must resolve aggregator links and validate the final source hostname.");
}
if (!opportunitySync.includes('calculatorCountries.json') || !opportunitySync.includes('countryRegistry.list')) {
  throw new Error("Opportunity discovery must use the canonical country registry, not an absent countries field.");
}
if (!opportunitySync.includes('Skipping unavailable opportunity feed') ||
    !newsSync.includes('Skipping unavailable news feed') ||
    !opportunitySync.includes('attempt <= 3') || !newsSync.includes('attempt <= 3')) {
  throw new Error("News and opportunity discovery must retry transient failures and continue with other feeds.");
}

// Discovery is not verification: new news records must not receive a verified date
// until a person checks the original source. Sorting must never delete older records.
if (!newsSync.includes("discovered: today") || newsSync.includes("verified: today")) {
  throw new Error("News discovery must record discovery date without falsely marking candidates verified.");
}
if (newsSync.includes(".slice(0, 20)")) {
  throw new Error("News discovery must not truncate and silently delete existing country records.");
}


const agriculturalDataWorkflow = read(".github/workflows/ag-data-monitor.yml");
if (!agriculturalDataWorkflow.includes("peter-evans/create-pull-request@v7") || !agriculturalDataWorkflow.includes("draft: true") || agriculturalDataWorkflow.includes("git push")) {
  throw new Error("Agricultural data candidates must go through a draft review PR and never push directly to the production branch.");
}

const eleventySource = read(".eleventy.js");
if (!eleventySource.includes("const collectPublishableNews") || !eleventySource.includes("const collectPublishableResources") || !eleventySource.includes("articles: dedupeAgriculturalRecords(") || !eleventySource.includes("const incoming = [...(supplement.records || []), ...(expansion.records || [])]") || !eleventySource.includes('title: article.title || article.headline || ""') || !eleventySource.includes("isSpecificAgriculturalNewsUrl(article.url)") || !eleventySource.includes("const allSupplementRecords = [...(supplement.records || []), ...gapRecords.map") || !eleventySource.includes("const isGenericAgriculturalResourceUrl = value =>") || !eleventySource.includes("twenty-african-countries-to-present-agrifood-investment-opportunities-at-the-2026-hand-in-hand-investment-forum") || !eleventySource.includes("shouldPublishAgriculturalResource(r, cat)") || !eleventySource.includes("filter(record => shouldPublishAgriculturalResource(record, record.category))")) {
  throw new Error("Public agricultural search, news and resource data must normalize eligible news, deduplicate sources and exclude generic or review-queue records.");
}
if (!eleventySource.includes("const normalizeAgriculturalUrl = value =>") ||
    !eleventySource.includes('url.hash = ""') ||
    !eleventySource.includes("const identity = rawUrl ? normalizeAgriculturalUrl(rawUrl)")) {
  throw new Error("Public agricultural deduplication must normalize URL variants without rewriting the source links.");
}

if (!eleventySource.includes("const bestByUrl = new Map()") ||
    !eleventySource.includes("normalizeAgriculturalUrl(r.url || r.source_url)") ||
    !eleventySource.includes("retainedRecords.has(r)") ||
    !eleventySource.includes("suppressedResourceDuplicates")) {
  throw new Error("The public resources directory must suppress duplicate source cards across categories within each country.");
}

if (eleventySource.includes('new Date("2026-10-08T00:00:00Z")') || !eleventySource.includes("new Date().toISOString().slice(0, 10)")) {
  throw new Error("Agricultural expiry, freshness and generated-date metadata must not be frozen to an old build date.");
}

const freshnessMonitor = read("scripts/monitor-agricultural-data.js");
if (!freshnessMonitor.includes("sourceUrlAudit") || !freshnessMonitor.includes("generic_landing_page_records") || !freshnessMonitor.includes("duplicate_url_groups") || !freshnessMonitor.includes("duplicate_url_same_country_groups") || !freshnessMonitor.includes('news_review_queue:sourceUrlAudit(newsReviewQueue,false,"news")') || !freshnessMonitor.includes('opportunity_review_queue:sourceUrlAudit(opportunityReviewQueue,false,"opportunities")') || !freshnessMonitor.includes("news-keywords\\/agriculture") || !freshnessMonitor.includes("news_country_coverage") || !freshnessMonitor.includes("zero_story_countries") || !freshnessMonitor.includes("under_four_story_countries") || !freshnessMonitor.includes("future_publication_dates") || !freshnessMonitor.includes("source_count") || !freshnessMonitor.includes("single_source_countries") || !freshnessMonitor.includes("under_three_sources_countries") || !freshnessMonitor.includes('services:sourceUrlAudit(publishableServices,false,"services")') || !freshnessMonitor.includes('markets:sourceUrlAudit(publishableMarkets,false,"markets")') || !freshnessMonitor.includes('market_review_queue:sourceUrlAudit(marketReviewQueue,false,"markets")') || !freshnessMonitor.includes('service_review_queue:sourceUrlAudit(serviceReviewQueue,false,"services")') || !freshnessMonitor.includes("r.price!==null && r.price!==undefined") || !freshnessMonitor.includes('resource_review_queue:sourceUrlAudit(resourceQueue,true,"resources")') || !freshnessMonitor.includes('resources:sourceUrlAudit(publicResourceRecords,true,"resources")') || !freshnessMonitor.includes("publicResourceRecords=[...resources,...resources2].filter(r=>!isResourceReviewRecord(r))")) {
  throw new Error("Agricultural data monitor must flag duplicate source URLs and nested generic landing pages for editorial review.");
}
if (!freshnessMonitor.includes("isSpecificNewsUrl") || !freshnessMonitor.includes("isCurrentNewsRecord") || !freshnessMonitor.includes("const publishableNews=news.filter(isCurrentNewsRecord)") || !freshnessMonitor.includes("newsCountryCoverage=newsCountryList.map") || !freshnessMonitor.includes("newsCountryExpansion.json") && !freshnessMonitor.includes("agriculturalNewsExpansion.json") || !freshnessMonitor.includes("const countryRecords=publishableNews.filter") || !freshnessMonitor.includes("source_count:sources.size")) {
  throw new Error("Country news coverage must include supplemental/expansion records and count unique stories per country.");
}
const mergeScript = read("scripts/merge-agricultural-intelligence.js");
if (!mergeScript.includes("title: record.headline || record.name ||") ||
    !mergeScript.includes("country[listField].push(candidate)") ||
    !mergeScript.includes("country.records[category].push(candidate)")) {
  throw new Error("Agricultural intelligence merge must normalize headline-only records before public rendering.");
}
if (mergeScript.includes("resourceGapFiles") || !mergeScript.includes("agriculturalResourcesSupplement.json") ||
    !freshnessMonitor.includes("resourceGapFiles") ||
    !freshnessMonitor.includes('resource_review_queue:sourceUrlAudit(resourceQueue,true,"resources")') ||
    !eleventySource.includes('gapRecords.map(r => ({ ...r, lifecycle: r.lifecycle || "needs_review" }))')) {
  throw new Error("Country resource-gap candidates must remain in the review queue and must not be merged directly into public data.");
}

if (!freshnessMonitor.includes("missing_verification_date") || !freshnessMonitor.includes("!r.verified||age(r.verified)===null||age(r.verified)>14") || !freshnessMonitor.includes("return !d||age(d)===null||age(d)>180")) {
  throw new Error("Agricultural freshness monitor must flag missing verification dates, not treat them as fresh.");
}


if (!newsSync.includes('if (parsedUrl.hostname !== feed.allowedHost && !parsedUrl.hostname.endsWith("." + feed.allowedHost)) continue;') || newsSync.includes("sourceHost !== feed.allowedHost")) {
  throw new Error("News discovery must validate the final article URL host, not trust RSS source attribution alone.");
}


if (!freshnessMonitor.includes("missing_publication_date") || !freshnessMonitor.includes("return !d||age(d)===null||age(d)>180") || !freshnessMonitor.includes("return !d||age(d)===null||age(d)>30") || !freshnessMonitor.includes('String(r.lifecycle||"").toLowerCase()==="needs_review"') || !freshnessMonitor.includes("age(r.observed_date)===null") || !freshnessMonitor.includes("invalid_deadline_date") || !freshnessMonitor.includes("opportunities:{total:opp.length,review:")) {
  throw new Error("Agricultural freshness monitor must flag missing resource verification dates and news publication dates, including lifecycle review queues.");
}

if (!freshnessMonitor.includes('publishableNews=news.filter(isCurrentNewsRecord)') ||
    !freshnessMonitor.includes("isSpecificNewsUrl") ||
    !freshnessMonitor.includes('["review","needs_review","draft","rejected","expired","closed","archived","historical"].includes(lifecycle)') ||
    !freshnessMonitor.includes("country_specific_story_count") ||
    !freshnessMonitor.includes("regional_story_count") ||
    !freshnessMonitor.includes("under_four_country_specific_story_countries") ||
    !freshnessMonitor.includes("review_candidates_by_country") ||
    !freshnessMonitor.includes("country_review_priorities")) {
  throw new Error("Country news coverage must distinguish regional stories, report review candidates by country, and exclude unpublished, historical, expired, and generic-source records.");
}

// Generic landing pages may be useful for research, but must never be presented
// as verified individual news stories or opportunities until a direct source is found.
const newsBase = JSON.parse(read("src/_data/agriculturalNews.json"));
const newsSupplement = JSON.parse(read("src/_data/agriculturalNewsSupplement.json"));
const newsExpansion = JSON.parse(read("src/_data/agriculturalNewsExpansion.json"));
const opportunityData = JSON.parse(read("src/_data/agriculturalOpportunities.json"));
const resourceBase = JSON.parse(read("src/_data/agriculturalResources.json"));
const resourceSupplement = JSON.parse(read("src/_data/agriculturalResourcesSupplement.json"));
const serviceData = JSON.parse(read("src/_data/agriculturalServices.json"));
const resourceCandidates = [
  ...(resourceBase.countries || []).flatMap(country =>
    Object.entries(country.records || {}).flatMap(([category, records]) =>
      (records || []).map(record => ({...record, category: record.category || category, country_code: record.country_code || country.code, country: record.country || country.name}))
    )
  ),
  ...(resourceSupplement.records || [])
];
const sourceCandidates = [
  ...(newsBase.countries || []).flatMap(country => (country.articles || []).map(record => ({...record, country: country.name}))),
  ...(newsSupplement.records || []),
  ...(newsExpansion.records || []),
  ...(opportunityData.records || [])
];
const genericSourcePath = pathname => pathname === "/" ||
  /(?:^|\/)(?:latest-news|news-detail|projects-list|call-for-proposals|news-keywords\/agriculture|sectors\/A|news|news-updates|actualites|capacity-development-office)(?:\/en)?$/i.test(pathname) ||
  /\/newsdetails(?:\/en)?$/i.test(pathname) ||
  /\/news\/detail(?:\/en)?$/i.test(pathname) ||
  /\/hand-in-hand\/investment-forum-2026\//i.test(pathname) ||
  pathname === "/en";
const publicNewsStatus = record =>
  ["official", "published", "verified"].includes(String(record.status || "").toLowerCase()) &&
  !["review", "needs_review", "draft"].includes(String(record.lifecycle || "").toLowerCase());
const incompletePublicNews = (newsBase.countries || []).flatMap(country => country.articles || [])
  .filter(record => publicNewsStatus(record) &&
    (!String(record.title || "").trim() || !String(record.summary || "").trim() || !String(record.published || "").trim()));
if (incompletePublicNews.length) {
  throw new Error("Public agricultural news must have a title, summary and publication date: " +
    incompletePublicNews.map(record => record.url || record.title || "Untitled record").join("; "));
}
const genericUnreviewed = sourceCandidates.filter(record => {
  if (!record.url) return false;
  let pathname;
  try {
    pathname = new URL(record.url).pathname.replace(/\/+$/, "") || "/";
  } catch (_) {
    return true;
  }
  const generic = genericSourcePath(pathname);
  const state = String(record.status || "").toLowerCase();
  const lifecycle = String(record.lifecycle || "").toLowerCase();
  const heldForReview = ["review", "draft", "needs_review", "rejected"].includes(state) ||
    ["review", "draft", "needs_review", "rejected"].includes(lifecycle);
  return generic && !heldForReview;
});
if (genericUnreviewed.length) {
  throw new Error("Generic agricultural source URLs must remain in editorial review: " +
    genericUnreviewed.map(record => (record.title || record.headline || "Untitled") + " -> " + record.url).join("; "));
}
const genericResourceSourcePath = pathname => pathname === "/" ||
  /(?:^|\/)(?:latest-news|news-detail|projects-list|call-for-proposals|news-keywords\/agriculture|sectors\/A|news|news-updates|actualites|capacity-development-office)(?:\/en)?$/i.test(pathname) ||
  /\/newsdetails(?:\/en)?$/i.test(pathname) ||
  /\/news\/detail(?:\/en)?$/i.test(pathname) ||
  /\/twenty-african-countries-to-present-agrifood-investment-opportunities-at-the-2026-hand-in-hand-investment-forum(?:\/en)?$/i.test(pathname) ||
  /\/hand-in-hand\/investment-forum-2026\/en$/i.test(pathname) ||
  /\/members\/lapse-of-time$/i.test(pathname);
const publicResourceRecord = record => {
  const status = String(record.status || "").toLowerCase();
  const lifecycle = String(record.lifecycle || "").toLowerCase();
  return !["review", "needs_review", "draft", "rejected", "expired", "closed"].includes(status) &&
    !["review", "needs_review", "draft", "rejected", "expired", "closed"].includes(lifecycle);
};
const genericPublicResources = resourceCandidates.filter(record => {
  if (!publicResourceRecord(record)) return false;
  const url = String(record.url || record.source_url || "");
  if (!url) return false;
  let parsed;
  try { parsed = new URL(url); } catch (_) { return true; }
  const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
  if (pathname === "/" && parsed.searchParams.has("page_id")) return false;
  if (!genericResourceSourcePath(pathname)) return false;
  const title = String(record.title || record.name || "");
  const category = String(record.category || "").toLowerCase().replace("policy", "general").replace("weather-climate", "climate");
  const institutional = /\b(ministry|authority|department|agency|institute|centre|center|fund|council|office|commission|bureau|government|research center|research centre|university|directorate|board|service)\b/i.test(title);
  const portal = /\b(platform|portal|system|database|information system|advisory tool|digital service)\b/i.test(title);
  const homepage = pathname === "/" || pathname === "/en";
  const allowedHomepage = homepage && (
    (institutional && ["general", "data", "farmer-support"].includes(category)) ||
    (portal && ["general", "data", "farmer-support", "inputs", "markets"].includes(category))
  );
  return !allowedHomepage;
});
if (genericPublicResources.length) {
  throw new Error("Generic resource landing pages must remain in editorial review: " +
    genericPublicResources.map(record => (record.title || "Untitled") + " -> " + (record.url || record.source_url)).join("; "));
}
const assertNoSameCountryUrlDuplicates = (records, label) => {
  const seen = new Map();
  for (const record of records) {
    const url = String(record.url || record.source_url || "").trim();
    if (!url) continue;
    const country = String(record.country_code || record.code || record.country || record.country_name || "unassigned").toUpperCase();
    const key = country + "|" + url;
    if (seen.has(key)) throw new Error(label + " contains duplicate public URLs for " + country + ": " + url);
    seen.set(key, true);
  }
};
// The build merge step has already folded approved news/resource supplements
// into the base files, so audit the merged base once to avoid counting the
// same supplement record twice in the checker.
const publicNewsRecords = (newsBase.countries || []).flatMap(country =>
  (country.articles || []).map(record => ({...record, country_code: record.country_code || country.code, country: record.country || country.name}))
).filter(publicNewsStatus);
const publicBaseResourceRecords = (resourceBase.countries || []).flatMap(country =>
  Object.entries(country.records || {}).flatMap(([category, records]) =>
    (records || []).map(record => ({...record, category: record.category || category, country_code: record.country_code || country.code, country: record.country || country.name}))
  )
);
assertNoSameCountryUrlDuplicates(publicNewsRecords, "Public agricultural news");
assertNoSameCountryUrlDuplicates(publicBaseResourceRecords.filter(publicResourceRecord), "Public agricultural resources");
const publicServiceRecords = (serviceData.records || []).filter(record => {
  const status = String(record.status || "").toLowerCase();
  const lifecycle = String(record.lifecycle || "").toLowerCase();
  return !["review", "needs_review", "draft", "rejected", "expired", "closed"].includes(status) &&
    !["review", "needs_review", "draft", "rejected", "expired", "closed", "historical"].includes(lifecycle);
});
assertNoSameCountryUrlDuplicates(publicServiceRecords, "Public agricultural services");
const genericPublicServices = publicServiceRecords.filter(record => {
  const url = String(record.url || "");
  if (!url) return false;
  let parsed;
  try { parsed = new URL(url); } catch (_) { return true; }
  const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
  if (!genericSourcePath(pathname)) return false;
  const title = String(record.title || record.provider || "");
  const institutional = /\b(ministry|authority|department|agency|institute|centre|center|council|office|commission|bureau|government|university|directorate|board|service)\b/i.test(title);
  return !(pathname === "/" && institutional);
});
if (genericPublicServices.length) {
  throw new Error("Generic service/event URLs must remain in editorial review: " +
    genericPublicServices.map(record => (record.title || "Untitled") + " -> " + record.url).join("; "));
}

const coverageAudit = read("scripts/audit-agriculture-coverage.js");
if (!coverageAudit.includes('const requiredNewsFields = ["title", "summary", "source", "url", "category"]') ||
    !coverageAudit.includes('if (!reviewOnly) requiredNewsFields.push("verified", "published")')) {
  throw new Error("Review-only news candidates must not be falsely marked verified; published records must require verification and publication dates.");
}

console.log("CMS end-to-end configuration and review-first publishing checks passed.");
