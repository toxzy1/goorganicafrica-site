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
const sourceUrlAudit=(records)=>{
 const counts=new Map();
 for(const r of records){if(!r.url)continue;const url=String(r.url).trim();counts.set(url,(counts.get(url)||0)+1);}
 const duplicateGroups=[...counts.entries()].filter(([,count])=>count>1).sort((a,b)=>b[1]-a[1]);
 const genericRecords=records.filter(r=>{
  if(!r.url)return false;
  try{
   const u=new URL(r.url);
   return u.pathname==="/"||/^\/(?:latest-news|news-detail|projects-list|call-for-proposals)\/?$/i.test(u.pathname)||/^\/en\/(?:sectors|)$/.test(u.pathname);
  }catch{return true;}
 });
 return {
  records_with_url:records.filter(r=>r.url).length,
  unique_urls:counts.size,
  duplicate_url_groups:duplicateGroups.length,
  duplicate_url_records:duplicateGroups.reduce((sum,[,count])=>sum+count,0),
  duplicate_url_examples:duplicateGroups.slice(0,10).map(([url,count])=>({url,count})),
  generic_landing_page_records:genericRecords.length,
  generic_landing_page_examples:genericRecords.slice(0,10).map(r=>({title:r.title||"",url:r.url}))
 };
};
const sourceQuality={
 news:sourceUrlAudit(news),
 opportunities:sourceUrlAudit(opp),
 resources:sourceUrlAudit(resources.concat(resources2))
};
const report={
 generated_at:today.toISOString(),
 policies:{resource_recheck_days:180,market_recheck_days:45,opportunity_recheck_days:14,news_review_days:30},
 resources:{total:resources.length+resources2.length,stale:resources.concat(resources2).filter(r=>{const d=r.verified_date||r.verified;return !d||age(d)===null||age(d)>180;}).length,missing_verification_date:resources.concat(resources2).filter(r=>!(r.verified_date||r.verified)).length,missing_source:resources.concat(resources2).filter(r=>!r.url).length},
 markets:{total:markets.length,stale:markets.filter(r=>r.observed_date&&(age(r.observed_date)===null||age(r.observed_date)>45)).length,missing_observation_date:markets.filter(r=>!r.observed_date&&r.price!=null).length},
 opportunities:{total:opp.length,review:opp.filter(r=>["review","draft","needs_review"].includes(String(r.status||"").toLowerCase())||String(r.lifecycle||"").toLowerCase()==="needs_review").length,needs_reverification:opp.filter(r=>["open","active"].includes(String(r.status).toLowerCase())&&(!r.verified||age(r.verified)===null||age(r.verified)>14)).length,missing_verification_date:opp.filter(r=>!(r.verified)).length,expired:opp.filter(r=>r.deadline&&age(r.deadline)!==null&&new Date(r.deadline)<today).length,invalid_deadline_date:opp.filter(r=>r.deadline&&age(r.deadline)===null).length},
 news:{total:news.length,stale:news.filter(r=>{const d=r.published||r.date;return !d||age(d)===null||age(d)>30;}).length,missing_publication_date:news.filter(r=>!(r.published||r.date)).length,review:news.filter(r=>["review","draft","needs_review"].includes(String(r.status||"").toLowerCase())||String(r.lifecycle||"").toLowerCase()==="needs_review").length},
 source_quality:sourceQuality,
 action:"Review flagged records in CMS before publication or replacement. Duplicate and generic-source findings are review flags only; this monitor never deletes or changes live records."
};
const out=path.join(root,"reports","agricultural-data-monitor.json");fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report,null,2));
