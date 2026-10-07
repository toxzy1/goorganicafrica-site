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

  // Merge the primary agricultural resource registry with reviewed supplement records.\n  eleventyConfig.addGlobalData("agriculturalResourcesAll", () => {\n    const fs = require("fs");\n    const path = require("path");\n    const primary = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src/_data/agriculturalResources.json"), "utf8"));\n    const supplement = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src/_data/agriculturalResourcesSupplement.json"), "utf8"));\n    const categories = [...new Set([...(primary.categories || []), ...(supplement.records || []).map(r => r.category).filter(Boolean)])];\n    const countries = (primary.countries || []).map(c => ({ ...c, records: Object.fromEntries(categories.map(cat => [cat, [...(c.records?.[cat] || [])]])) }));\n    const byCode = new Map(countries.map(c => [c.code, c]));\n    for (const r of supplement.records || []) {\n      const c = byCode.get(r.country_code);\n      if (!c || !r.category) continue;\n      c.records[r.category] = c.records[r.category] || [];\n      const key = `${r.country_code}|${r.category}|${r.url}|${r.title}`;\n      if (!c.records[r.category].some(x => `${c.code}|${r.category}|${x.url}|${x.title}` === key)) c.records[r.category].push(r);\n    }\n    for (const c of countries) c.total = categories.reduce((n, cat) => n + (c.records[cat] || []).length, 0);\n    return { ...primary, categories, countries, total: countries.reduce((n, c) => n + c.total, 0) };\n  });\n\n  // Collections\n  eleventyConfig.addCollection("ebooks", function (collectionApi) {
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