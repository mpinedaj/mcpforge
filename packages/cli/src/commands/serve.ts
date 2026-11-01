import type { Command } from "commander";
import { startServer } from "@mcpforge/runtime";
import { loadRuntimePaths, log, parsePort } from "./shared";

export function registerServeCommand(program: Command): void {
  program
    .command("serve")
    .description("Run the MCP server over stdio (default) or Streamable HTTP")
    .option("-m, --manifest <path>", "path to the tool manifest")
    .option("-c, --config <path>", "path to mcpforge.config.json")
    .option("--base-url <url>", "override the upstream base URL")
    .option("--http", "use the Streamable HTTP transport")
    .option("--stdio", "use the stdio transport")
    .option("--host <host>", "HTTP host (default: 127.0.0.1)")
    .option("--port <port>", "HTTP port (default: 7331)")
    .action(
      async (options: {
        manifest?: string;
        config?: string;
        baseUrl?: string;
        http?: boolean;
        stdio?: boolean;
        host?: string;
        port?: string;
      }) => {
        if (options.http && options.stdio) {
          throw new Error("Choose either --http or --stdio, not both.");
        }

        const { config, manifest } = await loadRuntimePaths(options);
        const transport = options.http ? "http" : options.stdio ? "stdio" : config.transport;

        const running = await startServer({
          manifest,
          config,
          transport,
          http: {
            host: options.host,
            port: parsePort(options.port),
          },
        });

        if (running.transport === "http") {
          log(`MCP endpoint: ${running.url}/mcp`);
          log(`inspector:    ${running.url}`);
        }

        let closing = false;
        const shutdown = async () => {
          if (closing) return;
          closing = true;
          log("shutting down");
          await running.close();
          process.exit(0);
        };

        process.on("SIGINT", () => void shutdown());
        process.on("SIGTERM", () => void shutdown());
      },
    );
}
