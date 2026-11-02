// Run inside the default runtime container; never call its configured upstream API.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { setTimeout } from "node:timers/promises";

const origin = "http://127.0.0.1:7331";
const deadline = Date.now() + 15_000;
let health;
while (Date.now() < deadline) {
  try {
    const response = await fetch(`${origin}/health`, { signal: AbortSignal.timeout(1_000) });
    assert.equal(response.status, 200);
    health = await response.json();
    break;
  } catch {
    await setTimeout(250);
  }
}
assert.equal(health?.ok, true, "default runtime must become healthy with its bundled manifest");

const response = await fetch(`${origin}/api/manifest`, { signal: AbortSignal.timeout(1_000) });
assert.equal(response.status, 200);
const { manifest, security } = await response.json();
assert.ok(manifest.tools.length > 0, "generated demo manifest must contain tools");
assert.equal(security.readOnly, true);
assert.equal(health.tools, manifest.tools.filter((tool) => tool.readOnly).length);

const inspector = await fetch(origin, { signal: AbortSignal.timeout(1_000) });
assert.equal(inspector.status, 200);
assert.match(inspector.headers.get("content-type"), /text\/html/);
assert.match(await inspector.text(), /MCPForge/);
for (const dependency of ["typescript", "tsup", "vitest"]) {
  assert.equal(existsSync(`node_modules/${dependency}`), false, `${dependency} must not ship as a runtime dependency`);
}
console.log(`Runtime smoke passed: ${health.tools} read-only tools, inspector, and production dependencies.`);
