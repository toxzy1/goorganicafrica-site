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
function slugify(v) { return v.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""); }

async function main() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  const today = new Date().toISOString().slice(0,10);
  const existing = new Set((data.records || []).map(r => r.url || r.title));
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

  for (const feed of FEEDS) {
    const response = await fetch(feed.url, {headers: {"user-agent": "GoOrganicAfrica-OpportunityBot/1.0"}});
    if (!response.ok) throw new Error(feed.name + ": HTTP " + response.status);
    const xml = await response.text();
    const items = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];

    for (const item of items) {
      const title = field(item, "title");
      const summary = field(item, "description");
      let link = url(field(item, "link"));
      // Google News RSS item links are redirect URLs, not publisher article URLs.
      // Resolve them before applying the trusted-host filter; never replace them
      // with the publisher homepage from the <source url="..."> attribute.
      if (link.includes("news.google.com")) {
        try {
          const resolved = await fetch(link, {
            redirect: "follow",
            headers: {"user-agent": "GoOrganicAfrica-OpportunityBot/1.0"}
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
      if (!title || !link || !published || !link.includes(feed.host) || existing.has(link) || existing.has(title)) continue;

      const age = Math.floor((Date.now() - new Date(published + "T23:59:59Z").getTime()) / 86400000);
      if (age > 90) continue;

      const hay = (title + " " + summary).toLowerCase();
      const country = feed.country;
      if (!country) continue;
      data.records = data.records || [];
      data.records.unshift({
        title,
        country: country.name,
        code: country.code,
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
      existing.add(link);
      existing.add(title);
      added++;
    }
  }

    if (added) {
    data.last_updated = today;
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + "\n");
  }
  console.log("GoOrganicAfrica opportunity sync: " + added + " candidate(s).");
}
main().catch(e => { console.error(e); process.exit(1); });
