import test from "node:test";
import assert from "node:assert/strict";
import { observePublicUrls, validatePublicUrl, extractObservation } from "../src/discovery-observer.mjs";

const publicLookup = async () => [{ address: "93.184.216.34" }];
const response = (body, { status = 200, type = "text/html" } = {}) => new Response(body, { status, headers: { "content-type": type } });

test("observer rejects unsafe schemes, credentials, and private destinations", async () => {
  await assert.rejects(validatePublicUrl("file:///tmp/x", { lookup: publicLookup }), /unsupported/);
  await assert.rejects(validatePublicUrl("https://user:pass@example.com", { lookup: publicLookup }), /credentials/);
  await assert.rejects(validatePublicUrl("http://127.0.0.1/x", { lookup: publicLookup }), /private/);
  assert.equal((await validatePublicUrl("https://example.com", { lookup: publicLookup })).hostname, "example.com");
});

test("observer extracts bounded redacted HTML and follows bounded public redirects", async () => {
  const calls = [];
  const fetchImpl = async (url) => { calls.push(String(url)); return calls.length === 1 ? new Response(null, { status: 302, headers: { location: "/final" } }) : response("<title>Need</title><script>bad()</script><p>Workflow token=secret-value</p>"); };
  const result = await observePublicUrls(["https://example.com/start"], { fetchImpl, lookup: publicLookup, maxText: 100 });
  assert.equal(result.observations.length, 1);
  assert.equal(result.observations[0].fetch.redirects, 1);
  assert.match(result.observations[0].title, /Need/);
  assert.doesNotMatch(result.observations[0].text, /secret-value/);
  assert.equal(calls.length, 2);
  assert.equal(extractObservation("<title>x</title><p>y</p>", "text/html").text, "x y");
});

test("observer classifies timeout, unsupported content and byte overflow as UNKNOWN", async () => {
  const fetchImpl = async (url, options) => {
    if (String(url).includes("timeout")) return await new Promise((_, reject) => options.signal.addEventListener("abort", () => { const e = new Error("aborted"); e.name = "AbortError"; reject(e); }));
    if (String(url).includes("type")) return response("{}", { type: "application/json" });
    return response("123456789", { type: "text/plain" });
  };
  const result = await observePublicUrls(["https://example.com/timeout", "https://example.com/type", "https://example.com/bytes"], { fetchImpl, lookup: publicLookup, timeoutMs: 5, maxBytes: 4 });
  assert.equal(result.observations.length, 3);
  assert.ok(result.observations.every((item) => item.observationStatus === "UNKNOWN"));
  assert.match(result.observations[1].fetch.reason, /content type/);
});

test("observer bounds URL count and redirects", async () => {
  const fetchImpl = async () => new Response(null, { status: 302, headers: { location: "https://example.com/again" } });
  const result = await observePublicUrls(["https://example.com/a", "https://example.com/b"], { fetchImpl, lookup: publicLookup, maxUrls: 1, maxRedirects: 0 });
  assert.equal(result.requested, 1); assert.equal(result.truncated, true);
  assert.equal(result.observations[0].observationStatus, "UNKNOWN");
  assert.match(result.observations[0].fetch.reason, /redirect/);
});
