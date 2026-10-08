#!/usr/bin/env node
const fs=require("fs"),path=require("path");
const root=process.cwd(), dir=path.join(root,"src","_data");
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,n),"utf8"));
const today=new Date();
const age=d=>{const x=new Date(d);return isNaN(x)?null:Math.floor((today-x)/86400000)};
const resources=[];
for(const c of read("agriculturalResources.json").countries||[]) for(const list of Object.values(c.records||{})) for(const r of list||[]) resources.push({...r,country_code:c.code});
const resources2=read("agriculturalResourcesSupplement.json").records||[];
const markets=read("agriculturalMarkets.json").records||[];
const opp=read("agriculturalOpportunities.json").records||[];
const news=[];
for(const c of read("agriculturalNews.json").countries||[]) for(const a of c.articles||[]) news.push(a);
news.push(...(read("agriculturalNewsSupplement.json").records||[]),...(read("agriculturalNewsExpansion.json").records||[]));
const report={
 generated_at:today.toISOString(),
 policies:{resource_recheck_days:180,market_recheck_days:45,opportunity_recheck_days:14,news_review_days:30},
 resources:{total:resources.length+resources2.length,stale:resources.concat(resources2).filter(r=>(age(r.verified_date||r.verified)||0)>180).length,missing_source:resources.concat(resources2).filter(r=>!r.url).length},
 markets:{total:markets.length,stale:markets.filter(r=>r.observed_date&&age(r.observed_date)>45).length,missing_observation_date:markets.filter(r=>!r.observed_date&&r.price!=null).length},
 opportunities:{total:opp.length,needs_reverification:opp.filter(r=>(age(r.verified)||0)>14&&["open","active"].includes(String(r.status).toLowerCase())).length,expired:opp.filter(r=>r.deadline&&new Date(r.deadline)<today).length},
 news:{total:news.length,stale:news.filter(r=>(age(r.published)||0)>30).length,review:news.filter(r=>["review","draft","needs_review"].includes(String(r.status||"").toLowerCase())).length},
 action:"Review flagged records in CMS before publication or replacement. This monitor never changes live records."
};
const out=path.join(root,"reports","agricultural-data-monitor.json");fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report,null,2));
