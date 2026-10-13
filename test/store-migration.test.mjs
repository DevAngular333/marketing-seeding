import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { JsonStore, migrateState } from "../src/store.mjs";

test("v1 state migrates additively to v4 without dropping existing records", () => {
  const original = { schemaVersion: 1, revision: 4, campaigns: [{ id: "c1" }], auditLog: [] };
  const { state, changed } = migrateState(original, new Date("2026-10-07T00:00:00.000Z"));
  assert.equal(changed, true);
  assert.equal(state.schemaVersion, 4);
  assert.deepEqual(state.campaigns, [{ id: "c1" }]);
  assert.deepEqual(state.campaignAuthorizations, []);
  assert.deepEqual(state.executionAccounts, []);
  assert.deepEqual(state.executionRequests, []);
  assert.deepEqual(state.executionReceipts, []);
  assert.deepEqual(state.artifacts, []);
  assert.deepEqual(state.stories, []);
  assert.equal(state.revision, 5);
  assert.equal(state.auditLog.at(-1).event, "state_schema_migrated_v4");
});

test("store accepts a UTF-8 BOM state and persists schema v4", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "seeding-migrate-"));
  const file = path.join(dir, "state.json");
  await writeFile(file, `\uFEFF${JSON.stringify({ schemaVersion: 1, revision: 0, campaigns: [], auditLog: [] })}`, "utf8");
  const state = await new JsonStore(file).init();
  assert.equal(state.schemaVersion, 4);
  assert.doesNotMatch(await readFile(file, "utf8"), /^\uFEFF/);
});

test("schema v2 migrates to v4 in an isolated fixture and preserves legacy approvals without promoting them", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "seeding-v2-v4-migrate-"));
  const file = path.join(dir, "state.json");
  const original = {
    schemaVersion: 2,
    revision: 9,
    campaigns: [{ id: "campaign-legacy", status: "active" }],
    posts: [{ id: "legacy-post", campaignId: "campaign-legacy", status: "approved", approvedAt: "2026-10-01T00:00:00.000Z" }],
    auditLog: [{ id: "prior-audit", event: "legacy" }]
  };
  await writeFile(file, JSON.stringify(original), "utf8");

  const state = await new JsonStore(file).init();
  assert.equal(state.schemaVersion, 4);
  assert.equal(state.revision, 10);
  assert.deepEqual(state.campaigns, original.campaigns);
  assert.deepEqual(state.posts, original.posts);
  assert.deepEqual(state.campaignAuthorizations, []);
  assert.equal(state.posts[0].approvedAt, original.posts[0].approvedAt);
  assert.equal(state.auditLog.at(-1).event, "state_schema_migrated_v4");
  const backup = JSON.parse(await readFile(`${file}.schema-v4.bak`, "utf8"));
  assert.deepEqual(backup, original);
});

test("schema v3 retains campaign authorization and adds execution collections", () => {
  const authorization = { id: "auth-v3", campaignId: "campaign-v3", status: "active" };
  const { state, changed } = migrateState({ schemaVersion: 3, revision: 2, campaignAuthorizations: [authorization], auditLog: [] });
  assert.equal(changed, true);
  assert.equal(state.schemaVersion, 4);
  assert.deepEqual(state.campaignAuthorizations, [authorization]);
  assert.deepEqual(state.executionAccounts, []);
  assert.deepEqual(state.executionRequests, []);
  assert.deepEqual(state.executionReceipts, []);
});

test("migration rejects a future schema instead of downgrading it", () => {
  assert.throws(() => migrateState({ schemaVersion: 5, revision: 9 }), /newer than supported/);
});

test("runtime writer lease fences a second process/store owner", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "seeding-lease-"));
  const file = path.join(dir, "state.json");
  const first = new JsonStore(file, { requireLease: true });
  await first.acquireWriterLease();
  await first.init();
  const second = new JsonStore(file, { requireLease: true });
  await assert.rejects(second.acquireWriterLease(), /already held/);
  await first.releaseWriterLease();
  await second.acquireWriterLease();
  await second.releaseWriterLease();
});
