module.exports = {
  eleventyComputed: {
    // Keep inactive posts out of generated output. Respect an explicit
    // permalink first; otherwise generate the stable language-prefixed slug.
    permalink: (data) => {
      if (data.active === false) return false;
      if (data.permalink) return data.permalink;
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