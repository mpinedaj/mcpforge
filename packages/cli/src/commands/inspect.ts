import { spawn } from "node:child_process";
import type { Command } from "commander";
import { startServer } from "@mcpforge/runtime";
import { loadRuntimePaths, log, parsePort } from "./shared";

export function registerInspectCommand(program: Command): void {
  program
    .command("inspect")
    .description("Start the HTTP transport and open the local inspector")
    .option("-m, --manifest <path>", "path to the tool manifest")
    .option("-c, --config <path>", "path to mcpforge.config.json")
    .option("--base-url <url>", "override the upstream base URL")
    .option("--host <host>", "HTTP host", "127.0.0.1")
    .option("--port <port>", "HTTP port", "7331")
    .option("--no-open", "do not open the inspector in a browser")
    .action(
      async (options: {
        manifest?: string;
        config?: string;
        baseUrl?: string;
        host: string;
        port: string;
        open: boolean;
      }) => {
        const { config, manifest } = await loadRuntimePaths(options);
        const running = await startServer({
          manifest,
          config,
          transport: "http",
          http: { host: options.host, port: parsePort(options.port) },
        });

        if (running.transport !== "http") return;

        log(`inspector:    ${running.url}`);
        log(`MCP endpoint: ${running.url}/mcp`);
        log(`tools:        ${manifest.tools.length} in manifest, ${manifest.tools.filter((tool) => tool.readOnly).length} read-only`);

        if (options.open) openBrowser(running.url);

        let closing = false;
        const shutdown = async () => {
          if (closing) return;
          closing = true;
          await running.close();
          process.exit(0);
        };

        process.on("SIGINT", () => void shutdown());
        process.on("SIGTERM", () => void shutdown());
      },
    );
}

function openBrowser(url: string): void {
  try {
    const command =
      process.platform === "win32" ? "cmd" : process.platform === "darwin" ? "open" : "xdg-open";
    const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.on("error", () => undefined);
    child.unref();
  } catch {
    // Opening a browser is best-effort only.
  }
}
