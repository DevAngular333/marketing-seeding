import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";

test("runtime root defaults under the current user's home and respects explicit configuration", async () => {
  const previous = process.env.AGENTIC_ROOT;
  try {
    delete process.env.AGENTIC_ROOT;
    const defaults = await import(`../src/paths.mjs?default=${Date.now()}`);
    assert.equal(defaults.agenticRoot, path.resolve(os.homedir(), "build-agentic-AI"));

    process.env.AGENTIC_ROOT = path.join(os.tmpdir(), "configured agentic root");
    const configured = await import(`../src/paths.mjs?configured=${Date.now()}`);
    assert.equal(configured.agenticRoot, path.resolve(process.env.AGENTIC_ROOT));
  } finally {
    if (previous === undefined) delete process.env.AGENTIC_ROOT;
    else process.env.AGENTIC_ROOT = previous;
  }
});
