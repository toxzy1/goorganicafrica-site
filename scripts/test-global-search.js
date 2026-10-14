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
function setup(language = "en") {
  const input = element(), type = element(), results = element(), connections = element(), cards = element(), count = element();
  const records = [
    element({type:"eBook",title:"Rabbit Farming Handbook",summary:"Practical smallholder guide",keywords:"rabbit_farming rabbit farming ebook livestock",meta:"Livestock · eBook",url:"/ebooks/rabbit-farming-handbook/"}),
    element({type:"Blog",title:"Rabbit housing and feeding",summary:"Build clean, low-cost rabbit housing",keywords:"rabbit housing",meta:"Livestock · Blog · en",url:"/blog/rabbit-housing-feeding/"}),
    element({type:"Resource",title:"Côte d’Ivoire agricultural inputs",summary:"Official farmer support information",keywords:"fertilizer seed",meta:"Côte d’Ivoire · inputs",url:"/agriculture-resources/"})
  ];
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

s.input.value = "nothing-will-match-this";
s.input.listeners.input();
assert.match(s.results.innerHTML, /No matching results found/, "no-result state should explain what to try");

s.input.value = "rabbit";
s.type.value = "Blog";
s.type.listeners.change();
assert.match(s.results.innerHTML, /Rabbit housing and feeding/, "Blog filter should return the matching blog");
assert.doesNotMatch(s.results.innerHTML, /Rabbit Farming Handbook/, "Blog filter should exclude eBooks");

console.log("Global Search interaction tests passed (4 scenarios).");
