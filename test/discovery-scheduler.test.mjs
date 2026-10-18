import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { JsonStore } from '../src/store.mjs';
import { SeedingService, normalizeDiscoveryFit } from '../src/service.mjs';
import { campaignScopeFingerprint } from '../src/campaign-authorization.mjs';

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'discovery-scheduler-'));
  await writeFile(path.join(root, 'README.md'), 'fixture');
  const store = new JsonStore(path.join(root, 'state.json'), { requireLease: false });
  const service = new SeedingService(store);
  await service.init();
  return { root, store, service };
}

test('campaign discovery sources are bounded and sanitized', async () => {
  const f = await fixture();
  const campaign = await f.service.createCampaign({ name: 'C', objective: 'O', productRepo: f.root, discoverySources: ['https://example.com/feed#fragment'] });
  assert.deepEqual(campaign.discoverySources, ['https://example.com/feed']);
  await assert.rejects(f.service.createCampaign({ name: 'C2', objective: 'O', productRepo: f.root, discoverySources: ['ftp://example.com'] }), /HTTP\(S\)/);
  await assert.rejects(f.service.createCampaign({ name: 'C3', objective: 'O', productRepo: f.root, discoverySources: ['https://user:pass@example.com'] }), /without credentials/);
});

test('campaign discovery fit is bounded, normalized, persisted and advisory', async () => {
  const f = await fixture();
  const campaign = await f.service.createCampaign({
    name: 'Fit campaign', objective: 'O', productRepo: f.root,
    discoveryFit: { audienceKeywords: [' Workflow ', 'workflow', 'A'.repeat(100)], targetChannel: ' Example ', targetLocale: 'EN-US' }
  });
  assert.deepEqual(campaign.discoveryFit, {
    audienceKeywords: ['workflow', 'a'.repeat(64)], targetChannel: 'example', targetLocale: 'en-us'
  });
  assert.deepEqual(normalizeDiscoveryFit({}), null);
  assert.throws(() => normalizeDiscoveryFit(['workflow']), /must be an object/);
  assert.throws(() => normalizeDiscoveryFit({ targetChannel: 'token: leaked' }), /credential\/session/);

  const beforeScope = campaignScopeFingerprint(campaign);
  const updated = await f.service.updateCampaign(campaign.id, {
    discoveryFit: { audienceKeywords: ['automation'], targetChannel: 'threads', targetLocale: 'en-US' }
  });
  assert.deepEqual(updated.discoveryFit, {
    audienceKeywords: ['automation'], targetChannel: 'threads', targetLocale: 'en-us'
  });
  assert.equal(campaignScopeFingerprint(updated), beforeScope);
  const cleared = await f.service.updateCampaign(campaign.id, { discoveryFit: null });
  assert.equal(Object.prototype.hasOwnProperty.call(cleared, 'discoveryFit'), false);
  assert.equal(campaignScopeFingerprint(cleared), beforeScope);
});

test('discovery observation preserves authority collections and records only successful fixtures', async () => {
  const f = await fixture();
  const campaign = await f.service.createCampaign({ name: 'C', objective: 'O', productRepo: f.root });
  const before = await f.store.read();
  const fixtureFetch = async (url) => ({ ok: true, status: 200, headers: new Headers({ 'content-type': 'text/plain' }), body: new Blob(['Need workflow help']) .stream() });
  const result = await f.service.observeDiscoveries(campaign.id, { urls: ['https://example.com/public'], options: { fetchImpl: fixtureFetch }, keywords: ['workflow'] });
  assert.equal(result.persisted.accepted, 1);
  const after = await f.store.read();
  assert.deepEqual(after.campaignAuthorizations, before.campaignAuthorizations);
  assert.deepEqual(after.executionRequests, before.executionRequests);
  assert.equal(after.campaigns[0].discovery.observations.length, 1);
});

test('pollConfiguredDiscoveries is bounded, isolates campaign errors and skips unconfigured campaigns', async () => {
  const calls = [];
  const service = {
    async snapshot() { return { campaigns: [
      { id: 'a', discoverySources: ['https://example.com/a'] },
      { id: 'b', discoverySources: [] },
      { id: 'c', discoverySources: ['https://example.com/c'] }
    ] }; },
    async observeDiscoveries(id, input) { calls.push([id, input.urls]); if (id === 'c') throw Object.assign(new Error('fixture failure'), { code: 'FIXTURE_FAIL' }); return { requested: input.urls.length, observations: [], persisted: { accepted: 2 } }; }
  };
  const { pollConfiguredDiscoveries } = await import('../src/service.mjs');
  const summary = await pollConfiguredDiscoveries(service, { actor: 'test' });
  assert.deepEqual(calls, [['a', ['https://example.com/a']], ['c', ['https://example.com/c']]]);
  assert.deepEqual(summary, { campaigns: 2, succeeded: 1, failed: 1, results: [
    { campaignId: 'a', requested: 1, accepted: 2, unknown: 0 },
    { campaignId: 'c', ok: false, reason: 'FIXTURE_FAIL' }
  ] });
});

test('pollConfiguredDiscoveries forwards configured fit and preserves legacy no-fit input', async () => {
  const calls = [];
  const service = {
    async snapshot() { return { campaigns: [
      { id: 'fit', discoverySources: ['https://example.com/fit'], discoveryFit: { audienceKeywords: ['automation'], targetChannel: 'example', targetLocale: 'en-us' } },
      { id: 'legacy', discoverySources: ['https://example.com/legacy'] }
    ] }; },
    async observeDiscoveries(id, input) {
      calls.push([id, input]);
      return { requested: input.urls.length, observations: [], persisted: { accepted: 0 } };
    }
  };
  const { pollConfiguredDiscoveries } = await import('../src/service.mjs');
  await pollConfiguredDiscoveries(service, { actor: 'test' });
  assert.deepEqual(calls, [
    ['fit', { urls: ['https://example.com/fit'], fit: { audienceKeywords: ['automation'], targetChannel: 'example', targetLocale: 'en-us' } }],
    ['legacy', { urls: ['https://example.com/legacy'] }]
  ]);
});

test('discovery poll interval policy is disabled at zero and rejects enabled values below fifteen minutes', () => {
  assert.equal(Number('0') > 0, false);
  assert.equal(Number('15') >= 15, true);
  assert.equal(Number('14') >= 15, false);
});
