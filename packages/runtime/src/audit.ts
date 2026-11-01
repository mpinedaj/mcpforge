import { promises as fs } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

const SECRET_KEY_PATTERN = /(authorization|token|secret|password|passwd|api[-_]?key|cookie|credential)/i;

export interface AuditEntry {
  timestamp: string;
  tool: string;
  method: string;
  url: string;
  status: number;
  ok: boolean;
  durationMs: number;
  args: unknown;
  error?: string;
}

export interface AuditLoggerOptions {
  enabled: boolean;
  path: string;
  cwd?: string;
}

export class AuditLogger {
  private chain: Promise<void> = Promise.resolve();
  private readonly enabled: boolean;
  private readonly path: string;
  private readonly cwd: string;

  constructor(options: AuditLoggerOptions) {
    this.enabled = options.enabled;
    this.path = options.path;
    this.cwd = options.cwd ?? process.cwd();
  }

  log(entry: AuditEntry): Promise<void> {
    if (!this.enabled) return Promise.resolve();

    const line = `${JSON.stringify(entry)}\n`;
    this.chain = this.chain
      .then(async () => {
        const target = isAbsolute(this.path) ? this.path : resolve(this.cwd, this.path);
        await fs.mkdir(dirname(target), { recursive: true });
        await fs.appendFile(target, line, "utf8");
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[mcpforge] audit log error: ${message}`);
      });

    return this.chain;
  }

  async flush(): Promise<void> {
    await this.chain;
  }
}

export function redactSecrets(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[depth-limit]";
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item, depth + 1));
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      output[key] = SECRET_KEY_PATTERN.test(key) ? "[REDACTED]" : redactSecrets(item, depth + 1);
    }
    return output;
  }
  return value;
}

export function redactUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    for (const key of [...url.searchParams.keys()]) {
      if (SECRET_KEY_PATTERN.test(key)) {
        url.searchParams.set(key, "[REDACTED]");
      }
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}
