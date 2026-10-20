import { createHash } from "node:crypto";
import { lstat, realpath, readFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_ALLOWLIST = [
  "README.md", "README", "package.json", "pyproject.toml", "Cargo.toml",
  "go.mod", "composer.json", "pom.xml", "CHANGELOG.md", "docs/README.md",
];
// Keep repository inspection bounded, while allowing the common repository
// README size (including generated product documentation) to remain usable as
// evidence.  Content stored in state is still capped by maxTextBytes and the
// aggregate byte budget remains finite.
const DEFAULTS = { maxFileBytes: 128 * 1024, maxTotalBytes: 512 * 1024, maxFiles: 32, maxTextBytes: 16 * 1024 };
const SECRET_KEY = /(password|passwd|secret|token|cookie|authorization|credential|api[_-]?key|private[_-]?key|session)/i;
const SECRET_VALUE = /\b(?:bearer\s+|sk-|gh[pousr]_)[a-z0-9._-]{8,}/i;
const FORBIDDEN_PATH = /(^|\/)(?:\.env(?:\..*)?|(?:password|passwd|secret|token|cookie|credential|credentials|private[-_]?key|auth|authorization)(?:[._-]|$))/i;

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (relative && !relative.startsWith(".." + path.sep) && relative !== "..");
}
function redactLine(line) {
  if (SECRET_VALUE.test(line)) return "credential/session material exists";
  if (/(?:[\"']?)(?:password|passwd|secret|token|cookie|authorization|credential|api[_-]?key|private[_-]?key|session)(?:[\"']?)\s*[:=]/i.test(line)) return "credential/session material exists";
  const match = line.match(/^\s*([A-Za-z0-9_.-]+)\s*([=:])\s*(.+?)\s*$/);
  if (match && SECRET_KEY.test(match[1])) return `${match[1]}${match[2]} credential/session material exists`;
  return line.replace(/(["']?)([A-Za-z0-9_.-]+)\1\s*:\s*(["'])(.*?)\3/g, (whole, quote, key, valueQuote, value) =>
    SECRET_KEY.test(key) ? `${quote}${key}${quote}: ${valueQuote}credential/session material exists${valueQuote}` : whole);
}
function boundedText(buffer, maxBytes) {
  return buffer.subarray(0, maxBytes).toString("utf8").split(/\r?\n/).map(redactLine).join("\n");
}

/** Inspect only caller-allowlisted small text files under repoRoot. No network, shell, or persistence. */
export async function inspectRepositoryEvidence(repoRoot, options = {}) {
  if (typeof repoRoot !== "string" || !repoRoot.trim()) throw new TypeError("repoRoot is required");
  const limits = { ...DEFAULTS };
  for (const key of ["maxFileBytes", "maxTotalBytes", "maxFiles", "maxTextBytes"]) {
    if (options[key] !== undefined && (!Number.isSafeInteger(options[key]) || options[key] < 1)) throw new RangeError(`${key} must be a positive integer`);
    if (options[key] !== undefined) limits[key] = Math.min(DEFAULTS[key], options[key]);
  }
  const requestedPaths = [...new Set((options.allowlist || DEFAULT_ALLOWLIST).map((item) => String(item).replaceAll("\\", "/")))].sort();
  const allowlist = requestedPaths.filter((item) => item && !item.includes("\0") && !path.isAbsolute(item) && !item.split("/").includes("..") && !FORBIDDEN_PATH.test(item));
  const root = await realpath(repoRoot);
  const records = [];
  const skipped = [];
  let totalBytes = 0;
  for (const requested of requestedPaths) {
    if (!requested || requested.includes("\0") || path.isAbsolute(requested) || requested.split("/").includes("..")) {
      skipped.push({ path: requested, reason: "invalid_path" });
    } else if (FORBIDDEN_PATH.test(requested)) {
      skipped.push({ path: requested, reason: "forbidden_path" });
    }
  }
  for (const relative of allowlist.slice(0, limits.maxFiles)) {
    const candidate = path.resolve(root, relative);
    if (!inside(root, candidate)) { skipped.push({ path: relative, reason: "outside_repository" }); continue; }
    let stat;
    try {
      const linkStat = await lstat(candidate);
      const resolved = await realpath(candidate);
      if (!inside(root, resolved)) { skipped.push({ path: relative, reason: "symlink_escape" }); continue; }
      stat = linkStat.isSymbolicLink() ? await lstat(resolved) : linkStat;
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "ENOTDIR") { skipped.push({ path: relative, reason: "missing" }); continue; }
      throw error;
    }
    if (!stat.isFile()) { skipped.push({ path: relative, reason: "not_regular_file" }); continue; }
    if (stat.size > limits.maxFileBytes) { skipped.push({ path: relative, reason: "file_too_large" }); continue; }
    if (totalBytes + stat.size > limits.maxTotalBytes) { skipped.push({ path: relative, reason: "total_limit" }); continue; }
    const bytes = await readFile(candidate);
    totalBytes += bytes.length;
    const content = boundedText(bytes, limits.maxTextBytes);
    records.push({ id: `repo:${relative}`, sourceType: "repository_file", locator: relative, content, sha256: sha256(bytes), bytes: bytes.length });
  }
  records.sort((a, b) => a.locator.localeCompare(b.locator));
  skipped.sort((a, b) => a.path.localeCompare(b.path) || a.reason.localeCompare(b.reason));
  const result = { schemaVersion: 1, repository: root, allowlist, limits: { maxFileBytes: limits.maxFileBytes, maxTotalBytes: limits.maxTotalBytes, maxFiles: limits.maxFiles, maxTextBytes: limits.maxTextBytes }, records, skipped, totalBytes };
  result.inspectionHash = sha256(stable({ ...result, inspectionHash: undefined }));
  return result;
}

/** Keep only non-content lineage metadata when an inspection is persisted. */
export function summarizeRepositoryInspection(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const hash = String(input.inspectionHash || "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hash)) return null;
  const bounded = (value, max) => Array.isArray(value) ? value.slice(0, max) : [];
  const records = bounded(input.records, 32).map((item) => ({
    id: String(item?.id || "").slice(0, 160),
    locator: String(item?.locator || "").slice(0, 500),
    sha256: String(item?.sha256 || "").toLowerCase(),
    bytes: Number.isSafeInteger(item?.bytes) && item.bytes >= 0 ? item.bytes : 0
  })).filter((item) => item.id && item.locator && /^[a-f0-9]{64}$/.test(item.sha256));
  const skipped = bounded(input.skipped, 64).map((item) => ({
    path: String(item?.path || "").slice(0, 500),
    reason: String(item?.reason || "").slice(0, 80)
  })).filter((item) => item.path && item.reason);
  const allowlist = bounded(input.allowlist, 64).map((item) => String(item).slice(0, 500)).filter(Boolean);
  const limits = input.limits && typeof input.limits === "object" ? Object.fromEntries(
    ["maxFileBytes", "maxTotalBytes", "maxFiles", "maxTextBytes"]
      .filter((key) => Number.isSafeInteger(input.limits[key]) && input.limits[key] > 0)
      .map((key) => [key, input.limits[key]])
  ) : {};
  return {
    schemaVersion: Number.isSafeInteger(input.schemaVersion) ? input.schemaVersion : 1,
    repository: String(input.repository || "").slice(0, 1000),
    allowlist,
    limits,
    records,
    skipped,
    totalBytes: Number.isSafeInteger(input.totalBytes) && input.totalBytes >= 0 ? input.totalBytes : 0,
    inspectionHash: hash
  };
}

export const repositoryInspectionDefaults = Object.freeze({ ...DEFAULTS });
