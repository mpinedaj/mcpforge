import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { renderInspectorHtml } from "@mcpforge/inspector";
import { McpForgeError } from "@mcpforge/shared";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { redactSecrets, redactUrl } from "./audit";
import type { RuntimeContext } from "./context";
import { executeTool } from "./executor";
import { SecurityError } from "./security";
import { createMcpServer } from "./server";

export interface HttpServerOptions {
  host?: string;
  port?: number;
}

export interface RunningHttpServer {
  url: string;
  host: string;
  port: number;
  close(): Promise<void>;
}

const MAX_JSON_BODY = 2 * 1024 * 1024;
const MAX_MCP_BODY = 4 * 1024 * 1024;

export async function startHttpServer(
  ctx: RuntimeContext,
  options: HttpServerOptions = {},
): Promise<RunningHttpServer> {
  const host = options.host ?? ctx.config.http.host;
  const port = options.port ?? ctx.config.http.port;
  const server = createServer((request, response) => {
    void handleRequest(request, response, ctx);
  });

  await new Promise<void>((resolve, reject) => {
    const onError = (error: NodeJS.ErrnoException) => {
      server.off("error", onError);
      if (error.code === "EADDRINUSE") {
        reject(
          new McpForgeError(
            `Port ${port} is already in use on ${host}. Pass --port to choose another one.`,
            "PORT_IN_USE",
          ),
        );
        return;
      }
      reject(error);
    };
    server.on("error", onError);
    server.listen(port, host, () => {
      server.off("error", onError);
      resolve();
    });
  });

  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;

  return {
    url: `http://${host}:${actualPort}`,
    host,
    port: actualPort,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  ctx: RuntimeContext,
): Promise<void> {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204).end();
    return;
  }

  try {
    if (url.pathname === "/health") {
      json(response, 200, {
        ok: true,
        name: ctx.config.name,
        version: ctx.config.version,
        tools: ctx.guard.listTools(ctx.manifest.tools).length,
      });
      return;
    }

    if (url.pathname === "/api/manifest" && request.method === "GET") {
      json(response, 200, {
        manifest: ctx.manifest,
        security: ctx.guard.summary(),
        baseUrl: ctx.baseUrl,
      });
      return;
    }

    if (url.pathname === "/api/call" && request.method === "POST") {
      await handleCall(request, response, ctx);
      return;
    }

    if ((url.pathname === "/" || url.pathname === "/inspect") && request.method === "GET") {
      const html = renderInspectorHtml({
        title: ctx.manifest.title ?? ctx.config.name,
        version: ctx.config.version,
      });
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "content-length": Buffer.byteLength(html),
      });
      response.end(html);
      return;
    }

    if (url.pathname === "/mcp") {
      await handleMcp(request, response, ctx);
      return;
    }

    json(response, 404, { error: "Not found" });
  } catch (error) {
    const status = error instanceof HttpError ? error.statusCode : 500;
    const message = error instanceof Error ? error.message : String(error);
    if (!response.headersSent) {
      json(response, status, { error: message });
    } else {
      response.end();
    }
  }
}

async function handleCall(
  request: IncomingMessage,
  response: ServerResponse,
  ctx: RuntimeContext,
): Promise<void> {
  const body = await readJson(request, MAX_JSON_BODY);

  if (!isPlainObject(body) || typeof body.name !== "string") {
    throw new HttpError('Body must be a JSON object like { "name": "tool_name", "arguments": {} }.', "INVALID_BODY", 400);
  }

  const tool = ctx.manifest.tools.find((candidate) => candidate.name === body.name);
  if (!tool) {
    throw new HttpError(`Unknown tool "${body.name}".`, "TOOL_NOT_FOUND", 404);
  }

  const args = isPlainObject(body.arguments) ? body.arguments : {};
  const startedAt = Date.now();

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

    json(response, 200, { result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = error instanceof SecurityError ? error.statusCode : 500;

    if (error instanceof SecurityError && error.retryAfterMs !== undefined) {
      response.setHeader("retry-after", String(Math.max(1, Math.ceil(error.retryAfterMs / 1000))));
    }

    await ctx.audit.log({
      timestamp: new Date().toISOString(),
      tool: tool.name,
      method: tool.method,
      url: redactUrl(buildAuditUrl(ctx.baseUrl, tool.path)),
      status: 0,
      ok: false,
      durationMs: Date.now() - startedAt,
      args: redactSecrets(args),
      error: message,
    });

    json(response, status, {
      error: message,
      code: error instanceof McpForgeError ? error.code : "INTERNAL_ERROR",
    });
  }
}

async function handleMcp(
  request: IncomingMessage,
  response: ServerResponse,
  ctx: RuntimeContext,
): Promise<void> {
  const mcpServer = createMcpServer(ctx);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  response.on("close", () => {
    void transport.close();
    void mcpServer.close();
  });

  await mcpServer.connect(transport);
  const body = request.method === "POST" ? await readJson(request, MAX_MCP_BODY) : undefined;
  await transport.handleRequest(request, response, body);
}

async function readJson(request: IncomingMessage, limit: number): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    size += buffer.length;
    if (size > limit) {
      throw new HttpError(`Request body exceeds ${limit} bytes.`, "BODY_TOO_LARGE", 413);
    }
    chunks.push(buffer);
  }

  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return undefined;

  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError("Request body is not valid JSON.", "INVALID_JSON", 400);
  }
}

function setCorsHeaders(response: ServerResponse): void {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET, POST, DELETE, OPTIONS");
  response.setHeader(
    "access-control-allow-headers",
    "content-type, authorization, mcp-session-id, mcp-protocol-version",
  );
  response.setHeader("access-control-expose-headers", "mcp-session-id");
}

function json(response: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(text),
  });
  response.end(text);
}

function buildAuditUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

class HttpError extends McpForgeError {
  constructor(
    message: string,
    code: string,
    readonly statusCode: number,
  ) {
    super(message, code);
    this.name = "HttpError";
  }
}
