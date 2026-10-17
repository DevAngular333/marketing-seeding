import dns from "node:dns/promises";
import net from "node:net";

const DEFAULTS = Object.freeze({ maxUrls: 20, maxBytes: 256_000, maxText: 12_000, maxRedirects: 3, timeoutMs: 8_000 });
const PUBLIC_TYPES = new Set(["text/html", "text/plain", "application/xhtml+xml"]);

function privateAddress(address) {
  const normalized = String(address).toLowerCase().replace(/^::ffff:/, "");
  if (net.isIP(normalized) === 4) {
    const [a, b] = normalized.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  if (net.isIP(normalized) === 6) {
    return normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb") || normalized.startsWith("ff");
  }
  return true;
}

export async function validatePublicUrl(raw, { lookup = dns.lookup } = {}) {
  let url;
  try { url = new URL(String(raw)); } catch { throw new Error("invalid URL"); }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("unsupported URL scheme");
  if (url.username || url.password) throw new Error("URL credentials are not allowed");
  if (!url.hostname) throw new Error("URL hostname is required");
  const addresses = net.isIP(url.hostname) ? [{ address: url.hostname }] : await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => privateAddress(entry.address))) throw new Error("private or reserved destination is not allowed");
  return url;
}

function redact(value) {
  return String(value || "").replace(/(bearer\s+|password|secret|token|cookie|authorization|api[_-]?key|session)\s*[=:]?\s*[^\s]+/gi, "$1credential/session material exists");
}

function htmlText(body) {
  const title = (body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/<[^>]+>/g, "");
  const text = body.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  return { title, text };
}

export function extractObservation(body, contentType, { maxText = DEFAULTS.maxText } = {}) {
  const source = String(body || "");
  const extracted = contentType.includes("html") ? htmlText(source) : { title: "", text: source };
  const clip = (value) => redact(value).replace(/\s+/g, " ").trim().slice(0, maxText);
  return { title: clip(extracted.title), text: clip(extracted.text) };
}

async function readBounded(response, maxBytes) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error("response exceeds byte bound");
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks = []; let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) { await reader.cancel(); throw new Error("response exceeds byte bound"); }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks.map((item) => Buffer.from(item))));
}

export async function observePublicUrls(urls, options = {}) {
  const config = { ...DEFAULTS, ...options };
  const requested = Array.isArray(urls) ? urls.slice(0, config.maxUrls) : [];
  const results = [];
  const fetchImpl = config.fetchImpl || globalThis.fetch;
  for (const raw of requested) {
    let current = String(raw); let redirects = 0; let finalUrl = null;
    try {
      while (true) {
        const url = await validatePublicUrl(current, config);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), config.timeoutMs);
        let response;
        try { response = await fetchImpl(url, { redirect: "manual", signal: controller.signal }); } finally { clearTimeout(timer); }
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          if (redirects >= config.maxRedirects) throw new Error("redirect limit exceeded");
          const location = response.headers.get("location");
          if (!location) throw new Error("redirect location missing");
          current = new URL(location, url).toString(); redirects += 1; continue;
        }
        finalUrl = url.toString();
        if (!response.ok) throw new Error(`HTTP_${response.status}`);
        const contentType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
        if (!PUBLIC_TYPES.has(contentType)) throw new Error("unsupported content type");
        const body = await readBounded(response, config.maxBytes);
        const extracted = extractObservation(body, contentType, config);
        results.push({ url: finalUrl, title: extracted.title, text: extracted.text, source: "public-http-observer", observedAt: new Date().toISOString(), fetch: { status: response.status, contentType, redirects } });
        break;
      }
    } catch (error) {
      results.push({ url: finalUrl || String(raw), title: "", text: "", source: "public-http-observer", observedAt: new Date().toISOString(), fetch: { status: "UNKNOWN", reason: redact(error?.name === "AbortError" ? "timeout" : error?.message || "unavailable"), redirects }, observationStatus: "UNKNOWN" });
    }
  }
  return { requested: requested.length, truncated: Array.isArray(urls) && urls.length > requested.length, observations: results };
}

export { privateAddress };
