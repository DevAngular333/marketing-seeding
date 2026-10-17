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
