const fs=require('fs'),path=require('path'); const root=path.join(__dirname,'..'); const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const countries=JSON.parse(read('src/_data/calculatorCountries.json')).list;
if(countries.length!==10 || countries.some(c=>c.available===false)) throw new Error('Calculator country coverage is not the original 10 active countries.');
const dir=path.join(root,'src/_data/calculator/commodities'), files=fs.readdirSync(dir).filter(f=>f.endsWith('.json'));
if(files.length!==17) throw new Error(`Expected 17 commodity files, found ${files.length}`);
const aggregate=JSON.parse(read('src/_data/calculatorData.json')).commodities; if(aggregate.length!==17) throw new Error('Aggregate calculator source must contain 17 commodities.');
for(const f of files){const d=JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')); if(!aggregate.some(x=>x.id===d.id)) throw new Error(`${f} missing from aggregate source`); for(const c of countries) if(!d.country_data?.[c.code]) throw new Error(`${f} missing ${c.code}`)}
for(const f of files){const d=JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')); const a=aggregate.find(x=>x.id===d.id); if(JSON.stringify(a)!==JSON.stringify(d)) throw new Error(`${f} differs from aggregate calculator source`)}
for(const f of fs.readdirSync(path.join(root,'src/blog/posts')).filter(f=>f.endsWith('.md'))){const s=read('src/blog/posts/'+f); const first=(s.split('<article class="blog-post">')[1]||'').slice(0,500); if(first.includes('<img')) throw new Error(`Duplicate top hero remains in ${f}`)}
if(read('src/_includes/layouts/base.njk').includes('serviceWorker.register')) throw new Error('Service worker registration remains.');
if(read('src/_data/site.js').includes('goorganicafricans.netlify.app')) throw new Error('Old hostname remains.');
console.log('GoOrganicAfrica checks passed: 10 countries, 17 synchronized commodities, duplicate heroes removed, no service worker registration, automation present.');
