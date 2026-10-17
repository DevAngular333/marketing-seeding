import {
  productIntelligenceHash,
  serializeProductIntelligence,
} from "./product-intelligence.mjs";

const VERSION = 1;
const READINESS = new Set(["READY", "INCOMPLETE", "BLOCKED", "UNKNOWN"]);
const HASH_RE = /^[a-f0-9]{64}$/;

function text(value, max = 1000) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function canonicalDocumentHash(document) {
  const copy = { ...(document || {}) };
  delete copy.documentHash;
  return productIntelligenceHash(JSON.parse(serializeProductIntelligence(copy)));
}

function unsupportedClaims(document) {
  return Array.isArray(document?.CLAIMS_WE_CANNOT_MAKE)
    ? document.CLAIMS_WE_CANNOT_MAKE.map((claim) => ({
      id: text(claim?.id, 160),
      text: text(claim?.text, 4000),
      reason: text(claim?.reason, 160) || "unsupported",
    })).filter((claim) => claim.id || claim.text)
    : [];
}

/** Build a versioned caller-persistable handoff; this function performs no I/O. */
export function createProductIntelligenceHandoff({ document, sourceRepository, readinessStatus } = {}) {
  if (!document || typeof document !== "object") throw new TypeError("product intelligence document is required");
  const readiness = text(readinessStatus, 32).toUpperCase() || (unsupportedClaims(document).length ? "INCOMPLETE" : "READY");
  if (!READINESS.has(readiness)) throw new RangeError(`unsupported readiness status: ${readiness}`);
  return {
    handoffVersion: VERSION,
    productId: text(document.productId, 160) || null,
    sourceRepository: text(sourceRepository, 1000) || null,
    evidenceClaimDocumentHash: canonicalDocumentHash(document),
    readinessStatus: readiness,
    unsupportedClaims: unsupportedClaims(document),
  };
}

/** Validate an already persisted handoff against its source document. */
export function validateProductIntelligenceHandoff(handoff, document) {
  const errors = [];
  if (!handoff || typeof handoff !== "object") errors.push("handoff must be an object");
  if (!document || typeof document !== "object") errors.push("product intelligence document is required");
  if (errors.length) return { ok: false, errors };
  if (handoff.handoffVersion !== VERSION) errors.push("unsupported handoff version");
  if (!text(handoff.productId) || handoff.productId !== text(document.productId)) errors.push("productId mismatch");
  if (!text(handoff.sourceRepository)) errors.push("sourceRepository is required");
  if (!HASH_RE.test(String(handoff.evidenceClaimDocumentHash || ""))) errors.push("invalid evidenceClaimDocumentHash");
  else if (handoff.evidenceClaimDocumentHash !== canonicalDocumentHash(document)) errors.push("evidenceClaimDocumentHash mismatch");
  if (!READINESS.has(handoff.readinessStatus)) errors.push("invalid readinessStatus");
  const expected = JSON.stringify(unsupportedClaims(document));
  if (JSON.stringify(handoff.unsupportedClaims || []) !== expected) errors.push("unsupportedClaims mismatch");
  return { ok: errors.length === 0, errors };
}

/** Normalize a persisted handoff to the stable, versioned shape after validation. */
export function normalizeProductIntelligenceHandoff(handoff, document) {
  const result = validateProductIntelligenceHandoff(handoff, document);
  if (!result.ok) {
    const error = new Error(`invalid product intelligence handoff: ${result.errors.join(", ")}`);
    error.code = "INVALID_PRODUCT_INTELLIGENCE_HANDOFF";
    error.errors = result.errors;
    throw error;
  }
  return createProductIntelligenceHandoff({ document, sourceRepository: handoff.sourceRepository, readinessStatus: handoff.readinessStatus });
}

export const PRODUCT_INTELLIGENCE_HANDOFF_VERSION = VERSION;
