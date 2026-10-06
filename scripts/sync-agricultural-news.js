const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(process.cwd(), "src", "_data", "agriculturalNews.json");
const BASE_FEEDS = [
  {
    name: "FAO Africa discovery",
    url: "https://news.google.com/rss/search?q=site%3Afao.org%2Fafrica%20agriculture%20Africa&hl=en&gl=US&ceid=US%3Aen",
    source: "FAO Regional Office for Africa",
    allowedHost: "fao.org"
  },
  {
    name: "FAO Emergencies discovery",
    url: "https://news.google.com/rss/search?q=site%3Afao.org%2Femergencies%20Africa%20agriculture&hl=en&gl=US&ceid=US%3Aen",
    source: "FAO Emergencies and Resilience",
    allowedHost: "fao.org"
  },
  {
    name: "IITA discovery",
    url: "https://news.google.com/rss/search?q=site%3Aiita.org%20Africa%20agriculture&hl=en&gl=US&ceid=US%3Aen",
    source: "International Institute of Tropical Agriculture (IITA)",
    allowedHost: "iita.org"
  },
  {
    name: "AATF discovery",
    url: "https://news.google.com/rss/search?q=site%3Aaatf-africa.org%20Africa%20agriculture&hl=en&gl=US&ceid=US%3Aen",
    source: "African Agricultural Technology Foundation (AATF)",
    allowedHost: "aatf-africa.org"
  },
  {
    name: "AGRA discovery",
    url: "https://news.google.com/rss/search?q=site%3Aagra.org%20Africa%20agriculture&hl=en&gl=US&ceid=US%3Aen",
    source: "Alliance for a Green Revolution in Africa (AGRA)",
    allowedHost: "agra.org"
  }
];

function googleFeed(query) {
  return "https://news.google.com/rss/search?q=" + encodeURIComponent(query) + "&hl=en&gl=US&ceid=US%3Aen";
}

function buildFeeds(countries) {
  const feeds = [...BASE_FEEDS];

  // Country-level FAO discovery gives every one of the 54 countries a
  // dedicated search path without inventing country news. Results still
  // pass the same host, age and country checks below.
  for (const country of countries) {
    feeds.push({
      name: "FAO country discovery — " + country.name,
      url: googleFeed('site:fao.org "' + country.name + '" agriculture'),
      source: "FAO",
      allowedHost: "fao.org"
    });
    feeds.push({
      name: "FAO emergency discovery — " + country.name,
      url: googleFeed('site:fao.org/emergencies "' + country.name + '" agriculture'),
      source: "FAO Emergencies and Resilience",
      allowedHost: "fao.org"
    });
  }

  return feeds;
}

const COUNTRY_ALIASES = {
  "democratic republic of the congo": "democratic-republic-of-the-congo",
  "republic of the congo": "republic-of-the-congo",
  "côte d'ivoire": "c-te-d-ivoire",
  "ivory coast": "c-te-d-ivoire",
  "cabo verde": "cabo-verde",
  "cape verde": "cabo-verde",
  "eswatini": "eswatini",
  "swaziland": "eswatini",
  "sao tome and principe": "s-o-tom-and-pr-ncipe",
  "são tomé and príncipe": "s-o-tom-and-pr-ncipe"
};

function clean(s = "") {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function field(block, tag) {
  const re = new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + tag + ">", "i");
  const m = block.match(re);
  return m ? clean(m[1]) : "";
}

function normalizeUrl(value) {
  const m = value.match(/https?:\/\/[^\s<>"']+/i);
  return m ? m[0].replace(/[),.;]+$/, "") : "";
}

function isoDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function findCountry(title, summary, countries) {
  const hay = (" " + (title + " " + summary).toLowerCase() + " ");
  for (const c of countries) {
    const names = [c.name.toLowerCase()];
    for (const [alias, slug] of Object.entries(COUNTRY_ALIASES)) {
      if (slug === c.slug) names.push(alias);
    }
    if (names.some(n => hay.includes(" " + n + " ") || hay.includes(n + ","))) return c;
  }
  return null;
}

function categoryFor(title, summary) {
  const t = (title + " " + summary).toLowerCase();
  if (/livestock|cattle|goat|sheep|poultry|animal health|veterinary|fish/.test(t)) return "livestock";
  if (/seed|crop|maize|rice|wheat|tomato|cassava|cocoa|coffee|horticulture|harvest/.test(t)) return "crops";
  if (/market|price|trade|export|import|commodity/.test(t)) return "markets";
  if (/finance|investment|funding|loan|credit/.test(t)) return "finance";
  if (/grant|programme|program|initiative|project/.test(t)) return "grants-programmes";
  if (/policy|minister|government|strategy|roadmap|law|regulation/.test(t)) return "policy";
  if (/flood|drought|climate|weather|cyclone|rainfall|food security/.test(t)) return "weather-climate";
  if (/tractor|machinery|irrigation|technology|digital|mechaniz/.test(t)) return "machinery-technology";
  if (/research|science|innovation|study/.test(t)) return "research-innovation";
  return "general";
}

async function main() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  const today = new Date().toISOString().slice(0, 10);
  const feeds = buildFeeds(data.countries);
  const existing = new Set(
    data.countries.flatMap(c => (c.articles || []).map(a => a.url || a.title))
  );
  let added = 0;

  for (const feed of FEEDS) {
    const response = await fetch(feed.url, { headers: { "user-agent": "GoOrganicAfrica-NewsBot/1.0" } });
    if (!response.ok) throw new Error(`${feed.name}: HTTP ${response.status}`);
    const xml = await response.text();
    const items = xml.match(/<item(?:\\s[^>]*)?>[\\s\\S]*?<\\/item>/gi) || [];

    for (const item of items) {
      const title = field(item, "title");
      const summary = field(item, "description");
      let url = normalizeUrl(field(item, "link"));
      const sourceTag = item.match(/<source(?:\\s[^>]*)?url=["']([^"']+)["'][^>]*>/i);
      const sourceUrl = sourceTag ? normalizeUrl(sourceTag[1]) : "";
      if (url.includes("news.google.com") && sourceUrl) url = sourceUrl;
      if (url.includes("news.google.com")) {
        try {
          const resolved = await fetch(url, { redirect: "follow", headers: { "user-agent": "GoOrganicAfrica-NewsBot/1.0" } });
          if (resolved.url) url = resolved.url;
        } catch (_) {}
      }
      const published = isoDate(field(item, "pubDate") || field(item, "dc:date"));
      if (!title || !url || !published) continue;
      let parsedUrl;
      try { parsedUrl = new URL(url); } catch (_) { continue; }
      const sourceHost = sourceUrl ? (() => { try { return new URL(sourceUrl).hostname; } catch (_) { return ""; } })() : "";
      if (parsedUrl.hostname !== feed.allowedHost && !parsedUrl.hostname.endsWith("." + feed.allowedHost) &&
          sourceHost !== feed.allowedHost && !sourceHost.endsWith("." + feed.allowedHost)) continue;
      const ageDays = Math.floor((Date.now() - new Date(published + "T23:59:59Z").getTime()) / 86400000);
      if (ageDays > 14) continue;

      const country = findCountry(title, summary, data.countries);
      if (!country || existing.has(url) || existing.has(title)) continue;

      country.articles = country.articles || [];
      country.articles.unshift({
        category: categoryFor(title, summary),
        title,
        summary: summary.slice(0, 420),
        url,
        source: feed.source,
        published,
        verified: today,
        status: "official-feed"
      });
      existing.add(url);
      existing.add(title);
      added++;
    }
  }

  for (const country of data.countries) {
    country.articles = (country.articles || [])
      .sort((a, b) => String(b.published).localeCompare(String(a.published)))
      .slice(0, 20);
  }

  if (added > 0) {
    data.last_updated = today;
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + "\n");
  }

  console.log(`GoOrganicAfrica agricultural news sync: ${added} new article(s).`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
