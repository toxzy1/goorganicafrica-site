# Cloudflare Pages quick setup

Primary deployment target: Cloudflare Pages via GitHub integration.

Build command: `npm run build`
Output directory: `_site`
Branch: `main`
Root directory: blank / repository root

Do not use Cloudflare Direct Upload for this project if you want automatic GitHub deployments later: Cloudflare states that Direct Upload projects cannot subsequently be switched to Git integration. Use **Import an existing Git repository** from the beginning.

The CMS authentication is separate from Pages hosting: use a Decap-compatible GitHub OAuth proxy on a Cloudflare Worker and keep OAuth secrets in Worker Secrets.
