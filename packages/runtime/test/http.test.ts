import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { parseConfig, parseManifest } from "@mcpforge/shared";
import {
  createRuntimeContext,
  startHttpServer,
  type RunningHttpServer,
} from "@mcpforge/runtime";

const manifest = parseManifest({
  manifestVersion: "1",
  source: "test",
  title: "Test API",
  baseUrl: "https://api.example.com",
  servers: [],
  tools: [
    {
      name: "get_pet",
      description: "Get a pet",
      method: "GET",
      path: "/pets/{petId}",
      readOnly: true,
      parameters: [
        { name: "petId", in: "path", required: true, schema: { type: "string" } },
      ],
      inputSchema: {
        type: "object",
        properties: { petId: { type: "string" } },
        required: ["petId"],
      },
    },
    {
      name: "create_pet",
      description: "Create a pet",
      method: "POST",
      path: "/pets",
      readOnly: false,
      requestBody: {
        required: true,
        contentType: "application/json",
        schema: { type: "object" },
      },
      inputSchema: { type: "object" },
    },
  ],
  generatedAt: "2026-01-01T00:00:00.000Z",
});

const config = parseConfig({
  name: "test-server",
  baseUrl: "https://api.example.com",
  security: {
    readOnly: true,
    audit: { enabled: false },
  },
});

const fetchImpl = vi.fn(async () => {
  return new Response(JSON.stringify({ id: 1, name: "doggie" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}) as unknown as typeof fetch;

describe("HTTP runtime", () => {
  let running: RunningHttpServer;

  beforeAll(async () => {
    const context = createRuntimeContext(manifest, config, {
      fetchImpl,
      auditPath: join(tmpdir(), "mcpforge-http-test-audit.log"),
    });
    running = await startHttpServer(context, { host: "127.0.0.1", port: 0 });
  });

  afterAll(async () => {
    await running.close();
  });

  it("serves health and manifest endpoints", async () => {
    const health = await fetch(`${running.url}/health`).then((response) => response.json());
    expect(health).toMatchObject({ ok: true, name: "test-server", tools: 1 });

    const payload = await fetch(`${running.url}/api/manifest`).then((response) => response.json());
    expect(payload.manifest.tools).toHaveLength(2);
    expect(payload.security.readOnly).toBe(true);
  });

  it("serves the inspector HTML", async () => {
    const response = await fetch(`${running.url}/`);
    const html = await response.text();
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(html).toContain("MCPForge Inspector");
    expect(html).toContain("Test API");
  });

  it("calls read-only tools through the inspector API", async () => {
    const response = await fetch(`${running.url}/api/call`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "get_pet", arguments: { petId: "1" } }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.result.status).toBe(200);
    expect(payload.result.body).toEqual({ id: 1, name: "doggie" });
  });

  it("blocks write tools in read-only mode", async () => {
    const response = await fetch(`${running.url}/api/call`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "create_pet", arguments: { body: { name: "doggie" } } }),
    });
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.code).toBe("READ_ONLY_MODE");
  });

  it("speaks MCP over Streamable HTTP", async () => {
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(`${running.url}/mcp`));

    try {
      await client.connect(transport);
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toEqual(["get_pet"]);

      const result = await client.callTool({
        name: "get_pet",
        arguments: { petId: "1" },
      });
      expect(result.isError).toBe(false);

      const content = (result.content as Array<{ type: "text"; text: string }>)[0];
      expect(JSON.parse(content.text).body).toEqual({ id: 1, name: "doggie" });
    } finally {
      await client.close();
    }
  });
});
