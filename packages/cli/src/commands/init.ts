import { resolve } from "node:path";
import type { Command } from "commander";
import { generateManifest, writeManifest } from "@mcpforge/core";
import { MCPFORGE_VERSION, parseConfig, type McpForgeConfigInput } from "@mcpforge/shared";
import { fileExists, log, slugify, writeJson } from "./shared";

const SPEC_CANDIDATES = [
  "openapi.yaml",
  "openapi.yml",
  "openapi.json",
  "swagger.yaml",
  "swagger.yml",
  "swagger.json",
  "api/openapi.yaml",
  "api/openapi.json",
];

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Create a config, import an OpenAPI document, and print next steps")
    .argument("[spec]", "path or URL to an OpenAPI 3.x document")
    .option("-o, --output <path>", "manifest output path", "mcpforge.json")
    .option("-c, --config <path>", "config output path", "mcpforge.config.json")
    .option("--base-url <url>", "override the upstream base URL")
    .option("--force", "overwrite existing files")
    .action(
      async (
        spec: string | undefined,
        options: { output: string; config: string; baseUrl?: string; force?: boolean },
      ) => {
        if (!options.force) {
          if (await fileExists(options.config)) {
            throw new Error(`${options.config} already exists. Use --force to overwrite it.`);
          }
          if (await fileExists(options.output)) {
            throw new Error(`${options.output} already exists. Use --force to overwrite it.`);
          }
        }

        const detectedSpec = spec ?? (await detectSpec());
        let name = "mcpforge";

        if (detectedSpec) {
          const manifest = await generateManifest(detectedSpec, {
            source: detectedSpec,
            baseUrl: options.baseUrl,
          });
          await writeManifest(options.output, manifest);
          name = slugify(manifest.title ?? "mcpforge");
          log(`imported ${manifest.tools.length} tools from ${detectedSpec}`);
          if (manifest.baseUrl) log(`base URL: ${manifest.baseUrl}`);
        } else {
          log("no OpenAPI document found; writing config only");
        }

        const config = parseConfig(buildConfig(name, options.output));

        await writeJson(options.config, config);
        log(`wrote ${options.config}`);

        printNextSteps(detectedSpec, options.output, options.config);
      },
    );
}

function buildConfig(name: string, manifest: string): McpForgeConfigInput {
  return {
    name,
    version: MCPFORGE_VERSION,
    manifest,
    transport: "stdio",
    http: { host: "127.0.0.1", port: 7331 },
    auth: { type: "none" },
    security: {
      readOnly: true,
      allowlist: [],
      denylist: [],
      rateLimitPerMinute: 60,
      timeoutMs: 30_000,
      maxResponseBytes: 1_048_576,
      audit: { enabled: true, path: ".mcpforge/audit.log" },
    },
    headers: {},
  };
}

async function detectSpec(): Promise<string | undefined> {
  for (const candidate of SPEC_CANDIDATES) {
    if (await fileExists(resolve(process.cwd(), candidate))) return candidate;
  }
  return undefined;
}

function printNextSteps(spec: string | undefined, manifest: string, config: string): void {
  const absoluteManifest = resolve(process.cwd(), manifest);
  const absoluteConfig = resolve(process.cwd(), config);
  const lines = [
    "",
    "Next steps:",
    "  1. mcpforge serve                     # stdio server for Claude Desktop, Cursor, VS Code",
    "  2. mcpforge inspect                   # local web inspector at http://127.0.0.1:7331",
    "",
    "Add this to your MCP client configuration:",
    JSON.stringify(
      {
        mcpServers: {
          mcpforge: {
            command: "npx",
            args: [
              "-y",
              "mcpforge",
              "serve",
              "--manifest",
              absoluteManifest,
              "--config",
              absoluteConfig,
            ],
          },
        },
      },
      null,
      2,
    ),
  ];

  if (!spec) {
    lines.push("", "No spec was imported. Run `mcpforge generate <openapi.yaml>` when you are ready.");
  }

  console.error(lines.join("\n"));
}
