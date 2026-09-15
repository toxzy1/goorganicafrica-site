const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const json = p => JSON.parse(read(p));

const countries = json('src/_data/calculatorCountries.json').list || [];
if (!countries.length || countries.some(c => !c.code || !c.name || c.available === undefined)) throw new Error('Country registry is incomplete.');
const activeCountries = countries.filter(c => c.available !== false);
if (!activeCountries.length) throw new Error('No active calculator countries.');

const regionsSource = json('src/_data/calculator/regions.json');
const regionRecords = Array.isArray(regionsSource.regions) ? regionsSource.regions : Object.entries(regionsSource).map(([country_code, regions]) => ({country_code, regions}));
for (const c of activeCountries) {
  if (!regionRecords.some(r => r.country_code === c.code)) throw new Error(`Missing regions for active country ${c.code}`);
}

const dir = path.join(root, 'src/_data/calculator/commodities');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
const aggregate = json('src/_data/calculatorData.json').commodities || [];
if (!aggregate.length) throw new Error('Aggregate calculator source is empty.');
for (const f of files) {
  const d = json('src/_data/calculator/commodities/' + f);
  const a = aggregate.find(x => x.id === d.id);
  if (d.active === undefined) throw new Error(`${f} missing active flag`);
  if (!a) throw new Error(`${f} missing from aggregate source`);
  if (JSON.stringify(a) !== JSON.stringify(d)) throw new Error(`${f} differs from aggregate calculator source`);
  const cd = Array.isArray(d.country_data) ? d.country_data : Object.entries(d.country_data || {}).map(([country_code, data]) => ({country_code, ...data}));
  for (const c of activeCountries) if (!cd.some(x => x.country_code === c.code)) throw new Error(`${f} missing ${c.code}`);
}

for (const f of fs.readdirSync(path.join(root, 'src/blog/posts')).filter(f => f.endsWith('.md'))) {
  const front = read('src/blog/posts/' + f);
  if (!/^meta_title:\s*.+/m.test(front) || !/^meta_description:\s*.+/m.test(front)) throw new Error(`SEO metadata missing in ${f}`);
  const s = read('src/blog/posts/' + f);
  const first = (s.split('<article class="blog-post">')[1] || '').slice(0, 500);
  if (first.includes('<img')) throw new Error(`Duplicate top hero remains in ${f}`);
}
if (read('src/_includes/layouts/base.njk').includes('serviceWorker.register')) throw new Error('Service worker registration remains.');
if (/https:\/\/goorganicafrica\.netlify\.app|https:\/\/goorganicafricans\.netlify\.app/.test(read('src/robots.njk') + read('src/_data/site.js'))) throw new Error('Old Netlify hostname remains in SEO/site configuration.');
if (!fs.existsSync(path.join(root, 'src/robots.njk'))) throw new Error('robots.txt template missing.');
if (!fs.existsSync(path.join(root, 'src/sitemap.njk'))) throw new Error('sitemap template missing.');
if (!read('src/robots.njk').includes('{{ site.url }}/sitemap.xml')) throw new Error('robots.txt does not point to the dynamic sitemap.');
if (!read('package.json').includes('node scripts/check-links.js')) throw new Error('Build is not protected by the internal link checker.');
if (fs.existsSync(path.join(root, 'src/_data/calculatorEnterprises.json')) || fs.existsSync(path.join(root, 'src/_data/calculator/countries.json'))) throw new Error('Legacy calculator source files remain; use the dynamic country/enterprise sources.');
if (!read('admin/config.yml').includes('Selar Checkout Link')) throw new Error('Selar admin field missing.');
if (!read('admin/config.yml').includes('Google AdSense')) throw new Error('AdSense admin controls missing.');
if (!read('admin/config.yml').includes('seed_price')) throw new Error('Seed-price admin field missing.');
for (const f of fs.readdirSync(path.join(root, 'src/ebooks')).filter(f => f.endsWith('.md'))) {
  const front = read('src/ebooks/' + f);
  if (!/^meta_title:\s*.+/m.test(front) || !/^meta_description:\s*.+/m.test(front)) throw new Error(`SEO metadata missing in ${f}`);
}
if (!fs.existsSync(path.join(root, 'src/blog-categories/blog-categories.11tydata.js'))) throw new Error('Blog category output protection is missing.');

if (!read('admin/config.yml').includes('Search Terms / Synonyms')) throw new Error('Ebook search-term control missing.');
if (!read('admin/config.yml').includes('SEO Meta Title')) throw new Error('Ebook SEO title control missing.');
if (!read('src/_includes/layouts/base.njk').includes('site.meta_title')) throw new Error('Global SEO title fallback is not wired to site settings.');
if (!read('src/_includes/layouts/base.njk').includes('site.meta_description')) throw new Error('Global SEO description fallback is not wired to site settings.');
if (!read('src/_includes/layouts/base.njk').includes('{% if meta_title %}')) throw new Error('Custom meta titles may be duplicated with the site name.');
if (!read('src/sitemap.njk').includes('/data-updates/')) throw new Error('Data updates page missing from sitemap.');
if (!read('src/ebooks/ebooks.11tydata.js').includes('active === false ? false')) throw new Error('Inactive eBooks are not protected from output.');
if (!read('src/blog/posts/posts.11tydata.js').includes('active === false ? false')) throw new Error('Inactive blog posts are not protected from output.');
if (!read('src/_data/site.js').includes('replace(/\\/+$/, "")')) throw new Error('Canonical site URL is not normalized.');
if (read('admin/index.html').includes('netlifyIdentity') || read('admin/index.html').includes('identity.netlify.com')) throw new Error('Legacy Netlify Identity admin auth remains.');
if (read('src/index.njk').includes('Countries reached')) throw new Error('Hard-coded country-reach statistic remains on homepage.');

if (read('src/sitemap.njk').includes('/tools/farm-profit-calculator/')) throw new Error('Sitemap still contains legacy calculator URL; use the canonical calculator path.');
if (!read('.eleventy.js').includes('item.data.active !== false')) throw new Error('Blog post collection is not protected by active status.');
if (!read('admin/config.yml').includes('Turn off to hide this article from listings and the sitemap')) throw new Error('Blog active control missing.');

console.log(`GoOrganicAfrica checks passed: ${activeCountries.length} active countries, ${aggregate.length} synchronized enterprises, dynamic data/admin controls, Selar support, AdSense controls, and agricultural data automation.`);
