import test from "node:test";
import assert from "node:assert/strict";
import { observePublicUrls, validatePublicUrl, extractObservation, extractFeedObservations, privateAddress } from "../src/discovery-observer.mjs";

const publicLookup = async () => [{ address: "93.184.216.34" }];
const response = (body, { status = 200, type = "text/html" } = {}) => new Response(body, { status, headers: { "content-type": type } });

test("observer rejects unsafe schemes, credentials, and private destinations", async () => {
  await assert.rejects(validatePublicUrl("file:///tmp/x", { lookup: publicLookup }), /unsupported/);
  await assert.rejects(validatePublicUrl("https://user:pass@example.com", { lookup: publicLookup }), /credentials/);
  await assert.rejects(validatePublicUrl("http://127.0.0.1/x", { lookup: publicLookup }), /private/);
  assert.equal((await validatePublicUrl("https://example.com", { lookup: publicLookup })).hostname, "example.com");
});

test("observer rejects carrier-grade NAT and reserved documentation ranges", () => {
  for (const address of ["100.64.0.1", "192.0.2.1", "198.18.0.1", "198.51.100.1", "203.0.113.1", "2001:db8::1", "2001:2::1"]) {
    assert.equal(privateAddress(address), true, address);
  }
  assert.equal(privateAddress("93.184.216.34"), false);
});

test("observer bounds DNS resolution before any fetch", async () => {
  await assert.rejects(validatePublicUrl("https://slow.example", { lookup: () => new Promise(() => {}), timeoutMs: 5 }), /DNS lookup timeout/);
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

test("observer timeout covers a response body that never produces a chunk", async () => {
  const fetchImpl = async () => new Response(new ReadableStream({ start() {} }), { status: 200, headers: { "content-type": "text/plain" } });
  const result = await observePublicUrls(["https://example.com/hanging-body"], { fetchImpl, lookup: publicLookup, timeoutMs: 5 });
  assert.equal(result.observations[0].observationStatus, "UNKNOWN");
  assert.match(result.observations[0].fetch.reason, /timeout/);
});

test("observer bounds URL count and redirects", async () => {
  const fetchImpl = async () => new Response(null, { status: 302, headers: { location: "https://example.com/again" } });
  const result = await observePublicUrls(["https://example.com/a", "https://example.com/b"], { fetchImpl, lookup: publicLookup, maxUrls: 1, maxRedirects: 0 });
  assert.equal(result.requested, 1); assert.equal(result.truncated, true);
  assert.equal(result.observations[0].observationStatus, "UNKNOWN");
  assert.match(result.observations[0].fetch.reason, /redirect/);
});

test("observer extracts bounded RSS items with safe links and publication time", async () => {
  const rss = `<?xml version="1.0"?><rss><channel><title>Design feeds</title><item><guid>item-1</guid><title>First &amp; useful</title><description><![CDATA[<p>Workflow help</p>]]></description><dc:creator>Ada</dc:creator><pubDate>Tue, 20 Oct 2026 10:00:00 GMT</pubDate><link>https://example.com/posts/1#comments</link></item><item><guid>item-2</guid><title>Second</title><description>More</description><link>https://127.0.0.1/private</link></item></channel></rss>`;
  const result = await observePublicUrls(["https://example.com/feed"], {
    fetchImpl: async () => response(rss, { type: "application/rss+xml" }), lookup: publicLookup, maxItems: 1
  });
  assert.equal(result.observations.length, 1);
  const [item] = result.observations;
  assert.equal(item.url, "https://example.com/posts/1");
  assert.equal(item.title, "First & useful");
  assert.equal(item.text, "Workflow help");
  assert.equal(item.author, "Ada");
  assert.equal(item.sourceId, "item-1");
  assert.equal(item.publishedAt, "2026-10-20T10:00:00.000Z");
  assert.equal(item.fetch.feed, true);
});

test("observer extracts Atom entries and fails closed for malformed or unsafe feed items", async () => {
  const atom = `<feed><title>Updates</title><entry><id>urn:1</id><title>Update</title><summary>Useful</summary><author><name>Sam</name></author><updated>2026-10-20T11:00:00Z</updated><link href="https://evil.example/item" /></entry></feed>`;
  const extracted = extractFeedObservations(atom, "application/atom+xml", { feedUrl: "https://example.com/feed", maxItems: 4 });
  assert.equal(extracted.length, 1);
  assert.equal(extracted[0].url, "https://example.com/feed");
  assert.equal(extracted[0].publishedAt, "2026-10-20T11:00:00.000Z");
  assert.equal(extracted[0].author, "Sam");

  const malformed = await observePublicUrls(["https://example.com/feed"], {
    fetchImpl: async () => response("<feed><entry><title>unfinished", { type: "application/atom+xml" }), lookup: publicLookup
  });
  assert.equal(malformed.observations[0].observationStatus, "UNKNOWN");
  assert.match(malformed.observations[0].fetch.reason, /feed contains no bounded items/);
});

test("observer recognizes bounded octet-stream feeds without relaxing unsupported-type behavior", async () => {
  const feed = "<rss><channel><item><title>One</title><link>https://example.com/one</link></item></channel></rss>";
  const result = await observePublicUrls(["https://example.com/feed"], {
    fetchImpl: async () => response(feed, { type: "application/octet-stream" }), lookup: publicLookup
  });
  assert.equal(result.observations.length, 1);
  assert.equal(result.observations[0].fetch.contentType, "application/octet-stream");
});

test("observer keeps oversized feeds UNKNOWN under the existing byte bound", async () => {
  const feed = "<rss><channel><item><title>Too large</title><description>payload</description></item></channel></rss>";
  const result = await observePublicUrls(["https://example.com/feed"], {
    fetchImpl: async () => response(feed, { type: "application/rss+xml" }), lookup: publicLookup, maxBytes: 8
  });
  assert.equal(result.observations.length, 1);
  assert.equal(result.observations[0].observationStatus, "UNKNOWN");
  assert.match(result.observations[0].fetch.reason, /response exceeds byte bound/);
});
