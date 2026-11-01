import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import type { ToolDefinition } from "@mcpforge/shared";
import { redactSecrets, redactUrl } from "./audit";
import type { RuntimeContext } from "./context";
import { executeTool } from "./executor";

export function createMcpServer(ctx: RuntimeContext): Server {
  const server = new Server(
    { name: ctx.config.name, version: ctx.config.version },
    {
      capabilities: { tools: {} },
      instructions:
        "Tools in this server proxy calls to an upstream HTTP API. Read-only tools are enabled by default.",
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = ctx.guard.listTools(ctx.manifest.tools).map(toMcpTool);
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    const { name } = request.params;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;
    const tool = ctx.manifest.tools.find((candidate) => candidate.name === name);

    if (!tool) {
      return errorResult(`Unknown tool "${name}".`);
    }

    try {
      ctx.guard.assertCallable(tool);
      ctx.guard.checkRateLimit(tool.name);

      const result = await executeTool(tool, args, ctx.execOptions);
      await ctx.audit.log({
        timestamp: new Date().toISOString(),
        tool: tool.name,
        method: tool.method,
        url: redactUrl(buildAuditUrl(ctx.baseUrl, tool.path)),
        status: result.status,
        ok: result.ok,
        durationMs: result.durationMs,
        args: redactSecrets(args),
      });

      const payload = {
        status: result.status,
        ok: result.ok,
        durationMs: result.durationMs,
        truncated: result.truncated,
        headers: result.headers,
        body: result.body,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        isError: !result.ok,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.audit.log({
        timestamp: new Date().toISOString(),
        tool: tool.name,
        method: tool.method,
        url: redactUrl(buildAuditUrl(ctx.baseUrl, tool.path)),
        status: 0,
        ok: false,
        durationMs: 0,
        args: redactSecrets(args),
        error: message,
      });
      return errorResult(message);
    }
  });

  return server;
}

export function toMcpTool(tool: ToolDefinition): Tool {
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema as Tool["inputSchema"],
    annotations: {
      title: tool.title,
      readOnlyHint: tool.readOnly,
      destructiveHint: !tool.readOnly,
      idempotentHint: tool.method === "GET" || tool.method === "HEAD",
      openWorldHint: true,
    },
  };
}

function errorResult(message: string): CallToolResult {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

function buildAuditUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
