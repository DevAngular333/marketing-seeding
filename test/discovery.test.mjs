import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDiscovery, deduplicateDiscoveries, processDiscoveries } from '../src/discovery.mjs';

const policies = { 'example.com': { channel: 'example', actions: ['observe'] } };

test('normalizes URL, text, provenance and stable id', () => {
  const a = normalizeDiscovery({ url: 'HTTPS://EXAMPLE.COM/thread#frag', title: '  A  ', text: ' hello\nworld ', source: 'fixture' }, { policies, now: '2026-01-01T00:00:00Z' });
  const b = normalizeDiscovery({ url: 'https://example.com/thread', title: 'A', text: 'hello world', source: 'fixture' }, { policies, now: '2026-01-01T00:00:00Z' });
  assert.equal(a.url, b.url); assert.equal(a.discoveryId, b.discoveryId); assert.equal(a.policy.status, 'ELIGIBLE'); assert.equal(a.provenance.source, 'fixture');
});

test('fails closed for unsafe and unsupported targets', () => {
  assert.throws(() => normalizeDiscovery({ url: 'javascript:alert(1)' }, { policies }), /unsafe|unsupported/);
  const item = normalizeDiscovery({ url: 'https://unknown.test/a' }, { policies });
  assert.equal(item.status, 'UNSUPPORTED');
});

test('deduplicates stable observations deterministically', () => {
  const a = normalizeDiscovery({ url: 'https://example.com/a', title: 'x', text: 'y', observedAt: '2026-02-02', source: 'b' }, { policies });
  const b = normalizeDiscovery({ url: 'https://example.com/a', title: 'x', text: 'y', observedAt: '2026-02-01', source: 'a' }, { policies });
  assert.equal(deduplicateDiscoveries([a, b]).length, 1); assert.equal(deduplicateDiscoveries([a, b])[0].provenance.source, 'a');
});

test('classifies and scores with explainable factors', () => {
  const [item] = processDiscoveries([{ url: 'https://example.com/a', title: 'Need automation', text: 'workflow pain', source: 'fixture' }], { policies, keywords: ['automation'], blockedKeywords: ['spam'] });
  assert.equal(item.classification.label, 'RELEVANT'); assert.equal(item.score.score, 100); assert.match(item.score.explanation, /relevant/);
});

test('blocked keyword receives zero score and no action eligibility', () => {
  const [item] = processDiscoveries([{ url: 'https://example.com/a', text: 'spam automation', source: 'fixture' }], { policies, keywords: ['automation'], blockedKeywords: ['spam'] });
  assert.equal(item.classification.label, 'BLOCKED'); assert.equal(item.score.score, 0);
});

test('redacts credential-like observation material', () => {
  const [item] = processDiscoveries([{
    url: 'https://example.com/a',
    text: 'token=abc123 password=hunter2',
    source: 'Bearer abcdefghijklmnop'
  }], { policies });
  assert.doesNotMatch(JSON.stringify(item), /hunter2|abcdefghijklmnop/);
  assert.match(JSON.stringify(item), /credential\/session material exists/);
});

test('evaluates bounded audience, channel and locale fit deterministically', () => {
  const options = { policies, fit: { audienceKeywords: ['automation'], targetChannel: 'example', targetLocale: 'en-US' } };
  const [matched] = processDiscoveries([{ url: 'https://example.com/a', title: 'Automation tips', text: 'workflow', locale: 'en-US' }], options);
  assert.equal(matched.fit.audience.status, 'MATCHED');
  assert.equal(matched.fit.channel.status, 'MATCHED');
  assert.equal(matched.fit.locale.status, 'MATCHED');
  assert.equal(matched.fit.eligible, true);
  const [mismatched] = processDiscoveries([{ url: 'https://example.com/a', title: 'Automation tips', locale: 'fr-FR' }], options);
  assert.equal(mismatched.fit.locale.status, 'MISMATCHED');
  const [unknown] = processDiscoveries([{ url: 'https://example.com/b', title: '' }], { policies, fit: { targetLocale: 'en-US' } });
  assert.equal(unknown.fit.locale.status, 'UNKNOWN');
  assert.deepEqual(unknown.fit, processDiscoveries([{ url: 'https://example.com/b', title: '' }], { policies, fit: { targetLocale: 'en-US' } })[0].fit);
});
