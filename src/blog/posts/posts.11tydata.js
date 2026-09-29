module.exports = {
  eleventyComputed: {
    // Keep inactive posts out of generated output while giving every
    // published translation a stable language-aware article URL.
    permalink: (data) => {
      if (data.active === false) return false;
      const lang = data.language || "en";
      const slug = data.slug || data.page?.fileSlug;
      if (!slug) return undefined;
      return lang === "en"
        ? `/blog/${slug}/`
        : `/${lang}/blog/${slug}/`;
    }
  }
};
