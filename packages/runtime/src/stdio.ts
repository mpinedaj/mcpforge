import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { RuntimeContext } from "./context";
import { createMcpServer } from "./server";

export interface RunningStdioServer {
  close(): Promise<void>;
}

export async function startStdioServer(ctx: RuntimeContext): Promise<RunningStdioServer> {
  const server = createMcpServer(ctx);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  const toolCount = ctx.guard.listTools(ctx.manifest.tools).length;
  console.error(`[mcpforge] ${ctx.config.name} v${ctx.config.version} ready on stdio · ${toolCount} tools`);

  return {
    close: () => server.close(),
  };
}
