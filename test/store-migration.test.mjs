import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { JsonStore, migrateState } from "../src/store.mjs";

test("v1 state migrates additively to v3 without dropping existing records", () => {
  const original = { schemaVersion: 1, revision: 4, campaigns: [{ id: "c1" }], auditLog: [] };
  const { state, changed } = migrateState(original, new Date("2026-10-07T00:00:00.000Z"));
  assert.equal(changed, true);
  assert.equal(state.schemaVersion, 3);
  assert.deepEqual(state.campaigns, [{ id: "c1" }]);
  assert.deepEqual(state.campaignAuthorizations, []);
  assert.deepEqual(state.artifacts, []);
  assert.deepEqual(state.stories, []);
  assert.equal(state.revision, 5);
  assert.equal(state.auditLog.at(-1).event, "state_schema_migrated_v3");
});

test("store accepts a UTF-8 BOM state and persists schema v3", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "seeding-migrate-"));
  const file = path.join(dir, "state.json");
  await writeFile(file, `\uFEFF${JSON.stringify({ schemaVersion: 1, revision: 0, campaigns: [], auditLog: [] })}`, "utf8");
  const state = await new JsonStore(file).init();
  assert.equal(state.schemaVersion, 3);
  assert.doesNotMatch(await readFile(file, "utf8"), /^\uFEFF/);
});

test("schema v2 migrates to v3 in an isolated fixture and preserves legacy approvals without promoting them", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "seeding-v2-v3-migrate-"));
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
  assert.equal(state.schemaVersion, 3);
  assert.equal(state.revision, 10);
  assert.deepEqual(state.campaigns, original.campaigns);
  assert.deepEqual(state.posts, original.posts);
  assert.deepEqual(state.campaignAuthorizations, []);
  assert.equal(state.posts[0].approvedAt, original.posts[0].approvedAt);
  assert.equal(state.auditLog.at(-1).event, "state_schema_migrated_v3");
  const backup = JSON.parse(await readFile(`${file}.schema-v3.bak`, "utf8"));
  assert.deepEqual(backup, original);
});

test("migration rejects a future schema instead of downgrading it", () => {
  assert.throws(() => migrateState({ schemaVersion: 4, revision: 9 }), /newer than supported/);
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
