# Hosting

Now: GitHub Pages serves `dist/` after `npm run build`.
Deploy is by `.github/workflows/pages.yml`.
The server runs on Modal.
Deploy is by `.github/workflows/deploy-server.yml`.
A merge that changes `server/` runs the server tests, deploys, and then runs one real check.
A failed check fails the workflow but does not undo the deploy.
The check cannot tell the new version from the old one.
To undo a deploy, revert the pull request. The revert deploys the old code.

The workflow reads `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` from the GitHub environment `modal`.
The token comes from https://modal.com/settings/tokens.
Set the environment's deployment branch rule to `main` only.
The deploy job also skips every other branch, so a pull request or a manual run on a branch cannot read the token.

`doctor.yokoten.app` is a CNAME record.
The custom domain is set in the repo Pages settings.

The page is static files, served from the root of the domain.
The API address is in `web/src/client/app.ts` and the tag in `web/src/layouts/Page.astro`.
A test keeps them equal.
The security rule is in the page.
It is not in a host setting.

To move to Cloudflare Pages:
Create a project with build command `npm run build` and output folder `dist`.
Add the custom domain in Cloudflare.
Change the CNAME record to Cloudflare.
Turn off the Pages workflow.
No code change is needed.
The server allows the domain, and the domain stays.

A move does not change rate limits.
A busy day is limited by the API.
It allows 10 checks per address per hour.
It allows 300 per day.
The static host does not set this.
Raising the limit costs Modal and Baseten credits.

If a Cloudflare Worker is ever put in front of the API:
Every request then comes from the Worker address.
So the per-address limit must change first.
Read `CF-Connecting-IP` only when proven to come from that Worker.
Otherwise a caller can set it to anything.

The share image is `web/public/images/share.png`.
Its source is `web/share/share-image.html`.
To change it, open the source from a local server at 1200 by 630, and save a screenshot.
