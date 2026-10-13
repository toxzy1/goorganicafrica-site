const { DateTime } = require("luxon");

const isPublishableAgriculturalRecord = record => {
  const status = String(record?.status || "").toLowerCase();
  const lifecycle = String(record?.lifecycle || "").toLowerCase();
  return !["review", "needs_review", "draft", "rejected"].includes(status) &&
    !["review", "needs_review", "draft", "rejected"].includes(lifecycle);
};

// Normalize URL variants for duplicate comparison only. Keep the original
// URL on the record so published source links are not rewritten.
const normalizeAgriculturalUrl = value => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if ((url.protocol === "https:" && url.port === "443") ||
        (url.protocol === "http:" && url.port === "80")) url.port = "";
    while (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }
    return url.toString();
  } catch (_) {
    return raw.split("#")[0].replace(/\/+$/, "").toLowerCase();
  }
};

const dedupeAgriculturalRecords = records => {
  const seen = new Set();
  return records.filter(record => {
    const country = String(record.country_code || record.code || "").toUpperCase();
    const rawUrl = String(record.url || record.source_url || record.application_url || "").trim();
    const identity = rawUrl ? normalizeAgriculturalUrl(rawUrl) : String(record.title || "").trim().toLowerCase();
    const key = country + "|" + identity;
    if (!country || !identity || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const isSpecificAgriculturalNewsUrl = value => {
  try {
    const parsed = new URL(value);
    const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    // Country investment profiles belong in Resources, not the Agricultural News feed.
    if (/\/hand-in-hand\/investment-forum-2026\//i.test(pathname)) return false;
    return !(pathname === "/" ||
      /(?:^|\/)(?:latest-news|news-detail|projects-list|call-for-proposals|news-keywords\/agriculture|sectors\/A|news|news-updates|actualites|capacity-development-office)(?:\/en)?$/i.test(pathname) ||
      /^\/en$/i.test(pathname) ||
      /\/newsdetails(?:\/en)?$/i.test(pathname) ||
      /\/news\/detail(?:\/en)?$/i.test(pathname));
  } catch {
    return false;
  }
};

// Keep generic landing pages out of category-specific country resource listings.
const isGenericAgriculturalResourceUrl = value => {
  try {
    const parsed = new URL(value);
    const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    // These query-addressed CMS pages are direct records, not generic homepages.
    if (pathname === "/" && parsed.searchParams.has("page_id")) return false;
    return pathname === "/" ||
      /(?:^|\/)(?:latest-news|news-detail|projects-list|call-for-proposals|news-keywords\/agriculture|sectors\/A|news|news-updates|actualites|capacity-development-office)(?:\/en)?$/i.test(pathname) || /\/newsdetails(?:\/en)?$/i.test(pathname) || /\/news\/detail(?:\/en)?$/i.test(pathname) ||
      /^\/en$/i.test(pathname) ||
      /\/newsdetails(?:\/en)?$/i.test(pathname) ||
      /\/twenty-african-countries-to-present-agrifood-investment-opportunities-at-the-2026-hand-in-hand-investment-forum(?:\/en)?$/i.test(pathname) ||
      /\/hand-in-hand\/investment-forum-2026\/en$/i.test(pathname) ||
      /\/members\/lapse-of-time$/i.test(pathname);
  } catch {
    return true;
  }
};

const shouldPublishAgriculturalResource = (record, category) => {
  if (!isPublishableAgriculturalRecord(record)) return false;
  const url = String(record.url || record.source_url || "").trim();
  if (!isGenericAgriculturalResourceUrl(url)) return true;
  // Only an institution's own homepage can remain as a broad general reference.
  // Generic project/news/grant listings must not be presented as direct records.
  let pathname;
  try { pathname = new URL(url).pathname.replace(/\/+$/, "") || "/"; }
  catch { return false; }
  const isHomepage = pathname === "/" || /^\/en$/i.test(pathname);
  const title = String(record.title || record.name || "");
  const institutionalTitle = /\b(ministry|authority|department|agency|institute|centre|center|fund|council|office|commission|bureau|government|research center|research centre|university|directorate|board|service)\b/i.test(title);
  const portalTitle = /\b(platform|portal|system|database|information system|advisory tool|digital service)\b/i.test(title);
  const rawCategory = String(category || record.category || "").toLowerCase();
  const normalizedCategory = ({ "weather-climate": "climate", policy: "general" })[rawCategory] || rawCategory;
  return (isHomepage && institutionalTitle &&
    ["general", "data", "farmer-support"].includes(normalizedCategory)) ||
    (isHomepage && portalTitle &&
    ["general", "data", "farmer-support", "inputs", "markets"].includes(normalizedCategory));
};

const collectPublishableNews = read => {
  const primary = (read("agriculturalNews.json").countries || []).flatMap(country =>
    (country.articles || []).map(article => ({
      ...article,
      country_code: article.country_code || country.code,
      country: article.country || country.name || country.country
    }))
  );
  const incoming = [
    ...(read("agriculturalNewsSupplement.json").records || []),
    ...(read("agriculturalNewsExpansion.json").records || [])
  ].map(article => ({
    ...article,
    country_code: article.country_code || article.code,
    country: article.country || article.country_name,
    title: article.title || article.headline || ""
  }));
  return dedupeAgriculturalRecords(
    [...primary, ...incoming]
      .filter(isPublishableAgriculturalRecord)
      .filter(article => article.title && isSpecificAgriculturalNewsUrl(article.url))
  );
};

const collectPublishableResources = read => {
  const primary = (read("agriculturalResources.json").countries || []).flatMap(country =>
    Object.entries(country.records || {}).flatMap(([category, list]) => (list || []).map(record => ({
      ...record,
      category: record.category || category,
      country_code: record.country_code || country.code,
      country: record.country || country.name || country.country
    })))
  );
  const supplement = read("agriculturalResourcesSupplement.json").records || [];
  const fs = require("fs");
  const path = require("path");
  const dataDir = path.join(process.cwd(), "src/_data");
  // Gap files are an editorial queue: they remain hidden until a reviewer
  // explicitly approves them in a published registry.
  const gapFiles = fs.readdirSync(dataDir).filter(name => /^agriculturalResourcesGap.*\.json$/.test(name));
  const queued = gapFiles.flatMap(name => {
    try {
      return (JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf8")).records || [])
        .map(record => ({ ...record, lifecycle: record.lifecycle || "needs_review" }));
    } catch (_) { return []; }
  });
  return dedupeAgriculturalRecords([...primary, ...supplement, ...queued].filter(record => shouldPublishAgriculturalResource(record, record.category)));
};

module.exports = function (eleventyConfig) {

  // Agricultural opportunities: unified current/expired lifecycle registry.
  eleventyConfig.addGlobalData("agriculturalOpportunities", () => {
    const fs = require("fs");
    const path = require("path");
    const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src/_data/agriculturalOpportunities.json"), "utf8"));
    const now = new Date();
    data.records = (data.records || []).filter(isPublishableAgriculturalRecord).map(record => {
      const deadline = record.deadline ? new Date(record.deadline + "T23:59:59Z") : null;
      const review = !isPublishableAgriculturalRecord(record);
      const expired = String(record.status || "").toLowerCase() === "expired" || (deadline && !Number.isNaN(deadline.getTime()) && deadline < now);
      return { ...record, lifecycle: review ? "needs_review" : (expired ? "expired" : "current"), is_current: !review && !expired, is_expired: !review && !!expired };
    });
    data.records.sort((a,b) => Number(b.is_current) - Number(a.is_current) || String(a.deadline || "9999").localeCompare(String(b.deadline || "9999")));
    data.market_signals = data.records.filter(r => r.market_signal === "strong_move" || r.market_signal === "notable_move").map(r => ({
      country_code: r.country_code, country: r.country, market: r.market, commodity: r.commodity,
      trend: r.trend, change_percent: r.change_percent, observed_date: r.observed_date,
      previous_observed_date: r.previous_observed_date, signal: r.market_signal
    }));
    data.total = data.records.length;
    data.current_total = data.records.filter(r => r.is_current).length;
    data.expired_total = data.records.filter(r => r.is_expired).length;
    return data;
  });

  // Agricultural services directory: suppliers, machinery, training and events.
  eleventyConfig.addGlobalData("agriculturalServices", () => {
    const fs = require("fs");
    const path = require("path");
    const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src/_data/agriculturalServices.json"), "utf8"));
    const records = (data.records || []).filter(isPublishableAgriculturalRecord).map(record => ({
      ...record,
      is_current: String(record.lifecycle || "current") === "current",
      is_historical: String(record.lifecycle || "") === "historical"
    }));
    data.records = records;
    data.total = records.length;
    data.current_total = records.filter(r => r.is_current).length;
    data.historical_total = records.filter(r => r.is_historical).length;
    data.categories = [...new Set(records.map(r => r.category).filter(Boolean))].sort();
    data.countries = [...new Set(records.map(r => r.country_code).filter(Boolean))].sort();
    return data;
  });

  // Agricultural markets: structured market intelligence and verified source registry.
  eleventyConfig.addGlobalData("agriculturalMarkets", () => {
    const fs = require("fs");
    const path = require("path");
    const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src/_data/agriculturalMarkets.json"), "utf8"));
    const now = new Date();
    const records = (data.records || []).filter(isPublishableAgriculturalRecord).map(record => {
      const observed = record.observed_date ? new Date(record.observed_date) : null;
      const ageDays = observed && !Number.isNaN(observed.getTime()) ? Math.floor((now - observed) / 86400000) : null;
      const freshness = ageDays === null ? "source_reference" : ageDays <= 31 ? "recent" : ageDays <= 180 ? "older" : "stale";
      return { ...record, freshness, is_current: freshness === "recent" };
    });
    const datedBySeries = new Map();
    for (const record of records) {
      if (!record.observed_date || record.price === null || record.price === undefined) continue;
      const key = [record.country_code, record.market, record.commodity, record.currency, record.unit].join("|");
      if (!datedBySeries.has(key)) datedBySeries.set(key, []);
      datedBySeries.get(key).push(record);
    }
    for (const series of datedBySeries.values()) {
      series.sort((a,b) => String(a.observed_date).localeCompare(String(b.observed_date)));
      for (let i=0; i<series.length; i++) {
        const current = series[i];
        const previous = series[i-1];
        if (!previous) {
          current.trend = "baseline";
          continue;
        }
        const change = Number(current.price) - Number(previous.price);
        const pct = Number(previous.price) ? (change / Number(previous.price)) * 100 : null;
        current.previous_price = previous.price;
        current.previous_observed_date = previous.observed_date;
        current.change = Number(change.toFixed(2));
        current.change_percent = pct === null ? null : Number(pct.toFixed(2));
        current.trend = change > 0 ? "rising" : change < 0 ? "falling" : "stable";
        current.market_signal = pct === null ? "none" : Math.abs(pct) >= 20 ? "strong_move" : Math.abs(pct) >= 10 ? "notable_move" : "normal_move";
      }
    }
    data.records = records;
    data.total = data.records.length;
    data.current_total = data.records.filter(r => r.is_current).length;
    data.source_reference_total = data.records.filter(r => r.freshness === "source_reference").length;
    data.commodities = [...new Set(data.records.map(r => r.commodity).filter(Boolean))].sort();
    data.price_types = [...new Set(data.records.map(r => r.price_type).filter(Boolean))].sort();
    data.freshness_totals = {
      recent: data.records.filter(r => r.freshness === "recent").length,
      older: data.records.filter(r => r.freshness === "older").length,
      stale: data.records.filter(r => r.freshness === "stale").length,
      source_reference: data.source_reference_total
    };
    return data;
  });

  // Cross-directory agricultural knowledge connections: country, topic/value chain and intelligence section counts.
  eleventyConfig.addGlobalData("agriculturalKnowledgeConnections", () => {
    const fs = require("fs");
    const path = require("path");
    const dataDir = path.join(process.cwd(), "src/_data");
    const read = name => JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf8"));
    const opp = (read("agriculturalOpportunities.json").records || []).filter(isPublishableAgriculturalRecord);
    const markets = (read("agriculturalMarkets.json").records || []).filter(isPublishableAgriculturalRecord);
    const services = (read("agriculturalServices.json").records || []).filter(isPublishableAgriculturalRecord);
    const news = collectPublishableNews(read);
    const resources = collectPublishableResources(read);
    const countries = new Map();
    const ensure = (code, name) => {
      if (!code) return null;
      if (!countries.has(code)) countries.set(code, { code, country: name || code, sections: {}, topics: new Set() });
      return countries.get(code);
    };
    const add = (code, name, section, text) => {
      const c = ensure(code, name); if (!c) return;
      c.sections[section] = (c.sections[section] || 0) + 1;
      String(text || "").toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 4).forEach(w => c.topics.add(w));
    };
    for (const r of opp) add(r.code || r.country_code, r.country, "opportunities", [r.title, r.summary, ...(r.tags || [])].join(" "));
    for (const r of markets) if (r.country_code && r.country_code !== "ALL") add(r.country_code, r.country, "markets", [r.commodity, r.market].join(" "));
    for (const r of services) add(r.country_code, r.country, "services", [r.title, r.summary, ...(r.tags || [])].join(" "));
    for (const r of news) add(r.country_code, r.country, "news", [r.title, r.summary, r.category].join(" "));
    for (const r of resources) add(r.country_code || r.code, r.country || r.country_name, "resources", [r.title, r.description, r.summary, r.type, ...(r.tags || [])].join(" "));
    
    const records = [...countries.values()].map(c => ({
      code: c.code, country: c.country,
      sections: c.sections,
      total: Object.values(c.sections).reduce((a,b) => a + b, 0),
      topics: [...c.topics].sort()
    })).sort((a,b) => a.country.localeCompare(b.country));
    return { version: 1, generated: new Date().toISOString().slice(0, 10), records };
  });

  eleventyConfig.addGlobalData("agriculturalDecisionCentre", () => {
    const fs = require("fs"), path = require("path"), dir = path.join(process.cwd(), "src/_data");
    const read = n => JSON.parse(fs.readFileSync(path.join(dir,n), "utf8"));
    const countries = read("calculatorCountries.json").list || [];
    const markets = read("agriculturalMarkets.json").records || [];
    const opportunities = (read("agriculturalOpportunities.json").records || []).filter(isPublishableAgriculturalRecord);
    const services = (read("agriculturalServices.json").records || []).filter(isPublishableAgriculturalRecord);
    const news = collectPublishableNews(read);
    const resources = collectPublishableResources(read);
    const records=[];
    const add=(section,r,code,country,title,text,url,date,tier,status)=>{
      if(code && title) records.push({section,country_code:code,country:country||code,title,text:String(text||""),url:url||"",date:date||"",tier:tier||5,status:status||"official"});
    };
    markets.filter(isPublishableAgriculturalRecord).forEach(r=>add("markets",r,r.country_code,r.country,r.commodity||r.market||"Market information",[r.market,r.commodity,r.note].join(" "),r.source_url,r.observed_date||r.verified,r.source_tier,r.status));
    opportunities.forEach(r=>add("opportunities",r,r.country_code||r.code,r.country,r.title,[r.summary,r.type,r.category,r.target_audience,r.eligibility,(r.tags||[]).join(" ")].join(" "),r.application_url||r.source_url||r.url,r.verified||r.verified_date,r.source_tier,r.status));
    services.filter(isPublishableAgriculturalRecord).forEach(r=>add("services",r,r.country_code,r.country,r.title,[r.summary,r.category,r.type,(r.services||[]).join(" "),(r.tags||[]).join(" ")].join(" "),r.url,r.verified,r.source_tier,r.status));
    news.forEach(r=>add("news",r,r.country_code,r.country,r.title,[r.summary,r.category,r.source].join(" "),r.url,r.published,r.source_tier,r.status));
    resources.forEach(r=>add("resources",r,r.country_code,r.country,r.title,[r.description,r.type,(r.tags||[]).join(" ")].join(" "),r.url,r.verified_date||r.verified,r.source_tier,r.status));
    const topics=["maize","rice","cassava","soybean","cocoa","coffee","cashew","tea","poultry","livestock","fish","vegetables","fruits","seeds","inputs","irrigation","mechanization","finance","climate","markets"];
    const goals=[["market","Find markets & price information",["markets"]],["finance","Find finance & opportunities",["opportunities","resources"]],["inputs","Find inputs & production resources",["resources","services"]],["machinery","Find machinery & services",["services","resources"]],["training","Find training & events",["services","resources"]],["climate","Check climate, resilience & current news",["news","resources","markets"]],["all","Show my full agricultural brief",["markets","opportunities","resources","services","news"]]].map(x=>({id:x[0],label:x[1],sections:x[2]}));
    return {version:1,generated:new Date().toISOString().slice(0,10),countries:countries.map(c=>({code:c.code,name:c.name})),topics,goals,records,json:JSON.stringify(records)};
  });

  // Topic/value-chain connection layer: derive real cross-section links from published records.
  eleventyConfig.addGlobalData("agriculturalTopicConnections", () => {
    const fs = require("fs");
    const path = require("path");
    const dataDir = path.join(process.cwd(), "src/_data");
    const read = name => JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf8"));
    const topics = [
      { key:"maize", label:"Maize", aliases:["maize","corn"] },
      { key:"rice", label:"Rice", aliases:["rice","paddy"] },
      { key:"cassava", label:"Cassava", aliases:["cassava","manioc","yuca"] },
      { key:"soybean", label:"Soybean", aliases:["soybean","soybeans","soya"] },
      { key:"cocoa", label:"Cocoa", aliases:["cocoa","cacao"] },
      { key:"coffee", label:"Coffee", aliases:["coffee"] },
      { key:"cashew", label:"Cashew", aliases:["cashew"] },
      { key:"tea", label:"Tea", aliases:["tea"] },
      { key:"poultry", label:"Poultry", aliases:["poultry","chicken","broiler","layer"] },
      { key:"livestock", label:"Livestock & Dairy", aliases:["livestock","cattle","beef","dairy","milk","goat","sheep"] },
      { key:"fish", label:"Fisheries & Aquaculture", aliases:["fish","fisheries","aquaculture","tilapia","catfish"] },
      { key:"vegetables", label:"Vegetables", aliases:["vegetable","vegetables","tomato","pepper","onion"] },
      { key:"fruits", label:"Fruits", aliases:["fruit","fruits","banana","pineapple","avocado","mango"] },
      { key:"seeds", label:"Seeds", aliases:["seed","seeds","certified seed","seed multiplication"] },
      { key:"inputs", label:"Farm Inputs", aliases:["fertilizer","fertiliser","inputs","agro-input","agrochemical"] },
      { key:"irrigation", label:"Irrigation & Water", aliases:["irrigation","water management","water access","solar pumping"] },
      { key:"mechanization", label:"Mechanization", aliases:["mechanization","mechanisation","tractor","machinery","equipment"] },
      { key:"finance", label:"Agricultural Finance", aliases:["finance","funding","grant","grants","loan","investment","credit","financing"] },
      { key:"climate", label:"Climate Resilience", aliases:["climate","resilience","drought","early warning","climate-smart"] },
      { key:"markets", label:"Markets & Trade", aliases:["market","markets","trade","export","value chain","agribusiness"] }
    ];
    const items = [];
    const add = (section, r, text, countryCode, country) => {
      if (!r || !r.title) return;
      items.push({ section, title:r.title, summary:r.summary || r.description || "", text:String(text || "").toLowerCase(), country_code:countryCode || "", country:country || "", url:r.url || r.source_url || r.application_url || "" });
    };
    const opp = read("agriculturalOpportunities.json").records || [];
    const markets = read("agriculturalMarkets.json").records || [];
    const services = read("agriculturalServices.json").records || [];
    const news = collectPublishableNews(read);
    const resources = collectPublishableResources(read);
    for (const r of opp) if (isPublishableAgriculturalRecord(r)) add("opportunities", r, [r.title,r.summary,r.description,r.type,r.category,...(r.tags||[]),...(r.sectors||[]),...(r.value_chains||[])].join(" "), r.country_code || r.code, r.country);
    for (const r of markets) if (r.country_code !== "ALL" && isPublishableAgriculturalRecord(r)) add("markets", r, [r.commodity,r.market,r.note,r.price_type].join(" "), r.country_code, r.country);
    for (const r of services) if (isPublishableAgriculturalRecord(r)) add("services", r, [r.title,r.summary,r.type,r.category,r.provider,...(r.services||[]),...(r.tags||[])].join(" "), r.country_code, r.country);
    for (const r of news) add("news", r, [r.title,r.summary,r.category].join(" "), r.country_code, r.country || r.country_name);
    for (const r of resources) add("resources", r, [r.title,r.description,r.summary,r.type,...(r.tags||[])].join(" "), r.country_code || r.code, r.country || r.country_name);
    const result = topics.map(topic => {
      const matched = items.filter(item => topic.aliases.some(alias => item.text.includes(alias.toLowerCase())));
      const bySection = {};
      const countries = {};
      for (const item of matched) {
        bySection[item.section] = (bySection[item.section] || 0) + 1;
        if (item.country_code) countries[item.country_code] = countries[item.country_code] || { code:item.country_code, country:item.country, sections:{} };
        if (item.country_code) countries[item.country_code].sections[item.section] = (countries[item.country_code].sections[item.section] || 0) + 1;
      }
      return { ...topic, total:matched.length, sections:bySection, countries:Object.values(countries).sort((a,b)=>a.country.localeCompare(b.country)) };
    }).filter(topic => topic.total > 0);
    return { version:1, generated:new Date().toISOString().slice(0,10), topics:result };
  });

  // Static passthroughs
  // Build validation: localized content is rendered at build time.
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/i18n");
  eleventyConfig.addPassthroughCopy("src/images");
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.addPassthroughCopy({ "src/_redirects": "_redirects" });
  eleventyConfig.addPassthroughCopy("src/manifest.webmanifest");
  eleventyConfig.addPassthroughCopy("src/favicon.svg");

  // Merge the primary agricultural resource registry with reviewed supplement records.
  eleventyConfig.addGlobalData("agriculturalResourcesAll", () => {
    const fs = require("fs");
    const path = require("path");
    const primary = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src/_data/agriculturalResources.json"), "utf8"));
    const supplement = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src/_data/agriculturalResourcesSupplement.json"), "utf8"));
    const gapFiles = fs.readdirSync(path.join(process.cwd(), "src/_data")).filter(name => /^agriculturalResourcesGap.*\.json$/.test(name));
    const gapRecords = gapFiles.flatMap(name => { try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), "src/_data", name), "utf8")).records || []; } catch (_) { return []; } });
    const allSupplementRecords = [...(supplement.records || []), ...gapRecords.map(r => ({ ...r, lifecycle: r.lifecycle || "needs_review" }))].filter(isPublishableAgriculturalRecord);
    const categoryAliases = { "weather-climate": "climate", "policy": "general" };
    const normalisedSupplementRecords = allSupplementRecords.map(r => ({ ...r, category: categoryAliases[r.category] || r.category })).filter(r => shouldPublishAgriculturalResource(r, r.category));
    const categories = [...new Set([...(primary.categories || []), ...normalisedSupplementRecords.map(r => r.category).filter(Boolean)])];
    const countries = (primary.countries || []).map(c => ({
      ...c,
      records: Object.fromEntries(categories.map(cat => [cat, [...(c.records?.[cat] || [])].filter(r => shouldPublishAgriculturalResource(r, cat))]))
    }));
    const byCode = new Map(countries.map(c => [c.code, c]));

    for (const r of normalisedSupplementRecords) {
      const c = byCode.get(r.country_code);
      if (!c || !r.category) continue;
      c.records[r.category] = c.records[r.category] || [];
      const key = `${r.country_code}|${r.category}|${r.url}|${r.title}`;
      if (!c.records[r.category].some(x => `${c.code}|${r.category}|${x.url}|${x.title}` === key)) c.records[r.category].push(r);
    }

    const sharedByUrl = new Map();
    for (const c of countries) for (const cat of categories) for (const r of c.records[cat] || []) {
      if (!r.url) continue;
      if (!sharedByUrl.has(r.url)) sharedByUrl.set(r.url, new Set());
      sharedByUrl.get(r.url).add(c.code);
    }

    for (const c of countries) for (const cat of categories) {
      c.records[cat] = (c.records[cat] || []).map(r => {
        const shared = r.url ? [...(sharedByUrl.get(r.url) || [])] : [];
        return shared.length > 1 ? { ...r, shared_coverage: shared } : r;
      });
      c.total = categories.reduce((n, category) => n + (c.records[category] || []).length, 0);
    }

    return { ...primary, categories, countries, total: countries.reduce((n, c) => n + c.total, 0) };
  });

  // Regional agricultural intelligence layer: shared initiatives and corridors spanning multiple countries.
  eleventyConfig.addGlobalData("agriculturalRegionalIntelligence", () => {
    const fs = require("fs");
    const path = require("path");
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), "src/_data/agriculturalRegionalIntelligence.json"), "utf8"));
  });

  // Merge primary agricultural news with reviewed supplement and expansion records.
  eleventyConfig.addGlobalData("agriculturalNewsMerged", () => {
    const fs = require("fs");
    const path = require("path");
    const dataDir = path.join(process.cwd(), "src/_data");
    const primary = JSON.parse(fs.readFileSync(path.join(dataDir, "agriculturalNews.json"), "utf8"));
    const supplement = JSON.parse(fs.readFileSync(path.join(dataDir, "agriculturalNewsSupplement.json"), "utf8"));
    const expansion = JSON.parse(fs.readFileSync(path.join(dataDir, "agriculturalNewsExpansion.json"), "utf8"));
    const countries = (primary.countries || []).map(c => ({
      ...c,
      // The primary country feeds can contain repeated URLs under slightly
      // different headlines. Keep one public card per country/source URL.
      articles: dedupeAgriculturalRecords(
        (c.articles || []).filter(article => isPublishableAgriculturalRecord(article) && article.title && isSpecificAgriculturalNewsUrl(article.url)).map(article => ({
          ...article,
          country_code: article.country_code || c.code
        }))
      ).map(({ country_code, ...article }) => article)
    }));
    const byCode = new Map(countries.map(c => [c.code, c]));
    // Some approved supplement records use "headline" rather than "title".
    // Normalize the schema, but keep generic listing pages out of public news.
    const incoming = [...(supplement.records || []), ...(expansion.records || [])]
      .map(article => ({ ...article, title: article.title || article.headline || "" }))
      .filter(article => isPublishableAgriculturalRecord(article) && article.title && isSpecificAgriculturalNewsUrl(article.url));

    for (const article of incoming) {
      const country = byCode.get(article.country_code);
      if (!country || !article.title || !article.url) continue;
      const duplicate = country.articles.some(existing =>
        existing.url === article.url ||
        (existing.title === article.title && existing.published === article.published)
      );
      if (!duplicate) country.articles.push({
        category: article.category || "general",
        title: article.title,
        summary: article.summary || "",
        url: article.url,
        source: article.source || "",
        published: article.published || "",
        verified: article.verified || "",
        status: article.status || "official"
      });
    }

    const now = new Date();
    const historicalCutoff = new Date(now);
    historicalCutoff.setUTCDate(historicalCutoff.getUTCDate() - 180);

    for (const country of countries) {
      country.articles = country.articles.map(article => {
        const explicitStatus = String(article.status || "official").toLowerCase();
        const deadline = article.deadline || article.expiry_date || article.closing_date || "";
        const deadlineDate = deadline ? new Date(deadline) : null;
        let lifecycle = "current";

        if (["expired", "closed"].includes(explicitStatus) || (deadlineDate && !Number.isNaN(deadlineDate.getTime()) && deadlineDate < now)) {
          lifecycle = "expired";
        } else if (["archived", "historical"].includes(explicitStatus)) {
          lifecycle = "historical";
        } else if (article.published) {
          const publishedDate = new Date(article.published);
          if (!Number.isNaN(publishedDate.getTime()) && publishedDate < historicalCutoff) lifecycle = "historical";
        }

        return {
          ...article,
          lifecycle,
          is_current: lifecycle === "current",
          is_expired: lifecycle === "expired",
          is_historical: lifecycle === "historical"
        };
      });

      country.articles.sort((a, b) => String(b.published || "").localeCompare(String(a.published || "")));
      country.total = country.articles.length;
      country.current_total = country.articles.filter(a => a.is_current).length;
      country.historical_total = country.articles.filter(a => a.is_historical).length;
      country.expired_total = country.articles.filter(a => a.is_expired).length;
    }

    return {
      ...primary,
      countries,
      total: countries.reduce((sum, country) => sum + country.articles.length, 0),
      last_updated: new Date().toISOString().slice(0, 10)
    };
  });

  // Collections
  eleventyConfig.addCollection("ebooks", function (collectionApi) {
    return collectionApi.getFilteredByGlob("src/ebooks/*.md").filter((item) => item.data.active !== false).sort((a, b) => {
      return (a.data.order || 99) - (b.data.order || 99);
    });
  });

  eleventyConfig.addCollection("blogCategories", function (collectionApi) {
    return collectionApi.getFilteredByGlob("src/blog-categories/*.md").filter((item) => item.data.active !== false).sort((a, b) => {
      return (a.data.order || 99) - (b.data.order || 99);
    });
  });

  eleventyConfig.addCollection("posts", function (collectionApi) {
    return collectionApi.getFilteredByGlob("src/blog/posts/*.md").filter((item) => item.data.active !== false).sort((a, b) => {
      return (b.date || 0) - (a.date || 0);
    });
  });

  // Filters
  eleventyConfig.addFilter("readableDate", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("dd LLL yyyy");
  });

  eleventyConfig.addFilter("currency", (value) => {
    if (!value) return "";
    return "\u20A6" + Number(value).toLocaleString("en-NG");
  });

  eleventyConfig.addFilter("jsonify", (value) => JSON.stringify(value));

  eleventyConfig.addFilter("findByDataSlug", (items, slug) => {
    return (items || []).find((item) => item && item.data && item.data.slug === slug);
  });

  eleventyConfig.addFilter("filterByLanguage", (items, language) => {
    const targetLanguage = language || "en";
    return (items || []).filter((item) => item && item.data &&
      (item.data.language || "en") === targetLanguage &&
      (item.data.active !== false) &&
      (item.data.translation_status || "published") !== "in_review");
  });

  // Find the localized version of a content item by stable slug and language.
  eleventyConfig.addFilter("findByDataSlugAndLanguage", (items, slug, language) => {
    const targetLanguage = language || "en";
    return (items || []).find((item) => item && item.data &&
      item.data.slug === slug &&
      (item.data.language || "en") === targetLanguage &&
      (item.data.translation_status || "published") !== "in_review");
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "_site",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};