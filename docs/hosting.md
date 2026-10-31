# Hosting

Now: GitHub Pages serves `dist/` after `npm run build`.
Deploy is by `.github/workflows/pages.yml`.
`doctor.yokoten.app` is a CNAME record.
The custom domain is set in the repo Pages settings.

The page is static files with relative paths.
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

See `docs/roadmap.md`, which holds the moving steps.

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
