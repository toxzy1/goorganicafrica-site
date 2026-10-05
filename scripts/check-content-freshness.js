const fs=require("fs");
const path=require("path");
const news=JSON.parse(fs.readFileSync(path.join(process.cwd(),"src/_data/agriculturalNews.json"),"utf8"));
const resources=JSON.parse(fs.readFileSync(path.join(process.cwd(),"src/_data/agriculturalResources.json"),"utf8"));
const today=Date.now();
const days=(d)=>Math.floor((today-new Date(d+"T23:59:59Z").getTime())/86400000);
const report={news_empty:[],news_stale:[],resource_empty:[],resource_stale:[]};

for(const c of news.countries){
  const a=c.articles||[];
  if(!a.length) report.news_empty.push(c.name);
  for(const x of a) if(x.verified && days(x.verified)>30) report.news_stale.push(c.name+" — "+x.title);
}
for(const c of resources.countries){
  const r=c.records||{};
  if(!(r.finance||[]).length && !(r.grants||[]).length && !(r.machinery||[]).length) report.resource_empty.push(c.name);
  for(const cat of ["finance","grants","machinery","general"]){
    for(const x of (r[cat]||[])) if(x.verified && days(x.verified)>45) report.resource_stale.push(c.name+" — "+cat+" — "+x.title);
  }
}
console.log(JSON.stringify(report,null,2));
if(report.news_empty.length || report.resource_empty.length || report.news_stale.length || report.resource_stale.length) process.exitCode=2;
