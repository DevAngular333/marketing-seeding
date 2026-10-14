import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
export const appRoot = path.resolve(moduleDir, "..");
export const agenticRoot = path.resolve(process.env.AGENTIC_ROOT || path.join(os.homedir(), "build-agentic-AI"));
export const publicRoot = path.join(appRoot, "public");
export const dataDir = path.resolve(
  process.env.SEEDING_DATA_DIR || path.join(agenticRoot, ".agentic", "marketing-seeding")
);
export const stateFile = path.join(dataDir, "state.json");
export const operatorTokenFile = path.join(dataDir, "operator-token");
export const dailyAutomationFile = path.join(dataDir, "daily-automation.json");
export const dailyAutomationReceiptFile = path.join(dataDir, "daily-product-seeding-automations.json");
export const browserAutomationFile = path.join(dataDir, "browser-automation.json");
export const autoGtmFeedFile = path.resolve(
  process.env.SEEDING_AUTO_GTM_FEED_FILE || path.join(agenticRoot, ".agentic", "gtm", "marketing-seeding-feed.json")
);
