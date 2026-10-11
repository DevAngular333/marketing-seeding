import { writeFile } from "node:fs/promises";
import { JsonStore } from "./store.mjs";
import { SeedingService } from "./service.mjs";
import { stateFile } from "./paths.mjs";

const command = process.argv[2] || "status";
if (command === "serve") {
  await import("./server.mjs");
  process.exitCode = 0;
} else {
const mutating = new Set(["init", "bootstrap-r19"]).has(command);
const store = new JsonStore(stateFile, { requireLease: mutating });
if (mutating) await store.acquireWriterLease();
const service = new SeedingService(store);
try {
  await service.init();

switch (command) {
  case "init":
    console.log(JSON.stringify({ ok: true, stateFile }, null, 2));
    break;
  case "bootstrap-r19":
    console.log(JSON.stringify({ ok: true, ...(await service.bootstrapR19("cli-operator")) }, null, 2));
    break;
  case "status":
    console.log(JSON.stringify(await service.dashboard(), null, 2));
    break;
  case "export": {
    const destination = process.argv[3];
    if (!destination) throw new Error("Usage: node src/cli.mjs export <file.json>");
    await writeFile(destination, `${JSON.stringify(await service.snapshot(), null, 2)}\n`, "utf8");
    console.log(JSON.stringify({ ok: true, destination }, null, 2));
    break;
  }
  default:
    throw new Error(`Unknown command: ${command}`);
}
} finally {
  if (mutating) await store.releaseWriterLease();
}
}
