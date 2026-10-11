import { randomBytes } from "node:crypto";

const baseUrl = process.env.SEEDING_SOAK_URL || "http://127.0.0.1:4318";
const durationMinutes = Number(process.env.SEEDING_SOAK_MINUTES || 60);
const intervalMs = Number(process.env.SEEDING_SOAK_INTERVAL_MS || 5_000);
if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) throw new Error("SEEDING_SOAK_MINUTES must be positive");
if (!Number.isFinite(intervalMs) || intervalMs < 100) throw new Error("SEEDING_SOAK_INTERVAL_MS must be at least 100");

const deadline = Date.now() + durationMinutes * 60_000;
let checks = 0;
let failures = 0;
const runId = randomBytes(6).toString("hex");
while (Date.now() < deadline) {
  try {
    const [health, dashboard] = await Promise.all([
      fetch(`${baseUrl}/health`, { cache: "no-store" }),
      fetch(`${baseUrl}/api/dashboard`, { cache: "no-store" })
    ]);
    if (!health.ok || !dashboard.ok) throw new Error(`HTTP ${health.status}/${dashboard.status}`);
    await Promise.all([health.json(), dashboard.json()]);
  } catch (error) {
    failures += 1;
    process.stderr.write(`[${new Date().toISOString()}] ${error.message}\n`);
  }
  checks += 1;
  await new Promise((resolve) => setTimeout(resolve, intervalMs));
}
process.stdout.write(JSON.stringify({ runId, baseUrl, durationMinutes, intervalMs, checks, failures }) + "\n");
if (failures > 0) process.exitCode = 1;
