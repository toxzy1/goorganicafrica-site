# GoOrganicAfrica Control Panel — Operating Plan

The admin panel is designed so routine website management does not require editing source code.

## 1. Content and products

### Blog Posts
Create and publish articles from **Blog Posts**. Each article supports:
- title, slug and publish date
- category
- featured image
- meta title/description and keywords
- full Markdown article body
- optional related eBook
- optional eBook call-to-action

When a related eBook is selected by slug, the article can automatically display the eBook's current title, price and Selar checkout link.

### Ebooks & Selar Products
Create and maintain eBooks from **Ebooks & Selar Products**. Store the current:
- title and slug
- cover
- price
- Selar checkout link
- audience, benefits and FAQs
- featured/order settings
- SEO description

The product page uses the stored Selar link for its purchase buttons. Update the Selar link once in the panel rather than editing multiple pages.

## 2. Agricultural database

### Countries
Add a country to the country list, give it a currency and flag, then mark it available when its calculator data is ready. The website's country counts and Organization `areaServed` data are calculated from this registry.

### States / Regions / Provinces
Add the country's regional list. The total regional coverage shown by the site is calculated automatically.

### Enterprises
Calculator enterprises are maintained in one extensible list. Each enterprise can be a `crop` or `livestock` record and can contain country-specific cost, yield and selling-price data.

Country data is a list rather than a fixed set of ten country fields, so adding country 11, 20 or 54 does not require redesigning the CMS schema.

### Price and seed data
Country data supports:
- selling price low/expected/high
- price unit
- seed price and seed-price unit
- seed variety/brand
- cost breakdown
- yield assumptions
- source and source URL
- data date
- data status

## 3. Automated agricultural data

The GitHub Actions monitor checks configured machine-readable sources on schedule and can also be run manually. The source registry supports government, market, relevant-agency and research sources for:
- commodity prices
- seed prices
- livestock prices
- input prices
- labour prices
- exchange rates
- government statistics

The system is intentionally conservative. It creates review candidates rather than blindly overwriting live calculator data. This is important because a source may change unit, geography, variety, table structure or reporting period.

A source must be configured with a trustworthy URL/feed before it can be collected. A blank source URL is **not** a claim that live data exists.

## 4. Data quality

`config/ag-data-policy.json` controls freshness thresholds and whether automatic publishing is permitted. The default is review-first and automatic publishing OFF.

Recommended operating model:
1. Bot collects source data.
2. Candidate is created.
3. Source, unit, geography and date are checked.
4. Approved values are published to calculator data.
5. Cloudflare Pages rebuilds automatically after the GitHub change.

## 5. SEO and AdSense readiness

The control panel contains global SEO defaults and AdSense controls.

The site already includes:
- About page
- Contact page
- Privacy Policy
- robots.txt
- sitemap
- canonical URLs
- Open Graph/Twitter metadata
- structured data for organization, articles and the calculator
- original long-form blog content support
- transparent calculator/data-source disclosures
- mobile-friendly navigation
- custom 404 page

AdSense is **disabled by default**. After Google approves the site and supplies a publisher ID, enter it in Site Settings and enable AdSense. The site then outputs the AdSense script and `ads.txt` from the same central setting.

AdSense approval and search ranking can never be guaranteed by code alone; content quality, originality, site history, policies, user experience and Google's review also matter.

## 6. Dynamic website statistics

Do not hard-code totals such as "10 countries" or "17 commodities" into normal website copy. The site calculates statistics from the current registries, including:
- active countries
- states/regions/provinces
- crops
- livestock
- total farming enterprises
- country price records
- countries with price data
- configured data sources
- latest detected reference period

When the underlying data changes, these statistics change at the next Cloudflare build.

## 7. Recommended expansion sequence

Before adding the remaining African countries, keep the existing ten-country data intact and verify the new extensible structure. Then add countries one at a time with their regional lists and source registry entries. Do not publish a country until its currency, regional structure and required enterprise data are validated.

## 8. Important operating rule for calculator enterprises

The editable source of truth for calculator enterprises is now the individual JSON files under `src/_data/calculator/commodities/`. The Control Panel exposes these as **Calculator: Crops & Livestock** entries. This avoids forcing an administrator to edit one enormous aggregate file and means a new enterprise can be created without changing the calculator code.

`src/_data/calculatorData.json` is retained as a legacy/compatibility aggregate and should not be edited manually. The website runtime reads the individual commodity files.

## 9. Automatic website counters

Website counters are calculated during every build from the current country, region and enterprise registries. Do not type calculator totals into page copy. Adding or deactivating data therefore changes the counters on the next Cloudflare build.

## 10. Price automation and source safety

Price automation is source-driven, not fabricated. A source may provide crop prices, seed prices, livestock prices, input costs, labour costs or exchange rates. Each incoming candidate records its publisher/source, URL, geography, unit and reporting date. Review-first publishing remains the default. If a trustworthy live feed is not available for a country or data type, the system should flag the gap rather than inventing a value.

## 11. AdSense operation

AdSense is centrally controlled in Site Settings. Auto Ads and the publisher script remain disabled until approval. After approval, enter the publisher ID and enable the appropriate settings. The same publisher ID also drives `ads.txt`. Ad placement should be reviewed for user experience and policy compliance before activation.
