const { DateTime } = require("luxon");

module.exports = function (eleventyConfig) {

  // Agricultural opportunities: unified current/expired lifecycle registry.
  eleventyConfig.addGlobalData("agriculturalOpportunities", () => {
    const fs = require("fs");
    const path = require("path");
    const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src/_data/agriculturalOpportunities.json"), "utf8"));
    const now = new Date("2026-10-08T00:00:00Z");
    data.records = (data.records || []).map(record => {
      const deadline = record.deadline ? new Date(record.deadline + "T23:59:59Z") : null;
      const expired = String(record.status || "").toLowerCase() === "expired" || (deadline && !Number.isNaN(deadline.getTime()) && deadline < now);
      return { ...record, lifecycle: expired ? "expired" : "current", is_current: !expired, is_expired: expired };
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
    const records = (data.records || []).map(record => ({
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
    const now = new Date("2026-10-08T00:00:00Z");
    const records = (data.records || []).map(record => {
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
    const opp = read("agriculturalOpportunities.json").records || [];
    const markets = read("agriculturalMarkets.json").records || [];
    const services = read("agriculturalServices.json").records || [];
    const news = read("agriculturalNewsExpansion.json").records || [];
    const resourcesPrimary = read("agriculturalResources.json").countries || [];
    const resourcesSupplement = read("agriculturalResourcesSupplement.json").records || [];
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
    for (const country of resourcesPrimary) {
      const text = Object.values(country.records || {}).flat().map(r => [r.title, r.description, r.type, ...(r.tags || [])].join(" ")).join(" ");
      if (text) add(country.code, country.name || country.country, "resources", text);
    }
    for (const r of resourcesSupplement) add(r.country_code, r.country, "resources", [r.title, r.description, r.type, ...(r.tags || [])].join(" "));
    const records = [...countries.values()].map(c => ({
      code: c.code, country: c.country,
      sections: c.sections,
      total: Object.values(c.sections).reduce((a,b) => a + b, 0),
      topics: [...c.topics].sort()
    })).sort((a,b) => a.country.localeCompare(b.country));
    return { version: 1, generated: "2026-10-08", records };
  });

  eleventyConfig.addGlobalData("agriculturalDecisionCentre", () => {
    const fs = require("fs"), path = require("path"), dir = path.join(process.cwd(), "src/_data");
    const read = n => JSON.parse(fs.readFileSync(path.join(dir,n), "utf8"));
    const countries = read("calculatorCountries.json").list || [];
    const markets = read("agriculturalMarkets.json").records || [];
    const opportunities = read("agriculturalOpportunities.json").records || [];
    const services = read("agriculturalServices.json").records || [];
    const news = [];
    const primaryNews = read("agriculturalNews.json").countries || [];
    primaryNews.forEach(c => (c.articles||[]).forEach(a => news.push({...a,country_code:c.code,country:c.name})));
    news.push(...(read("agriculturalNewsSupplement.json").records||[]),...(read("agriculturalNewsExpansion.json").records||[]));
    const resources = [];
    (read("agriculturalResources.json").countries||[]).forEach(c => Object.values(c.records||{}).flat().forEach(r=>resources.push({...r,country_code:c.code,country:c.name})));
    resources.push(...(read("agriculturalResourcesSupplement.json").records||[]));
    const records=[];
    const add=(section,r,code,country,title,text,url,date,tier,status)=>{
      if(code && title) records.push({section,country_code:code,country:country||code,title,text:String(text||""),url:url||"",date:date||"",tier:tier||5,status:status||"official"});
    };
    markets.forEach(r=>add("markets",r,r.country_code,r.country,r.commodity||r.market||"Market information",[r.market,r.commodity,r.note].join(" "),r.source_url,r.observed_date||r.verified,r.source_tier,r.status));
    opportunities.forEach(r=>add("opportunities",r,r.country_code||r.code,r.country,r.title,[r.summary,r.type,r.category,r.target_audience,r.eligibility,(r.tags||[]).join(" ")].join(" "),r.application_url||r.source_url||r.url,r.verified||r.verified_date,r.source_tier,r.status));
    services.forEach(r=>add("services",r,r.country_code,r.country,r.title,[r.summary,r.category,r.type,(r.services||[]).join(" "),(r.tags||[]).join(" ")].join(" "),r.url,r.verified,r.source_tier,r.status));
    news.forEach(r=>add("news",r,r.country_code,r.country,r.title,[r.summary,r.category,r.source].join(" "),r.url,r.published,r.source_tier,r.status));
    resources.forEach(r=>add("resources",r,r.country_code,r.country,r.title,[r.description,r.type,(r.tags||[]).join(" ")].join(" "),r.url,r.verified_date||r.verified,r.source_tier,r.status));
    const topics=["maize","rice","cassava","soybean","cocoa","coffee","cashew","tea","poultry","livestock","fish","vegetables","fruits","seeds","inputs","irrigation","mechanization","finance","climate","markets"];
    const goals=[["market","Find markets & price information",["markets"]],["finance","Find finance & opportunities",["opportunities","resources"]],["inputs","Find inputs & production resources",["resources","services"]],["machinery","Find machinery & services",["services","resources"]],["training","Find training & events",["services","resources"]],["climate","Check climate, resilience & current news",["news","resources","markets"]],["all","Show my full agricultural brief",["markets","opportunities","resources","services","news"]]].map(x=>({id:x[0],label:x[1],sections:x[2]}));
    return {version:1,generated:"2026-10-08",countries:countries.map(c=>({code:c.code,name:c.name})),topics,goals,records,json:JSON.stringify(records)};
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
    const news = read("agriculturalNews.json");
    const newsSupplement = read("agriculturalNewsSupplement.json").records || [];
    const newsExpansion = read("agriculturalNewsExpansion.json").records || [];
    const resources = read("agriculturalResources.json").countries || [];
    const resourceSupplement = read("agriculturalResourcesSupplement.json").records || [];
    const gapFiles = fs.readdirSync(dataDir).filter(name => /^agriculturalResourcesGap.*\.json$/.test(name));
    const resourceGaps = gapFiles.flatMap(name => { try { return JSON.parse(fs.readFileSync(path.join(dataDir,name),"utf8")).records || []; } catch (_) { return []; } });
    for (const r of opp) add("opportunities", r, [r.title,r.summary,r.description,r.type,r.category,...(r.tags||[]),...(r.sectors||[]),...(r.value_chains||[])].join(" "), r.country_code || r.code, r.country);
    for (const r of markets) if (r.country_code !== "ALL") add("markets", r, [r.commodity,r.market,r.note,r.price_type].join(" "), r.country_code, r.country);
    for (const r of services) add("services", r, [r.title,r.summary,r.type,r.category,r.provider,...(r.services||[]),...(r.tags||[])].join(" "), r.country_code, r.country);
    for (const c of (news.countries || [])) for (const r of (c.articles || [])) add("news", r, [r.title,r.summary,r.category].join(" "), c.code, c.name || c.country);
    for (const r of [...newsSupplement,...newsExpansion]) add("news", r, [r.title,r.summary,r.category].join(" "), r.country_code, r.country);
    for (const c of resources) for (const list of Object.values(c.records || {})) for (const r of (list || [])) add("resources", r, [r.title,r.description,r.summary,r.type,...(r.tags||[])].join(" "), c.code, c.name || c.country);
    for (const r of [...resourceSupplement,...resourceGaps]) add("resources", r, [r.title,r.description,r.summary,r.type,...(r.tags||[])].join(" "), r.country_code, r.country);
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
    return { version:1, generated:"2026-10-08", topics:result };
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
    const allSupplementRecords = [...(supplement.records || []), ...gapRecords];
    const categoryAliases = { "weather-climate": "climate", "policy": "general" };
    const normalisedSupplementRecords = allSupplementRecords.map(r => ({ ...r, category: categoryAliases[r.category] || r.category }));
    const categories = [...new Set([...(primary.categories || []), ...normalisedSupplementRecords.map(r => r.category).filter(Boolean)])];
    const countries = (primary.countries || []).map(c => ({
      ...c,
      records: Object.fromEntries(categories.map(cat => [cat, [...(c.records?.[cat] || [])]]))
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
    const countries = (primary.countries || []).map(c => ({ ...c, articles: [...(c.articles || [])] }));
    const byCode = new Map(countries.map(c => [c.code, c]));
    const incoming = [...(supplement.records || []), ...(expansion.records || [])];

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

    const now = new Date("2026-10-08T00:00:00Z");
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
      last_updated: "2026-10-08"
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