import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { recordView } from '../../web/fixes.js';

describe('recordView', () => {
  it('null gives null', () => {
    assert.equal(recordView(null), null);
    assert.equal(recordView(undefined), null);
  });

  it('bad sha256 gives null', () => {
    assert.equal(recordView({ sha256: 'zzzz', recorded_at: '2024-01-01T00:00:00Z', document: '{}' }), null);
    assert.equal(recordView({ sha256: 'abc', recorded_at: '2024-01-01T00:00:00Z', document: '{}' }), null);
    assert.equal(recordView({ sha256: 'A'.repeat(64), recorded_at: '2024-01-01T00:00:00Z', document: '{}' }), null);
    // missing fields
    assert.equal(recordView({ sha256: 'a'.repeat(64), recorded_at: '2024-01-01T00:00:00Z' }), null);
    assert.equal(recordView({ sha256: 'a'.repeat(64), document: '{}' }), null);
  });

  it('both links', () => {
    const sha = 'a'.repeat(64);
    const r = recordView({
      sha256: sha,
      recorded_at: '2024-01-01T00:00:00Z',
      document: '{"hello":1}',
      rekor: { url: 'https://search.sigstore.dev/?logIndex=123' },
      solana: { url: 'https://explorer.solana.com/tx/abc?cluster=devnet' },
    });
    assert.equal(r.rekorUrl, 'https://search.sigstore.dev/?logIndex=123');
    assert.equal(r.solanaUrl, 'https://explorer.solana.com/tx/abc?cluster=devnet');
    assert.equal(r.message, '');
  });

  it('only Rekor gives devnet message', () => {
    const sha = 'b'.repeat(64);
    const r = recordView({
      sha256: sha,
      recorded_at: '2024-01-01T00:00:00Z',
      document: '{}',
      rekor: { url: 'https://search.sigstore.dev/?uuid=abc' },
      solana: null,
    });
    assert.equal(r.rekorUrl, 'https://search.sigstore.dev/?uuid=abc');
    assert.equal(r.solanaUrl, null);
    assert.equal(r.message, 'The devnet record could not be written this time.');
  });

  it('neither gives other message', () => {
    const sha = 'c'.repeat(64);
    const r = recordView({
      sha256: sha,
      recorded_at: '2024-01-01T00:00:00Z',
      document: '{}',
      rekor: null,
      solana: null,
    });
    assert.equal(r.rekorUrl, null);
    assert.equal(r.solanaUrl, null);
    assert.equal(r.message, 'The public record could not be written this time. The result above is still right.');
    // also when both missing keys
    const r2 = recordView({
      sha256: sha,
      recorded_at: '2024-01-01T00:00:00Z',
      document: '{}',
    });
    assert.equal(r2.message, 'The public record could not be written this time. The result above is still right.');
  });

  it('rekor url on another host is dropped', () => {
    const sha = 'd'.repeat(64);
    const r = recordView({
      sha256: sha,
      recorded_at: '2024-01-01T00:00:00Z',
      document: '{}',
      rekor: { url: 'https://evil.com/?logIndex=123' },
      solana: { url: 'https://explorer.solana.com/tx/abc?cluster=devnet' },
    });
    assert.equal(r.rekorUrl, null);
    // without rekor, message is public record failure
    assert.equal(r.message, 'The public record could not be written this time. The result above is still right.');
  });

  it('solana link without ?cluster=devnet is dropped', () => {
    const sha = 'e'.repeat(64);
    const r = recordView({
      sha256: sha,
      recorded_at: '2024-01-01T00:00:00Z',
      document: '{}',
      rekor: { url: 'https://search.sigstore.dev/?logIndex=1' },
      solana: { url: 'https://explorer.solana.com/tx/abc' },
    });
    assert.equal(r.solanaUrl, null);
    assert.equal(r.message, 'The devnet record could not be written this time.');
  });

  it('mainnet explorer link is dropped', () => {
    const sha = 'f'.repeat(64);
    const r = recordView({
      sha256: sha,
      recorded_at: '2024-01-01T00:00:00Z',
      document: '{}',
      rekor: { url: 'https://search.sigstore.dev/?logIndex=1' },
      solana: { url: 'https://explorer.solana.com/tx/abc?cluster=mainnet' },
    });
    assert.equal(r.solanaUrl, null);
    assert.equal(r.message, 'The devnet record could not be written this time.');
  });

  it('documentName and verifyCommand', () => {
    const sha = 'ab'.repeat(32);
    const r = recordView({
      sha256: sha,
      recorded_at: '2024-01-01T00:00:00Z',
      document: '{}',
    });
    assert.equal(r.documentName, `yokoten-doctor-${sha.slice(0, 12)}.json`);
    assert.equal(r.verifyCommand, `sha256sum ${r.documentName}`);
  });

  it('documentText is document unchanged', () => {
    const sha = 'a'.repeat(64);
    const doc = '{"hello":"world","x":1}';
    const r = recordView({
      sha256: sha,
      recorded_at: '2024-01-01T00:00:00Z',
      document: doc,
    });
    assert.equal(r.documentText, doc);
    assert.equal(r.sha256, sha);
    assert.equal(r.recordedAt, '2024-01-01T00:00:00Z');
  });
});
