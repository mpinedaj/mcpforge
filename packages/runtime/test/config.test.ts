import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "@mcpforge/runtime";

describe("loadConfig", () => {
  it("returns safe defaults without a config file", async () => {
    const config = await loadConfig(undefined, {});

    expect(config.security.readOnly).toBe(true);
    expect(config.security.rateLimitPerMinute).toBe(60);
    expect(config.http).toEqual({ host: "127.0.0.1", port: 7331 });
    expect(config.auth).toEqual({ type: "none" });
  });

  it("applies environment overrides", async () => {
    const config = await loadConfig(undefined, {
      MCPFORGE_READ_ONLY: "false",
      MCPFORGE_PORT: "9000",
      MCPFORGE_BASE_URL: "https://api.test",
      MCPFORGE_RATE_LIMIT: "5",
    });

    expect(config.security.readOnly).toBe(false);
    expect(config.http.port).toBe(9000);
    expect(config.baseUrl).toBe("https://api.test");
    expect(config.security.rateLimitPerMinute).toBe(5);
  });

  it("merges a config file with environment overrides", async () => {
    const directory = await fs.mkdtemp(join(tmpdir(), "mcpforge-config-"));
    const path = join(directory, "mcpforge.config.json");
    await fs.writeFile(
      path,
      JSON.stringify({
        name: "demo",
        security: { readOnly: true, allowlist: ["get_pet"] },
      }),
      "utf8",
    );

    const config = await loadConfig(path, { MCPFORGE_READ_ONLY: "false" });

    expect(config.name).toBe("demo");
    expect(config.security.readOnly).toBe(false);
    expect(config.security.allowlist).toEqual(["get_pet"]);
  });

  it("rejects invalid environment values", async () => {
    await expect(loadConfig(undefined, { MCPFORGE_PORT: "nope" })).rejects.toThrow(/MCPFORGE_PORT/);
  });
});
