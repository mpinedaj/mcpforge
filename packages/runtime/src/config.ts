import { promises as fs } from "node:fs";
import { McpForgeError, parseConfig, type McpForgeConfig } from "@mcpforge/shared";

export async function loadConfig(
  path?: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<McpForgeConfig> {
  let raw: Record<string, unknown> = {};

  if (path) {
    let text: string;
    try {
      text = await fs.readFile(path, "utf8");
    } catch (error) {
      throw new McpForgeError(
        `Could not read config at ${path}: ${error instanceof Error ? error.message : String(error)}`,
        "CONFIG_READ_ERROR",
      );
    }

    try {
      const parsed: unknown = JSON.parse(text);
      if (!isPlainObject(parsed)) throw new Error("config must be a JSON object");
      raw = parsed;
    } catch (error) {
      throw new McpForgeError(
        `Config at ${path} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
        "CONFIG_PARSE_ERROR",
      );
    }
  }

  return parseConfig(applyEnvOverrides(raw, env));
}

export async function configFileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

function applyEnvOverrides(raw: Record<string, unknown>, env: NodeJS.ProcessEnv): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...raw };
  const security: Record<string, unknown> = isPlainObject(raw.security) ? { ...raw.security } : {};
  const http: Record<string, unknown> = isPlainObject(raw.http) ? { ...raw.http } : {};
  const audit: Record<string, unknown> = isPlainObject(security.audit) ? { ...security.audit } : {};

  if (env.MCPFORGE_BASE_URL) merged.baseUrl = env.MCPFORGE_BASE_URL;
  if (env.MCPFORGE_MANIFEST) merged.manifest = env.MCPFORGE_MANIFEST;
  if (env.MCPFORGE_TRANSPORT === "stdio" || env.MCPFORGE_TRANSPORT === "http") {
    merged.transport = env.MCPFORGE_TRANSPORT;
  }
  if (env.MCPFORGE_HOST) http.host = env.MCPFORGE_HOST;
  if (env.MCPFORGE_PORT) {
    const port = Number(env.MCPFORGE_PORT);
    if (!Number.isInteger(port) || port <= 0) {
      throw new McpForgeError(`Invalid MCPFORGE_PORT value "${env.MCPFORGE_PORT}".`, "CONFIG_INVALID");
    }
    http.port = port;
  }
  if (env.MCPFORGE_READ_ONLY) security.readOnly = parseBoolean(env.MCPFORGE_READ_ONLY);
  if (env.MCPFORGE_RATE_LIMIT) {
    const limit = Number(env.MCPFORGE_RATE_LIMIT);
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new McpForgeError(`Invalid MCPFORGE_RATE_LIMIT value "${env.MCPFORGE_RATE_LIMIT}".`, "CONFIG_INVALID");
    }
    security.rateLimitPerMinute = limit;
  }
  if (env.MCPFORGE_AUDIT) audit.enabled = parseBoolean(env.MCPFORGE_AUDIT);
  if (env.MCPFORGE_AUDIT_PATH) audit.path = env.MCPFORGE_AUDIT_PATH;

  if (Object.keys(audit).length > 0) security.audit = audit;
  if (Object.keys(security).length > 0) merged.security = security;
  if (Object.keys(http).length > 0) merged.http = http;

  return merged;
}

function parseBoolean(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  throw new McpForgeError(`Invalid boolean value "${value}".`, "CONFIG_INVALID");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
