# GoOrganicAfrica — Master CMS & Project Specification

## Non-negotiable preservation rules
- Do not redesign or rebuild the existing website when adding CMS capabilities.
- Preserve all existing multilingual content and working routes.
- The calculator language selector must remain intact and isolated from Blog/eBook/static-page language-selector changes.
- Preview and test changes before production. Never merge a change to main until the preview is verified.
- New CMS records must inherit the same rendering, SEO, search, URL, sitemap, language and metadata behavior as existing records of that content type.
- English is the source of truth for translations. Reviewed translations must not be silently overwritten.
- Automated data collection must create reviewable candidates; it must not silently publish uncertain agricultural or directory information.

## Content managed by CMS
### Blog
User-written source content is pasted into the CMS. The CMS may assist with formatting/metadata/SEO structure, but must not replace the author's substantive article unless explicitly requested.
Each new post inherits title, slug, date, language, category, image, SEO metadata, related eBook CTA, search/indexing, sitemap and publication workflow.

### eBooks
Manage title, tagline, cover, price, Selar link, category, audience, search terms, benefits, FAQs, language, translation group/status, ordering, SEO and publication status. New eBooks inherit the same search/card/detail/SEO/sitemap behavior as existing eBooks.

## Agricultural directories
Core categories:
- Finance
- Grants
- Machinery

Each listing supports:
- Title
- Category
- Country
- Region
- Description
- Public URL
- Official source
- Source type
- Verification date
- Last checked
- Status
- Notes
- Active/featured flags
- SEO metadata
- Auto-discovered flag

### Directory automation
The site maintains an approved Source Registry. A scheduled monitor checks configured machine-readable feeds and official pages. New or changed information is written to a review queue. It is not automatically published unless a future source is explicitly marked safe for auto-publication.

The system must record the source, retrieval/check date, proposed action and reason for review. Expired or changed programmes should be flagged rather than silently left as current.

The initial automation is source-registry based, not an unrestricted internet crawler. New official sources can be added from the CMS without redesigning the directory system.

## Calculator/data roadmap
- Expand toward all 54 African countries.
- Manage regions/states/provinces through CMS.
- Manage crops and livestock through CMS.
- Manage country-specific costs, yields, selling prices and seed prices.
- Keep seed prices separately identifiable by variety/brand/pack size/supplier/location where available.
- Record source and verification date.
- Support automatic monitoring plus human approval/manual override.
- Keep country/language calculator URLs and the calculator language selector intact.
- Avoid static counters where counts can be derived from the underlying data.

## Languages
Current supported languages: English, French, Arabic, Portuguese and Swahili.
- Section-specific selectors remain as currently working.
- Do not reintroduce a shared selector that breaks Blog/eBook routing.
- Missing/unreviewed translations fall back safely according to existing governance.
- Arabic remains RTL.
- Failed translation generation must not break the build.

## SEO/monetization
Preserve canonical URLs, hreflang, sitemap, robots.txt, structured data, internal/external links and AdSense readiness.
Keep Selar as the paid eBook checkout/delivery path.
Future finance/insurance/inputs/equipment lead-generation opportunities may be added as separate approved directory types; do not add them without explicit approval.

## Future expansion rule
Any new content type must be implemented through the same CMS/data-model pattern so that adding a new item automatically receives the existing content type's rendering, search, SEO, language, sitemap and publication behavior.

## Acceptance test before production
- Existing pages and calculator remain unchanged.
- Existing language behavior remains unchanged.
- Add one new Blog post in preview and verify all inherited Blog features.
- Add one new eBook in preview and verify all inherited eBook features.
- Add one directory listing manually and verify source/verification/status fields.
- Run the directory monitor and verify that candidates enter review queue rather than publishing silently.
- Run localization/build/audit checks.
- Only after successful preview testing may the branch be merged to main.
