module.exports = {
  eleventyComputed: {
    // Active posts are published normally; inactive posts are not emitted to _site.
    permalink: (data) => data.active === false ? false : `/blog/${data.slug}/`
  }
};
