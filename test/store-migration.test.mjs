import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { JsonStore, migrateState } from "../src/store.mjs";

test("v1 state migrates additively without dropping existing records", () => {
  const original = { schemaVersion: 1, revision: 4, campaigns: [{ id: "c1" }], auditLog: [] };
  const { state, changed } = migrateState(original, new Date("2026-10-07T00:00:00.000Z"));
  assert.equal(changed, true);
  assert.equal(state.schemaVersion, 2);
  assert.deepEqual(state.campaigns, [{ id: "c1" }]);
  assert.deepEqual(state.artifacts, []);
  assert.deepEqual(state.stories, []);
  assert.equal(state.revision, 5);
  assert.equal(state.auditLog.at(-1).event, "state_schema_migrated_v2");
});

test("store accepts a UTF-8 BOM runtime receipt/state and persists v2", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "seeding-migrate-"));
  const file = path.join(dir, "state.json");
  await writeFile(file, `\uFEFF${JSON.stringify({ schemaVersion: 1, revision: 0, campaigns: [], auditLog: [] })}`, "utf8");
  const state = await new JsonStore(file).init();
  assert.equal(state.schemaVersion, 2);
  assert.doesNotMatch(await readFile(file, "utf8"), /^\uFEFF/);
});

test("migration rejects a future schema instead of downgrading it", () => {
  assert.throws(() => migrateState({ schemaVersion: 3, revision: 9 }), /newer than supported/);
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
