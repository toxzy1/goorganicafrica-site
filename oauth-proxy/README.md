# GoOrganicAfrica CMS authentication

This Cloudflare Worker is the GitHub OAuth bridge for the GoOrganicAfrica Decap CMS.

Production URL:
https://goorganicafrica-cms-auth.goorganicafricans.workers.dev

One-time setup:
1. Create a GitHub OAuth App.
2. Homepage URL: https://goorganicafrica-site.pages.dev
3. Authorization callback URL: https://goorganicafrica-cms-auth.goorganicafricans.workers.dev/callback
4. Deploy this worker to the Cloudflare account that owns the goorganicafricans.workers.dev namespace.
5. Add encrypted Worker secrets:
   GITHUB_APP_CLIENT_ID
   GITHUB_APP_CLIENT_SECRET
6. Open https://goorganicafrica-site.pages.dev/admin/ and sign in with the GitHub account that has push access to toxzy1/goorganicafrica-site.

The OAuth App uses public_repo,user because the repository is public but Decap must write content to it.

Secrets must never be committed to GitHub.
