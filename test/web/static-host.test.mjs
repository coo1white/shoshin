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

  test('web/ holds only .html, .js and .css files', () => {
    const allowed = new Set(['.html', '.js', '.css']);
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

  test('connect-src in meta tag equals API constant in web/app.js', () => {
    const html = fs.readFileSync(indexPath, 'utf8');
    const app = fs.readFileSync(appPath, 'utf8');

    // Find CSP meta tag
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

    // Find API constant in app.js: API = "https://..." or '...'
    const apiMatch = app.match(/API\s*=\s*["']([^"']+)["']/);
    assert.ok(apiMatch, 'API constant not found in web/app.js');
    const api = apiMatch[1].trim();

    assert.equal(connectSrc, api, `connect-src (${connectSrc}) should equal API (${api})`);
  });
});
