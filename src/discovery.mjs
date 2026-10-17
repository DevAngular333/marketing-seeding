import { createHash } from 'node:crypto';

const UNSAFE_SCHEMES = /^(javascript|data|file|ftp):/i;
const ALLOWED_SCHEMES = new Set(['http:', 'https:']);

function stable(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
}

function hash(value) { return createHash('sha256').update(stable(value)).digest('hex'); }

function normalizeText(value) { return String(value ?? '').replace(/\s+/g, ' ').trim(); }

function normalizeUrl(raw) {
  const url = new URL(String(raw));
  if (!ALLOWED_SCHEMES.has(url.protocol) || UNSAFE_SCHEMES.test(String(raw))) throw new Error('unsupported or unsafe URL scheme');
  url.hash = '';
  url.hostname = url.hostname.toLowerCase();
  return url.toString();
}

function policyFor(url, policies = {}) {
  const host = new URL(url).hostname;
  const entry = policies[host] ?? policies['*'];
  if (!entry) return { status: 'UNSUPPORTED', reason: 'no channel policy for host', host };
  if (entry.enabled === false) return { status: 'INELIGIBLE', reason: entry.reason || 'channel disabled', host };
  if (Array.isArray(entry.allowedHosts) && !entry.allowedHosts.includes(host)) return { status: 'INELIGIBLE', reason: 'host not allowed by policy', host };
  return { status: 'ELIGIBLE', reason: 'channel policy matched', host, channel: entry.channel || host, actions: [...(entry.actions || [])].sort() };
}

export function normalizeDiscovery(observation, { policies = {}, now = new Date().toISOString() } = {}) {
  if (!observation || typeof observation !== 'object') throw new Error('observation must be an object');
  const url = normalizeUrl(observation.url);
  const policy = policyFor(url, policies);
  const title = normalizeText(observation.title);
  const text = normalizeText(observation.text ?? observation.body ?? observation.content);
  const provenance = {
    source: normalizeText(observation.source || 'caller-supplied'),
    observedAt: observation.observedAt || now,
    sourceId: observation.sourceId ? normalizeText(observation.sourceId) : undefined,
  };
  const normalized = {
    url,
    title,
    text,
    author: normalizeText(observation.author),
    channel: policy.channel || policy.host,
    policy,
    provenance,
  };
  const discoveryId = hash({ url, title, text, author: normalized.author });
  return { ...normalized, discoveryId, normalizedAt: now, status: policy.status };
}

export function deduplicateDiscoveries(discoveries) {
  const seen = new Map();
  for (const item of discoveries || []) {
    if (!item?.discoveryId) continue;
    const prior = seen.get(item.discoveryId);
    if (!prior || String(item.provenance?.observedAt || '') < String(prior.provenance?.observedAt || '')) seen.set(item.discoveryId, item);
  }
  return [...seen.values()].sort((a, b) => a.discoveryId.localeCompare(b.discoveryId));
}

export function classifyDiscovery(discovery, { keywords = [], blockedKeywords = [] } = {}) {
  if (!discovery || discovery.status !== 'ELIGIBLE') return { label: 'INELIGIBLE', reason: discovery?.policy?.reason || 'not eligible', matchedKeywords: [] };
  const haystack = `${discovery.title} ${discovery.text}`.toLowerCase();
  const blocked = blockedKeywords.filter((word) => haystack.includes(String(word).toLowerCase()));
  if (blocked.length) return { label: 'BLOCKED', reason: 'blocked keyword matched', matchedKeywords: [], blockedKeywords: blocked };
  const matched = keywords.filter((word) => haystack.includes(String(word).toLowerCase()));
  return { label: matched.length ? 'RELEVANT' : 'UNCLASSIFIED', reason: matched.length ? 'relevance keyword matched' : 'no relevance evidence', matchedKeywords: matched };
}

export function scoreDiscovery(discovery, classification, { weights = {} } = {}) {
  const factors = {
    eligible: discovery?.status === 'ELIGIBLE' ? 1 : 0,
    relevant: classification?.label === 'RELEVANT' ? 1 : 0,
    blocked: classification?.label === 'BLOCKED' ? 1 : 0,
    provenance: discovery?.provenance?.source ? 1 : 0,
  };
  const appliedWeights = { eligible: 40, relevant: 40, blocked: -100, provenance: 20, ...weights };
  const score = Math.max(0, Math.min(100, Object.entries(factors).reduce((sum, [key, value]) => sum + value * appliedWeights[key], 0)));
  return { score, factors, weights: appliedWeights, explanation: Object.entries(factors).filter(([, value]) => value).map(([key]) => `${key}=${appliedWeights[key]}`).join(',') || 'no positive evidence' };
}

export function processDiscoveries(observations, options = {}) {
  const normalized = (observations || []).map((item) => normalizeDiscovery(item, options));
  return deduplicateDiscoveries(normalized).map((item) => {
    const classification = classifyDiscovery(item, options);
    return { ...item, classification, score: scoreDiscovery(item, classification, options) };
  });
}

export { stable };
