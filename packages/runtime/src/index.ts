import type { McpForgeConfig, ToolManifest } from "@mcpforge/shared";
import { createRuntimeContext, type RuntimeContext, type RuntimeContextOptions } from "./context";
import { startHttpServer, type RunningHttpServer } from "./http";
import { startStdioServer } from "./stdio";

export * from "./audit";
export * from "./config";
export * from "./context";
export * from "./executor";
export * from "./http";
export * from "./security";
export * from "./server";
export * from "./stdio";

export interface StartServerOptions {
  manifest: ToolManifest;
  config: McpForgeConfig;
  transport?: "stdio" | "http";
  contextOptions?: RuntimeContextOptions;
  http?: {
    host?: string;
    port?: number;
  };
}

export type RunningServer =
  | { transport: "stdio"; close(): Promise<void> }
  | ({ transport: "http" } & RunningHttpServer);

export async function startServer(options: StartServerOptions): Promise<RunningServer> {
  const context = createRuntimeContext(options.manifest, options.config, options.contextOptions);
  return startServerWithContext(context, options);
}

export async function startServerWithContext(
  context: RuntimeContext,
  options: Omit<StartServerOptions, "manifest" | "config" | "contextOptions"> = {},
): Promise<RunningServer> {
  const transport = options.transport ?? context.config.transport;

  if (transport === "http") {
    const server = await startHttpServer(context, options.http);
    return { transport: "http", ...server };
  }

  const server = await startStdioServer(context);
  return { transport: "stdio", close: server.close };
}
