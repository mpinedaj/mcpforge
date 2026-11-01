import { describe, expect, it } from "vitest";
import { parseConfig, ToolDefinitionSchema, type ToolDefinition } from "@mcpforge/shared";
import { SecurityError, SecurityGuard } from "@mcpforge/runtime";

function makeTool(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return ToolDefinitionSchema.parse({
    name: "list_pets",
    description: "List pets",
    method: "GET",
    path: "/pets",
    readOnly: true,
    inputSchema: { type: "object" },
    ...overrides,
  });
}

const writeTool = makeTool({
  name: "create_pet",
  description: "Create pet",
  method: "POST",
  path: "/pets",
  readOnly: false,
});

describe("SecurityGuard", () => {
  it("hides write tools in read-only mode", () => {
    const config = parseConfig({ security: { readOnly: true } });
    const guard = new SecurityGuard(config.security);

    expect(guard.listTools([makeTool(), writeTool]).map((tool) => tool.name)).toEqual(["list_pets"]);
    expect(() => guard.assertCallable(writeTool)).toThrow(SecurityError);
  });

  it("enforces allowlists and denylists", () => {
    const config = parseConfig({
      security: { readOnly: false, allowlist: ["list_pets"] },
    });
    const guard = new SecurityGuard(config.security);

    expect(guard.listTools([makeTool(), writeTool]).map((tool) => tool.name)).toEqual(["list_pets"]);
    expect(() => guard.assertCallable(writeTool)).toThrow(/allowlist/);

    const denied = new SecurityGuard(
      parseConfig({ security: { readOnly: false, denylist: ["list_pets"] } }).security,
    );
    expect(() => denied.assertCallable(makeTool())).toThrow(/blocked/);
  });

  it("rate limits calls per tool", () => {
    const guard = new SecurityGuard(
      parseConfig({ security: { rateLimitPerMinute: 2 } }).security,
    );

    guard.checkRateLimit("list_pets");
    guard.checkRateLimit("list_pets");

    try {
      guard.checkRateLimit("list_pets");
      throw new Error("expected rate limit");
    } catch (error) {
      expect(error).toBeInstanceOf(SecurityError);
      expect((error as SecurityError).statusCode).toBe(429);
      expect((error as SecurityError).retryAfterMs).toBeGreaterThan(0);
    }
  });
});
