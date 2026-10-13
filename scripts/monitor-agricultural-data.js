#!/usr/bin/env node
const fs=require("fs"),path=require("path");
const root=process.cwd(), dir=path.join(root,"src","_data");
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,n),"utf8"));
const today=new Date();
const age=d=>{const x=new Date(d);return isNaN(x)?null:Math.floor((today-x)/86400000)};
const resources=[];
for(const c of read("agriculturalResources.json").countries||[]) for(const [category,list] of Object.entries(c.records||{})) for(const r of list||[]) resources.push({...r,category:r.category||category,country_code:c.code});
const resources2=read("agriculturalResourcesSupplement.json").records||[];
const resourceGapFiles=fs.readdirSync(dir).filter(name=>/^agriculturalResourcesGap(?:[A-Z]{2}|Batch)\.json$/.test(name)).sort();
const resourceGapRecords=resourceGapFiles.flatMap(name=>read(name).records||[]);
const allResourceRecords=resources.concat(resources2,resourceGapRecords);
const isResourceReviewRecord=r=>["review","needs_review","draft","rejected"].includes(String(r.status||"").toLowerCase())||["review","needs_review","draft","rejected"].includes(String(r.lifecycle||"").toLowerCase());
const publicResourceRecords=[...resources,...resources2].filter(r=>!isResourceReviewRecord(r));
const reviewResourceRecords=[...resources,...resources2].filter(isResourceReviewRecord);
const resourceQueue=resourceGapRecords.concat(reviewResourceRecords);
const markets=read("agriculturalMarkets.json").records||[];
const services=read("agriculturalServices.json").records||[];
const opp=read("agriculturalOpportunities.json").records||[];
const news=[];
const newsCountryList=read("agriculturalNews.json").countries||[];
for(const c of newsCountryList) for(const a of c.articles||[]) news.push({...a,country_code:c.code,country_name:c.name});
news.push(...(read("agriculturalNewsSupplement.json").records||[]),...(read("agriculturalNewsExpansion.json").records||[]));
// Coverage must include the supplemental and expansion records too, otherwise
// countries with stories outside the base file are incorrectly reported empty.
// Count unique story URLs per country so duplicate records do not inflate coverage.
const isSpecificNewsUrl=value=>{
 try{
  const parsed=new URL(String(value||""));
  const pathname=parsed.pathname.replace(/\/+$/,"")||"/";
  if(/\/hand-in-hand\/investment-forum-2026\//i.test(pathname))return false;
  return !(pathname==="/"||/(?:^|\/)(?:latest-news|news-detail|projects-list|call-for-proposals|news-keywords\/agriculture|sectors\/A|news|news-updates|actualites|capacity-development-office)(?:\/en)?$/i.test(pathname)||/^\/en$/i.test(pathname)||/\/newsdetails(?:\/en)?$/i.test(pathname)||/\/news\/detail(?:\/en)?$/i.test(pathname));
 }catch{return false;}
};
const isCurrentNewsRecord=r=>{
 const status=String(r.status||"").toLowerCase();
 const lifecycle=String(r.lifecycle||"").toLowerCase();
 if(!["official","published","verified"].includes(status)||["review","needs_review","draft","rejected","expired","closed","archived","historical"].includes(lifecycle))return false;
 if(["expired","closed","archived","historical"].includes(status))return false;
 const deadline=r.deadline||r.expiry_date||r.closing_date||"";
 if(deadline){const d=new Date(deadline);if(!Number.isNaN(d.getTime())&&d<today)return false;}
 const published=r.published||r.date||"";
 if(published){const d=new Date(published);if(!Number.isNaN(d.getTime())&&d<new Date(today.getTime()-180*86400000))return false;}
 return Boolean((r.title||r.headline)&&isSpecificNewsUrl(r.url));
};
const publishableNews=news.filter(isCurrentNewsRecord);
const newsCountryCoverage=newsCountryList.map(c=>{
 const code=String(c.code||"").toUpperCase();
 // Coverage counts only stories the public templates can display; review-queue
 // candidates must not hide a real country coverage gap.
 const countryRecords=publishableNews.filter(r=>String(r.country_code||r.code||"").toUpperCase()===code);
 const urls=new Set(countryRecords.map(r=>String(r.url||r.title||"").trim()).filter(Boolean));
 const sources=new Set(countryRecords.map(r=>String(r.source||r.publisher||"").trim()).filter(Boolean));
 return {code:c.code,name:c.name,story_count:urls.size,source_count:sources.size};
});
const sourceUrlAudit=(records, resourceMode=false, kind="generic")=>{
 const sourceUrl=r=>String(r.url||r.source_url||r.application_url||"").trim();
 const counts=new Map(), recordsByUrl=new Map(), duplicateCounts=new Map(), duplicateRecordsByKey=new Map();
 for(const r of records){
  const url=sourceUrl(r);if(!url)continue;
  counts.set(url,(counts.get(url)||0)+1);
  if(!recordsByUrl.has(url))recordsByUrl.set(url,[]);
  recordsByUrl.get(url).push(r);
  const country=String(r.country_code||r.code||r.country||r.country_name||"unassigned").toUpperCase();
  const duplicateKey=kind==="markets" ? [url,country,r.commodity||"",r.market||"",r.observed_date||r.date||""].join("|") : url;
  duplicateCounts.set(duplicateKey,(duplicateCounts.get(duplicateKey)||0)+1);
  if(!duplicateRecordsByKey.has(duplicateKey))duplicateRecordsByKey.set(duplicateKey,[]);
  duplicateRecordsByKey.get(duplicateKey).push(r);
 }
 const duplicateGroups=[...duplicateCounts.entries()].filter(([,count])=>count>1).sort((a,b)=>b[1]-a[1]);
 const sameCountryGroups=[],crossCountryGroups=[];
 if(kind==="markets"){
  for(const [key,group] of duplicateRecordsByKey){
   if(group.length<2)continue;
   const sample=group[0];
   sameCountryGroups.push({url:sourceUrl(sample),records:group.length,countries:[String(sample.country_code||sample.code||sample.country||"unassigned").toUpperCase()],commodity:sample.commodity||"",market:sample.market||"",observed_date:sample.observed_date||sample.date||""});
  }
 }else{
  for(const [url,group] of recordsByUrl){
   if(group.length<2)continue;
   const byCountry=new Map();
   for(const record of group){
    const country=String(record.country_code||record.code||record.country||record.country_name||"unassigned").toUpperCase();
    byCountry.set(country,(byCountry.get(country)||0)+1);
   }
   if([...byCountry.values()].some(count=>count>1))sameCountryGroups.push({url,records:group.length,countries:[...byCountry.keys()]});
  }
 }
 for(const [url,group] of recordsByUrl){
  if(group.length<2)continue;
  const byCountry=new Set(group.map(record=>String(record.country_code||record.code||record.country||record.country_name||"unassigned").toUpperCase()));
  if(byCountry.size>1)crossCountryGroups.push({url,records:group.length,countries:[...byCountry]});
 }
 const genericRecords=records.filter(r=>{
  const url=sourceUrl(r);
  if(!url)return false;
  if(kind==="markets" && r.price!==null && r.price!==undefined && String(r.commodity||"").trim() && String(r.market||"").trim())return false;
  try{
   const u=new URL(url);
   const pathname=u.pathname.replace(/\/+$/, "")||"/";
   if(resourceMode && pathname==="/" && u.searchParams.has("page_id"))return false;
   const commonGeneric=pathname==="/"||/(?:^|\/)(?:latest-news|news-detail|projects-list|call-for-proposals|news-keywords\/agriculture|sectors\/A|news|news-updates|actualites|capacity-development-office)(?:\/en)?$/i.test(pathname)||/\/newsdetails(?:\/en)?$/i.test(pathname)||/\/news\/detail(?:\/en)?$/i.test(pathname)||/^\/en$/.test(pathname);
   const investmentProfile=/\/hand-in-hand\/investment-forum-2026\//i.test(pathname);
   const regionalOverview=/\/twenty-african-countries-to-present-agrifood-investment-opportunities-at-the-2026-hand-in-hand-investment-forum(?:\/en)?$/i.test(pathname);
   const generic=commonGeneric||(resourceMode?regionalOverview:investmentProfile);
   if(!generic)return false;
   if(resourceMode && (pathname==="/"||/^\/en$/.test(pathname))){
    const title=String(r.title||r.name||"");
    const institutional=/\b(ministry|authority|department|agency|institute|centre|center|fund|council|office|commission|bureau|government|research center|research centre|university|directorate|board|service)\b/i.test(title);
    const portal=/\b(platform|portal|system|database|information system|advisory tool|digital service)\b/i.test(title);
    const cat=String(r.category||"").toLowerCase().replace("policy","general").replace("weather-climate","climate");
    if(institutional && ["general","data","farmer-support"].includes(cat))return false;
    if(portal && ["general","data","farmer-support","inputs","markets"].includes(cat))return false;
   }
   if(kind==="services" && (pathname==="/"||/^\/en$/.test(pathname))){
    const title=String(r.title||r.provider||"");
    const institutional=/\b(ministry|authority|department|agency|institute|centre|center|fund|council|office|commission|bureau|government|research center|research centre|university|directorate|board|service)\b/i.test(title);
    const cat=String(r.category||"").toLowerCase();
    if(institutional && ["machinery","suppliers","training","services","general"].includes(cat))return false;
   }
   return true;
  }catch{return true;}
 });
 return {
  records_with_url:records.filter(r=>sourceUrl(r)).length,
  unique_urls:counts.size,
  duplicate_url_groups:duplicateGroups.length,
  duplicate_url_records:duplicateGroups.reduce((sum,[,count])=>sum+count,0),
  duplicate_url_same_country_groups:sameCountryGroups.length,
  duplicate_url_same_country_examples:sameCountryGroups.slice(0,8),
  duplicate_url_cross_country_groups:crossCountryGroups.length,
  duplicate_url_cross_country_examples:crossCountryGroups.slice(0,8),
  duplicate_url_examples:duplicateGroups.slice(0,10).map(([key,count])=>({url:sourceUrl(duplicateRecordsByKey.get(key)[0]),count,commodity:duplicateRecordsByKey.get(key)[0].commodity||"",market:duplicateRecordsByKey.get(key)[0].market||""})),
  generic_landing_page_records:genericRecords.length,
  generic_landing_page_examples:genericRecords.slice(0,10).map(r=>({title:r.title||r.name||"",url:sourceUrl(r)}))
 };
};
const publishableOpportunities=opp.filter(r=>!isResourceReviewRecord(r));
const opportunityReviewQueue=opp.filter(isResourceReviewRecord);
const newsReviewQueue=news.filter(r=>!["official","published","verified"].includes(String(r.status||"").toLowerCase())||isResourceReviewRecord(r));
const publishableMarkets=markets.filter(r=>!isResourceReviewRecord(r)&&!["expired","closed"].includes(String(r.status||"").toLowerCase())&&!["expired","closed","historical"].includes(String(r.lifecycle||"").toLowerCase()));
const marketReviewQueue=markets.filter(r=>!publishableMarkets.includes(r));
const publishableServices=services.filter(r=>!isResourceReviewRecord(r)&&!["expired","closed"].includes(String(r.status||"").toLowerCase())&&!["expired","closed","historical"].includes(String(r.lifecycle||"").toLowerCase()));
const serviceReviewQueue=services.filter(r=>!publishableServices.includes(r));
const sourceQuality={
 news:sourceUrlAudit(publishableNews,false,"news"),
 news_review_queue:sourceUrlAudit(newsReviewQueue,false,"news"),
 opportunities:sourceUrlAudit(publishableOpportunities,false,"opportunities"),
 opportunity_review_queue:sourceUrlAudit(opportunityReviewQueue,false,"opportunities"),
 resources:sourceUrlAudit(publicResourceRecords,true,"resources"),
 resource_review_queue:sourceUrlAudit(resourceQueue,true,"resources"),
 markets:sourceUrlAudit(publishableMarkets,false,"markets"),
 market_review_queue:sourceUrlAudit(marketReviewQueue,false,"markets"),
 services:sourceUrlAudit(publishableServices,false,"services"),
 service_review_queue:sourceUrlAudit(serviceReviewQueue,false,"services")
};
const report={
 generated_at:today.toISOString(),
 policies:{resource_recheck_days:180,market_recheck_days:45,opportunity_recheck_days:14,news_review_days:30},
 resources:{total:publicResourceRecords.length,stale:publicResourceRecords.filter(r=>{const d=r.verified_date||r.verified;return !d||age(d)===null||age(d)>180;}).length,missing_verification_date:publicResourceRecords.filter(r=>!(r.verified_date||r.verified)).length,missing_source:publicResourceRecords.filter(r=>!r.url).length},
 resource_review_queue:{total:resourceQueue.length,missing_verification_date:resourceQueue.filter(r=>!(r.verified_date||r.verified)).length,missing_source:resourceQueue.filter(r=>!r.url&&!r.source_url).length},
 markets:{total:publishableMarkets.length,stale:publishableMarkets.filter(r=>r.observed_date&&(age(r.observed_date)===null||age(r.observed_date)>45)).length,missing_observation_date:publishableMarkets.filter(r=>!r.observed_date&&r.price!=null).length},
 market_review_queue:{total:marketReviewQueue.length,missing_observation_date:marketReviewQueue.filter(r=>!r.observed_date&&r.price!=null).length},
 services:{total:publishableServices.length,stale:publishableServices.filter(r=>{const d=r.verified_date||r.verified;return !d||age(d)===null||age(d)>180;}).length,missing_verification_date:publishableServices.filter(r=>!(r.verified_date||r.verified)).length},
 service_review_queue:{total:serviceReviewQueue.length,missing_verification_date:serviceReviewQueue.filter(r=>!(r.verified_date||r.verified)).length},
 opportunities:{total:opp.length,review:opp.filter(r=>["review","draft","needs_review"].includes(String(r.status||"").toLowerCase())||String(r.lifecycle||"").toLowerCase()==="needs_review").length,needs_reverification:opp.filter(r=>["open","active"].includes(String(r.status).toLowerCase())&&(!r.verified||age(r.verified)===null||age(r.verified)>14)).length,missing_verification_date:opp.filter(r=>!(r.verified)).length,expired:opp.filter(r=>r.deadline&&age(r.deadline)!==null&&new Date(r.deadline)<today).length,invalid_deadline_date:opp.filter(r=>r.deadline&&age(r.deadline)===null).length},
 news:{total:news.length,stale:news.filter(r=>{const d=r.published||r.date;return !d||age(d)===null||age(d)>30;}).length,missing_publication_date:news.filter(r=>!(r.published||r.date)).length,future_publication_dates:news.filter(r=>{const d=r.published||r.date;return d&&age(d)!==null&&age(d)<0;}).map(r=>({country_code:r.country_code||r.code||"",title:r.title||"",published:r.published||r.date,url:r.url||"",lifecycle:r.lifecycle||""})),review:news.filter(r=>["review","draft","needs_review"].includes(String(r.status||"").toLowerCase())||String(r.lifecycle||"").toLowerCase()==="needs_review").length},
 news_country_coverage:{countries:newsCountryCoverage.length,zero_story_countries:newsCountryCoverage.filter(c=>c.story_count===0),single_story_countries:newsCountryCoverage.filter(c=>c.story_count===1),under_four_story_countries:newsCountryCoverage.filter(c=>c.story_count<4),single_source_countries:newsCountryCoverage.filter(c=>c.source_count===1),under_three_sources_countries:newsCountryCoverage.filter(c=>c.source_count<3),coverage_by_country:newsCountryCoverage},
 source_quality:sourceQuality,
 action:"Review flagged records in CMS before publication or replacement. Duplicate and generic-source findings are review flags only; this monitor never deletes or changes live records."
};
const out=path.join(root,"reports","agricultural-data-monitor.json");fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report,null,2));
