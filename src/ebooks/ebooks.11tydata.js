function baseSlug(slug) {
  const value = String(slug || "");
  return value.replace(/-(fr|ar|pt|sw)$/, "");
}

module.exports = {
  eleventyComputed: {
    // Active guides are published normally; localized guides get language-specific URLs.
    permalink: (data) => {
      if (data.active === false) return false;
      const slug = baseSlug(data.slug);
      const language = data.language || "en";
      return language === "en"
        ? `/ebooks/${slug}/`
        : `/${language}/ebooks/${slug}/`;
    }
  }
};
