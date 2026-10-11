const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(process.cwd(), "src", "_data", "agriculturalOpportunities.json");
const COUNTRIES_FILE = path.join(process.cwd(), "src", "_data", "calculatorCountries.json");
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
  const countryRegistry = JSON.parse(fs.readFileSync(COUNTRIES_FILE, "utf8"));
  const countries = Array.isArray(countryRegistry.list) ? countryRegistry.list : [];
  if (!countries.length) throw new Error("Country registry is missing or empty.");
  const today = new Date().toISOString().slice(0,10);
  const existing = new Set((data.records || []).map(r => r.url || r.title));
  let added = 0;

  const FEEDS = buildFeeds(countries);

  for (const feed of FEEDS) {
    let xml;
    try {
      let response;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          response = await fetch(feed.url, { headers: { "user-agent": "GoOrganicAfrica-OpportunityBot/1.0" } });
          if (response.ok) break;
          if (response.status < 500 && response.status !== 429) break;
        } catch (error) {
          if (attempt === 3) throw error;
        }
        if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 750));
      }
      if (!response || !response.ok) throw new Error("HTTP " + (response ? response.status : "network error"));
      xml = await response.text();
    } catch (error) {
      console.warn("Skipping unavailable opportunity feed " + feed.name + ": " + error.message);
      continue;
    }
    const items = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];

    for (const item of items) {
      const title = field(item, "title");
      const summary = field(item, "description");
      let link = url(field(item, "link"));
      if (link) {
        try {
          const candidate = new URL(link);
          if (candidate.hostname === "news.google.com" || candidate.hostname.endsWith(".news.google.com")) {
            const resolved = await fetch(link, {
              redirect: "follow",
              headers: { "user-agent": "GoOrganicAfrica-OpportunityBot/1.0" }
            });
            if (resolved.url) link = resolved.url;
          }
        } catch (_) {
          // Unresolvable discovery links are excluded by the host check below.
        }
      }
      const published = date(field(item, "pubDate") || field(item, "dc:date"));
      if (!title || !link || !published || existing.has(link) || existing.has(title)) continue;
      let parsedLink;
      try { parsedLink = new URL(link); } catch (_) { continue; }
      const hostname = parsedLink.hostname.toLowerCase();
      if (hostname !== feed.host && !hostname.endsWith("." + feed.host)) continue;

      const age = Math.floor((Date.now() - new Date(published + "T23:59:59Z").getTime()) / 86400000);
      if (age > 90) continue;

      const hay = (title + " " + summary).toLowerCase();
      const country = feed.country;
      if (!country) continue;
      data.records = data.records || [];
      data.records.unshift({
        title,
        description: summary.slice(0, 600),
        url: link,
        source: feed.source,
        discovered: today,
        status: "review",
        lifecycle: "needs_review",
        source_tier: 1,
        code: country.code,
        country: country.name,
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
