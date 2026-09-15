# GoOrganicAfrica — Cloudflare Pages deployment

This project is designed to be deployed from GitHub to Cloudflare Pages using Git integration.

## 1. Create the GitHub repository

Create an empty GitHub repository, for example `goorganicafrica-site`. Keep the default branch as `main`.

Upload the **contents of this ZIP** to the repository root. `package.json`, `src/`, `admin/`, `scripts/`, and `.github/` must be at the repository root — do not put them inside another folder.

## 2. Create the Cloudflare Pages project

In Cloudflare:
1. Open **Workers & Pages**.
2. Choose **Create application** and the **Pages** option.
3. Choose **Import an existing Git repository**.
4. Connect GitHub and select the GoOrganicAfrica repository.
5. Configure the build as follows:
   - Production branch: `main`
   - Framework preset: `None` (or Eleventy if offered)
   - Build command: `npm run build`
   - Build output directory: `_site`
   - Root directory: `/` (blank)
6. Deploy.

Cloudflare's Git integration automatically builds and deploys when changes are pushed to the connected GitHub repository.

## 3. Node version

Cloudflare Pages currently provides a modern Node build image, but this project is compatible with Node 20+. If the dashboard asks for a Node version, set `NODE_VERSION=20`.

## 4. Test the website

After deployment, test these pages:
- `/`
- `/blog/`
- `/ebooks/`
- `/farm-profit-calculator/`
- `/about/`
- `/contact/`
- `/privacy-policy/`
- `/data-updates/`
- `/admin/`

Also test the old calculator path; it should redirect to `/farm-profit-calculator/`.

## 5. Decap CMS authentication on Cloudflare

Because the site is no longer hosted on Netlify, do **not** configure Netlify Identity/Git Gateway for the CMS.

The CMS uses the Decap GitHub backend. GitHub OAuth requires a small authentication service. Decap documents using an OAuth proxy/edge worker for non-Netlify hosting.

Recommended setup:
1. Create a GitHub OAuth App.
2. Deploy a Decap GitHub OAuth proxy as a small Cloudflare Worker.
3. Store the GitHub OAuth client ID/secret as Worker secrets — never put the secret in `admin/config.yml` or GitHub source files.
4. Put the Worker URL into `admin/config.yml` as `base_url` and use `/auth` as `auth_endpoint`.
5. Set `repo` to your real GitHub repository, e.g. `YOUR_USERNAME/goorganicafrica-site`.
6. Redeploy the site.

See `ADMIN-SETUP.md` for the detailed CMS sequence.

## 6. Automatic agricultural data

The GitHub Actions workflow in `.github/workflows/agricultural-data-update.yml` checks configured official sources on a schedule and can also be run manually.

It creates **reviewable candidate data** rather than silently changing live calculator prices. After you review and merge the pull request, Cloudflare Pages automatically rebuilds the site from `main`.

This covers the architecture for changing commodity prices, seed prices and other time-varying input data. Seed prices remain separately identified because variety, brand, pack size, supplier and location can change independently.

## 7. Paid eBooks

Keep paid PDF/eBook delivery on Selar. Do not unnecessarily host large paid downloads on the Pages site. Cloudflare Pages can serve static assets efficiently, but separating paid-file delivery keeps the website lighter and preserves the intended sales/delivery workflow.

## 8. Custom domain later

When you buy your custom domain, open the Cloudflare Pages project → **Custom domains** → **Set up a domain**. If you want an apex domain such as `goorganicafrica.com`, the domain must be added as a zone to the same Cloudflare account. A subdomain can instead use a CNAME at its DNS provider.
