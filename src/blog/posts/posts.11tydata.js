module.exports = {
  eleventyComputed: {
    // Keep inactive posts out of generated output while giving every
    // translation the same stable article slug under its language prefix.
    permalink: (data) => {
      if (data.active === false) return false;
      const lang = data.language || "en";
      const rawSlug = data.slug || data.page?.fileSlug;
      if (!rawSlug) return undefined;
      const slug = rawSlug.replace(/-(fr|ar|pt|sw)$/, "");
      return lang === "en"
        ? `/blog/${slug}/`
        : `/${lang}/blog/${slug}/`;
    }
  }
};
