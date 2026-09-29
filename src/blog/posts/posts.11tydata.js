module.exports = {
  eleventyComputed: {
    permalink: (data) => {
      const lang = data.language || "en";
      const slug = data.slug || data.page?.fileSlug;
      if (!slug) return undefined;
      return lang === "en"
        ? `/blog/${slug}/`
        : `/${lang}/blog/${slug}/`;
    }
  }
};
