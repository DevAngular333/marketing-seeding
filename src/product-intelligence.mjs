import { createHash } from "node:crypto";

const REQUIRED_FIELDS = [
  "WHAT_IS_IT",
  "WHAT_PROBLEM_DOES_IT_SOLVE",
  "WHY_IS_IT_BETTER",
  "WHO_NEEDS_IT",
];
const SECRET_KEY = /(pass(word)?|secret|token|cookie|authorization|credential|api[_-]?key|session)/i;
const SECRET_VALUE = /(bearer\s+[a-z0-9._-]+|sk-[a-z0-9_-]{12,}|gh[pousr]_[a-z0-9_]{12,})/i;

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return createHash("sha256").update(stable(value)).digest("hex");
}

function redact(value, key = "") {
  if (SECRET_KEY.test(key)) return "credential/session material exists";
  if (typeof value === "string") return SECRET_VALUE.test(value) ? "credential/session material exists" : value;
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redact(v, k)]));
  }
  return value;
}

function text(value, max = 4000) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Normalize public, caller-supplied evidence without reading files or the network. */
export function normalizeEvidenceRecords(records = []) {
  if (!Array.isArray(records)) throw new TypeError("evidence must be an array");
  const byHash = new Map();
  const aliases = {};
  for (const raw of records) {
    if (!raw || typeof raw !== "object") continue;
    const candidate = redact({
      id: text(raw.id, 160),
      sourceType: text(raw.sourceType || raw.kind || "unknown", 80).toLowerCase(),
      locator: text(raw.locator || raw.path || raw.url, 1000),
      content: text(raw.content || raw.text || raw.snippet, 12000),
      observedAt: text(raw.observedAt || raw.occurredAt, 80),
    });
    if (!candidate.content || !candidate.id) continue;
    // Identity is content/source based so producer aliases do not duplicate evidence.
    const hash = digest({ sourceType: candidate.sourceType, locator: candidate.locator, content: candidate.content, observedAt: candidate.observedAt });
    const prior = byHash.get(hash);
    if (!prior || candidate.id.localeCompare(prior.id) < 0) byHash.set(hash, { ...candidate, hash });
    aliases[candidate.id] = hash;
  }
  return {
    records: [...byHash.values()].sort((a, b) => a.hash.localeCompare(b.hash)),
    aliases,
  };
}

function claim(raw, evidence, unsupported) {
  const item = raw && typeof raw === "object" ? raw : {};
  const id = text(item.id, 160) || `claim-${digest(text(item.text)).slice(0, 12)}`;
  const refs = Array.isArray(item.evidenceRefs) ? item.evidenceRefs.map((ref) => text(ref, 160)).filter(Boolean) : [];
  const hashes = refs.map((ref) => evidence.aliases[ref] || (evidence.records.some((record) => record.hash === ref) ? ref : null)).filter(Boolean);
  const output = { id, field: text(item.field, 80) || null, text: text(item.text), evidenceRefs: hashes };
  if (!output.text || !hashes.length || hashes.length !== refs.length) unsupported.push({ ...output, reason: !output.text ? "empty_claim" : "missing_or_invalid_evidence" });
  return output;
}

const UNSAFE_INFERENCE = /\b(best|better|fastest|leading|#1|customers?|users?\s+love|benchmark|superior|market|guarantee)\b/i;
const SENTENCE = /[^.!?\n]+[.!?]?/g;

function sentences(record) {
  return text(record?.content, 12000).match(SENTENCE)?.map((item) => text(item, 360)).filter((item) => item.length >= 18) || [];
}

function candidateFrom(record, field, sentence, suffix = "evidence") {
  if (!record || !sentence || UNSAFE_INFERENCE.test(sentence)) return null;
  return {
    id: `derived-${field.toLowerCase()}-${digest(`${field}:${record.hash}:${sentence}`).slice(0, 12)}`,
    field,
    text: sentence,
    evidenceRefs: [record.hash],
    derivation: "deterministic_local_evidence",
    source: suffix,
  };
}

function deriveCandidates(records, fields) {
  const available = [...records].sort((a, b) => a.hash.localeCompare(b.hash));
  const parsedPackage = available.find((record) => record.locator === "package.json");
  let packageMetadata = null;
  if (parsedPackage) {
    try { packageMetadata = JSON.parse(parsedPackage.content); } catch { packageMetadata = null; }
  }
  const result = {};
  const first = (field, predicate, fallback) => {
    if (fields.has(field)) return;
    const record = available.find((item) => sentences(item).some(predicate));
    const sentence = record && sentences(record).find(predicate);
    result[field] = candidateFrom(record, field, sentence, "repository_evidence") || fallback?.();
  };
  if (!fields.has("WHAT_IS_IT") && parsedPackage && typeof packageMetadata?.description === "string") {
    result.WHAT_IS_IT = candidateFrom(parsedPackage, "WHAT_IS_IT", text(packageMetadata.description, 360), "package_metadata");
  }
  if (!result.WHAT_IS_IT) first("WHAT_IS_IT", (s) => /\b(is|provides|platform|tool|runtime|library|framework|service|application)\b/i.test(s));
  first("WHAT_PROBLEM_DOES_IT_SOLVE", (s) => /\b(solv|help|avoid|reduce|automate|manage|pain|problem|without|instead of)\w*/i.test(s));
  first("WHY_IS_IT_BETTER", (s) => /\b(deterministic|idempotent|atomic|bounded|verified|evidence|reliable|safe|redact|exactly[- ]once)\b/i.test(s));
  first("WHO_NEEDS_IT", (s) => /\b(for|teams?|developers?|operators?|marketers?|creators?|businesses?|projects?|organizations?|users?)\b/i.test(s));
  return result;
}

/**
 * Build deterministic product understanding from evidence and explicit claims.
 * Claims without valid evidence are retained only in CLAIMS_WE_CANNOT_MAKE.
 */
export function buildProductIntelligence(input = {}) {
  const evidence = normalizeEvidenceRecords(input.evidence || []);
  const unsupported = [];
  const claims = Array.isArray(input.claims) ? input.claims.map((item) => claim(item, evidence, unsupported)) : [];
  const supported = claims.filter((item) => item.text && item.evidenceRefs.length && !unsupported.some((u) => u.id === item.id));
  const byField = new Map();
  for (const item of supported) {
    const field = text(input.claims.find((candidate) => candidate?.id === item.id)?.field, 80);
    if (REQUIRED_FIELDS.includes(field) && !byField.has(field)) byField.set(field, item);
  }
  // A caller's explicit field declaration, even when invalid, is quarantined
  // rather than silently replaced by a heuristic candidate.
  const declaredFields = new Set((Array.isArray(input.claims) ? input.claims : [])
    .map((item) => text(item?.field, 80)).filter((field) => REQUIRED_FIELDS.includes(field)));
  const derived = deriveCandidates(evidence.records, new Set([...byField.keys(), ...declaredFields]));
  for (const field of REQUIRED_FIELDS) {
    if (!byField.has(field) && derived[field]) {
      byField.set(field, derived[field]);
      supported.push(derived[field]);
    }
    if (!byField.has(field) && !declaredFields.has(field)) unsupported.push({ id: `missing-${field.toLowerCase()}`, field, text: "", evidenceRefs: [], reason: "no_safe_evidence" });
  }
  const answer = Object.fromEntries(REQUIRED_FIELDS.map((field) => [field, byField.get(field) || null]));
  const doc = redact({
    schemaVersion: 1,
    productId: text(input.productId, 160) || null,
    generatedAt: text(input.generatedAt, 80) || null,
    evidence: evidence.records,
    ["WHAT_IS_IT"]: answer.WHAT_IS_IT,
    ["WHAT_PROBLEM_DOES_IT_SOLVE"]: answer.WHAT_PROBLEM_DOES_IT_SOLVE,
    ["WHY_IS_IT_BETTER"]: answer.WHY_IS_IT_BETTER,
    ["WHO_NEEDS_IT"]: answer.WHO_NEEDS_IT,
    CLAIMS_WE_CAN_PROVE: supported,
    CLAIMS_WE_CANNOT_MAKE: unsupported,
  });
  doc.documentHash = digest(doc);
  return doc;
}

export function serializeProductIntelligence(document) {
  if (!document || typeof document !== "object") throw new TypeError("document is required");
  return stable(redact(document));
}

export const productIntelligenceStableStringify = stable;
export const productIntelligenceHash = digest;
