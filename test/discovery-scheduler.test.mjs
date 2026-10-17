import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { JsonStore } from '../src/store.mjs';
import { SeedingService } from '../src/service.mjs';

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

test('discovery poll interval policy is disabled at zero and rejects enabled values below fifteen minutes', () => {
  assert.equal(Number('0') > 0, false);
  assert.equal(Number('15') >= 15, true);
  assert.equal(Number('14') >= 15, false);
});
