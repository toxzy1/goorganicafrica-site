const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(process.cwd(), "src", "_data", "agriculturalResources.json");
const FEEDS = [
  { name: "World Bank agriculture finance", url: "https://news.google.com/rss/search?q=site%3Aworldbank.org%20Africa%20agriculture%20funding%20grant%20finance&hl=en&gl=US&ceid=US%3Aen", host: "worldbank.org", source: "World Bank" },
  { name: "African Development Bank agriculture opportunities", url: "https://news.google.com/rss/search?q=site%3Aafdb.org%20Africa%20agriculture%20grant%20finance%20project&hl=en&gl=US&ceid=US%3Aen", host: "afdb.org", source: "African Development Bank" },
  { name: "CGIAR agriculture programmes", url: "https://news.google.com/rss/search?q=site%3Acgiar.org%20Africa%20agriculture%20programme%20funding&hl=en&gl=US&ceid=US%3Aen", host: "cgiar.org", source: "CGIAR" },
  { name: "WFP agriculture resilience", url: "https://news.google.com/rss/search?q=site%3Awfp.org%20Africa%20agriculture%20resilience%20funding&hl=en&gl=US&ceid=US%3Aen", host: "wfp.org", source: "World Food Programme" },
  { name: "FAO grants", url: "https://news.google.com/rss/search?q=site%3Afao.org%20Africa%20grant%20agriculture%20call%20proposals&hl=en&gl=US&ceid=US%3Aen", host: "fao.org", source: "FAO" },
  { name: "IFAD opportunities", url: "https://news.google.com/rss/search?q=site%3Aifad.org%20Africa%20agriculture%20finance%20grant&hl=en&gl=US&ceid=US%3Aen", host: "ifad.org", source: "IFAD" },
  { name: "AfDB agriculture finance", url: "https://news.google.com/rss/search?q=site%3Aafdb.org%20Africa%20agriculture%20finance%20funding&hl=en&gl=US&ceid=US%3Aen", host: "afdb.org", source: "African Development Bank" },
  { name: "EAC funding", url: "https://news.google.com/rss/search?q=site%3Aeac.int%20agriculture%20funding%20grants&hl=en&gl=US&ceid=US%3Aen", host: "eac.int", source: "East African Community" }
];

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
  const existing = new Set(data.countries.flatMap(c => Object.values(c.records || {}).flatMap(list => (list || []).map(r => r.url || r.title))));
  let added = 0;

  for (const feed of FEEDS) {
    const response = await fetch(feed.url, {headers: {"user-agent": "GoOrganicAfrica-OpportunityBot/1.0"}});
    if (!response.ok) throw new Error(feed.name + ": HTTP " + response.status);
    const xml = await response.text();
    const items = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];

    for (const item of items) {
      const title = field(item, "title");
      const summary = field(item, "description");
      let link = url(field(item, "link"));
      const sourceLink = url(field(item, "source"));
      if (link.includes("news.google.com") && sourceLink) link = sourceLink;
      const published = date(field(item, "pubDate") || field(item, "dc:date"));
      if (!title || !link || !published || !link.includes(feed.host) || existing.has(link) || existing.has(title)) continue;

      const age = Math.floor((Date.now() - new Date(published + "T23:59:59Z").getTime()) / 86400000);
      if (age > 60) continue;

      const hay = (title + " " + summary).toLowerCase();
      const country = data.countries.find(c => hay.includes(c.name.toLowerCase()));
      if (!country) continue;

      const bucket = categoryFor(title, summary);
      country.records[bucket] = country.records[bucket] || [];
      country.records[bucket].unshift({
        title,
        description: summary.slice(0, 600),
        url: link,
        source: feed.source,
        verified: today,
        status: "review",
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

  for (const c of data.countries) {
    c.records = c.records || {};
    c.records.finance = c.records.finance || [];
    c.records.grants = c.records.grants || [];
    c.records.machinery = c.records.machinery || [];
    c.records.general = c.records.general || [];
  }
  if (added) {
    data.last_updated = today;
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + "\n");
  }
  console.log("GoOrganicAfrica opportunity sync: " + added + " candidate(s).");
}
main().catch(e => { console.error(e); process.exit(1); });
