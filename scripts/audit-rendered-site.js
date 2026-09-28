const fs = require("fs");
const path = require("path");
const site = path.join(__dirname, "..", "_site");
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
const htmlFiles = walk(site).filter(f => f.endsWith(".html"));

function read(rel) {
  const p = path.join(site, rel);
  if (!fs.existsSync(p)) { failures.push("Missing rendered page: " + rel); return ""; }
  return fs.readFileSync(p, "utf8");
}
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

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, "utf8");

  // Every localized detail page must expose one exact sibling URL per
  // available language, and the visible language links must match that map.
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
    for (const lang of Object.keys(mapAttrs)) {
      if (visible[lang] !== mapAttrs[lang]) failures.push(path.relative(site, file) + ": language target mismatch for " + lang);
      const targetRel = mapAttrs[lang].replace(/^\//, "");
      const targetFile = path.join(site, targetRel, "index.html");
      if (!fs.existsSync(targetFile)) failures.push(path.relative(site, file) + ": target does not render for " + lang + ": " + mapAttrs[lang]);
    }
  }
  const rel = path.relative(site, file);
  if (!/farm-profit-calculator/.test(rel) && !/^admin\//.test(rel)) {
    if ((html.match(/<main\b/gi) || []).length !== 1) failures.push(rel + ": expected exactly one <main>");
    if ((html.match(/<header\b/gi) || []).length !== 1) failures.push(rel + ": expected exactly one <header>");
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
  ["ebooks/index.html","/ebooks/"],["fr/ebooks/index.html","/fr/ebooks/"],["ar/ebooks/index.html","/ar/ebooks/"],["pt/ebooks/index.html","/pt/ebooks/"],["sw/ebooks/index.html","/sw/ebooks/"],
  ["blog/index.html","/blog/"],["fr/blog/index.html","/fr/blog/"],["ar/blog/index.html","/ar/blog/"],["pt/blog/index.html","/pt/blog/"],["sw/blog/index.html","/sw/blog/"]
]) {
  const html = read(rel);
  if (!html) continue;
  const cards = cardHrefs(html);
  if (cards.length !== new Set(cards).size) failures.push(rel + ": duplicate section card links");
  if (cards.some(h => (h.includes("/blog/") || h.includes("/ebooks/")) && !h.startsWith(prefix))) failures.push(rel + ": section contains cards from another language");
}

if (failures.length) {
  console.error("Rendered-site audit failed:");
  failures.forEach(x => console.error(" - " + x));
  process.exit(1);
}
console.log("Rendered-site audit passed.");
