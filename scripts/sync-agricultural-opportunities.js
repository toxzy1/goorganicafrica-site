const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(process.cwd(), "src", "_data", "agriculturalOpportunities.json");
const BASE_FEEDS = [
  { name: "World Bank agriculture finance", query: "site:worldbank.org agriculture funding grant finance", host: "worldbank.org", source: "World Bank" },
  { name: "African Development Bank agriculture opportunities", query: "site:afdb.org agriculture grant finance project", host: "afdb.org", source: "African Development Bank" },
  { name: "FAO grants and programmes", query: "site:fao.org agriculture grant call proposals programme", host: "fao.org", source: "FAO" },
  { name: "IFAD opportunities and programmes", query: "site:ifad.org agriculture finance grant call proposals programme", host: "ifad.org", source: "IFAD" },
  { name: "CGIAR agriculture programmes", query: "site:cgiar.org Africa agriculture programme funding", host: "cgiar.org", source: "CGIAR" },
  { name: "WFP agriculture resilience", query: "site:wfp.org Africa agriculture resilience funding", host: "wfp.org", source: "World Food Programme" }
];

function googleFeed(query) {
  return "https://news.google.com/rss/search?q=" + encodeURIComponent(query) + "&hl=en&gl=US&ceid=US%3Aen";
}

function buildFeeds(countries) {
  const feeds = [];
  for (const country of countries) {
    for (const base of BASE_FEEDS) {
      feeds.push({
        ...base,
        name: base.name + " — " + country.name,
        url: googleFeed(base.query + ' "' + country.name + '"'),
        country
      });
    }
  }
  return feeds;
}

function clean(s = "") {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}
function field(block, tag) {
  const m = block.match(new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + tag + ">", "i"));
  return m ? clean(m[1]) : "";
}
function url(v) { const m = v.match(/https?:\/\/[^\s<>"']+/i); return m ? m[0].replace(/[),.;]+$/, "") : ""; }
function date(v) { const d = new Date(v); return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0,10); }
function categoryFor(title, summary) {
  const t = (title + " " + summary).toLowerCase();
  if (/tractor|machinery|equipment|irrigation|mechaniz/.test(t)) return "machinery";
  if (/loan|finance|credit|investment|bank|funding/.test(t)) return "finance";
  if (/insurance|risk finance|risk management/.test(t)) return "insurance";
  if (/market|trade|value chain|commodity/.test(t)) return "markets";
  if (/research|innovation|science|technology/.test(t)) return "research";
  if (/climate|drought|resilien|weather/.test(t)) return "climate";
  return "grants";
}
function candidateKey(record) {
  const country = String(record.code || record.country_code || record.country || "").trim().toUpperCase();
  let identity = String(record.url || "").trim();
  if (identity) {
    try {
      const parsed = new URL(identity);
      parsed.hash = "";
      parsed.hostname = parsed.hostname.toLowerCase();
      if ((parsed.protocol === "https:" && parsed.port === "443") ||
          (parsed.protocol === "http:" && parsed.port === "80")) parsed.port = "";
      while (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
        parsed.pathname = parsed.pathname.slice(0, -1);
      }
      identity = parsed.toString();
    } catch (_) {
      const hashIndex = identity.indexOf("#");
      if (hashIndex >= 0) identity = identity.slice(0, hashIndex);
      while (identity.endsWith("/")) identity = identity.slice(0, -1);
      identity = identity.toLowerCase();
    }
  } else {
    identity = String(record.title || "").trim().toLowerCase();
  }
  return country + "::" + identity;
}

function slugify(v) { return v.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""); }

async function main() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  const today = new Date().toISOString().slice(0,10);
  // A regional story may legitimately be relevant to more than one country.
  // Deduplicate by country + canonical URL/title, not URL globally.
  const existing = new Set((data.records || []).map(candidateKey));
  let added = 0;

  // Opportunities data is a flat records list; country metadata lives in the
  // agricultural resources registry. Do not assume opportunities.json has a
  // top-level countries array.
  const registryPath = path.join(process.cwd(), "src", "_data", "agriculturalResources.json");
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const countries = Array.isArray(data.countries) && data.countries.length
    ? data.countries
    : (registry.countries || []).map(c => ({ code: c.code, name: c.name }));
  if (!countries.length) throw new Error("No country registry found for agricultural opportunity discovery.");

  const FEEDS = buildFeeds(countries);

  async function processFeed(feed) {
    try {
      const response = await fetch(feed.url, {
        headers: {"user-agent": "GoOrganicAfrica-OpportunityBot/1.0"},
        signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const xml = await response.text();
      const items = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];
      const candidates = [];

      for (const item of items) {
        const title = field(item, "title");
        const summary = field(item, "description");
        let link = url(field(item, "link"));
        if (link.includes("news.google.com")) {
          try {
            const resolved = await fetch(link, {
              redirect: "follow",
              headers: {"user-agent": "GoOrganicAfrica-OpportunityBot/1.0"},
              signal: AbortSignal.timeout(10000)
            });
            if (resolved.ok && resolved.url && !resolved.url.includes("news.google.com")) {
              link = resolved.url;
            } else {
              continue;
            }
          } catch (_) {
            continue;
          }
        }
        const published = date(field(item, "pubDate") || field(item, "dc:date"));
        if (!title || !link || !published || !link.includes(feed.host)) continue;
        const age = Math.floor((Date.now() - new Date(published + "T23:59:59Z").getTime()) / 86400000);
        if (age > 90) continue;
        if (!feed.country) continue;

        candidates.push({
          title,
          country: feed.country.name,
          code: feed.country.code,
          category: categoryFor(title, summary),
          summary: summary.slice(0, 600),
          url: link,
          source: feed.source,
          verified: today,
          status: "review",
          lifecycle: "needs_review",
          source_tier: 1,
          type: "Opportunity / resource candidate",
          amount: "",
          eligibility: "",
          beneficiary: "",
          deadline: "",
          application_url: link,
          contact: ""
        });
      }
      return candidates;
    } catch (error) {
      console.warn("Skipping unavailable opportunity feed " + feed.name + ": " + error.message);
      return [];
    }
  }

  // Bounded concurrency prevents one slow or temporarily unavailable source
  // from blocking all country/source combinations. Candidates are merged
  // sequentially below so duplicate checks remain deterministic.
  const FEED_BATCH_SIZE = 8;
  for (let i = 0; i < FEEDS.length; i += FEED_BATCH_SIZE) {
    const batch = FEEDS.slice(i, i + FEED_BATCH_SIZE);
    const results = await Promise.all(batch.map(processFeed));
    for (const candidates of results) {
      for (const candidate of candidates) {
        const key = candidateKey(candidate);
        if (existing.has(key)) continue;
        data.records = data.records || [];
        data.records.unshift(candidate);
        existing.add(key);
        added++;
      }
    }
  }

    if (added) {
    data.last_updated = today;
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + "\n");
  }
  console.log("GoOrganicAfrica opportunity sync: " + added + " candidate(s).");
}
main().catch(e => { console.error(e); process.exit(1); });
