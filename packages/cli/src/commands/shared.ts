import { promises as fs } from "node:fs";
import { dirname, resolve } from "node:path";
import { readManifest } from "@mcpforge/core";
import { configFileExists, loadConfig } from "@mcpforge/runtime";
import type { McpForgeConfig, ToolManifest } from "@mcpforge/shared";

export interface RuntimePathsOptions {
  manifest?: string;
  config?: string;
  baseUrl?: string;
}

export interface RuntimePaths {
  config: McpForgeConfig;
  manifest: ToolManifest;
  manifestPath: string;
  configPath?: string;
}

export async function loadRuntimePaths(options: RuntimePathsOptions): Promise<RuntimePaths> {
  const configPath =
    options.config ??
    ((await configFileExists(resolve(process.cwd(), "mcpforge.config.json")))
      ? "mcpforge.config.json"
      : undefined);

  const loadedConfig = await loadConfig(configPath);
  const manifestPath = options.manifest ?? loadedConfig.manifest;
  const manifest = await readManifest(manifestPath);
  const config = options.baseUrl ? { ...loadedConfig, baseUrl: options.baseUrl } : loadedConfig;

  return { config, manifest, manifestPath, configPath };
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "mcpforge"
  );
}

export function log(message: string): void {
  console.error(`[mcpforge] ${message}`);
}

export function parsePort(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error(`Invalid port "${value}".`);
  }
  return port;
}
