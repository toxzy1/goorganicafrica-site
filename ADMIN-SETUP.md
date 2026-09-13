# GoOrganicAfrica — GitHub CMS on Cloudflare Pages

## What the CMS controls

The Decap CMS at `/admin/` is configured for:
- eBooks and Selar links
- Blog categories
- Blog posts and featured images
- Site information
- Calculator countries
- Live calculator enterprise/commodity data
- Agricultural data source configuration

## Important: Cloudflare authentication

The GitHub backend needs an OAuth authentication service. Netlify's Identity/Git Gateway is not required for the website and should not be enabled merely to host the site.

Decap's current GitHub-backend documentation explains that GitHub OAuth needs a server and recommends an edge/serverless OAuth proxy for non-Netlify hosting. A Cloudflare Worker can perform this role.

### Step 1 — GitHub OAuth App

In GitHub, open **Settings → Developer settings → OAuth Apps → New OAuth App**.

Use:
- Application name: `GoOrganicAfrica CMS`
- Homepage URL: your deployed site, e.g. `https://goorganicafrica-site.pages.dev`
- Authorization callback URL: the callback URL supplied by your OAuth proxy, normally `<PROXY_URL>/callback`

Keep the Client ID and Client Secret private.

### Step 2 — Cloudflare OAuth proxy

Deploy a Decap-compatible GitHub OAuth proxy as a Cloudflare Worker. The proxy needs the GitHub OAuth Client ID and Client Secret as **Worker secrets**. Do not put the Client Secret into this repository.

Cloudflare documents encrypted Worker secrets under **Workers & Pages → your Worker → Settings → Variables and Secrets**.

A practical architecture is:

`/admin/ → Cloudflare OAuth Worker → GitHub OAuth → GitHub API → repository`

### Step 3 — Configure this repository

Edit `admin/config.yml` and replace:

`YOUR_GITHUB_USERNAME/YOUR_REPOSITORY_NAME`

with your real repository path.

Then set:

`base_url: https://YOUR-OAUTH-PROXY.workers.dev`

and:

`auth_endpoint: /auth`

The proxy URL must be HTTPS.

### Step 4 — CMS access

Open:

`https://YOUR-PAGES-SITE.pages.dev/admin/`

Choose **Login with GitHub**, authorize the OAuth application, and return to the CMS.

The GitHub account used to edit the site should have write access to the repository. Decap's GitHub backend uses that access to read and commit content.

## Editorial workflow

The CMS uses the editorial workflow. Changes can be reviewed before they become part of `main`.

For the automatic agricultural-data workflow, the GitHub Action creates a review pull request. Review the official source, unit, geography and period before merging. Once merged, Cloudflare Pages rebuilds the website.

## Automatic price/data updates

The project contains:
- `.github/workflows/agricultural-data-update.yml`
- `scripts/update-ag-data.py`
- `config/ag-data-sources.json`
- `data/ag-data/pending/`
- `data/ag-data/history/`

The design deliberately separates **candidate data** from **published calculator data**. This prevents a changed government spreadsheet layout, unit or region from silently corrupting the calculator.

Seed prices are a separate data type because they can change by variety, brand, package size, supplier and location.

## Security

Never store any GitHub OAuth Client Secret, GitHub personal access token, or other credential in `admin/config.yml`, JavaScript, HTML, JSON data, or GitHub Actions source. Store secrets in the appropriate Cloudflare/GitHub secret store.

## Current control-panel architecture

The CMS is now designed around extensible data lists rather than fixed ten-country fields. It includes:
- Ebooks & Selar Products
- Blog Posts and Blog Categories
- Calculator Countries
- Calculator States / Regions / Provinces
- Calculator Enterprises with country-specific costs, selling prices, seed prices, yields and source metadata
- Automatic Agricultural Data Sources
- Data Quality & Publishing Rules
- Global Site Settings, SEO and AdSense controls

Routine content updates should be made in the admin panel and committed through the GitHub backend. Cloudflare Pages then rebuilds the site from `main`.
