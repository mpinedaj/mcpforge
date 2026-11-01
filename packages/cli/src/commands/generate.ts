import type { Command } from "commander";
import { generateManifest, writeManifest } from "@mcpforge/core";
import { log } from "./shared";

export function registerGenerateCommand(program: Command): void {
  program
    .command("generate")
    .description("Compile an OpenAPI 3.x document into an MCPForge tool manifest")
    .argument("<spec>", "path or URL to an OpenAPI 3.x document")
    .option("-o, --output <path>", "output manifest path", "mcpforge.json")
    .option("--base-url <url>", "override the upstream base URL")
    .option("--include-tag <tags...>", "only include operations with these tags")
    .option("--exclude-tag <tags...>", "exclude operations with these tags")
    .option("--include-operation <ids...>", "only include these operationIds")
    .option("--exclude-operation <ids...>", "exclude these operationIds")
    .action(
      async (
        spec: string,
        options: {
          output: string;
          baseUrl?: string;
          includeTag?: string[];
          excludeTag?: string[];
          includeOperation?: string[];
          excludeOperation?: string[];
        },
      ) => {
        const manifest = await generateManifest(spec, {
          source: spec,
          baseUrl: options.baseUrl,
          includeTags: options.includeTag,
          excludeTags: options.excludeTag,
          includeOperationIds: options.includeOperation,
          excludeOperationIds: options.excludeOperation,
        });

        await writeManifest(options.output, manifest);

        log(`wrote ${manifest.tools.length} tools to ${options.output}`);
        if (manifest.title) log(`source: ${manifest.title}${manifest.version ? ` v${manifest.version}` : ""}`);
        if (manifest.baseUrl) log(`base URL: ${manifest.baseUrl}`);
        const readOnly = manifest.tools.filter((tool) => tool.readOnly).length;
        log(`read-only tools: ${readOnly}/${manifest.tools.length} (writes are blocked by default)`);
      },
    );
}
