# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-11-01

### Added

- OpenAPI 3.x to MCP tool manifest compiler (`@mcpforge/core`).
- Secure runtime with read-only mode, allowlists, denylists, rate limits, timeouts and response caps.
- Bearer, API key and HTTP basic auth passthrough.
- JSONL audit log with secret redaction.
- stdio and Streamable HTTP transports.
- Zero-build inspector UI with tool search, schema viewer and live calls.
- CLI commands: `init`, `generate`, `serve`, `inspect`, `build`.
- Petstore example and end-to-end tests.
