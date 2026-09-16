const data=require('./siteTranslations.json'); const out={}; (data.languages||[]).forEach(l=>{out[l.code]=l;}); module.exports=out;
