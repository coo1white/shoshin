Give each page good share and search tags. A shared link has no image, and search engines have no sitemap or canonical address. Issue 19.

`web/public/images/share.png` already exists: 1200 by 630. Do not return it.

Return the full text of each file you change or add. Keep every current test, and change only what step 5 names. Add one entry with the path `COMMIT_MSG`: `feat:` commit form, one short plain body line, no tool attribution.

1. `web/src/layouts/Page.astro`. Add these optional props: `title`, `description` and `path`. Their defaults are the current title, the current description and `"/"`. Use a `site` constant with the value `https://doctor.yokoten.app`.
   - `<title>`, `og:title` and the description tags use the props.
   - `og:url` is `site + path`.
   - Add `<link rel="canonical" href={site + path} />`.
   - Add `og:image` with the value `https://doctor.yokoten.app/images/share.png`, `og:image:width` 1200, `og:image:height` 630, `og:image:alt` with the value `A health check for repos that AI agents work in.`, `twitter:card` with the value `summary_large_image`.

2. `web/src/pages/example/[slug].astro`. Pass these to `Page`, and keep `noindex`:
   - `title`: `<owner>/<repo>: <done> of <total> file checks · yokoten doctor`. `done` and `total` come from `result.summary`.
   - `description`: `A saved yokoten doctor check of <owner>/<repo> at commit <short commit>. The file checks do not judge its code.`
   - `path`: `/example/<slug>.html`. Read the slug from `Astro.params.slug`.

3. New file `web/public/robots.txt`:
   ```
   User-agent: *
   Allow: /

   Sitemap: https://doctor.yokoten.app/sitemap.xml
   ```

4. New file `web/public/sitemap.xml`: a standard sitemap with one `url`, `https://doctor.yokoten.app/`. Leave out `lastmod`. The example pages have `noindex`, so they are not in it.

5. `test/web/static-host.test.mjs`:
   - The test that holds the `allowed` set of file types: add `.png`, `.txt` and `.xml`. Change nothing else in that test.
   - Add a test: `dist/index.html` holds the canonical `https://doctor.yokoten.app/`, `og:url` with the same value, `og:image` with the share image address, and `summary_large_image`.
   - Add a test: `dist/images/share.png` exists, and bytes 16 to 23 give a width of 1200 and a height of 630 as big-endian numbers.
   - Add a test: `dist/robots.txt` names the sitemap address. `dist/sitemap.xml` holds the home address and does not hold `/example/`.
   - Add a test for each example in `sample-result.json`: its page has the canonical `https://doctor.yokoten.app/example/<slug>.html`, and its `<title>` starts with `<repo>: <done> of <total> file checks`.

6. `docs/hosting.md`: add this at the end:
   ```
   The share image is `web/public/images/share.png`.
   Its source is `web/share/share-image.html`.
   To change it, open the source from a local server at 1200 by 630, and save a screenshot.
   ```

Add no dependency. Do not use the Astro sitemap package.
