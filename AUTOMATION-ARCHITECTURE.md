# GoOrganicAfrica Automation Architecture

## Expansion model
Countries, regions, crops and livestock are data-driven. Adding a country to `src/_data/calculatorCountries.json` and its regions to `src/_data/calculator/regions.json` automatically feeds the calculator, country selector, currency display, regional selector, dashboard counts and localized calculator URL generation on the next build.

## Country URLs
Each active country automatically receives five language-aware calculator URLs: `/xx/en/farm-profit-calculator/`, `/xx/fr/...`, `/xx/ar/...`, `/xx/pt/...`, and `/xx/sw/...`. The root calculator remains `/farm-profit-calculator/`. The legacy `/tools/farm-profit-calculator/` redirects permanently to the root URL.

## Languages
The language switcher is designed around separate URLs and `hreflang`. Calculator interface labels support English, French, Arabic, Portuguese and Swahili. Blog/eBook entries have `language` and `translation_group` fields so genuine translated content can be added without changing the website code. A language switch does not falsely claim an English article is translated.

## Crops and livestock
Both use the same enterprise collection. New enterprises can be added from the CMS. Their country data can include prices, seed/planting-material costs, input costs and recommendations. `advice` and `recommendations` are read dynamically by the calculator, so new enterprises do not require hard-coded JavaScript advice.

## Agricultural data automation
`config/ag-data-sources.json` is the source registry. `scripts/update-ag-data.py` monitors the configured machine-readable feeds and creates review candidates. Review-first publishing remains enabled. A country/source profile is used for automatic routing; adding a country does not invent an unverified government feed. Each new country should have a trusted source profile configured before live automatic updates are enabled.

## AdSense and regional SEO
Country URLs represent regional content/data versions. They do not spoof visitor location. AdSense can continue to use the real visitor's location and other targeting signals. Country/language URLs, canonical tags and `hreflang` provide search engines with legitimate regional/language signals.

## eBooks
The eBook catalogue is searchable client-side and CMS-driven. Adding 100+ guides does not require changing the search code; title, tagline, category, audience, slug and `search_terms` are indexed automatically.
