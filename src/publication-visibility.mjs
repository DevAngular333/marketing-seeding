/** Normalized publication visibility, distinct from content audience segments. */
// Only PUBLIC is currently required by the controlled LinkedIn path and has
// direct browser evidence. Add other values only alongside platform evidence.
export const PUBLICATION_VISIBILITIES = Object.freeze(["PUBLIC"]);

export function normalizePublicationVisibility(value, { defaultValue = "PUBLIC" } = {}) {
  const normalized = String(value ?? "").trim().toUpperCase() || defaultValue;
  if (!PUBLICATION_VISIBILITIES.includes(normalized)) {
    throw new Error(`Unsupported publication visibility: ${normalized}`);
  }
  return normalized;
}

export function publicationVisibilityMatchesLabels(visibility, labels) {
  const normalized = normalizePublicationVisibility(visibility);
  const values = (Array.isArray(labels) ? labels : []).map((label) => String(label || "").trim()).filter(Boolean);
  if (normalized === "PUBLIC") return values.some((label) => /anyone|public|everyone|mọi người|moi nguoi|tất cả mọi người|tat ca moi nguoi/i.test(label));
  return false;
}

export function publicationVisibilityLabels(visibility) {
  const normalized = normalizePublicationVisibility(visibility);
  if (normalized === "PUBLIC") return ["public", "everyone", "anyone", "mọi người", "moi nguoi", "tất cả mọi người", "tat ca moi nguoi"];
  return [];
}
