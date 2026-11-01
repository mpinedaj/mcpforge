import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AuditLogger, redactSecrets, redactUrl } from "@mcpforge/runtime";

describe("redactSecrets", () => {
  it("redacts nested secret keys", () => {
    const value = redactSecrets({
      name: "doggie",
      authorization: "Bearer secret",
      nested: { apiKey: "123", list: [{ password: "hunter2" }] },
    });

    expect(value).toEqual({
      name: "doggie",
      authorization: "[REDACTED]",
      nested: { apiKey: "[REDACTED]", list: [{ password: "[REDACTED]" }] },
    });
  });
});

describe("redactUrl", () => {
  it("redacts secret query parameters", () => {
    const url = redactUrl("https://api.example.com/pets?api_key=secret&status=available");
    expect(url).toContain("api_key=%5BREDACTED%5D");
    expect(url).toContain("status=available");
  });
});

describe("AuditLogger", () => {
  it("appends JSONL entries and flushes", async () => {
    const directory = await fs.mkdtemp(join(tmpdir(), "mcpforge-audit-"));
    const logger = new AuditLogger({ enabled: true, path: "audit.log", cwd: directory });

    await logger.log({
      timestamp: "2026-01-01T00:00:00.000Z",
      tool: "list_pets",
      method: "GET",
      url: "https://api.example.com/pets",
      status: 200,
      ok: true,
      durationMs: 12,
      args: { status: "available" },
    });
    await logger.log({
      timestamp: "2026-01-01T00:00:01.000Z",
      tool: "create_pet",
      method: "POST",
      url: "https://api.example.com/pets",
      status: 0,
      ok: false,
      durationMs: 0,
      args: {},
      error: "blocked",
    });
    await logger.flush();

    const lines = (await fs.readFile(join(directory, "audit.log"), "utf8")).trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).tool).toBe("list_pets");
    expect(JSON.parse(lines[1]).error).toBe("blocked");
  });
});
