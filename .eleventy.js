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