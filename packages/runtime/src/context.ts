import { McpForgeError, type McpForgeConfig, type ToolManifest } from "@mcpforge/shared";
import { AuditLogger } from "./audit";
import { resolveAuth, type ExecuteOptions } from "./executor";
import { SecurityGuard } from "./security";

export interface RuntimeContext {
  manifest: ToolManifest;
  config: McpForgeConfig;
  baseUrl: string;
  guard: SecurityGuard;
  audit: AuditLogger;
  execOptions: ExecuteOptions;
}

export interface RuntimeContextOptions {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  cwd?: string;
  auditPath?: string;
}

export function createRuntimeContext(
  manifest: ToolManifest,
  config: McpForgeConfig,
  options: RuntimeContextOptions = {},
): RuntimeContext {
  const baseUrl = (config.baseUrl ?? manifest.baseUrl ?? "").replace(/\/+$/, "");
  if (!baseUrl) {
    throw new McpForgeError(
      "No base URL configured. Set baseUrl in mcpforge.config.json, pass --base-url, or define servers[0].url in the OpenAPI document.",
      "MISSING_BASE_URL",
    );
  }

  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("protocol must be http or https");
    }
  } catch (error) {
    throw new McpForgeError(
      `Invalid base URL "${baseUrl}": ${error instanceof Error ? error.message : String(error)}`,
      "INVALID_BASE_URL",
    );
  }

  const env = options.env ?? process.env;
  const auth = resolveAuth(config.auth, env);
  const guard = new SecurityGuard(config.security);
  const audit = new AuditLogger({
    enabled: config.security.audit.enabled,
    path: options.auditPath ?? config.security.audit.path,
    cwd: options.cwd,
  });

  return {
    manifest,
    config,
    baseUrl,
    guard,
    audit,
    execOptions: {
      baseUrl,
      auth,
      headers: config.headers,
      timeoutMs: config.security.timeoutMs,
      maxResponseBytes: config.security.maxResponseBytes,
      fetchImpl: options.fetchImpl,
    },
  };
}
