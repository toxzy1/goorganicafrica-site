const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(process.cwd(), "src", "_data", "agriculturalNews.json");
const BASE_FEEDS = [
  {
    name: "World Bank Africa agriculture discovery",
    url: "https://news.google.com/rss/search?q=site%3Aworldbank.org%20Africa%20agriculture&hl=en&gl=US&ceid=US%3Aen",
    source: "World Bank",
    allowedHost: "worldbank.org"
  },
  {
    name: "African Development Bank agriculture discovery",
    url: "https://news.google.com/rss/search?q=site%3Aafdb.org%20Africa%20agriculture&hl=en&gl=US&ceid=US%3Aen",
    source: "African Development Bank",
    allowedHost: "afdb.org"
  },
  {
    name: "IFAD Africa agriculture discovery",
    url: "https://news.google.com/rss/search?q=site%3Aifad.org%20Africa%20agriculture&hl=en&gl=US&ceid=US%3Aen",
    source: "International Fund for Agricultural Development (IFAD)",
    allowedHost: "ifad.org"
  },
  {
    name: "CGIAR Africa agriculture discovery",
    url: "https://news.google.com/rss/search?q=site%3Acgiar.org%20Africa%20agriculture&hl=en&gl=US&ceid=US%3Aen",
    source: "CGIAR",
    allowedHost: "cgiar.org"
  },
  {
    name: "WFP Africa food security discovery",
    url: "https://news.google.com/rss/search?q=site%3Awfp.org%20Africa%20food%20security%20agriculture&hl=en&gl=US&ceid=US%3Aen",
    source: "World Food Programme (WFP)",
    allowedHost: "wfp.org"
  },

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

  // Give every country its own authoritative discovery paths. The country
  // is carried by the feed itself, so articles do not depend on the country
  // name appearing in the headline/summary.
  for (const country of countries) {
    const q = encodeURIComponent('"'+country.name+'" agriculture');
    const sources = [
      {
        name: "FAO country discovery — " + country.name,
        url: googleFeed('site:fao.org "' + country.name + '" agriculture'),
        source: "FAO",
        allowedHost: "fao.org"
      },
      {
        name: "IFAD country discovery — " + country.name,
        url: googleFeed('site:ifad.org "' + country.name + '" agriculture'),
        source: "IFAD",
        allowedHost: "ifad.org"
      },
      {
        name: "African Development Bank country discovery — " + country.name,
        url: googleFeed('site:afdb.org "' + country.name + '" agriculture'),
        source: "African Development Bank",
        allowedHost: "afdb.org"
      },
      {
        name: "World Bank country discovery — " + country.name,
        url: googleFeed('site:worldbank.org "' + country.name + '" agriculture'),
        source: "World Bank",
        allowedHost: "worldbank.org"
      }
    ];
    for (const feed of sources) feeds.push({ ...feed, country });
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

  // Fetch in bounded batches instead of serially. There are hundreds of
  // country/source combinations; a single slow RSS endpoint must not stall
  // the entire scheduled review-queue run.
  async function processFeed(feed) {
    try {
      const response = await fetch(feed.url, {
        headers: { "user-agent": "GoOrganicAfrica-NewsBot/1.0" },
        signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const xml = await response.text();
      const items = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];

      for (const item of items) {
        const title = field(item, "title");
        const summary = field(item, "description");
        let url = normalizeUrl(field(item, "link"));
        const sourceTag = item.match(/<source(?:\s[^>]*)?url=["']([^"']+)["'][^>]*>/i);
        const sourceUrl = sourceTag ? normalizeUrl(sourceTag[1]) : "";
        if (url.includes("news.google.com")) {
          try {
            const resolved = await fetch(url, {
              redirect: "follow",
              headers: { "user-agent": "GoOrganicAfrica-NewsBot/1.0" },
              signal: AbortSignal.timeout(10000)
            });
            if (resolved.ok && resolved.url && !resolved.url.includes("news.google.com")) {
              url = resolved.url;
            } else {
              continue;
            }
          } catch (_) { continue; }
        }
        const published = isoDate(field(item, "pubDate") || field(item, "dc:date"));
        if (!title || !url || !published) continue;
        let parsedUrl;
        try { parsedUrl = new URL(url); } catch (_) { continue; }
        const sourceHost = sourceUrl ? (() => { try { return new URL(sourceUrl).hostname; } catch (_) { return ""; } })() : "";
        if (parsedUrl.hostname !== feed.allowedHost && !parsedUrl.hostname.endsWith("." + feed.allowedHost) &&
            sourceHost !== feed.allowedHost && !sourceHost.endsWith("." + feed.allowedHost)) continue;
        const ageDays = Math.floor((Date.now() - new Date(published + "T23:59:59Z").getTime()) / 86400000);
        if (ageDays > 30) continue;

        const country = feed.country || findCountry(title, summary, data.countries);
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
          status: "review",
          lifecycle: "needs_review",
          source_tier: 1,
          country_code: country.code
        });
        existing.add(url);
        existing.add(title);
        added++;
      }
    } catch (error) {
      console.warn("Skipping unavailable news feed " + feed.name + ": " + error.message);
    }
  }

  const FEED_BATCH_SIZE = 8;
  for (let i = 0; i < feeds.length; i += FEED_BATCH_SIZE) {
    await Promise.all(feeds.slice(i, i + FEED_BATCH_SIZE).map(processFeed));
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
