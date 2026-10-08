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