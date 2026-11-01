#!/usr/bin/env node
import { Command } from "commander";
import { MCPFORGE_VERSION } from "@mcpforge/shared";
import { registerBuildCommand } from "./commands/build";
import { registerGenerateCommand } from "./commands/generate";
import { registerInitCommand } from "./commands/init";
import { registerInspectCommand } from "./commands/inspect";
import { registerServeCommand } from "./commands/serve";

const program = new Command();

program
  .name("mcpforge")
  .description("Turn any API into a secure MCP server in one command.")
  .version(MCPFORGE_VERSION);

registerInitCommand(program);
registerGenerateCommand(program);
registerServeCommand(program);
registerInspectCommand(program);
registerBuildCommand(program);

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[mcpforge] error: ${message}`);
  process.exitCode = 1;
});
