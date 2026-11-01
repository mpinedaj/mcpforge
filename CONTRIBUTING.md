# Contributing to MCPForge

Thanks for helping make MCPForge better. This guide covers the development workflow, architecture and review expectations.

## Development setup

Requirements:

- Node.js 20 or newer
- npm 10 or newer

```bash
git clone https://github.com/mpinedaj/mcpforge.git
cd mcpforge
npm install
npm run build
npm test
```

Useful commands:

```bash
npm run build       # build all workspace packages
npm run typecheck   # strict TypeScript check
npm test            # run the Vitest suite
npm run test:watch  # watch mode
npm run demo        # generate the petstore manifest and start the inspector
```

## Repository layout

```text
packages/
  shared/      Types, Zod schemas, config parsing and shared helpers
  core/        OpenAPI 3.x → tool manifest compiler
  runtime/     Executor, security guard, audit log, MCP transports
  inspector/   Zero-build inspector UI served by the HTTP runtime
  cli/         mcpforge command line interface
examples/      Demo OpenAPI document
```

Data flow:

```text
OpenAPI ──► core ──► mcpforge.json ──► runtime ──► MCP clients
```

## Making changes

1. Open an issue or comment on an existing one before starting large changes.
2. Keep pull requests focused. One feature or fix per PR.
3. Add tests for behavior changes. Tests live next to each package under `test/`.
4. Run `npm run build`, `npm run typecheck` and `npm test` before pushing.
5. Update the README or docs when you change user-facing behavior.

## Code style

- TypeScript strict mode, ESM, Node.js APIs.
- Prefer small, dependency-light modules.
- No new runtime dependency without a clear justification.
- Never log secrets. Use the existing redaction helpers in `packages/runtime/src/audit.ts`.
- Keep stdout clean in stdio mode: use `console.error` for logs.

## Good first issues

Look for issues labeled `good first issue`. Good candidates include:

- Adding a new OpenAPI fixture and assertions.
- Improving error messages.
- Adding a new inspector convenience feature.
- Documenting a client setup (Claude Desktop, Cursor, VS Code, Windsurf).

## Security

Do not open a public issue for vulnerabilities. Follow [`SECURITY.md`](./SECURITY.md).

## License

By contributing you agree that your contributions are licensed under the MIT License.
