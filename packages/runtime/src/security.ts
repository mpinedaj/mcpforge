import { McpForgeError, type SecurityConfig, type ToolDefinition } from "@mcpforge/shared";

export class SecurityError extends McpForgeError {
  constructor(
    message: string,
    code: string,
    readonly statusCode = 403,
    readonly retryAfterMs?: number,
  ) {
    super(message, code);
    this.name = "SecurityError";
  }
}

export interface SecuritySummary {
  readOnly: boolean;
  allowlist: string[];
  denylist: string[];
  rateLimitPerMinute: number;
  timeoutMs: number;
  maxResponseBytes: number;
}

export class SecurityGuard {
  private readonly calls = new Map<string, number[]>();

  constructor(private readonly config: SecurityConfig) {}

  listTools(tools: ToolDefinition[]): ToolDefinition[] {
    return tools.filter((tool) => this.isAllowed(tool));
  }

  isAllowed(tool: ToolDefinition): boolean {
    if (this.config.readOnly && !tool.readOnly) return false;
    if (this.config.allowlist.length > 0 && !this.config.allowlist.includes(tool.name)) return false;
    if (this.config.denylist.includes(tool.name)) return false;
    return true;
  }

  assertCallable(tool: ToolDefinition): void {
    if (this.config.readOnly && !tool.readOnly) {
      throw new SecurityError(
        `Tool "${tool.name}" is a write operation and the server is running in read-only mode.`,
        "READ_ONLY_MODE",
      );
    }
    if (this.config.allowlist.length > 0 && !this.config.allowlist.includes(tool.name)) {
      throw new SecurityError(`Tool "${tool.name}" is not in the allowlist.`, "TOOL_NOT_ALLOWED");
    }
    if (this.config.denylist.includes(tool.name)) {
      throw new SecurityError(`Tool "${tool.name}" is explicitly blocked.`, "TOOL_BLOCKED");
    }
  }

  checkRateLimit(toolName: string): void {
    const limit = this.config.rateLimitPerMinute;
    const now = Date.now();
    const windowStart = now - 60_000;
    const timestamps = (this.calls.get(toolName) ?? []).filter((timestamp) => timestamp > windowStart);

    if (timestamps.length >= limit) {
      const oldest = timestamps[0];
      throw new SecurityError(
        `Rate limit exceeded for "${toolName}" (${limit} calls/minute). Retry in ${Math.ceil((oldest + 60_000 - now) / 1000)}s.`,
        "RATE_LIMITED",
        429,
        oldest + 60_000 - now,
      );
    }

    timestamps.push(now);
    this.calls.set(toolName, timestamps);
  }

  summary(): SecuritySummary {
    return {
      readOnly: this.config.readOnly,
      allowlist: this.config.allowlist,
      denylist: this.config.denylist,
      rateLimitPerMinute: this.config.rateLimitPerMinute,
      timeoutMs: this.config.timeoutMs,
      maxResponseBytes: this.config.maxResponseBytes,
    };
  }
}
