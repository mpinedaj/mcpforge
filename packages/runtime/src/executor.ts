import {
  McpForgeError,
  type AuthConfig,
  type ToolDefinition,
} from "@mcpforge/shared";

export interface ResolvedAuth {
  headers: Record<string, string>;
  query: Record<string, string>;
}

export interface ExecuteOptions {
  baseUrl: string;
  auth?: ResolvedAuth;
  headers?: Record<string, string>;
  timeoutMs: number;
  maxResponseBytes: number;
  fetchImpl?: typeof fetch;
}

export interface ExecuteResult {
  status: number;
  ok: boolean;
  durationMs: number;
  truncated: boolean;
  headers: Record<string, string>;
  body: unknown;
}

const OMITTED_RESPONSE_HEADERS = new Set(["set-cookie", "authorization", "proxy-authorization"]);

export function resolveAuth(
  auth: AuthConfig | undefined,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedAuth | undefined {
  if (!auth || auth.type === "none") return undefined;

  if (auth.type === "bearer") {
    const token = auth.token ?? readEnv(auth.tokenEnv, env) ?? readEnv("MCPFORGE_AUTH_TOKEN", env);
    if (!token) {
      throw new McpForgeError(
        "Bearer authentication is configured but no token was found. Set MCPFORGE_AUTH_TOKEN or auth.tokenEnv.",
        "AUTH_MISSING",
      );
    }
    return { headers: { authorization: `Bearer ${token}` }, query: {} };
  }

  if (auth.type === "basic") {
    const password = auth.password ?? readEnv(auth.passwordEnv, env) ?? readEnv("MCPFORGE_AUTH_PASSWORD", env);
    if (password === undefined) {
      throw new McpForgeError(
        "Basic authentication is configured but no password was found. Set MCPFORGE_AUTH_PASSWORD or auth.passwordEnv.",
        "AUTH_MISSING",
      );
    }
    const encoded = Buffer.from(`${auth.username}:${password}`).toString("base64");
    return { headers: { authorization: `Basic ${encoded}` }, query: {} };
  }

  const value = auth.value ?? readEnv(auth.valueEnv, env) ?? readEnv("MCPFORGE_AUTH_TOKEN", env);
  if (!value) {
    throw new McpForgeError(
      "API key authentication is configured but no value was found. Set MCPFORGE_AUTH_TOKEN or auth.valueEnv.",
      "AUTH_MISSING",
    );
  }

  if (auth.in === "query") {
    return { headers: {}, query: { [auth.name]: value } };
  }
  return { headers: { [auth.name]: value }, query: {} };
}

export async function executeTool(
  tool: ToolDefinition,
  args: Record<string, unknown>,
  options: ExecuteOptions,
): Promise<ExecuteResult> {
  const startedAt = Date.now();
  const url = buildUrl(options.baseUrl, tool, args);
  const headers = new Headers(options.headers ?? {});
  headers.set("accept", "application/json, text/plain, */*");
  headers.set("user-agent", "mcpforge/0.1.0");

  for (const parameter of tool.parameters) {
    if (parameter.in !== "header") continue;
    const value = args[parameter.name];
    if (value !== undefined && value !== null) headers.set(parameter.name, String(value));
  }

  const cookies = tool.parameters
    .filter((parameter) => parameter.in === "cookie")
    .map((parameter) => {
      const value = args[parameter.name];
      return value === undefined || value === null
        ? undefined
        : `${parameter.name}=${encodeURIComponent(String(value))}`;
    })
    .filter((value): value is string => Boolean(value));
  if (cookies.length > 0) headers.set("cookie", cookies.join("; "));

  for (const [key, value] of Object.entries(options.auth?.headers ?? {})) headers.set(key, value);
  for (const [key, value] of Object.entries(options.auth?.query ?? {})) url.searchParams.set(key, value);

  const body = buildBody(tool, args, headers);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);

  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(url, {
      method: tool.method,
      headers,
      body,
      redirect: "follow",
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new McpForgeError(
        `Request to ${tool.method} ${tool.path} timed out after ${options.timeoutMs}ms.`,
        "REQUEST_TIMEOUT",
      );
    }
    throw new McpForgeError(
      `Request to ${tool.method} ${tool.path} failed: ${error instanceof Error ? error.message : String(error)}`,
      "REQUEST_FAILED",
    );
  } finally {
    clearTimeout(timer);
  }

  const { text, truncated } = await readLimited(response, options.maxResponseBytes);
  const bodyValue = parseBody(text, response.headers.get("content-type"));
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    if (!OMITTED_RESPONSE_HEADERS.has(key.toLowerCase())) responseHeaders[key] = value;
  });

  return {
    status: response.status,
    ok: response.ok,
    durationMs: Date.now() - startedAt,
    truncated,
    headers: responseHeaders,
    body: bodyValue,
  };
}

export function buildUrl(baseUrl: string, tool: ToolDefinition, args: Record<string, unknown>): URL {
  const base = baseUrl.replace(/\/+$/, "");
  let path = tool.path;

  for (const parameter of tool.parameters) {
    if (parameter.in !== "path") continue;
    const value = args[parameter.name];
    if (value === undefined || value === null || value === "") {
      throw new McpForgeError(`Missing required path parameter "${parameter.name}".`, "MISSING_PARAMETER");
    }
    const raw = String(value);
    if (raw.includes("..") || /[\u0000-\u001f]/.test(raw)) {
      throw new McpForgeError(
        `Invalid path parameter "${parameter.name}": path traversal sequences are not allowed.`,
        "INVALID_PARAMETER",
      );
    }
    path = path.replaceAll(`{${parameter.name}}`, encodeURIComponent(raw));
  }

  const url = new URL(`${base}${path.startsWith("/") ? path : `/${path}`}`);

  for (const parameter of tool.parameters) {
    if (parameter.in !== "query") continue;
    const value = args[parameter.name];
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(parameter.name, String(item));
    } else if (typeof value === "object") {
      url.searchParams.set(parameter.name, JSON.stringify(value));
    } else {
      url.searchParams.set(parameter.name, String(value));
    }
  }

  return url;
}

function buildBody(tool: ToolDefinition, args: Record<string, unknown>, headers: Headers): string | undefined {
  if (!tool.requestBody) return undefined;

  const value = args[tool.bodyProperty];
  if (value === undefined || value === null) {
    if (tool.requestBody.required) {
      throw new McpForgeError(
        `Missing required request body "${tool.bodyProperty}".`,
        "MISSING_PARAMETER",
      );
    }
    return undefined;
  }

  const contentType = tool.requestBody.contentType.toLowerCase();
  headers.set("content-type", tool.requestBody.contentType);

  if (contentType.includes("json")) {
    return typeof value === "string" ? value : JSON.stringify(value);
  }

  if (contentType.includes("x-www-form-urlencoded") && typeof value === "object" && !Array.isArray(value)) {
    const form = new URLSearchParams();
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item !== undefined && item !== null) form.set(key, String(item));
    }
    return form.toString();
  }

  return typeof value === "string" ? value : JSON.stringify(value);
}

async function readLimited(
  response: Response,
  maxBytes: number,
): Promise<{ text: string; truncated: boolean }> {
  if (!response.body) {
    return { text: await response.text(), truncated: false };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let output = "";
  let bytes = 0;
  let truncated = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    bytes += value.byteLength;
    if (bytes > maxBytes) {
      const remaining = maxBytes - (bytes - value.byteLength);
      if (remaining > 0) output += decoder.decode(value.subarray(0, remaining), { stream: true });
      truncated = true;
      await reader.cancel();
      break;
    }
    output += decoder.decode(value, { stream: true });
  }

  output += decoder.decode();
  return { text: output, truncated };
}

function parseBody(text: string, contentType: string | null): unknown {
  if (!text) return null;
  if (contentType?.toLowerCase().includes("json")) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return text;
    }
  }
  return text;
}

function readEnv(name: string | undefined, env: NodeJS.ProcessEnv): string | undefined {
  if (!name) return undefined;
  return env[name];
}
