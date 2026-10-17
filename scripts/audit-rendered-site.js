// Rendered-site release audit; executed by the build workflow for review-candidate PRs.
const fs = require("fs");
const path = require("path");
const site = path.join(__dirname, "..", "_site");
const source = path.join(__dirname, "..", "src");
if (!fs.existsSync(site)) throw new Error("Rendered site is missing.");

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full)); else out.push(full);
  }
  return out;
}
const failures = [];
const emptyNewsPages = [];
const htmlFiles = walk(site).filter(f => f.endsWith(".html"));

// SEO metadata regression guard: Eleventy front matter must not leak Nunjucks
// interpolation into rendered titles or meta content attributes.
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, "utf8");
  const rel = path.relative(site, file).split(path.sep).join("/");
  const headMatch = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  if (headMatch) {
    const head = headMatch[1];
    for (const match of head.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)) {
      if (match[1].includes("{{")) failures.push(rel + ": raw Nunjucks interpolation found in <title>");
    }
    for (const metaMatch of head.matchAll(/<meta\b[^>]*>/gi)) {
      const contentMatch = metaMatch[0].match(/\bcontent\s*=\s*(["'])([\s\S]*?)\1/i);
      if (contentMatch && contentMatch[2].includes("{{")) {
        failures.push(rel + ": raw Nunjucks interpolation found in meta content");
      }
    }
  }
  if (html.includes('data-i18n="home.directoryNote"')) {
    failures.push(rel + ": internal home.directoryNote editor note leaked into rendered HTML");
  }
}


function read(rel) {
  const p = path.join(site, rel);
  if (!fs.existsSync(p)) { failures.push("Missing rendered page: " + rel); return ""; }
  return fs.readFileSync(p, "utf8");
}
const selectorCount = (html) => (html.match(/class="[^"]*site-language-select[^"]*"/gi) || []).length;

function cardHrefs(html) {
  const out = [];
  const patterns = [
    /<a\b[^>]*class=["'][^"']*ebook-card[^"']*["'][^>]*href=["']([^"']+)["']/gi,
    /<a\b[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*ebook-card[^"']*["']/gi,
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>\s*<div class=["'][^"']*ebook-card[^"']*["']/gi
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(html))) out.push(m[1]);
  }
  return out;
}

// The five public blog indexes are mandatory. Previously these checks silently
// skipped missing localized indexes, allowing a broken build to pass.
for (const [rel, lang] of [
  ["blog/index.html","en"],["fr/blog/index.html","fr"],["ar/blog/index.html","ar"],
  ["pt/blog/index.html","pt"],["sw/blog/index.html","sw"]
]) {
  const html = read(rel);
  if (!html) continue;
  const expectedPrefix = lang === "en" ? "/blog/" : "/" + lang + "/blog/";
  const cards = cardHrefs(html);
  if (cards.length !== new Set(cards).size) failures.push(rel + ": duplicate section card links");
  if (cards.some(h => h.includes("/blog/") && !h.startsWith(expectedPrefix))) {
    failures.push(rel + ": section contains blog cards from another language");
  }
}

// Verify every published source post has a rendered URL, and every translation
// group has exactly one published page in each enabled language.
const postDir = path.join(source, "blog", "posts");
const postFiles = fs.existsSync(postDir) ? fs.readdirSync(postDir).filter(n => n.endsWith(".md")) : [];
const groups = new Map();
for (const name of postFiles) {
  const raw = fs.readFileSync(path.join(postDir, name), "utf8");
  const fm = (raw.match(/^---\n([\s\S]*?)\n---/) || [,""])[1];
  const lang = (fm.match(/^language:\s*([^\n\r]+)/m) || [,"en"])[1].trim().replace(/^["']|["']$/g, "");
  const slug = (fm.match(/^slug:\s*([^\n\r]+)/m) || [,""])[1].trim().replace(/^["']|["']$/g, "");
  const group = (fm.match(/^translation_group:\s*([^\n\r]+)/m) || [,""])[1].trim().replace(/^["']|["']$/g, "");
  const status = (fm.match(/^translation_status:\s*([^\n\r]+)/m) || [,"published"])[1].trim().replace(/^["']|["']$/g, "");
  const active = !/^active:\s*false$/m.test(fm);
  if (!active || status === "in_review" || !slug) continue;
  const base = slug.replace(/-(fr|ar|pt|sw)$/, "");
  const url = lang === "en" ? "/blog/" + base + "/" : "/" + lang + "/blog/" + base + "/";
  const target = path.join(site, url.replace(/^\//, ""), "index.html");
  if (!fs.existsSync(target)) failures.push("Source post does not render: " + name + " -> " + url);
  if (group) {
    if (!groups.has(group)) groups.set(group, new Map());
    const byLang = groups.get(group);
    if (byLang.has(lang)) failures.push("Duplicate published post language in " + group + ": " + lang);
    byLang.set(lang, url);
  }
}
for (const [group, byLang] of groups) {
  for (const lang of ["en","fr","ar","pt","sw"]) {
    if (!byLang.has(lang)) failures.push("Translation group " + group + " is missing published " + lang + " blog post");
  }
}

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, "utf8");
  if (html.includes('id="goa-language-targets"')) {
    const mapAttrs = {};
    for (const m of html.matchAll(/data-url-(en|fr|ar|pt|sw)=["']([^"']+)["']/gi)) {
      if (mapAttrs[m[1]]) failures.push(path.relative(site, file) + ": duplicate target for " + m[1]);
      mapAttrs[m[1]] = m[2];
    }
    const visible = {};
    for (const m of html.matchAll(/class=["'][^"']*translation-links[^"']*[\s\S]*?<\/div>/gi)) {
      for (const a of m[0].matchAll(/<a\b[^>]*data-language=["'](en|fr|ar|pt|sw)["'][^>]*href=["']([^"']+)["']/gi)) {
        visible[a[1]] = a[2];
      }
    }
    const selectorOptions = new Set();
    for (const m of html.matchAll(/<select\b[^>]*class=["\'][^"\']*site-language-select[^"\']*["\'][^>]*>([\s\S]*?)<\/select>/gi)) {
      for (const opt of m[1].matchAll(/<option\b[^>]*value=["\'](en|fr|ar|pt|sw)["\']/gi)) selectorOptions.add(opt[1]);
    }
    for (const lang of ["en","fr","ar","pt","sw"]) {
      if (!mapAttrs[lang]) failures.push(path.relative(site, file) + ": missing language target for " + lang);
      else {
        if (Object.keys(visible).length && visible[lang] !== mapAttrs[lang]) failures.push(path.relative(site, file) + ": language target mismatch for " + lang);
        if (!Object.keys(visible).length && !selectorOptions.has(lang)) failures.push(path.relative(site, file) + ": language selector missing option for " + lang);
        const targetFile = path.join(site, mapAttrs[lang].replace(/^\//, ""), "index.html");
        if (!fs.existsSync(targetFile)) failures.push(path.relative(site, file) + ": target does not render for " + lang + ": " + mapAttrs[lang]);
      }
    }
  }
  const rel = path.relative(site, file);
  if (!/farm-profit-calculator/.test(rel) && !/^admin\//.test(rel)) {
    if ((html.match(/<main\b/gi) || []).length !== 1) failures.push(rel + ": expected exactly one <main>");
    if (!["markets/index.html","opportunities/index.html","agricultural-services/index.html"].includes(rel) && (html.match(/<header\b/gi) || []).length !== 1) failures.push(rel + ": expected exactly one <header>");
  }
  // The site-wide selector is a shared layout contract. Catch missing or
  // duplicated selectors on every visitor-facing page, not only directory pages.
  if (!/farm-profit-calculator/.test(rel) && !/^admin\//.test(rel)) {
    const selectors = (html.match(/class="[^"]*site-language-select[^"]*"/gi) || []).length;
    if (selectors !== 1) failures.push(rel + ": expected exactly one site language selector, found " + selectors);
    const selectorOptions = new Set();
    for (const select of html.matchAll(/<select\b[^>]*class=["'][^"']*site-language-select[^"']*["'][^>]*>([\s\S]*?)<\/select>/gi)) {
      for (const option of select[1].matchAll(/<option\b[^>]*value=["'](en|fr|ar|pt|sw)["']/gi)) selectorOptions.add(option[1]);
    }
    for (const lang of ["en", "fr", "ar", "pt", "sw"]) {
      if (!selectorOptions.has(lang)) failures.push(rel + ": language selector is missing option " + lang);
    }
  }
  // Every generated country-news page must link to the matching country slug
  // in all five language trees. This catches accidental homepage fallbacks,
  // guessed slugs, and language options that lead to nonexistent pages.
  const countryNewsRoute = rel.match(/^(?:(fr|ar|pt|sw)\/)?agricultural-news\/([^/]+)\/index\.html$/);
  if (countryNewsRoute) {
    const slug = countryNewsRoute[2];
    const targets = {};
    for (const match of html.matchAll(/data-url-(en|fr|ar|pt|sw)=["']([^"']+)["']/gi)) targets[match[1]] = match[2];
    for (const lang of ["en", "fr", "ar", "pt", "sw"]) {
      const expected = "/" + (lang === "en" ? "" : lang + "/") + "agricultural-news/" + slug + "/";
      if (targets[lang] !== expected) failures.push(rel + ": language target " + lang + " should be " + expected + ", found " + (targets[lang] || "(missing)"));
      const targetFile = path.join(site, expected.replace(/^\//, ""), "index.html");
      if (!fs.existsSync(targetFile)) failures.push(rel + ": language target does not render for " + lang + ": " + expected);
    }
  }
  if (/content-variant|data-content-group|data-content-language|data-content-slug/.test(html)) {
    failures.push(rel + ": legacy content-variant markup remains");
  }
  const ids = new Set(), dup = new Set();
  const idRe = /\bid=["']([^"']+)["']/gi;
  let m;
  while ((m = idRe.exec(html))) { if (ids.has(m[1])) dup.add(m[1]); ids.add(m[1]); }
  if (dup.size) failures.push(rel + ": duplicate HTML ids: " + [...dup].join(", "));
}

for (const [rel, lang] of [["index.html","en"],["fr/index.html","fr"],["ar/index.html","ar"],["pt/index.html","pt"],["sw/index.html","sw"]]) {
  const html = read(rel);
  if (!html) continue;
  const cards = cardHrefs(html);
  if (cards.length !== new Set(cards).size) failures.push(rel + ": duplicate homepage card links");
  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map(x => x[1]);
  const ebookPrefix = lang === "en" ? "/ebooks/" : "/" + lang + "/ebooks/";
  const blogPrefix = lang === "en" ? "/blog/" : "/" + lang + "/blog/";
  const ebookLinks = hrefs.filter(h => /\/ebooks\/[^/]+/.test(h));
  const blogLinks = hrefs.filter(h => /\/blog\/[^/]+/.test(h));
  if (!hrefs.some(h => h === ebookPrefix)) failures.push(rel + ": no eBook section link rendered");
  if (!hrefs.some(h => h === blogPrefix)) failures.push(rel + ": no blog section link rendered");
  if (ebookLinks.some(h => /\/((fr|ar|pt|sw)\/)?ebooks\//.test(h) && !h.startsWith(ebookPrefix))) failures.push(rel + ": homepage contains eBook links from another language");
  if (blogLinks.some(h => /\/((fr|ar|pt|sw)\/)?blog\//.test(h) && !h.startsWith(blogPrefix))) failures.push(rel + ": homepage contains blog links from another language");
}

for (const [rel, prefix] of [
  ["ebooks/index.html","/ebooks/"],["fr/ebooks/index.html","/fr/ebooks/"],["ar/ebooks/index.html","/ar/ebooks/"],
  ["pt/ebooks/index.html","/pt/ebooks/"],["sw/ebooks/index.html","/sw/ebooks/"]
]) {
  const html = read(rel);
  if (!html) continue;
  const cards = cardHrefs(html);
  if (cards.length !== new Set(cards).size) failures.push(rel + ": duplicate section card links");
  if (cards.some(h => (h.includes("/blog/") || h.includes("/ebooks/")) && !h.startsWith(prefix))) {
    failures.push(rel + ": section contains cards from another language");
  }
}

// Step 7: verify Resources and Agricultural News are rendered in all five languages.
const enabledLanguages = ["en", "fr", "ar", "pt", "sw"];
const languagePrefix = (lang) => lang === "en" ? "" : lang + "/";
const hasLang = (html, lang) => { const match = html.match(/<html\b[^>]*\blang=["\']([^"\']+)["\']/i); return !!match && match[1].split("-")[0].toLowerCase() === lang; };
const hasRtl = (html) => /<html\b[^>]*\bdir=["\']rtl["\']/i.test(html);
const resourcePages = enabledLanguages.map((lang) => ({
  lang,
  rel: languagePrefix(lang) + "agriculture-resources/index.html",
  title: ({en:"Agricultural Resources",fr:"Ressources agricoles",ar:"الموارد الزراعية",pt:"Recursos agrícolas",sw:"Rasilimali za Kilimo"})[lang]
}));
const newsPages = enabledLanguages.map((lang) => ({
  lang,
  rel: languagePrefix(lang) + "agricultural-news/index.html"
}));

for (const item of resourcePages) {
  const html = read(item.rel);
  if (!html) continue;
  if (!hasLang(html, item.lang)) failures.push(item.rel + ": html lang does not match " + item.lang);
  if (item.lang === "ar" && !hasRtl(html)) failures.push(item.rel + ": Arabic page must render dir=rtl");
  for (const id of ["resourceSearch", "resourceCountry", "resourceCategory", "resourceDirectory", "resourceCount"]) {
    if (!html.includes('id="' + id + '"')) failures.push(item.rel + ": missing resource search/filter element #" + id);
  }
  if (!html.includes(item.title)) failures.push(item.rel + ": expected localized resource heading is missing");
  if (!html.includes('id="resourceEmpty"')) failures.push(item.rel + ": missing accessible no-results message");
  if (!html.includes("Intl.DisplayNames")) failures.push(item.rel + ": country names are not localized for the selected language");
  const countryBlocks = (html.match(/<details class=["']resource-country["']/gi) || []).length;
  if (countryBlocks !== 54) failures.push(item.rel + ": expected 54 country groups, found " + countryBlocks);
  const countryOptions = (html.match(/<option value=["'][A-Z]{2}["'][^>]*data-country-code=/gi) || []).length;
  if (countryOptions !== 54) failures.push(item.rel + ": expected 54 country filter options, found " + countryOptions);
  const cardCount = (html.match(/<article class=["']resource-card["']/gi) || []).length;
  const initialCount = (html.match(/id=["']resourceCount["']>(\\d+)/i) || [])[1];
  if (initialCount && Number(initialCount) !== cardCount) failures.push(item.rel + ": resource counter does not match rendered country cards (" + initialCount + " vs " + cardCount + ")");
  if (!html.includes("data-resource-country-name")) failures.push(item.rel + ": country headings lack localization hooks");
  if (item.lang !== "en" && html.includes("<h2>Regional Agricultural Intelligence</h2>")) failures.push(item.rel + ": regional intelligence heading is not localized");
  if (item.lang !== "en" && html.includes("Shared agricultural initiatives and corridors spanning multiple African countries.")) failures.push(item.rel + ": regional intelligence description is not localized");
  if (item.lang !== "en" && html.includes("Funding, programmes, markets and services can change.")) failures.push(item.rel + ": current-resource explanation is not localized");
  const selectors = selectorCount(html);
  if (selectors !== 1) failures.push(item.rel + ": expected exactly one site language selector, found " + selectors);
}

// Regional intelligence is loaded from its JSON data file exactly once. A second
// global-data registration used to deep-merge the same array and duplicate every card.
const regionalSourcePath = path.join(source, "_data", "agriculturalRegionalIntelligence.json");
if (fs.existsSync(regionalSourcePath)) {
  const regionalSource = JSON.parse(fs.readFileSync(regionalSourcePath, "utf8"));
  const expectedRegions = regionalSource.regions || [];
  const expectedUrls = expectedRegions.map(region => normalizedSourceHref(region.url)).filter(Boolean);
  if (new Set(expectedUrls).size !== expectedUrls.length) failures.push("Regional intelligence source data contains duplicate URLs.");
  for (const item of resourcePages) {
    const html = read(item.rel);
    if (!html) continue;
    const section = html.match(/<section id=["']regionalAgriculturalIntelligence["'][\s\S]*?<\/section>/i);
    if (!section) { failures.push(item.rel + ": regional agricultural intelligence section is missing"); continue; }
    const renderedUrls = [...section[0].matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)].map(match => normalizedSourceHref(match[1]));
    if (renderedUrls.length !== expectedUrls.length) failures.push(item.rel + ": expected " + expectedUrls.length + " regional intelligence cards, found " + renderedUrls.length);
    if (new Set(renderedUrls).size !== renderedUrls.length) failures.push(item.rel + ": duplicate regional intelligence cards are rendered");
  }
}

// A resource URL may be shared across countries, but it should appear
// only once within any one country's rendered resource directory.
function normalizedSourceHref(value) {
  try {
    const u = new URL(String(value || "").replace(/&amp;/g, "&"), "https://goorganicafrica.example");
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    if ((u.protocol === "https:" && u.port === "443") ||
        (u.protocol === "http:" && u.port === "80")) u.port = "";
    while (u.pathname.length > 1 && u.pathname.endsWith("/")) u.pathname = u.pathname.slice(0, -1);
    return u.toString();
  } catch (_) {
    return String(value || "").split("#")[0].replace(/\/+$/, "").toLowerCase();
  }
}
for (const item of resourcePages) {
  const html = read(item.rel);
  if (!html) continue;
  for (const match of html.matchAll(/<details class=["']resource-country["'] data-country=["']([^"']+)["'][\s\S]*?<\/details>/gi)) {
    const countryCode = match[1];
    const countryBlock = match[0];
    const seenSources = new Set();
    for (const link of countryBlock.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)) {
      const href = link[1];
      if (!/^https?:\/\//i.test(href)) continue;
      const key = normalizedSourceHref(href);
      if (seenSources.has(key)) failures.push(item.rel + ": duplicate resource source URL for " + countryCode + ": " + href);
      seenSources.add(key);
    }
  }
}

for (const item of newsPages) {
  const html = read(item.rel);
  if (!html) continue;
  if (!hasLang(html, item.lang)) failures.push(item.rel + ": html lang does not match " + item.lang);
  if (item.lang === "ar" && !hasRtl(html)) failures.push(item.rel + ": Arabic page must render dir=rtl");
  const selectors = selectorCount(html);
  if (selectors !== 1) failures.push(item.rel + ": expected exactly one site language selector, found " + selectors);
}

// Language switching must not send shared discovery pages to guessed localized URLs.
// Keep this contract checked in CI because a route can build successfully yet redirect visitors to the homepage or a 404.
const switcherPath = path.join(source, "js", "language-switcher.js");
if (!fs.existsSync(switcherPath)) {
  failures.push("Language switcher source is missing.");
} else {
  const switcher = fs.readFileSync(switcherPath, "utf8");
  for (const route of ["search", "farmer-decision-centre", "markets", "opportunities", "agricultural-services", "my-agriculture", "agricultural-intelligence"]) {
    if (!switcher.includes(route)) failures.push("Language switcher: missing shared-route handling for " + route);
  }
  if (!switcher.includes('localStorage.getItem("goa_language")')) failures.push("Language switcher: shared-page language preference is not restored");
  if (!switcher.includes('localStorage.setItem("goa_language"')) failures.push("Language switcher: selected language is not persisted");
  if (!switcher.includes("return null;") || !switcher.includes("window.location.assign(targetUrl)")) failures.push("Language switcher: missing safe no-target navigation guard");
}

// Shared discovery pages must render usable source data, not just their shell.
const searchHtml = read("search/index.html");
if (searchHtml) {
  for (const id of ["goa-global-search", "goa-search-type", "goa-search-results"]) {
    if (!searchHtml.includes('id="' + id + '"')) failures.push("search/index.html: missing search UI element #" + id);
  }
  // Keyword and slug indexing protects searches for terms absent from a card title.
  if (!searchHtml.includes("data-keywords=")) failures.push("search/index.html: searchable records do not expose keyword metadata");
  if (!searchHtml.includes("keywords:el.dataset.keywords")) failures.push("search/index.html: keyword metadata is not loaded into the search index");
  if (!searchHtml.includes("x.keywords")) failures.push("search/index.html: query matching ignores keyword metadata");
  const sourceMatch = searchHtml.match(/<div id=["']goa-search-source["'] hidden>([\s\S]*?)<\/div>/i);
  if (!sourceMatch) {
    failures.push("search/index.html: embedded source index is missing");
  } else {
    const sourceBlock = sourceMatch[1];
    const searchableRecords = (sourceBlock.match(/<article\b[^>]*data-type=/gi) || []).length;
    if (searchableRecords < 100) failures.push("search/index.html: expected at least 100 searchable source records, found " + searchableRecords);
    for (const type of ["Resource", "News", "Opportunity", "Market", "Service", "eBook", "Blog"]) {
      if (!sourceBlock.includes('data-type="' + type + '"')) failures.push("search/index.html: no searchable " + type + " records");
    }
    const records = [...sourceBlock.matchAll(/<article\b([^>]*)>/gi)];
    let unusable = 0;
    for (const match of records) {
      const attrs = match[1];
      const urlMatch = attrs.match(/\bdata-url=["']([^"']*)["']/i);
      const titleMatch = attrs.match(/\bdata-title=["']([^"']*)["']/i);
      const title = titleMatch ? titleMatch[1].trim() : "";
      const url = urlMatch ? urlMatch[1].trim() : "";
      if (!title || !searchTargetExists(url)) {
        unusable++;
        failures.push("search/index.html: indexed " + ((attrs.match(/\bdata-type=["']([^"']*)["']/i) || [,"unknown"])[1]) +
          " record has missing title or unusable destination: " + (title || "(untitled)") + " -> " + (url || "(no URL)"));
      }
    }
    if (unusable) failures.push("search/index.html: " + unusable + " indexed records cannot lead visitors to a usable destination");

    // Review-only resources must not be the only indexed version for a country/source.
    // Some datasets intentionally contain a review duplicate alongside an official record;
    // compare by country and URL so those legitimate published copies do not false-fail.
    const resourceFiles = ["_data/agriculturalResources.json", "_data/agriculturalResourcesSupplement.json"];
    const resourceRecords = [];
    const flattenResourceRecords = data => {
      if (Array.isArray(data.records)) return data.records;
      return (data.countries || []).flatMap(country =>
        Object.values(country.records || {}).flatMap(items =>
          (Array.isArray(items) ? items : []).map(record => ({
            ...record,
            country_code: record.country_code || country.code
          }))
        )
      );
    };
    for (const relData of resourceFiles) {
      const filePath = path.join(source, relData);
      if (!fs.existsSync(filePath)) continue;
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      resourceRecords.push(...flattenResourceRecords(data));
    }
    const sourceKey = record => String(record.country_code || "").toUpperCase() + "|" + normalizedSourceHref(record.url || record.source_url || "");
    const isPublicResource = record => {
      const status = String(record.status || "official").toLowerCase();
      const lifecycle = String(record.lifecycle || "").toLowerCase();
      return ["official","published","verified"].includes(status) && (!lifecycle || lifecycle === "current");
    };
    const publicKeys = new Set(resourceRecords.filter(isPublicResource).map(sourceKey));
    const reviewKeys = new Set(resourceRecords.filter(record => {
      const status = String(record.status || "official").toLowerCase();
      const lifecycle = String(record.lifecycle || "").toLowerCase();
      const reviewOnly = ["review","needs_review","draft","rejected","expired","closed","archived","historical"].includes(status) ||
        ["review","needs_review","draft","rejected","expired","closed","archived","historical"].includes(lifecycle);
      return reviewOnly && record.title && !publicKeys.has(sourceKey(record));
    }).map(sourceKey));
    for (const match of sourceBlock.matchAll(/<article\b([^>]*)>/gi)) {
      const attrs = match[1];
      if (!/\bdata-type=["']Resource["']/i.test(attrs)) continue;
      const codeMatch = attrs.match(/\bdata-country-code=["']([^"']*)["']/i);
      const urlMatch = attrs.match(/\bdata-url=["']([^"']*)["']/i);
      const key = String(codeMatch ? codeMatch[1] : "").toUpperCase() + "|" + normalizedSourceHref(urlMatch ? urlMatch[1] : "");
      if (reviewKeys.has(key)) {
        const titleMatch = attrs.match(/\bdata-title=["']([^"']*)["']/i);
        failures.push("search/index.html: review-only resource leaked into public search: " + (titleMatch ? titleMatch[1] : "(untitled)") + " (" + key + ")");
      }
    }
  }
}

// Validate that search records are not merely counted: every indexed result must
// have a usable destination, and internal destinations must exist in the rendered site.
function searchTargetExists(rawUrl) {
  const value = String(rawUrl || "").trim().replace(/&amp;/g, "&");
  if (!value || /^(javascript:|data:|vbscript:)/i.test(value)) return false;
  if (/^https?:\/\//i.test(value)) return true;
  if (/^(mailto:|tel:)/i.test(value)) return true;
  if (/^\/\//.test(value)) return true;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return false;
  const pathname = value.split(/[?#]/)[0];
  if (!pathname) return true;
  const normalized = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  const candidates = [];
  if (!normalized || normalized.endsWith("/")) candidates.push(path.join(site, normalized, "index.html"));
  else {
    candidates.push(path.join(site, normalized));
    candidates.push(path.join(site, normalized, "index.html"));
    if (!path.extname(normalized)) candidates.push(path.join(site, normalized, "index.html"));
  }
  return candidates.some(candidate => {
    const resolved = path.resolve(candidate);
    const withinSite = resolved.startsWith(path.resolve(site) + path.sep) || resolved === path.resolve(site + "/index.html");
    return withinSite && fs.existsSync(resolved) && fs.statSync(resolved).isFile();
  });
}

// Search must normalize punctuation/hyphens before matching multi-word queries.
const searchTemplatePath = path.join(source, "search.njk");
if (!fs.existsSync(searchTemplatePath)) {
  failures.push("Global Search source template is missing.");
} else {
  const searchTemplate = fs.readFileSync(searchTemplatePath, "utf8");
  if (!searchTemplate.includes("const normalize=value=>String(value||'').toLowerCase()")) failures.push("Global Search: punctuation-normalized matching is missing");
  if (!searchTemplate.includes("normalize(x.title+' '+x.summary+' '+x.keywords+' '+x.meta)")) failures.push("Global Search: title, summary, keywords and metadata are not combined for matching");
  for (const field of ["localizedSectionUrl('agriculture-resources')", "localizedSectionUrl('agricultural-news')", "localizedSectionUrl('ebooks')", "localizedSectionUrl('blog')"]) {
    if (!searchTemplate.includes(field)) failures.push("Global Search: connected card lacks localized destination: " + field);
  }
}

const decisionUiPath = path.join(source, "_includes", "farmer-decision-centre-ui.njk");
if (!fs.existsSync(decisionUiPath)) {
  failures.push("Decision Centre source template is missing.");
} else {
  const decisionUi = fs.readFileSync(decisionUiPath, "utf8");
  if (!decisionUi.includes("topicMatched=topicRows.length>0")) failures.push("Decision Centre: exact-topic matching status is missing");
  if (!decisionUi.includes("rows=topicMatched?topicRows:rows")) failures.push("Decision Centre: country-level fallback is missing when exact topic records are unavailable");
  if (!decisionUi.includes("Showing broader country-level records")) failures.push("Decision Centre: fallback is not explained to visitors");
  if (!decisionUi.includes("goa:languagechange")) failures.push("Decision Centre: results are not refreshed after language changes");
}
const decisionHtml = read("farmer-decision-centre/index.html");
if (decisionHtml) {
  for (const id of ["dc-country", "dc-topic", "dc-goal", "dc-build", "dc-output"]) {
    if (!decisionHtml.includes('id="' + id + '"')) failures.push("farmer-decision-centre/index.html: missing interactive element #" + id);
  }
  const decisionMatch = decisionHtml.match(/const data=(\[[\s\S]*?\]);\s*const goals=/);
  if (!decisionMatch || !decisionHtml.includes('tr("openSource")')) {
    failures.push("farmer-decision-centre/index.html: embedded source data or source-link action is missing");
  } else {
    try {
      const decisionRecords = JSON.parse(decisionMatch[1]);
      const decisionCountries = new Set(decisionRecords.map(r => r.country_code).filter(Boolean));
      const decisionSections = new Set(decisionRecords.map(r => r.section).filter(Boolean));
      const decisionSources = decisionRecords.filter(r => r.url).length;
      if (decisionRecords.length < 100) failures.push("farmer-decision-centre/index.html: too few source records (" + decisionRecords.length + ")");
      if (decisionCountries.size < 40) failures.push("farmer-decision-centre/index.html: covers only " + decisionCountries.size + " country codes");
      if (decisionSources < 100) failures.push("farmer-decision-centre/index.html: too few linked source records (" + decisionSources + ")");
      const unusableDecisionRecords = decisionRecords.filter(r => !String(r.title || "").trim() || !searchTargetExists(r.url));
      if (unusableDecisionRecords.length) {
        failures.push("farmer-decision-centre/index.html: " + unusableDecisionRecords.length + " records have a missing title or unusable destination");
        unusableDecisionRecords.slice(0, 20).forEach(r => failures.push("Decision Centre source: " + (r.title || "(untitled)") + " -> " + (r.url || "(no URL)")));
      }
      for (const section of ["markets", "opportunities", "resources", "services", "news"]) {
        if (!decisionSections.has(section)) failures.push("farmer-decision-centre/index.html: no records for " + section);
      }
    } catch (error) {
      failures.push("farmer-decision-centre/index.html: embedded data is not valid JSON: " + error.message);
    }
  }
}
// News lifecycle is optional for legacy verified records. Missing lifecycle means
// current unless explicitly marked otherwise; requiring lifecycle="current" hid most official stories.
for (const rel of ["agricultural-news.njk", "agricultural-news-country.njk", "search.njk"]) {
  const p = path.join(source, rel);
  if (!fs.existsSync(p)) { failures.push("Agricultural News filter source is missing: " + rel); continue; }
  const template = fs.readFileSync(p, "utf8");
  if (!template.includes("not ") || !template.includes("lifecycle")) failures.push(rel + ": missing lifecycle compatibility handling");
  if (rel === "agricultural-news.njk" && template.includes(') and article.lifecycle == "current"')) failures.push(rel + ": strict lifecycle filter hides legacy official news records");
  if (rel === "agricultural-news-country.njk" && template.includes(') and candidate.lifecycle == "current"')) failures.push(rel + ": strict lifecycle filter hides legacy official news records");
  if (rel === "search.njk" && template.includes('r.lifecycle == "current" and r.url')) failures.push(rel + ": strict lifecycle filter hides legacy official news from search");
}

// Keep fallback routes localized in source templates even when there are no approved stories.
for (const [rel, lang] of [["agricultural-news-country.njk","en"],["fr/agricultural-news-country.njk","fr"],["ar/agricultural-news-country.njk","ar"],["pt/agricultural-news-country.njk","pt"],["sw/agricultural-news-country.njk","sw"]]) {
  const p = path.join(source, rel);
  if (!fs.existsSync(p)) { failures.push("Missing country-news template: " + rel); continue; }
  const template = fs.readFileSync(p, "utf8");
  if (!template.includes("news-empty-fallback") || !template.includes('href="/search/"')) failures.push(rel + ": empty state must offer a search route");
  const prefix = lang === "en" ? "" : "/" + lang;
  if (!template.includes('href="' + prefix + '/agriculture-resources/"') || !template.includes('href="' + prefix + '/opportunities/"')) failures.push(rel + ": empty state must link to localized resources and opportunities");
}

const newsSourcePath = path.join(source, "_data", "agriculturalNews.json");
if (fs.existsSync(newsSourcePath)) {
  const newsData = JSON.parse(fs.readFileSync(newsSourcePath, "utf8"));
  for (const country of (newsData.countries || [])) {
    if (!country.slug) {
      failures.push("Agricultural News country is missing slug: " + (country.name || country.code || "unknown"));
      continue;
    }
    for (const lang of enabledLanguages) {
      const rel = languagePrefix(lang) + "agricultural-news/" + country.slug + "/index.html";
      const html = read(rel);
      if (!html) continue;
      if (!hasLang(html, lang)) failures.push(rel + ": html lang does not match " + lang);
      if (lang === "ar" && !hasRtl(html)) failures.push(rel + ": Arabic country page must render dir=rtl");
      for (const targetLang of enabledLanguages) {
        const target = targetLang === "en"
          ? "/agricultural-news/" + country.slug + "/"
          : "/" + targetLang + "/agricultural-news/" + country.slug + "/";
        if (!html.includes('data-url-' + targetLang + '="' + target + '"')) {
          failures.push(rel + ": incorrect or missing language target for " + targetLang);
        }
      }
      const storyCards = (html.match(/<article\b[^>]*class=["'][^"']*\bcard\b[^"']*["']/gi) || []).length;
      if (storyCards === 0) {
        // An empty story queue is acceptable only when the page explains the gap
        // and gives visitors a working route into other agriculture content.
        const fallbackIsUseful = html.includes("news-empty-fallback") && html.includes('href="/search/"');
        if (!fallbackIsUseful) emptyNewsPages.push({ lang, country: country.name || country.code, rel });
      }

    }
  }
}

if (emptyNewsPages.length) {
  failures.push("Rendered agricultural-news coverage: " + emptyNewsPages.length + " country-language pages have no current verified story cards.");
  emptyNewsPages.slice(0, 30).forEach(x => failures.push(x.lang + ":" + x.country + " (" + x.rel + ")"));
}
// Audit the final merged agricultural-news dataset after the build merge step.
// This catches duplicate country URLs even when duplicates originated in different
// source files or used slightly different titles.
const mergedNewsPath = path.join(source, "_data", "agriculturalNews.json");
if (fs.existsSync(mergedNewsPath)) {
  const mergedNews = JSON.parse(fs.readFileSync(mergedNewsPath, "utf8"));
  const normalizedNewsUrl = (raw) => {
    const value = String(raw || "").trim();
    if (!value) return "";
    try {
      const url = new URL(value);
      url.hash = "";
      url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
      const decodedPath = decodeURIComponent(url.pathname).replace(/\/+$/, "") || "/";
      return url.origin + decodedPath + url.search;
    } catch (_) {
      return value.replace(/\/+$/, "").toLowerCase();
    }
  };
  for (const country of (mergedNews.countries || [])) {
    const seen = new Map();
    for (const article of (country.articles || [])) {
      const url = normalizedNewsUrl(article.url);
      if (!url) continue;
      if (seen.has(url)) {
        failures.push("Agricultural News merged dataset: duplicate source URL for " + country.code + ": " + url + " (" + (seen.get(url) || "first record") + " / " + (article.title || "untitled") + ")");
      } else {
        seen.set(url, article.title || "untitled");
      }
    }
    const published = (country.articles || []).filter(article =>
      ["official", "published", "verified"].includes(String(article.status || "").toLowerCase()) &&
      (!article.lifecycle || article.lifecycle === "current") && article.url && article.title && article.summary
    );
    if (!published.length) failures.push("Agricultural News merged dataset: no publishable sourced story for " + (country.name || country.code));

    // Translation drafts must remain visibly pending on localized country pages.
    // This prevents draft machine/AI translations from being presented as reviewed.
    const translationDraftCutoff = new Date();
    translationDraftCutoff.setUTCDate(translationDraftCutoff.getUTCDate() - 180);
    const translationDrafts = (country.articles || []).filter(article => {
      const publishedDate = article.published ? new Date(article.published) : null;
      const stillCurrent = !article.lifecycle || article.lifecycle === "current";
      const withinCurrentWindow = !publishedDate || Number.isNaN(publishedDate.getTime()) || publishedDate >= translationDraftCutoff;
      return ["official", "published", "verified"].includes(String(article.status || "").toLowerCase()) &&
        article.translation_status === "draft" && article.translations && stillCurrent && withinCurrentWindow;
    });
    for (const article of translationDrafts) {
      for (const lang of ["fr", "ar", "pt", "sw"]) {
        const translation = article.translations[lang];
        if (!translation || !translation.title || !translation.summary) continue;
        const localizedFile = path.join(site, lang, "agricultural-news", country.slug, "index.html");
        if (!fs.existsSync(localizedFile)) {
          failures.push("Draft translation audit: missing localized country page for " + country.code + " (" + lang + ")");
          continue;
        }
        const localizedHtml = fs.readFileSync(localizedFile, "utf8");
        if (!localizedHtml.includes('data-translation-status="pending"')) {
          failures.push("Draft translation audit: " + country.code + " (" + lang + ") does not mark draft translations as pending for " + article.title);
        }
        if (!localizedHtml.includes(article.title)) {
          failures.push("Draft translation audit: " + country.code + " (" + lang + ") should retain the source-language title until approval for " + article.title);
        }
      }
    }
  }
}

// Pin the two owner-requested SEO outputs so a fallback description cannot
// silently pass merely because it contains no raw template delimiters.
const homepageHtml = read("index.html");
const homepageDescriptionTag = (homepageHtml.match(/<meta\b(?=[^>]*\bname=["']description["'])[^>]*>/i) || [])[0] || "";
const homepageDescription = (homepageDescriptionTag.match(/\bcontent\s*=\s*(["'])([\s\S]*?)\1/i) || [])[2] || "";
if (!/across 17 farming enterprises in 54 African countries/.test(homepageDescription)) {
  failures.push("index.html: homepage meta description is not the computed enterprise/country description");
}
const portugueseCalculatorHtml = read("ng/pt/farm-profit-calculator/index.html");
const portugueseCalculatorTitle = (portugueseCalculatorHtml.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "";
if (portugueseCalculatorTitle.trim() !== "Calculadora gratuita de lucro agrícola — Nigeria | GoOrganicAfrica") {
  failures.push("ng/pt/farm-profit-calculator/index.html: unexpected rendered title: " + portugueseCalculatorTitle.trim());
}

if (failures.length) {
  console.error("Rendered-site audit failed:");
  failures.forEach(x => console.error(" - " + x));
  process.exit(1);
}
console.log("Rendered-site audit passed.");
