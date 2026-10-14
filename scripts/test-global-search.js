"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const template = fs.readFileSync(path.join(__dirname, "..", "src", "search.njk"), "utf8");
const match = template.match(/<script>\s*([\s\S]*?)<\/script>/);
assert.ok(match, "Global Search script exists");
const searchScript = match[1];

function element(dataset = {}) {
  return { dataset, value: "", textContent: "", innerHTML: "", style: {display:""}, listeners: {},
    addEventListener(name, fn) { this.listeners[name] = fn; } };
}
function setup(language = "en", suppliedRecords = null) {
  const input = element(), type = element(), results = element(), connections = element(), cards = element(), count = element();
  const fixtureRecords = [
    element({type:"eBook",title:"Rabbit Farming Handbook",summary:"Practical smallholder guide",keywords:"rabbit_farming rabbit farming ebook livestock",meta:"Livestock · eBook",url:"/ebooks/rabbit-farming-handbook/"}),
    element({type:"Blog",title:"Rabbit housing and feeding",summary:"Build clean, low-cost rabbit housing",keywords:"rabbit housing",meta:"Livestock · Blog · en",url:"/blog/rabbit-housing-feeding/"}),
    element({type:"Resource",title:"Rabbit feed resources",summary:"Official farmer support information",keywords:"rabbit fertilizer seed",meta:"Côte d’Ivoire · inputs",url:"/agriculture-resources/"}),
    element({type:"News",title:"Rabbit farming news",summary:"Agricultural update",keywords:"rabbit livestock",meta:"Nigeria · livestock",url:"https://example.org/news"})
  ];
  const records = suppliedRecords || fixtureRecords;
  const listeners = {};
  const document = {
    documentElement:{lang:language},
    getElementById(id) { return ({
      "goa-global-search":input,"goa-search-type":type,"goa-search-results":results,
      "goa-search-connections":connections,"goa-connection-cards":cards,"goa-search-count":count
    })[id] || null; },
    querySelectorAll(selector) { return selector === "#goa-search-source article" ? records : []; },
    addEventListener(name, fn) { listeners[name] = fn; }
  };
  const window = {GOA_I18N:{lang:()=>language,t:(_section,key)=>({
    resultSingular:"result",resultPlural:"results",showingFirst:"showing first 100",
    matching:"matching result",matchingPlural:"matching results",
    noResults:"No matching results found. Try a broader search or choose “All sections”.",
    markets:"Markets",opportunities:"Opportunities",resources:"Resources",services:"Services",
    news:"Agricultural News",ebooks:"eBooks",blog:"Blog"
  }[key]||key)}};
  const context = {window,document,location:{search:""},URLSearchParams,console};
  vm.runInNewContext(searchScript, context, {filename:"global-search.js"});
  return {input,type,results,connections,cards,count,records,listeners};
}

const s = setup("fr");
s.input.value = "rabbit-farming";
s.type.value = "eBook";
s.input.listeners.input();
assert.match(s.results.innerHTML, /Rabbit Farming Handbook/, "hyphenated query should match normalized metadata");
assert.match(s.count.textContent, /^1 /, "section filter should limit matching records");

s.input.value = "rabbit farming ebook";
s.type.value = "";
s.input.listeners.input();
assert.match(s.results.innerHTML, /Rabbit Farming Handbook/, "all metadata fields should be searchable");
 s.input.value = "rabbit";
s.input.listeners.input();
assert.match(s.cards.innerHTML, /href="\/fr\/ebooks\//, "eBook connected card should use the selected language");
assert.match(s.cards.innerHTML, /href="\/fr\/blog\//, "Blog connected card should use the selected language");
assert.match(s.cards.innerHTML, /href="\/fr\/agriculture-resources\//, "Resources connected card should use the selected language");
assert.match(s.cards.innerHTML, /href="\/fr\/agricultural-news\//, "Agricultural News connected card should use the selected language");

for (const language of ["fr","ar","pt","sw"]) {
  const localized = setup(language);
  localized.input.value = "rabbit";
  localized.input.listeners.input();
  for (const section of ["ebooks","blog","agriculture-resources","agricultural-news"]) {
    assert.ok(localized.cards.innerHTML.includes(`href="/${language}/${section}/`), `${language} connected card should link to /${language}/${section}/`);
  }
}

s.input.value = "nothing-will-match-this";
s.input.listeners.input();
assert.match(s.results.innerHTML, /No matching results found/, "no-result state should explain what to try");
for (const language of ["en","fr","ar","pt","sw"]) {
  const empty = setup(language);
  empty.input.value = "nothing-will-match-this";
  empty.input.listeners.input();
  const prefix = language === "en" ? "" : "/" + language;
  for (const section of ["ebooks","blog","agriculture-resources","agricultural-news"]) {
    assert.ok(empty.results.innerHTML.includes('href="' + prefix + "/" + section + '/"'),
      language + " no-result state should offer a localized " + section + " destination");
  }
}

s.input.value = "rabbit";
s.type.value = "Blog";
s.type.listeners.change();
assert.match(s.results.innerHTML, /Rabbit housing and feeding/, "Blog filter should return the matching blog");
assert.doesNotMatch(s.results.innerHTML, /Rabbit Farming Handbook/, "Blog filter should exclude eBooks");


/*
 * Integration pass: run the same search script against the actual rendered
 * build index, not only the small fixtures above. CI builds the site before
 * running npm run check, so these are real content/query checks.
 */
const builtSearchPath = path.join(__dirname, "..", "_site", "search", "index.html");
if (fs.existsSync(builtSearchPath)) {
  const builtHtml = fs.readFileSync(builtSearchPath, "utf8");
  const sourceBlock = builtHtml.match(/<div id=["']goa-search-source["'] hidden>([\s\S]*?)<\/div>/i);
  assert.ok(sourceBlock, "built Global Search contains its embedded source index");
  const builtRecords = [...sourceBlock[1].matchAll(/<article\b([^>]*)>/gi)].map((match) => {
    const dataset = {};
    for (const attr of match[1].matchAll(/\bdata-([\w-]+)=["']([^"']*)["']/gi)) {
      const key = attr[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      dataset[key] = attr[2].replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
    }
    return element(dataset);
  });
  assert.ok(builtRecords.length >= 100, "built Global Search indexes at least 100 real records");
  const actual = setup("en", builtRecords);
  const realQueries = [
    ["rabbit farming ebook", null, false],
    ["mushroom farming ebook", "eBook", true],
    ["farm loans", null, true],
    ["organic farming", null, true],
    ["agricultural machinery", null, true],
    ["Nigeria", null, true]
  ];
  for (const [query, section, expectResults] of realQueries) {
    actual.input.value = query;
    actual.type.value = section || "";
    actual.input.listeners.input();
    const count = Number.parseInt(actual.count.textContent, 10);
    if (expectResults) {
      assert.doesNotMatch(actual.results.innerHTML, /goa-search-empty/, "real content query should find results: " + query);
      assert.ok(count > 0, "real content query should return a positive result count: " + query);
      assert.match(actual.results.innerHTML, /href=["'][^"']+["']/, "real results must have clickable destinations: " + query);
    } else {
      assert.equal(count, 0, "query without matching published content should not invent a result: " + query);
      assert.match(actual.results.innerHTML, /No matching results found/, "missing content should show useful empty-state guidance: " + query);
    }
  }
  console.log("Global Search built-content integration checks passed (" + realQueries.length + " realistic queries; " + builtRecords.length + " indexed records).");
} else {
  console.warn("Global Search built-content integration checks skipped: build output not found.");
}

console.log("Global Search interaction tests passed (fixture scenarios plus built-content checks when available).");
