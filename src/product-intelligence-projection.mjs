import { createHash } from "node:crypto";
import { productIntelligenceHash, serializeProductIntelligence } from "./product-intelligence.mjs";
import { validateProductIntelligenceHandoff } from "./product-intelligence-runtime.mjs";

const REQUIRED_FIELDS = ["WHAT_IS_IT", "WHAT_PROBLEM_DOES_IT_SOLVE", "WHY_IS_IT_BETTER", "WHO_NEEDS_IT"];
const HASH_RE = /^[a-f0-9]{64}$/;

function fingerprint(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
}
function countClaims(value) { return Array.isArray(value) ? value.length : 0; }
function validInspection(value) {
  return Boolean(value && typeof value === "object" && HASH_RE.test(String(value.inspectionHash || "")) && Array.isArray(value.records));
}
function documentHashValid(document) {
  if (!document || typeof document !== "object") return false;
  const declared = String(document.documentHash || "").toLowerCase();
  if (!HASH_RE.test(declared)) return false;
  const copy = { ...document }; delete copy.documentHash;
  return declared === productIntelligenceHash(JSON.parse(serializeProductIntelligence(copy)));
}

/** Read-only, secret-safe Mission Control summary for persisted product intelligence. */
export function projectProductIntelligence(state = {}) {
  const campaigns = Array.isArray(state.campaigns) ? state.campaigns : [];
  return campaigns.map((campaign) => {
    const product = campaign?.productIntelligence;
    const document = product?.document;
    const handoff = product?.handoff;
    const inspection = product?.repositoryInspection;
    const validation = handoff && document ? validateProductIntelligenceHandoff(handoff, document) : { ok: false, errors: ["handoff_missing"] };
    const required = Object.fromEntries(REQUIRED_FIELDS.map((field) => [field, Boolean(document?.[field]?.text && Array.isArray(document[field].evidenceRefs) && document[field].evidenceRefs.length)]));
    const supported = countClaims(document?.CLAIMS_WE_CAN_PROVE);
    const unsupported = countClaims(document?.CLAIMS_WE_CANNOT_MAKE);
    const complete = REQUIRED_FIELDS.every((field) => required[field]) && unsupported === 0;
    const handoffReady = String(handoff?.readinessStatus || "").toUpperCase() === "READY";
    const inspectionPresent = validInspection(inspection);
    const status = !product || !document ? "MISSING" : !validation.ok || !documentHashValid(document) ? "BLOCKED" : handoffReady && complete && inspectionPresent ? "READY" : "INCOMPLETE";
    return {
      campaignId: String(campaign?.id || ""),
      campaignStatus: String(campaign?.status || "UNKNOWN"),
      status,
      readinessStatus: String(handoff?.readinessStatus || "UNKNOWN").toUpperCase(),
      requiredFields: required,
      supportedClaimCount: supported,
      unsupportedClaimCount: unsupported,
      evidenceCount: Array.isArray(document?.evidence) ? document.evidence.length : 0,
      inspection: {
        status: inspectionPresent ? "PERSISTED" : "MISSING",
        recordCount: inspectionPresent ? inspection.records.length : 0,
        inspectionHash: inspectionPresent ? inspection.inspectionHash : null,
        sourceFingerprint: inspection?.repository ? fingerprint(inspection.repository) : null
      },
      documentHash: documentHashValid(document) ? String(document.documentHash) : null,
      handoffValid: validation.ok,
      validationErrors: validation.ok ? [] : validation.errors.slice(0, 8),
      externalSideEffects: false,
      authoritySideEffects: false
    };
  }).sort((a, b) => a.campaignId.localeCompare(b.campaignId));
}
