const fs = require("fs");
const path = require("path");

const root = process.cwd();
const dataDir = path.join(root, "src", "_data");
const outDir = path.join(root, "_site", "feeds");
fs.mkdirSync(outDir, { recursive: true });

const read = name => JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf8"));

const newsData = read("agriculturalNews.json");
const newsSupplement = read("agriculturalNewsSupplement.json").records || [];
const newsExpansion = read("agriculturalNewsExpansion.json").records || [];
const newsByCountry = new Map((newsData.countries || []).map(c => [c.code, {...c, articles:[...(c.articles || [])]}]));
for (const item of [...newsSupplement, ...newsExpansion]) {
  const c = newsByCountry.get(item.country_code);
  if (!c || !item.title || !item.url) continue;
  if (!c.articles.some(x => x.url === item.url || (x.title === item.title && x.published === item.published))) c.articles.push(item);
}
const news = [];
for (const c of newsByCountry.values()) for (const item of c.articles) {
  const status = String(item.status || "official").toLowerCase();
  if (["draft","review","needs_review","expired","closed"].includes(status)) continue;
  news.push({country_code:c.code,country:c.name,category:item.category || "general",title:item.title,summary:item.summary || "",url:item.url,source:item.source || "",published:item.published || "",verified:item.verified || ""});
}

const opportunities = (read("agriculturalOpportunities.json").records || [])
  .filter(r => r.is_current !== false && !["draft","review","needs_review"].includes(String(r.status || "").toLowerCase()))
  .map(r => ({country_code:r.country_code,country:r.country,title:r.title,summary:r.summary || "",type:r.type || "",provider:r.provider || "",deadline:r.deadline || "",application_url:r.application_url || "",source_url:r.source_url || "",verified:r.verified || r.verified_date || "",source_tier:r.source_tier || 5}));

const marketData = read("agriculturalMarkets.json").records || [];
const markets = marketData
  .filter(r => r.country_code !== "ALL" && !["draft","review","needs_review"].includes(String(r.status || "").toLowerCase()))
  .map(r => ({country_code:r.country_code,country:r.country,market:r.market,commodity:r.commodity,price:r.price,currency:r.currency,unit:r.unit,price_type:r.price_type,observed_date:r.observed_date,previous_price:r.previous_price,change_percent:r.change_percent,trend:r.trend,market_signal:r.market_signal,source_url:r.source_url,source_tier:r.source_tier || 5}));

const primaryResources = read("agriculturalResources.json").countries || [];
const supplement = read("agriculturalResourcesSupplement.json").records || [];
const gapFiles = fs.readdirSync(dataDir).filter(n => /^agriculturalResourcesGap.*\.json$/.test(n));
const gaps = gapFiles.flatMap(n => { try { return read(n).records || []; } catch (_) { return []; } });
const resources = [];
for (const c of primaryResources) for (const [category,list] of Object.entries(c.records || {})) for (const r of (list || [])) {
  if (["draft","review","needs_review"].includes(String(r.status || "").toLowerCase())) continue;
  resources.push({country_code:c.code,country:c.name,category:r.category || category,title:r.title,description:r.description || "",url:r.url || "",source:r.source || "",verified_date:r.verified_date || r.verified || "",source_tier:r.source_tier || 5});
}
for (const r of [...supplement,...gaps]) {
  if (["draft","review","needs_review"].includes(String(r.status || "").toLowerCase())) continue;
  resources.push({country_code:r.country_code,country:r.country,category:r.category || "",title:r.title,description:r.description || "",url:r.url || "",source:r.source || "",verified_date:r.verified_date || r.verified || "",source_tier:r.source_tier || 5});
}

const services = (read("agriculturalServices.json").records || [])
  .filter(r => String(r.lifecycle || "current") === "current" && !["draft","review","needs_review"].includes(String(r.status || "").toLowerCase()))
  .map(r => ({country_code:r.country_code,country:r.country,title:r.title,summary:r.summary || "",category:r.category || "",type:r.type || "",provider:r.provider || "",url:r.url || "",verified:r.verified || "",source_tier:r.source_tier || 5}));

const generated = "2026-10-08";
const feeds = {
  "news.json": {feed:"goorganicafrica.agricultural-news",version:1,generated,records:news},
  "opportunities.json": {feed:"goorganicafrica.opportunities",version:1,generated,records:opportunities},
  "markets.json": {feed:"goorganicafrica.markets",version:1,generated,records:markets},
  "resources.json": {feed:"goorganicafrica.resources",version:1,generated,records:resources},
  "services.json": {feed:"goorganicafrica.services",version:1,generated,records:services}
};
for (const [name,payload] of Object.entries(feeds)) fs.writeFileSync(path.join(outDir,name), JSON.stringify(payload,null,2) + "\n");
console.log("Generated agricultural feeds:", Object.keys(feeds).join(", "));
