const { DateTime } = require("luxon");

module.exports = function (eleventyConfig) {
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
    const categories = [...new Set([...(primary.categories || []), ...(supplement.records || []).map(r => r.category).filter(Boolean)])];
    const countries = (primary.countries || []).map(c => ({
      ...c,
      records: Object.fromEntries(categories.map(cat => [cat, [...(c.records?.[cat] || [])]]))
    }));
    const byCode = new Map(countries.map(c => [c.code, c]));

    for (const r of supplement.records || []) {
      const c = byCode.get(r.country_code);
      if (!c || !r.category) continue;
      c.records[r.category] = c.records[r.category] || [];
      const key = `${r.country_code}|${r.category}|${r.url}|${r.title}`;
      if (!c.records[r.category].some(x => `${c.code}|${r.category}|${x.url}|${x.title}` === key)) {
        c.records[r.category].push(r);
      }
    }

    const sharedByUrl = new Map();
    for (const c of countries) {
      for (const cat of categories) {
        for (const r of c.records[cat] || []) {
          if (!r.url) continue;
          if (!sharedByUrl.has(r.url)) sharedByUrl.set(r.url, new Set());
          sharedByUrl.get(r.url).add(c.code);
        }
      }
    }

    for (const c of countries) {
      for (const cat of categories) {
        c.records[cat] = (c.records[cat] || []).map(r => {
          const shared = r.url ? [...(sharedByUrl.get(r.url) || [])] : [];
          return shared.length > 1 ? { ...r, shared_coverage: shared } : r;
        });
      }
      c.total = categories.reduce((n, cat) => n + (c.records[cat] || []).length, 0);
    }

    return { ...primary, categories, countries, total: countries.reduce((n, c) => n + c.total, 0) };
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

  eleventyConfig.addFilter("jsonify", (value) => {
    return JSON.stringify(value);
  });

  eleventyConfig.addFilter("findByDataSlug", (items, slug) => {
    return (items || []).find((item) => item && item.data && item.data.slug === slug);
  });

  eleventyConfig.addFilter("filterByLanguage", (items, language) => {
    const targetLanguage = language || "en";
    return (items || []).filter((item) => {
      return item && item.data &&
        (item.data.language || "en") === targetLanguage &&
        (item.data.active !== false) &&
        (item.data.translation_status || "published") !== "in_review";
    });
  });

  // Find the localized version of a content item by stable slug and language.
  eleventyConfig.addFilter("findByDataSlugAndLanguage", (items, slug, language) => {
    const targetLanguage = language || "en";
    return (items || []).find((item) => {
      return item && item.data &&
        item.data.slug === slug &&
        (item.data.language || "en") === targetLanguage &&
        (item.data.translation_status || "published") !== "in_review";
    });
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