import { timingSafeEqual } from "node:crypto";

export function isLoopbackAddress(address) {
  const value = String(address || "").toLowerCase();
  return value === "::1" || value === "127.0.0.1" || value.startsWith("127.") || value.startsWith("::ffff:127.");
}

export function isAuthorizedLocalShutdown({ remoteAddress, authorization, expectedToken }) {
  if (!isLoopbackAddress(remoteAddress) || typeof expectedToken !== "string" || expectedToken.length < 32) return false;
  const value = String(authorization || "");
  if (!value.startsWith("Bearer ")) return false;
  const provided = Buffer.from(value.slice(7).trim());
  const expected = Buffer.from(expectedToken);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export function runtimeMetadata({ pid = process.pid, sourceCommit, sourceDirty = false, state }) {
  return {
    pid: Number(pid),
    sourceCommit: /^[a-f0-9]{7,40}$/i.test(String(sourceCommit || "")) ? String(sourceCommit) : "unknown",
    sourceDirty: Boolean(sourceDirty),
    schemaVersion: Number.isSafeInteger(state?.schemaVersion) ? state.schemaVersion : null,
    stateRevision: Number.isSafeInteger(state?.revision) ? state.revision : null
  };
}
