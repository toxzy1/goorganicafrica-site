"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const template = fs.readFileSync(path.join(__dirname, "..", "src", "_includes", "farmer-decision-centre-ui.njk"), "utf8");
const match = template.match(/<script>\s*([\s\S]*?)<\/script>/);
assert.ok(match, "Decision Centre script exists");
const data = [
  {country_code:"NG",section:"resources",title:"Maize production guide",text:"Official guide to maize planting",summary:"Maize guide",date:"2026-09-01",tier:1,url:"https://example.org/maize"},
  {country_code:"NG",section:"news",title:"Nigeria agricultural update",text:"Official agricultural update",summary:"Country update",date:"2026-09-02",tier:2,url:"https://example.org/news"}
];
const goals = [{id:"brief",label:"Full brief",sections:["resources","news"]}];

function setup({countryValue="NG",topicValue="maize",goalValue="brief",sourceData=data,sourceGoals=goals,countryName="Nigeria"}={}) {
  const country={value:countryValue,selectedIndex:1,options:[{text:"Select country"},{text:countryName}],listeners:{},addEventListener(n,fn){this.listeners[n]=fn;}};
  const topic={value:topicValue,selectedIndex:1,options:[{text:"Select topic"},{text:topicValue}],listeners:{},addEventListener(n,fn){this.listeners[n]=fn;}};
  const goal={value:goalValue,listeners:{},addEventListener(n,fn){this.listeners[n]=fn;}};
  const out={innerHTML:""};
  const btn={listeners:{},addEventListener(n,fn){this.listeners[n]=fn;}};
  const docListeners={};
  const document={
    getElementById(id){return ({"dc-country":country,"dc-topic":topic,"dc-goal":goal,"dc-output":out,"dc-build":btn})[id]||null;},
    addEventListener(n,fn){docListeners[n]=fn;}
  };
  const window={GOA_I18N:{t:(_section,key)=>({chooseCountry:"Please select a country first.",chooseTopic:"Choose a topic and click",buildButton:"Build brief",initialPrompt:"Select a country and topic",briefHeading:"Agricultural brief: ",verifiedDate:"Verified",notStated:"Not stated",sourceTier:"Source tier",openSource:"Open source",noMatch:"No matching records"}[key]||key)}};
  const code=match[1]
    .replace("{{ agriculturalDecisionCentre.json | safe }}",JSON.stringify(sourceData))
    .replace("{{ agriculturalDecisionCentre.goals | dump | safe }}",JSON.stringify(sourceGoals));
  assert.ok(!code.includes("{{ agriculturalDecisionCentre"),"Nunjucks data expressions replaced for test");
  vm.runInNewContext(code,{window,document,console});
  return {country,topic,goal,out,btn,docListeners};
}
{
  const s=setup({topicValue:"maize"}); s.btn.listeners.click();
  assert.match(s.out.innerHTML,/Maize production guide/,"exact topic match should show the matching record");
  assert.doesNotMatch(s.out.innerHTML,/No exact matches/,"exact match should not show fallback warning");
}
{
  const s=setup({topicValue:"rice"}); s.btn.listeners.click();
  assert.match(s.out.innerHTML,/No exact matches for this topic/,"missing topic match should explain the fallback");
  assert.match(s.out.innerHTML,/Maize production guide/,"fallback should show country-level records");
  assert.match(s.out.innerHTML,/Nigeria agricultural update/,"fallback should retain all allowed sections");
}
{
  const s=setup({countryValue:""}); s.btn.listeners.click();
  assert.match(s.out.innerHTML,/Please select a country first/,"missing country should produce a clear prompt");
}
{
  const s=setup({topicValue:"maize"}); s.docListeners["goa:languagechange"]();
  assert.match(s.out.innerHTML,/Maize production guide/,"language change should rerender the selected brief");
}

/*
 * Integration pass: execute the real Decision Centre script with the data
 * embedded in the generated site. The full-brief goal and a real country are
 * selected dynamically so the test remains useful as source records evolve.
 */
const builtDecisionPath = path.join(__dirname, "..", "_site", "farmer-decision-centre", "index.html");
if (fs.existsSync(builtDecisionPath)) {
  const builtHtml = fs.readFileSync(builtDecisionPath, "utf8");
  const builtMatch = builtHtml.match(/const data=(\[[\s\S]*?\]);\s*const goals=(\[[\s\S]*?\]);/);
  assert.ok(builtMatch, "built Decision Centre embeds source records and goal definitions");
  const realData = JSON.parse(builtMatch[1]);
  const realGoals = JSON.parse(builtMatch[2]);
  assert.ok(realData.length >= 100, "built Decision Centre has a useful volume of real records");
  const fullGoal = realGoals.reduce((best, item) =>
    !best || (item.sections || []).length > (best.sections || []).length ? item : best, null);
  assert.ok(fullGoal && fullGoal.id && Array.isArray(fullGoal.sections), "built Decision Centre has a valid broad goal");
  const realRecord = realData.find(item => item.country_code && fullGoal.sections.includes(item.section) && item.url);
  assert.ok(realRecord, "built Decision Centre has a real country/section/source combination");
  const actual = setup({
    countryValue:realRecord.country_code,
    topicValue:"qa-topic-that-cannot-match-any-record",
    goalValue:fullGoal.id,
    sourceData:realData,
    sourceGoals:realGoals,
    countryName:realRecord.country_code
  });
  actual.btn.listeners.click();
  assert.match(actual.out.innerHTML,/No exact matches for this topic/, "real-data fallback should explain that the topic had no exact match");
  assert.match(actual.out.innerHTML,/Open source/, "real-data fallback should provide a source-opening action");
  assert.match(actual.out.innerHTML,/href=['"][^'"]+['"]/, "real-data fallback recommendations should have clickable destinations");
  console.log("Decision Centre built-content integration check passed (" + realData.length + " records; country " + realRecord.country_code + ").");
} else {
  console.warn("Decision Centre built-content integration check skipped: build output not found.");
}

console.log("Decision Centre interaction tests passed (fixture scenarios plus built-content check when available).");
