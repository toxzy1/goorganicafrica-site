"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const template = fs.readFileSync(path.join(__dirname, "..", "src", "_includes", "opportunities-directory.njk"), "utf8");
assert.match(template, /data-deadline=/, "opportunity cards expose their deadline for lifecycle filtering");
assert.match(template, /record\.category == 'competition'[\s\S]*?competitions/, "competition category uses the plural translation key");
assert.match(template, /record\.category == 'programme'[\s\S]*?programmes/, "programme category uses its translation key");
assert.match(template, /function dedupeCards\(\)/, "duplicate opportunity cards are removed");
assert.match(template, /recordLifecycle==='expired'/, "expired lifecycle metadata is respected even when status differs");
const match = template.match(/<script>\s*([\s\S]*?)<\/script>/);
assert.ok(match, "opportunity directory filter script exists");

function makeCard({status, deadline, category="grants", search="farm grant"}={}) {
  return {dataset:{status, deadline, category, search}, hidden:false, querySelector(){return null;}, querySelectorAll(){return [];}, innerText:"", remove(){this.removed=true;}};
}
function element(value="") {
  return {value, hidden:false, listeners:{}, addEventListener(name, fn){this.listeners[name]=fn;}};
}
const input=element(), select=element("current"), category=element("all"), empty=element();
const future=makeCard({status:"open",deadline:"2099-12-31",search:"future farm grant"});
const pastDeadline=makeCard({status:"open",deadline:"2020-01-01",search:"old farm grant"});
const closed=makeCard({status:"expired",deadline:"2020-01-01",search:"closed farm grant"});
const noDeadline=makeCard({status:"active",deadline:"",search:"ongoing farm grant"});
const cards=[future,pastDeadline,closed,noDeadline];
const listeners={};
const document={
  querySelectorAll(selector){return selector===".opportunity-card"?cards:[];},
  getElementById(id){return ({"opportunity-search":input,"opportunity-status":select,"opportunity-category":category,"opportunity-empty":empty})[id]||null;},
  addEventListener(name,fn){listeners[name]=fn;}
};
const window={GOA_I18N:{t:(_section,key)=>key}};
vm.runInNewContext(match[1],{document,window,console,Date,Number});
assert.equal(future.hidden,false,"future deadline remains visible in the open filter");
assert.equal(pastDeadline.hidden,true,"open record with a past deadline is hidden from current opportunities");
assert.equal(closed.hidden,true,"closed record is hidden from current opportunities");
assert.equal(noDeadline.hidden,false,"current record without a deadline remains visible");

select.value="expired"; select.listeners.change();
assert.equal(future.hidden,true,"future opportunity is not in the expired archive");
assert.equal(pastDeadline.hidden,false,"past-deadline opportunity appears in the expired archive");
assert.equal(closed.hidden,false,"explicitly expired opportunity appears in the archive");
assert.equal(noDeadline.hidden,true,"current opportunity without a deadline is not in the archive");

select.value="all"; select.listeners.change();
assert.ok(cards.every(card=>!card.hidden),"all filter includes both current and expired records");
input.value="old"; input.listeners.input();
assert.equal(pastDeadline.hidden,false,"search works within the all-status view");
assert.equal(future.hidden,true,"search excludes unrelated opportunities");
console.log("Opportunity lifecycle interaction tests passed (deadline expiry, archive, all-status, and search filters).");
