const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const site = path.join(root, "_site");
if (!fs.existsSync(site)) throw new Error("Rendered site is missing.");

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const htmlFiles = walk(site).filter(f => f.endsWith(".html"));
const failures = [];

function read(rel) {
  const file = path.join(site, rel);
  if (!fs.existsSync(file)) failures.push("Missing rendered page: " + rel);
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function cardHrefs(html) {
  const result = [];
  const anchorCard = /<a\b[^>]*class=["'][^"']*ebook-card[^"']*["'][^>]*href=["']([^"']+)["']/gi;
  const anchorCardReversed = /<a\b[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*ebook-card[^"']*["']/gi;
  const blogCard = /<a\b[^>]*href=["']([^"']+)["'][^>]*>\s*<div class=["'][^"']*ebook-card[^"']*["']/gi;
  let m;
  while ((m = anchorCard.exec(html))) result.push(m[1]);
  while ((m = anchorCardReversed.exec(html))) result.push(m[1]);
  while ((m = blogCard.exec(html))) result.push(m[1]);
  return result;
}

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, "utf8");
  const rel = path.relative(site, file);
  if (!/farm-profit-calculator/.test(rel)) {
    if ((html.match(/<main\b/gi) || []).length !== 1) failures.push(rel + ": expected exactly one <main>");
    if ((html.match(/<header\b/gi) || []).length !== 1) failures.push(rel + ": expected exactly one <header>");
  }
  if (/content-variant|data-content-group|data-content-language|data-content-slug/.test(html)) {
    failures.push(rel + ": legacy content-variant markup remains");
  }
  const ids = new Set();
  const duplicateIds = new Set();
  const idRe = /\bid=["']([^"']+)["']/gi;
  let idm;
  while ((idm = idRe.exec(html))) {
    if (ids.has(idm[1])) duplicateIds.add(idm[1]);
    ids.add(idm[1]);
  }
  if (duplicateIds.size) failures.push(rel + ": duplicate HTML ids: " + [...duplicateIds].join(", "));
}

const homePages = [
  ["index.html", "en"],
  ["fr/index.html", "fr"],
  ["ar/index.html", "ar"],
  ["pt/index.html", "pt"],
  ["sw/index.html", "sw"]
];

for (const [rel, lang] of homePages) {
  const html = read(rel);
  if (!html) continue;
  const hrefs = cardHrefs(html);
  const unique = [...new Set(hrefs)];
  if (hrefs.length !== unique.length) failures.push(rel + ": duplicate homepage card links");
  const ebookPrefix = lang === "en" ? "/ebooks/" : "/" + lang + "/ebooks/";
  const blogPrefix = lang === "en" ? "/blog/" : "/" + lang + "/blog/";
  const ebookLinks = unique.filter(h => h.includes("/ebooks/"));
  const blogLinks = unique.filter(h => h.includes("/blog/"));
  if (ebookLinks.some(h => !h.startsWith(ebookPrefix))) failures.push(rel + ": homepage contains eBook cards from another language");
  if (blogLinks.some(h => !h.startsWith(blogPrefix))) failures.push(rel + ": homepage contains blog cards from another language");
  if (ebookLinks.length === 0) failures.push(rel + ": no eBook cards rendered");
  if (blogLinks.length === 0) failures.push(rel + ": no blog cards rendered");
}

const sectionPages = [
  ["ebooks/index.html", "/ebooks/"],
  ["fr/ebooks/index.html", "/fr/ebooks/"],
  ["ar/ebooks/index.html", "/ar/ebooks/"],
  ["pt/ebooks/index.html", "/pt/ebooks/"],
  ["sw/ebooks/index.html", "/sw/ebooks/"],
  ["blog/index.html", "/blog/"],
  ["fr/blog/index.html", "/fr/blog/"],
  ["ar/blog/index.html", "/ar/blog/"],
  ["pt/blog/index.html", "/pt/blog/"],
  ["sw/blog/index.html", "/sw/blog/"]
];

for (const [rel, prefix] of sectionPages) {
  const html = read(rel);
  if (!html) continue;
  const hrefs = cardHrefs(html);
  const unique = [...new Set(hrefs)];
  if (hrefs.length !== unique.length) failures.push(rel + ": duplicate section card links");
  if (unique.some(h => h.includes("/blog/") || h.includes("/ebooks/") ? !h.startsWith(prefix) : false)) {
    failures.push(rel + ": section contains cards from another language");
  }
}

if (failures.length) {
  console.error("Rendered-site audit failed:");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}

console.log("Rendered-site audit passed: page structure, no legacy language-variant markup, and language-scoped homepage/section cards.");
