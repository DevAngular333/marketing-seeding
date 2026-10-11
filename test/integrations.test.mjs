import test from "node:test";
import assert from "node:assert/strict";
import { collectOfficialMetrics, integrationReadiness, requestJson } from "../src/integrations.mjs";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("integration readiness reports only credential names and never values", () => {
  const secret = "never-render-this-secret";
  const rows = integrationReadiness({ THREADS_GRAPH_VERSION: "v1.0", THREADS_ACCESS_TOKEN: secret });
  const threads = rows.find((item) => item.id === "threads");
  assert.equal(threads.configured, true);
  assert.doesNotMatch(JSON.stringify(rows), new RegExp(secret));
  assert.equal(rows.find((item) => item.id === "indie_hackers").mode, "manual_only");
});

test("official Threads collector maps provider metrics to finite integer snapshots", async () => {
  const result = await collectOfficialMetrics(
    { status: "published", externalId: "thread_1" },
    { channel: "threads" },
    {
      env: { THREADS_GRAPH_VERSION: "v1.0", THREADS_ACCESS_TOKEN: "fixture-token" },
      fetchImpl: async (url) => {
        assert.match(String(url), /^https:\/\/graph\.threads\.net\/v1\.0\/thread_1\/insights/);
        return jsonResponse({ data: [
          { name: "views", values: [{ value: 20 }] },
          { name: "likes", values: [{ value: 3 }] },
          { name: "replies", values: [{ value: 2 }] },
          { name: "reposts", values: [{ value: 1 }] },
          { name: "quotes", values: [{ value: 1 }] },
          { name: "shares", values: [{ value: 2 }] }
        ] });
      }
    }
  );
  assert.deepEqual(result, {
    impressions: 20, reactions: 3, comments: 2, shares: 4, clicks: null, leads: null,
    coverage: { impressions: "measured", reactions: "measured", comments: "measured", shares: "measured", clicks: "unsupported", leads: "unsupported" },
    source: "official:threads"
  });
});

test("provider request retries transient network errors without duplicating successful result", async () => {
  let attempts = 0;
  const result = await requestJson("https://example.invalid/fixture", {}, {
    retries: 2,
    fetchImpl: async () => {
      attempts += 1;
      if (attempts < 3) throw new TypeError("network offline");
      return jsonResponse({ ok: true });
    }
  });
  assert.deepEqual(result, { ok: true });
  assert.equal(attempts, 3);
});
