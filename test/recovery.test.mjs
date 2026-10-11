import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function startServer(dataDir, token) {
  const automationToken = `automation-${token}`;
  const child = spawn(process.execPath, ["src/server.mjs"], {
    cwd: appRoot,
    env: { ...process.env, OPENSSL_CONF: "", SEEDING_DATA_DIR: dataDir, SEEDING_PORT: "0", SEEDING_OPERATOR_TOKEN: token, SEEDING_AUTOMATION_TOKEN: automationToken },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const baseUrl = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Fixture server did not start")), 10_000);
    child.once("error", reject);
    child.stderr.on("data", (chunk) => reject(new Error(chunk.toString())));
    child.stdout.on("data", (chunk) => {
      const match = chunk.toString().match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (match) { clearTimeout(timer); resolve(`http://127.0.0.1:${match[1]}`); }
    });
  });
  return { child, baseUrl };
}

function stopServer(child) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 5_000);
    child.once("exit", () => { clearTimeout(timer); resolve(); });
    child.kill("SIGTERM");
  });
}

test("concurrent load stays responsive and persisted state survives process restart", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "seeding-recovery-test-"));
  const token = randomBytes(32).toString("hex");
  const first = await startServer(dataDir, token);
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json", "x-agentic-actor": "stress-test" };
  const writes = Array.from({ length: 30 }, (_, index) => fetch(`${first.baseUrl}/api/campaigns`, {
    method: "POST", headers,
    body: JSON.stringify({ name: `Campaign ${index}`, objective: "Recovery test", productRepo: appRoot })
  }));
  const reads = Array.from({ length: 100 }, () => fetch(`${first.baseUrl}/api/dashboard`));
  const responses = await Promise.all([...writes, ...reads]);
  assert.equal(responses.every((response) => response.ok), true);
  const before = await (await fetch(`${first.baseUrl}/api/state`, { headers })).json();
  assert.equal(before.campaigns.length, 30);
  assert.equal(before.revision, 30);
  await stopServer(first.child);

  const second = await startServer(dataDir, token);
  try {
    const health = await fetch(`${second.baseUrl}/health`);
    assert.equal(health.status, 200);
    const after = await (await fetch(`${second.baseUrl}/api/state`, { headers })).json();
    assert.equal(after.campaigns.length, 30);
    assert.equal(after.revision, 30);
  } finally {
    await stopServer(second.child);
  }
});
