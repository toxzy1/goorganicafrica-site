const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const json = p => JSON.parse(read(p));

const countries = json('src/_data/calculatorCountries.json').list || [];
if (!countries.length || countries.some(c => !c.code || !c.name || c.available === undefined)) throw new Error('Country registry is incomplete.');
const activeCountries = countries.filter(c => c.available !== false);
const calculatorCountries = activeCountries.filter(c => c.directory_only !== true);
if (!activeCountries.length) throw new Error('No active calculator countries.');

const regionsSource = json('src/_data/calculator/regions.json');
const regionRecords = Array.isArray(regionsSource.regions) ? regionsSource.regions : Object.entries(regionsSource).map(([country_code, regions]) => ({country_code, regions}));
for (const c of calculatorCountries) {
  if (!regionRecords.some(r => r.country_code === c.code)) throw new Error(`Missing regions for calculator country ${c.code}`);
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
  for (const c of calculatorCountries) if (!cd.some(x => x.country_code === c.code)) throw new Error(`${f} missing ${c.code}`);
}

for (const f of fs.readdirSync(path.join(root, 'src/blog/posts')).filter(f => f.endsWith('.md'))) {
  const front = read('src/blog/posts/' + f);
  if (!/^meta_title:\s*.+/m.test(front) || !/^meta_description:\s*.+/m.test(front)) throw new Error(`SEO metadata missing in ${f}`);
  const first = (front.split('<article class="blog-post">')[1] || '').slice(0, 500);
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
if (!read('src/ebooks/ebooks.11tydata.js').includes('data.active === false')) throw new Error('Inactive eBooks are not protected from output.');
if (!read('src/blog/posts/posts.11tydata.js').includes('data.active === false')) throw new Error('Inactive blog posts are not protected from output.');
if (!read('src/_data/site.js').includes('replace(/\\/+$/, "")')) throw new Error('Canonical site URL is not normalized.');
if (read('admin/index.html').includes('netlifyIdentity') || read('admin/index.html').includes('identity.netlify.com')) throw new Error('Legacy Netlify Identity admin auth remains.');
if (read('src/index.njk').includes('Countries reached')) throw new Error('Hard-coded country-reach statistic remains on homepage.');
if (read('src/sitemap.njk').includes('/tools/farm-profit-calculator/')) throw new Error('Sitemap still contains legacy calculator URL; use the canonical calculator path.');
if (!read('.eleventy.js').includes('item.data.active !== false')) throw new Error('Blog post collection is not protected by active status.');
if (!read('admin/config.yml').includes('Turn off to hide this article from listings and the sitemap')) throw new Error('Blog active control missing.');
if (fs.existsSync(path.join(root, 'src/localized/calculator.njk'))) throw new Error('Legacy country-only calculator generator remains; use country/language calculator routes.');
if (fs.existsSync(path.join(root, '.github/workflows/extract-project.yml')) || fs.existsSync(path.join(root, '.github/workflows/extract-corrected-site.yml'))) throw new Error('Legacy extraction workflow remains and could overwrite the maintained source tree.');
for (const legacyZip of ['GoOrganicAfrica-CORRECTED-FINAL.zip','GoOrganicAfrica-FINAL-REBUILT (1).zip','GoOrganicAfrica-FINAL-REBUILT (2).zip','GoOrganicAfrica-FINAL-REBUILT (2).zip..zip','GoOrganicAfrica-FINAL-SCALABLE-LOCALIZATION-FIX.zip']) if (fs.existsSync(path.join(root, legacyZip))) throw new Error(`Legacy project archive remains: ${legacyZip}`);
const redirects = read('src/_redirects');
for (const code of calculatorCountries.map(c => String(c.code).toLowerCase())) {
  if (!redirects.includes(`/${code}/farm-profit-calculator/ /${code}/en/farm-profit-calculator/ 301`)) throw new Error(`Legacy calculator redirect missing for ${code}`);
}
if (!read('src/sitemap.njk').includes('calculatorLocales')) throw new Error('Localized calculator pages are missing from sitemap.');

const languageSwitcher = read('src/js/language-switcher.js');
if (!languageSwitcher.includes('search|farmer-decision-centre|markets|opportunities|agricultural-services|my-agriculture|agricultural-intelligence') ||
    !languageSwitcher.includes('privacy-policy|data-updates')) {
  throw new Error('Shared pages must preserve the selected language on their single-URL routes.');
}
if (!languageSwitcher.includes('if (/^(search|farmer-decision-centre|markets|opportunities|agricultural-services|my-agriculture|agricultural-intelligence|agriculture-resources|agricultural-news)$/.test(rest))')) {
  throw new Error('Language switching must keep shared discovery tools on their actual routes.');
}
if (!languageSwitcher.includes('link.href = "/" + sectionPath + "/";')) {
  throw new Error('Shared discovery navigation must not create missing language-prefixed routes.');
}
const currentNewsTemplates = ['src/agricultural-news-country.njk','src/fr/agricultural-news-country.njk','src/ar/agricultural-news-country.njk','src/pt/agricultural-news-country.njk','src/sw/agricultural-news-country.njk'];
if (currentNewsTemplates.some(p => !read(p).includes('candidate.status == "official"') || !read(p).includes(') and (not candidate.lifecycle or candidate.lifecycle == "current")')) ||
    !read('src/agricultural-news.njk').includes('(not article.lifecycle or article.lifecycle == "current")')) {
  throw new Error('Every localized country-news page must require an approved publication status and treat missing lifecycle metadata as current; explicit non-current lifecycle values remain hidden.');
}

const localizedNewsTemplates = ['src/fr/agricultural-news-country.njk','src/ar/agricultural-news-country.njk','src/pt/agricultural-news-country.njk','src/sw/agricultural-news-country.njk'];
if (localizedNewsTemplates.some(p => !read(p).includes('class="translation-pending-note"') ||
    !read(p).includes('translated and translated.title and translated.summary') ||
    !read(p).includes('article.translation_status == "translated"'))) {
  throw new Error('Localized news pages must show only reviewed translations and flag pending translations.');
}

const resourcesDirectoryTemplate = read('src/_includes/resources-directory.njk');
if (!resourcesDirectoryTemplate.includes('translation-pending-note') ||
    !resourcesDirectoryTemplate.includes('translationPending') ||
    !resourcesDirectoryTemplate.includes('record.localized[lang].title and record.localized[lang].description') ||
    !resourcesDirectoryTemplate.includes('record.translation_status == "translated"')) {
  throw new Error('Localized resource cards must show only reviewed translations and flag pending translations.');
}
const decisionPage = read('src/farmer-decision-centre.njk');
const decisionUi = read('src/_includes/farmer-decision-centre-ui.njk');
if (!decisionPage.includes('farmer-decision-centre-ui.njk') || !decisionUi.includes('btn.addEventListener("click",render)') || !decisionUi.includes('tr("openSource")')) {
  throw new Error('Farmer Decision Centre must retain its interactive brief builder and source links.');
}

const eleventyConfig = read('.eleventy.js');
if (!eleventyConfig.includes('articles: dedupeAgriculturalRecords(') || !eleventyConfig.includes('country_code: article.country_code || c.code')) {
  throw new Error('Public country news must deduplicate repeated source URLs within each country.');
}
if (!eleventyConfig.includes('title: article.title || article.headline || ""') || !eleventyConfig.includes('isSpecificAgriculturalNewsUrl(article.url)') || !eleventyConfig.includes('const isSpecificAgriculturalNewsUrl = value =>')) {
  throw new Error('Public news merging must normalize headline-only records and reject generic listing URLs.');
}
if (!decisionPage.includes('data-i18n="decisionCentre.title"') || !decisionUi.includes('data-i18n="decisionCentre.buildTitle"') || !decisionUi.includes('tr("noMatch")')) {
  throw new Error('Farmer Decision Centre must translate its interface and dynamic empty states.');
}
for (const code of ['en','fr','ar','pt','sw']) {
  const translations = JSON.parse(read(`src/i18n/${code}.json`));
  if (!translations.search || !translations.decisionCentre || !translations.search.noResults || !translations.decisionCentre.briefHeading || !translations.decisionCentre.goal_market || !translations.decisionCentre.topic_maize) {
    throw new Error(`Search and Decision Centre translations are incomplete for ${code}.`);
  }
}


const decisionCentreLabelKeys = [
  'goal_market','goal_finance','goal_inputs','goal_machinery','goal_training','goal_climate','goal_all',
  'section_markets','section_opportunities','section_resources','section_services','section_news'
];
if (!decisionUi.includes('sectionLabel(sec)') || !decisionUi.includes('decisionCentre.goal_{{g.id}}')) {
  throw new Error('Farmer Decision Centre dynamic section headings and goal options must use translation keys.');
}
for (const code of ['en','fr','ar','pt','sw']) {
  const decisionLabels = JSON.parse(read(`src/i18n/${code}.json`)).decisionCentre || {};
  for (const key of decisionCentreLabelKeys) {
    if (!String(decisionLabels[key] || '').trim()) throw new Error(`Decision Centre label ${key} is missing for ${code}.`);
  }
}

// Keep all shared discovery-tool and directory translation keys in sync across every supported language.
const englishDiscoveryTranslations = JSON.parse(read('src/i18n/en.json'));
for (const code of ['fr','ar','pt','sw']) {
  const locale = JSON.parse(read(`src/i18n/${code}.json`));
  for (const namespace of ['search','decisionCentre','markets','opportunities','services']) {
    const expected = Object.keys(englishDiscoveryTranslations[namespace] || {}).sort();
    const actual = Object.keys(locale[namespace] || {}).sort();
    if (expected.join('|') !== actual.join('|')) {
      throw new Error(`Discovery translation keys differ for ${code}/${namespace}; keep localized search and decision tools structurally complete.`);
    }
    for (const key of expected) {
      if (!String(locale[namespace][key] || '').trim()) {
        throw new Error(`Empty discovery translation: ${code}/${namespace}/${key}.`);
      }
    }
  }
}

const marketsTemplate = read('src/_includes/markets-directory.njk');
const opportunitiesTemplate = read('src/_includes/opportunities-directory.njk');
const servicesTemplate = read('src/_includes/agricultural-services-directory.njk');
if (!marketsTemplate.includes('data-i18n="markets.title"') || !marketsTemplate.includes('data-i18n="markets.noResults"') || !marketsTemplate.includes("goa:languagechange")) {
  throw new Error('Markets directory must translate its controls, empty state, and dynamic summary when the language changes.');
}
if (!opportunitiesTemplate.includes('data-i18n="opportunities.title"') || !opportunitiesTemplate.includes('data-i18n="opportunities.noResults"') || !opportunitiesTemplate.includes("goa:languagechange")) {
  throw new Error('Opportunities directory must translate its controls and empty state when the language changes.');
}
if (!servicesTemplate.includes('data-i18n="services.title"') || !servicesTemplate.includes('data-i18n="services.noResults"') || !servicesTemplate.includes("goa:languagechange")) {
  throw new Error('Agricultural services directory must translate its controls and empty state when the language changes.');
}

const intelligenceMerge = read('scripts/merge-agricultural-intelligence.js');
if (!intelligenceMerge.includes("'agriculturalNewsExpansion.json'") ||
    !intelligenceMerge.includes("normalizeUrl(item.url) === candidateUrl") ||
    !intelligenceMerge.includes("normalizeTitle(item.title || item.headline) === candidateTitle")) {
  throw new Error('Build-time agricultural merge must include expanded news and skip only exact normalized same-title/same-URL duplicates.');
}
const newsExpansion = JSON.parse(read('src/_data/agriculturalNewsExpansion.json'));
if (!Array.isArray(newsExpansion.records)) {
  throw new Error('Expanded agricultural news must use the records schema consumed by the build-time merge.');
}

console.log(`GoOrganicAfrica checks passed: ${activeCountries.length} active countries, ${aggregate.length} synchronized enterprises, dynamic data/admin controls, Selar support, AdSense controls, and agricultural data automation.`);
