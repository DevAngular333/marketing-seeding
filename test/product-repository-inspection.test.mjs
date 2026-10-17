import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, realpath, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { inspectRepositoryEvidence, summarizeRepositoryInspection } from "../src/product-repository-inspection.mjs";

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "repo-inspection-"));
  await writeFile(path.join(root, "README.md"), "# Demo\nA bounded product.\n", "utf8");
  await writeFile(path.join(root, "package.json"), '{"name":"demo"}\n', "utf8");
  await writeFile(path.join(root, "secret.txt"), "TOKEN=do-not-leak\n", "utf8");
  return root;
}

test("returns deterministic allowlisted evidence with stable file hashes", async () => {
  const root = await fixture();
  const first = await inspectRepositoryEvidence(root, { allowlist: ["package.json", "README.md"] });
  const second = await inspectRepositoryEvidence(root, { allowlist: ["README.md", "package.json"] });
  assert.deepEqual(first, second);
  assert.equal(first.records.length, 2);
  assert.match(first.records[0].sha256, /^[a-f0-9]{64}$/);
  assert.match(first.inspectionHash, /^[a-f0-9]{64}$/);
});

test("enforces allowlist, file and total byte bounds", async () => {
  const root = await fixture();
  const result = await inspectRepositoryEvidence(root, { allowlist: ["README.md", "secret.txt", "missing.md"], maxFileBytes: 8, maxTotalBytes: 8 });
  assert.equal(result.records.length, 0);
  assert.ok(result.skipped.some((item) => item.path === "README.md" && item.reason === "file_too_large"));
  assert.ok(result.skipped.some((item) => item.path === "missing.md" && item.reason === "missing"));
});

test("rejects symlink escape and redacts credential-like content", async () => {
  const root = await fixture();
  const outside = await mkdtemp(path.join(tmpdir(), "repo-outside-"));
  await writeFile(path.join(outside, "README.md"), "outside secret\n", "utf8");
  await symlink(path.join(outside, "README.md"), path.join(root, "linked.md"));
  await writeFile(path.join(root, "package.json"), '{"token":"abc"}\n', "utf8");
  const result = await inspectRepositoryEvidence(root, { allowlist: ["linked.md", "package.json"] });
  assert.ok(result.skipped.some((item) => item.reason === "symlink_escape"));
  assert.equal(result.records[0].content.includes('"token":"abc"'), false);
  assert.match(result.records[0].content, /credential\/session material exists/);
});

test("rejects paths outside repository and caps text", async () => {
  const root = await fixture();
  const result = await inspectRepositoryEvidence(root, { allowlist: ["../outside", "/tmp/nope", "README.md"], maxTextBytes: 5 });
  assert.ok(result.skipped.some((item) => item.reason === "invalid_path"));
  assert.ok(result.records[0].content.length <= 5);
});

test("forbids credential-like filenames and preserves only bounded lineage metadata", async () => {
  const root = await fixture();
  await writeFile(path.join(root, "token.json"), '{"token":"abc"}\n', "utf8");
  const result = await inspectRepositoryEvidence(root, { allowlist: ["token.json", "README.md"] });
  assert.ok(result.skipped.some((item) => item.path === "token.json" && item.reason === "forbidden_path"));
  const summary = summarizeRepositoryInspection(result);
  assert.equal(summary.repository, await realpath(root));
  assert.equal(summary.records.length, 1);
  assert.equal("content" in summary.records[0], false);
  assert.equal(summary.inspectionHash, result.inspectionHash);
  assert.equal(summarizeRepositoryInspection({ ...result, inspectionHash: "bad" }), null);
});

