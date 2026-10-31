import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');
const indexPath = path.join(distDir, 'index.html');
const appPath = path.join(path.resolve('web/src/client'), 'app.ts');

describe('static host portability', () => {
  test('every <link> and <script> in dist/index.html has a path starting with /_astro/ or equal to /favicon.svg, and no scheme', () => {
    const html = fs.readFileSync(indexPath, 'utf8');
    const tagRe = /<(?:link|script)\b[^>]*>/gi;
    let tagMatch;
    const values = [];
    while ((tagMatch = tagRe.exec(html)) !== null) {
      const tag = tagMatch[0];
      const attrMatch = tag.match(/\b(?:href|src)\s*=\s*["']([^"']+)["']/i);
      if (attrMatch) values.push(attrMatch[1]);
    }
    assert.ok(values.length > 0, 'expected at least one href or src');
    for (const v of values) {
      assert.equal(/^[a-zA-Z][a-zA-Z0-9+.\-]*:/.test(v), false, `href/src should not have a scheme: ${v}`);
      const ok = v === '/favicon.svg' || v.startsWith('/_astro/');
      assert.ok(ok, `href/src should be /favicon.svg or start with /_astro/: ${v}`);
    }
  });

  test('dist/ holds only .html, .js, .css, .svg and .woff2', () => {
    const allowed = new Set(['.html', '.js', '.css', '.svg', '.woff2']);
    function walk(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (e.isFile()) {
          const ext = path.extname(e.name).toLowerCase();
          assert.ok(allowed.has(ext), `unexpected file in dist/: ${path.relative(distDir, full)} (extension ${ext})`);
        }
      }
    }
    walk(distDir);
  });

  test('every SVG in dist/ holds no <script and no on...= attribute', () => {
    function walk(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const svgs = [];
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) svgs.push(...walk(full));
        else if (e.isFile() && path.extname(e.name).toLowerCase() === '.svg') svgs.push(full);
      }
      return svgs;
    }
    const svgFiles = walk(distDir);
    for (const file of svgFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const lower = content.toLowerCase();
      assert.equal(lower.includes('<script'), false, `SVG should not contain <script: ${path.relative(distDir, file)}`);
      assert.equal(/\bon\w+\s*=/i.test(content), false, `SVG should not contain on...= attribute: ${path.relative(distDir, file)}`);
    }
  });

  test('dist/index.html has a description meta tag, og:title, and a relative icon link', () => {
    const html = fs.readFileSync(indexPath, 'utf8');
    const descRe = /<meta\s+[^>]*name\s*=\s*["']description["'][^>]*>/i;
    const descMatch = html.match(descRe);
    assert.ok(descMatch, 'description meta tag not found');
    const descTag = descMatch[0];
    const descContent = descTag.match(/content\s*=\s*["']([^"']+)["']/i);
    assert.ok(descContent && descContent[1].trim().length > 0, 'description meta tag should have non-empty content');
    const ogRe = /<meta\s+[^>]*property\s*=\s*["']og:title["'][^>]*>/i;
    const ogMatch = html.match(ogRe);
    assert.ok(ogMatch, 'og:title meta tag not found');
    const ogTag = ogMatch[0];
    const ogContent = ogTag.match(/content\s*=\s*["']([^"']+)["']/i);
    assert.ok(ogContent && ogContent[1].trim().length > 0, 'og:title meta tag should have non-empty content');
    const linkRe = /<link\s+[^>]*rel\s*=\s*["'][^"']*icon[^"']*["'][^>]*>/gi;
    const iconMatches = [...html.matchAll(linkRe)];
    assert.ok(iconMatches.length > 0, 'icon link not found');
    for (const m of iconMatches) {
      const tag = m[0];
      const hrefMatch = tag.match(/href\s*=\s*["']([^"']+)["']/i);
      assert.ok(hrefMatch, `icon link should have href: ${tag}`);
      assert.equal(hrefMatch[1], '/favicon.svg');
    }
  });

  test('connect-src in meta tag equals API constant in web/src/client/app.ts', () => {
    const html = fs.readFileSync(indexPath, 'utf8');
    const app = fs.readFileSync(appPath, 'utf8');
    const metaRe = /<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/i;
    const metaMatch = html.match(metaRe);
    assert.ok(metaMatch, 'Content-Security-Policy meta tag not found');
    const metaTag = metaMatch[0];
    const contentMatch = metaTag.match(/content="([^"]+)"/i);
    assert.ok(contentMatch, 'CSP meta tag has no content attribute');
    const csp = contentMatch[1];
    const connectMatch = csp.match(/connect-src\s+([^;]+)/);
    assert.ok(connectMatch, 'connect-src not found in CSP');
    const connectSrc = connectMatch[1].trim().split(/\s+/)[0];
    const apiMatch = app.match(/API\s*=\s*["']([^"']+)["']/);
    assert.ok(apiMatch, 'API constant not found in web/src/client/app.ts');
    const api = apiMatch[1].trim();
    assert.equal(connectSrc, api, `connect-src (${connectSrc}) should equal API (${api})`);
  });

  test('dist/index.html holds the words "How this was made", "Muse Spark Open" and "Claude Opus 5.5"', () => {
    const html = fs.readFileSync(indexPath, 'utf8');
    assert.ok(html.includes('How this was made'), 'dist/index.html should contain "How this was made"');
    assert.ok(html.includes('Muse Spark Open'), 'dist/index.html should contain "Muse Spark Open"');
    assert.ok(html.includes('Claude Opus 5.5'), 'dist/index.html should contain "Claude Opus 5.5"');
  });

  test('every imported name in web/src/client exists in its source file', () => {
    function walkTs(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files = [];
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) files.push(...walkTs(full));
        else if (e.isFile() && path.extname(e.name) === '.ts') files.push(full);
      }
      return files;
    }
    const tsFiles = walkTs(path.resolve('web/src/client'));
    const importRe = /import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g;
    for (const file of tsFiles) {
      const content = fs.readFileSync(file, 'utf8');
      let m;
      while ((m = importRe.exec(content)) !== null) {
        const specifiersRaw = m[1];
        const importPath = m[2];
        const targetPath = path.resolve(path.dirname(file), importPath);
        assert.ok(fs.existsSync(targetPath), `${path.relative(process.cwd(), file)} imports ${importPath} but file does not exist: ${path.relative(process.cwd(), targetPath)}`);
        const targetContent = fs.readFileSync(targetPath, 'utf8');
        const specs = specifiersRaw.split(',');
        for (const raw of specs) {
          const trimmed = raw.trim();
          if (!trimmed) continue;
          const name = trimmed.split(/\s+as\s+/)[0].trim();
          if (!name) continue;
          const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const exportRe = new RegExp(`export\\s+(?:async\\s+)?function\\s+${escaped}\\b|export\\s+const\\s+${escaped}\\b|export\\s+class\\s+${escaped}\\b|export\\s+interface\\s+${escaped}\\b|export\\s+type\\s+${escaped}\\b`);
          assert.ok(exportRe.test(targetContent), `${path.relative(process.cwd(), file)} imports ${name} from ${importPath} but ${path.relative(process.cwd(), targetPath)} does not export it`);
        }
      }
    }
  });

  test('dist/index.html holds the h1, the label, the Check button, the three examples, the noscript sentence, and the sentence that starts "How this was made"', () => {
    const html = fs.readFileSync(indexPath, 'utf8');
    const h1Re = /<h1[^>]*>([^<]+)<\/h1>/i;
    const h1 = html.match(h1Re);
    assert.ok(h1, 'heading not found in dist/index.html');
    assert.ok(h1[1].trim().length > 0, 'heading empty');
    assert.ok(html.includes('<label'), 'label not found in dist/index.html');
    assert.ok(html.includes('>Check<') || html.includes('>Check </button>') || html.includes('Check'), 'Check button not found');
    const buttonRe = /<button[^>]*>([^<]+)<\/button>/i;
    const buttonMatch = html.match(buttonRe);
    assert.ok(buttonMatch, 'Check button not found');
    assert.equal(buttonMatch[1].trim(), 'Check');
    const exampleTexts = ['Uniswap/v4-core', 'OpenZeppelin/openzeppelin-contracts', 'jup-ag/jupiter-quote-api-node'];
    for (const ex of exampleTexts) assert.ok(html.includes(ex), `example "${ex}" not in dist/index.html`);
    assert.ok(html.includes('This page needs JavaScript to run a check. You can also run it yourself: npx yokoten'), 'noscript text incorrect');
    assert.ok(html.includes('How this was made'), 'How this was made sentence not found');
  });

  test('example links in dist/index.html are relative and start with ?repo=', () => {
    const html = fs.readFileSync(indexPath, 'utf8');
    const anchorRe = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
    let m;
    const repoLinks = [];
    while ((m = anchorRe.exec(html)) !== null) {
      const href = m[1];
      const text = m[2].trim();
      if (text.includes('/') && (text === 'Uniswap/v4-core' || text === 'OpenZeppelin/openzeppelin-contracts' || text === 'jup-ag/jupiter-quote-api-node')) repoLinks.push(href);
    }
    assert.ok(repoLinks.length === 3, `expected 3 example links, found ${repoLinks.length}`);
    for (const href of repoLinks) {
      assert.ok(href.startsWith('?repo='), `example href should start with ?repo=: ${href}`);
      assert.equal(href.startsWith('/'), false, `example href should not start with /: ${href}`);
      assert.equal(/^[a-zA-Z][a-zA-Z0-9+.\-]*:/.test(href), false, `example href should not have scheme: ${href}`);
    }
  });

  test('dist/index.html has no <script> without src, no <style>, and no style= attribute, because the policy blocks them', () => {
    const html = fs.readFileSync(indexPath, 'utf8');
    const scriptRe = /<script\b[^>]*>/gi;
    let sm;
    while ((sm = scriptRe.exec(html)) !== null) {
      const tag = sm[0];
      assert.ok(/\bsrc\s*=/.test(tag), `<script> without src found: ${tag}`);
    }
    assert.equal(html.toLowerCase().includes('<style'), false, 'dist/index.html should not contain <style>');
    assert.equal(/\bstyle\s*=/.test(html), false, 'dist/index.html should not contain style= attribute');
  });

  test('in dist/index.html, the sentence "How this was made" comes after <main id="app"', () => {
    const html = fs.readFileSync(indexPath, 'utf8');
    const mainIdx = html.indexOf('<main id="app"');
    assert.ok(mainIdx !== -1, '<main id="app" not found');
    const howIdx = html.indexOf('How this was made');
    assert.ok(howIdx !== -1, 'How this was made not found');
    assert.ok(howIdx > mainIdx, 'How this was made should come after <main id="app"');
  });

  test('web/src/data/sample-result.json has a 40-character commit, total equal to the number of steps, and done equal to the steps marked done', () => {
    const p = path.resolve('web/src/data/sample-result.json');
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    assert.equal(typeof data.commit, 'string');
    assert.equal(data.commit.length, 40);
    assert.ok(/^[0-9a-f]{40}$/i.test(data.commit), 'commit should be hex');
    const steps = data.steps;
    assert.ok(Array.isArray(steps), 'steps should be array');
    assert.equal(data.total, steps.length);
    const doneCount = steps.filter(s => s.mark === 'done').length;
    assert.equal(data.done, doneCount);
  });
});
