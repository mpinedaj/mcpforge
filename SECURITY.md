# Security Policy

## Supported versions

MCPForge is pre-1.0. Security fixes are applied to the latest release on the `main` branch.

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report vulnerabilities privately using GitHub Security Advisories:

1. Go to the repository's **Security** tab.
2. Click **Report a vulnerability**.
3. Include a description, reproduction steps and the affected version.

We will acknowledge the report as soon as possible and coordinate a fix and disclosure timeline.

## Scope

MCPForge sits between an MCP client and an upstream HTTP API. Areas of interest include:

- Authentication bypass or credential leakage.
- Read-only or allowlist/denylist bypasses.
- Path traversal or SSRF through crafted path parameters.
- Secret leakage in logs, tool results or the inspector.
- Prompt-injection vectors introduced by generated tool metadata.
- Denial of service through unbounded responses or rate-limit bypasses.

## Design notes

- Credentials are injected by the runtime and are never exposed as tool arguments.
- Read-only mode is the default; write tools are hidden and blocked.
- Audit entries redact keys matching `authorization`, `token`, `secret`, `password`, `apiKey`, `cookie` and similar names.
- Response bodies are truncated to `security.maxResponseBytes` (1 MiB by default).
- The inspector binds to `127.0.0.1` by default. Do not expose it publicly without an additional auth layer.
