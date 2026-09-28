function baseSlug(slug) {
  const value = String(slug || "");
  return value.replace(/-(fr|ar|pt|sw)$/, "");
}

module.exports = {
  eleventyComputed: {
    permalink: (data) => {
      if (data.active === false) return false;
      const slug = baseSlug(data.slug);
      const language = data.language || "en";
      return language === "en"
        ? `/blog/${slug}/`
        : `/${language}/blog/${slug}/`;
    }
  }
};
