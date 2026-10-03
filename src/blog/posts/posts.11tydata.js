module.exports = {
  eleventyComputed: {
    // Localized article URLs are authoritative. If a post already declares an
    // explicit permalink, preserve it exactly. This prevents the language
    // layer from rewriting a readable article URL unexpectedly.
    permalink: (data) => {
      if (data.active === false) return false;
      if (typeof data.permalink === "string" && data.permalink.trim()) {
        return data.permalink.trim();
      }

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
