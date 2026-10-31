import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const webDir = path.resolve('web');
const indexPath = path.join(webDir, 'index.html');
const appPath = path.join(webDir, 'app.js');

describe('static host portability', () => {
  test('every href and src in web/index.html is relative', () => {
    const html = fs.readFileSync(indexPath, 'utf8');
    const re = /\b(?:href|src)\s*=\s*["']([^"']+)["']/g;
    let match;
    const values = [];
    while ((match = re.exec(html)) !== null) {
      values.push(match[1]);
    }
    assert.ok(values.length > 0, 'expected at least one href or src');
    for (const v of values) {
      assert.equal(v.startsWith('/'), false, `href/src should not start with /: ${v}`);
      assert.equal(/^[a-zA-Z][a-zA-Z0-9+.\-]*:/.test(v), false, `href/src should not have a scheme: ${v}`);
      assert.equal(v.startsWith('//'), false, `href/src should not be protocol-relative: ${v}`);
    }
  });

  test('web/ holds only .html, .js, .css and .svg files', () => {
    const allowed = new Set(['.html', '.js', '.css', '.svg']);
    function walk(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          walk(full);
        } else if (e.isFile()) {
          const ext = path.extname(e.name).toLowerCase();
          assert.ok(allowed.has(ext), `unexpected file in web/: ${path.relative(webDir, full)} (extension ${ext})`);
        }
      }
    }
    walk(webDir);
  });

  test('every SVG in web/ holds no <script and no on...= attribute', () => {
    function walk(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const svgs = [];
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          svgs.push(...walk(full));
        } else if (e.isFile() && path.extname(e.name).toLowerCase() === '.svg') {
          svgs.push(full);
        }
      }
      return svgs;
    }
    const svgFiles = walk(webDir);
    for (const file of svgFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const lower = content.toLowerCase();
      assert.equal(lower.includes('<script'), false, `SVG should not contain <script: ${path.relative(webDir, file)}`);
      assert.equal(/\bon\w+\s*=/i.test(content), false, `SVG should not contain on...= attribute: ${path.relative(webDir, file)}`);
    }
  });

  test('web/index.html has a description meta tag, og:title, and a relative icon link', () => {
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
      const href = hrefMatch[1];
      assert.equal(href.startsWith('/'), false, `icon href should not start with /: ${href}`);
      assert.equal(/^[a-zA-Z][a-zA-Z0-9+.\-]*:/.test(href), false, `icon href should not have a scheme: ${href}`);
      assert.equal(href.startsWith('//'), false, `icon href should not be protocol-relative: ${href}`);
    }
  });

  test('connect-src in meta tag equals API constant in web/app.js', () => {
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
    assert.ok(apiMatch, 'API constant not found in web/app.js');
    const api = apiMatch[1].trim();
    assert.equal(connectSrc, api, `connect-src (${connectSrc}) should equal API (${api})`);
  });

  test('web/*.js holds the words "How this was made", "Muse Spark Open" and "Claude Opus 5.5"', () => {
    function walkJs(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files = [];
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) files.push(...walkJs(full));
        else if (e.isFile() && path.extname(e.name) === ".js") files.push(full);
      }
      return files;
    }
    const jsFiles = walkJs(webDir);
    const joined = jsFiles.map(f => fs.readFileSync(f, 'utf8')).join("\n");
    assert.ok(joined.includes('How this was made'), 'web/*.js should contain "How this was made"');
    assert.ok(joined.includes('Muse Spark Open'), 'web/*.js should contain "Muse Spark Open"');
    assert.ok(joined.includes('Claude Opus 5.5'), 'web/*.js should contain "Claude Opus 5.5"');
  });

  test('every imported name in web/ exists in its source file', () => {
    function walkJs(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files = [];
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) files.push(...walkJs(full));
        else if (e.isFile() && path.extname(e.name) === '.js') files.push(full);
      }
      return files;
    }
    const jsFiles = walkJs(webDir);
    const importRe = /import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g;
    for (const file of jsFiles) {
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
          const exportRe = new RegExp(`export\\s+(?:async\\s+)?function\\s+${escaped}\\b|export\\s+const\\s+${escaped}\\b|export\\s+class\\s+${escaped}\\b`);
          assert.ok(exportRe.test(targetContent), `${path.relative(process.cwd(), file)} imports ${name} from ${importPath} but ${path.relative(process.cwd(), targetPath)} does not export it`);
        }
      }
    }
  });
});
