# Hosting

Now: GitHub Pages serves `web/`.
Deploy is by `.github/workflows/pages.yml`.
`doctor.yokoten.app` is a CNAME record.
The custom domain is set in the repo Pages settings.

The page is static files with relative paths.
There is no build step.
The API address is in `web/app.js`.
It is also in the meta tag in `web/index.html`.
A test keeps them equal.
The security rule is in the page.
It is not in a host setting.

To move to Cloudflare Pages:
Create a project with no build command.
Use `web` as the output folder.
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
