module.exports = {
  eleventyComputed: {
    // Active guides are published normally; inactive guides are not emitted to _site.
    permalink: (data) => data.active === false ? false : `/ebooks/${data.slug}/`
  }
};
