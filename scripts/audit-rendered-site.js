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
const hasLang = (html, lang) => new RegExp('<html\\b[^>]*\\blang="' + lang + '"', "i").test(html);
const hasRtl = (html) => new RegExp('<html\\b[^>]*\\bdir="rtl"', "i").test(html);
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
  const selectors = selectorCount(html);
  if (selectors !== 1) failures.push(item.rel + ": expected exactly one site language selector, found " + selectors);
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

// Shared discovery pages must render usable source data, not just their shell.
const searchHtml = read("search/index.html");
if (searchHtml) {
  for (const id of ["goa-global-search", "goa-search-type", "goa-search-results"]) {
    if (!searchHtml.includes('id="' + id + '"')) failures.push("search/index.html: missing search UI element #" + id);
  }
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
  }
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
      for (const section of ["markets", "opportunities", "resources", "services", "news"]) {
        if (!decisionSections.has(section)) failures.push("farmer-decision-centre/index.html: no records for " + section);
      }
    } catch (error) {
      failures.push("farmer-decision-centre/index.html: embedded data is not valid JSON: " + error.message);
    }
  }
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
      if (storyCards === 0) emptyNewsPages.push({ lang, country: country.name || country.code, rel });

    }
  }
}

if (emptyNewsPages.length) {
  failures.push("Rendered agricultural-news coverage: " + emptyNewsPages.length + " country-language pages have no current verified story cards.");
  emptyNewsPages.slice(0, 30).forEach(x => failures.push(x.lang + ":" + x.country + " (" + x.rel + ")"));
}
if (failures.length) {
  console.error("Rendered-site audit failed:");
  failures.forEach(x => console.error(" - " + x));
  process.exit(1);
}
console.log("Rendered-site audit passed.");
