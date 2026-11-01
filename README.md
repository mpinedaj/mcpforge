# MCPForge

**Turn any API into a secure MCP server in one command.**

[![CI](https://github.com/mpinedaj/mcpforge/actions/workflows/ci.yml/badge.svg)](https://github.com/mpinedaj/mcpforge/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/mcpforge-cli.svg)](https://www.npmjs.com/package/mcpforge-cli)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)

MCPForge compiles an OpenAPI document into a ready-to-run [Model Context Protocol](https://modelcontextprotocol.io) server with typed tools, auth passthrough, read-only mode, rate limits and an audit log. No boilerplate, no hand-written tool schemas.

```bash
npx mcpforge-cli init ./openapi.yaml
# [mcpforge] imported 42 tools from ./openapi.yaml
# [mcpforge] base URL: https://api.example.com
# [mcpforge] wrote mcpforge.config.json

npx mcpforge-cli inspect
# [mcpforge] inspector:    http://127.0.0.1:7331
# [mcpforge] MCP endpoint: http://127.0.0.1:7331/mcp
```

Open the inspector, pick a tool, and call your API. Then point Claude Desktop, Cursor, VS Code, Windsurf or any MCP client at the same server.

## Demo

<!-- Run `vhs docs/demo.tape` to generate docs/demo.gif, then replace this block with the image. -->
```text
$ npx mcpforge-cli generate examples/petstore.yaml -o examples/petstore.mcpforge.json
[mcpforge] wrote 5 tools to examples/petstore.mcpforge.json
[mcpforge] source: Swagger Petstore v1.0.0
[mcpforge] base URL: https://petstore3.swagger.io/api/v3
[mcpforge] read-only tools: 3/5 (writes are blocked by default)

$ npx mcpforge-cli inspect --manifest examples/petstore.mcpforge.json
[mcpforge] MCP endpoint: http://127.0.0.1:7331/mcp
[mcpforge] inspector:    http://127.0.0.1:7331
```

To record the animated version, install [VHS](https://github.com/charmbracelet/vhs) and run `vhs docs/demo.tape`. Then replace the transcript with `![MCPForge demo](docs/demo.gif)`.

---

## Why MCPForge?

Connecting an AI agent to an internal API today means writing a custom MCP server by hand: parsing OpenAPI, mapping schemas, wiring auth, handling errors, pagination and timeouts. It is days of work per API, and most implementations give the agent far more access than it needs.

MCPForge does the boring part in one command and puts a security layer in front of the API:

- **Read-only by default.** Write tools are hidden and blocked unless you opt in.
- **No raw credentials in prompts.** Auth is injected by the runtime, never exposed as a tool argument.
- **Auditable.** Every tool call is logged with secrets redacted.
- **Bounded.** Per-tool rate limits, request timeouts and response size caps.
- **Composable.** Works over stdio or Streamable HTTP with any MCP client.

## Quickstart (under 2 minutes)

### 1. Generate a server from an OpenAPI document

```bash
npx mcpforge-cli init ./openapi.yaml
```

`init` auto-detects `openapi.yaml`, `openapi.json`, `swagger.json` and common variants when no path is given.

### 2. Inspect and try the tools locally

```bash
npx mcpforge-cli inspect
```

The inspector lists every exposed tool, shows its JSON Schema and lets you call the upstream API from the browser.

### 3. Add it to your MCP client

**stdio (recommended for desktop clients):**

```json
{
  "mcpServers": {
    "my-api": {
      "command": "npx",
      "args": [
        "-y",
        "mcpforge-cli",
        "serve",
        "--manifest",
        "mcpforge.json",
        "--config",
        "mcpforge.config.json"
      ],
      "env": {
        "MCPFORGE_AUTH_TOKEN": "your-token"
      }
    }
  }
}
```

**Streamable HTTP:**

```bash
npx mcpforge-cli serve --http --port 7331
```

```json
{
  "mcpServers": {
    "my-api": {
      "url": "http://127.0.0.1:7331/mcp"
    }
  }
}
```

### From source

```bash
git clone https://github.com/mpinedaj/mcpforge.git
cd mcpforge
npm install
npm run build
npm test
npm run demo
```

## Features

- **OpenAPI 3.x → MCP tools** with JSON Schema inputs generated from parameters and request bodies.
- **Read-only mode by default**, with allowlists and denylists.
- **Auth passthrough** for bearer tokens, API keys and HTTP basic auth.
- **Rate limiting, timeouts and response truncation** per tool.
- **Audit log** in JSONL with automatic secret redaction.
- **Two transports:** stdio and Streamable HTTP.
- **Built-in inspector** at `/` for humans and agents.
- **Health endpoint** at `/health` for deployments.
- **Zero configuration** for the common case.

## How it works

```text
OpenAPI 3.x
    │
    ▼
@mcpforge/core ──► mcpforge.json (tool manifest)
                        │
          ┌─────────────┴─────────────┐
          ▼                           ▼
   stdio transport            Streamable HTTP
          │                     ┌─────┴─────┐
          ▼                     ▼           ▼
    MCP clients              /mcp       inspector
```

The manifest is a plain JSON file. Commit it if you want reproducible tool definitions, or regenerate it in CI when the upstream spec changes.

## Security model

| Control | Default | How to change |
| --- | --- | --- |
| Read-only | `true` | `security.readOnly` or `MCPFORGE_READ_ONLY=false` |
| Allowlist | `[]` (all) | `security.allowlist` |
| Denylist | `[]` | `security.denylist` |
| Rate limit | `60` calls/min per tool | `security.rateLimitPerMinute` |
| Timeout | `30000` ms | `security.timeoutMs` |
| Max response | `1048576` bytes | `security.maxResponseBytes` |
| Audit log | `.mcpforge/audit.log` | `security.audit.path` |
| Secret redaction | always on | — |

MCPForge is a proxy, not a sandbox. Run it with the least-privileged upstream credentials you can, keep `readOnly` enabled for exploration, and review the allowlist before exposing write operations to an autonomous agent.

## Configuration

`mcpforge.config.json`:

```json
{
  "name": "my-api",
  "version": "0.1.0",
  "manifest": "mcpforge.json",
  "baseUrl": "https://api.example.com",
  "transport": "stdio",
  "http": { "host": "127.0.0.1", "port": 7331 },
  "auth": { "type": "bearer", "tokenEnv": "MY_API_TOKEN" },
  "security": {
    "readOnly": true,
    "allowlist": [],
    "denylist": [],
    "rateLimitPerMinute": 60,
    "timeoutMs": 30000,
    "maxResponseBytes": 1048576,
    "audit": { "enabled": true, "path": ".mcpforge/audit.log" }
  },
  "headers": { "x-client": "mcpforge" }
}
```

Supported auth types:

```json
{ "type": "none" }
{ "type": "bearer", "tokenEnv": "MY_API_TOKEN" }
{ "type": "apiKey", "in": "header", "name": "X-API-Key", "valueEnv": "MY_API_KEY" }
{ "type": "basic", "username": "me", "passwordEnv": "MY_API_PASSWORD" }
```

### Environment variables

| Variable | Purpose |
| --- | --- |
| `MCPFORGE_BASE_URL` | Override the upstream base URL |
| `MCPFORGE_MANIFEST` | Override the manifest path |
| `MCPFORGE_TRANSPORT` | `stdio` or `http` |
| `MCPFORGE_HOST` / `MCPFORGE_PORT` | HTTP bind address |
| `MCPFORGE_READ_ONLY` | `true` / `false` |
| `MCPFORGE_RATE_LIMIT` | Calls per minute per tool |
| `MCPFORGE_AUDIT` | `true` / `false` |
| `MCPFORGE_AUDIT_PATH` | Audit log path |
| `MCPFORGE_AUTH_TOKEN` | Bearer token or API key fallback |
| `MCPFORGE_AUTH_PASSWORD` | Basic auth password fallback |

## CLI

```text
mcpforge init [spec]       Create a config, import a spec and print next steps
mcpforge generate <spec>   Compile OpenAPI into mcpforge.json
mcpforge serve             Run over stdio (default) or HTTP
mcpforge inspect           Start HTTP and open the inspector
mcpforge build             Create a deployable folder with a Dockerfile
```

Useful flags:

```bash
mcpforge generate ./openapi.yaml \
  --include-tag pets \
  --exclude-operation deletePet \
  --base-url https://staging.example.com

mcpforge serve --http --host 0.0.0.0 --port 7331
mcpforge inspect --no-open --port 7444
```

## Supported sources

| Source | Status |
| --- | --- |
| OpenAPI 3.0 / 3.1 | ✅ Supported |
| Swagger 2.0 | ⚠️ Convert to OpenAPI 3.x first |
| GraphQL | 🗺️ Roadmap |
| PostgreSQL (read-only introspection) | 🗺️ Roadmap |

## Works with

Claude Desktop · Cursor · VS Code (GitHub Copilot MCP) · Windsurf · Cline · any MCP-compatible client.

## Examples

- [`examples/petstore.yaml`](./examples/petstore.yaml) — the demo spec used by `npm run demo`.
- Run `npm run demo` to generate a manifest, start the inspector and call the public Swagger Petstore API.

## Roadmap

- **v0.1 — MVP (current):** OpenAPI import, stdio + HTTP, inspector, read-only mode, allowlists, rate limits, audit log.
- **v0.2:** GraphQL SDL and read-only PostgreSQL adapters, per-tool scopes, SQLite audit backend, published Docker image.
- **v0.3:** React/Vite inspector, OAuth2 client credentials, richer OpenAPI 3.1 support, tool output schemas.
- **v1.0:** Plugin API, policy DSL, hosted tool registry, team audit export.

## Contributing

Contributions are welcome. Start with [`CONTRIBUTING.md`](./CONTRIBUTING.md), open an issue, or pick a `good first issue`.

```bash
npm install
npm run build
npm run typecheck
npm test
```

The monorepo layout:

```text
packages/
  shared/      Types, Zod schemas and config parsing
  core/        OpenAPI → tool manifest compiler
  runtime/     Executor, security, audit, MCP transports
  inspector/   Zero-build inspector UI
  cli/         mcpforge command line interface
```

## Security

Please report vulnerabilities privately as described in [`SECURITY.md`](./SECURITY.md). Do not open a public issue for security bugs.

## License

[MIT](./LICENSE) © MCPForge contributors

---

> MCPForge is an early-stage MVP. The manifest format and CLI flags may change before v1.0. Pin a version in production.
