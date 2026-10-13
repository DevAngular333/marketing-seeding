import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createInitialState } from "../src/store.mjs";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("campaign authorization API is operator-only while queue reevaluation is automation-safe", async (context) => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "campaign-authorization-server-test-"));
  const state = createInitialState();
  state.campaigns.push({
    id: "campaign-http-fixture",
    name: "HTTP fixture",
    objective: "Verify authorization endpoint permissions",
    productRepo: appRoot,
    status: "active",
    audience: [],
    createdAt: new Date().toISOString()
  });
  await writeFile(path.join(dataDir, "state.json"), JSON.stringify(state));
  const operatorToken = randomBytes(32).toString("hex");
  const automationToken = randomBytes(32).toString("hex");
  const child = spawn(process.execPath, ["src/server.mjs"], {
    cwd: appRoot,
    env: {
      ...process.env,
      OPENSSL_CONF: "",
      SEEDING_DATA_DIR: dataDir,
      SEEDING_AUTO_GTM_FEED_FILE: path.join(dataDir, "absent-feed.json"),
      SEEDING_PORT: "0",
      SEEDING_OPERATOR_TOKEN: operatorToken,
      SEEDING_AUTOMATION_TOKEN: automationToken,
      SEEDING_TRAFFIC_POLL_MINUTES: "0"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  context.after(() => child.kill());
  const baseUrl = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Fixture server did not start")), 10_000);
    child.once("error", reject);
    child.stderr.on("data", (chunk) => reject(new Error(chunk.toString())));
    child.stdout.on("data", (chunk) => {
      const match = chunk.toString().match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve(`http://127.0.0.1:${match[1]}`);
      }
    });
  });
  const endpoint = `${baseUrl}/api/campaigns/campaign-http-fixture/authorization`;
  assert.equal((await fetch(endpoint, { method: "POST", body: "{}" })).status, 401);
  assert.equal((await fetch(endpoint, {
    method: "POST",
    headers: { authorization: `Bearer ${automationToken}`, "content-type": "application/json" },
    body: "{}"
  })).status, 401);
  assert.equal((await fetch(endpoint, {
    method: "POST",
    headers: { authorization: `Bearer ${operatorToken}`, "content-type": "application/json" },
    body: "{}"
  })).status, 400);
  const queueResponse = await fetch(`${baseUrl}/api/campaigns/campaign-http-fixture/queue-ready-jobs`, {
    method: "POST",
    headers: { authorization: `Bearer ${automationToken}`, "content-type": "application/json" },
    body: "{}"
  });
  assert.equal(queueResponse.status, 200);
  assert.deepEqual(await queueResponse.json(), []);
  assert.equal((await fetch(`${baseUrl}/api/campaigns/campaign-http-fixture/authorization/pause`, {
    method: "POST",
    headers: { authorization: `Bearer ${automationToken}`, "content-type": "application/json" },
    body: "{}"
  })).status, 401);
});
