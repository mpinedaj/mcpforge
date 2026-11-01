import { z } from "zod";

export const MCPFORGE_VERSION = "0.1.0";
export const MANIFEST_VERSION = "1" as const;

export const JsonSchemaSchema = z.record(z.string(), z.unknown());
export type JsonSchema = z.infer<typeof JsonSchemaSchema>;

export const HttpMethodSchema = z.enum([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);
export type HttpMethod = z.infer<typeof HttpMethodSchema>;

export const ParameterLocationSchema = z.enum(["path", "query", "header", "cookie"]);
export type ParameterLocation = z.infer<typeof ParameterLocationSchema>;

export const ToolParameterSchema = z.object({
  name: z.string().min(1),
  in: ParameterLocationSchema,
  required: z.boolean().default(false),
  description: z.string().optional(),
  schema: JsonSchemaSchema.default({ type: "string" }),
});
export type ToolParameter = z.infer<typeof ToolParameterSchema>;

export const RequestBodySchema = z.object({
  required: z.boolean().default(false),
  contentType: z.string().default("application/json"),
  schema: JsonSchemaSchema.default({ type: "object" }),
});
export type RequestBody = z.infer<typeof RequestBodySchema>;

export const ToolDefinitionSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-zA-Z0-9_-]+$/, "Tool names may only contain letters, digits, underscores and hyphens"),
  title: z.string().optional(),
  description: z.string(),
  method: HttpMethodSchema,
  path: z.string().min(1),
  operationId: z.string().optional(),
  tags: z.array(z.string()).default([]),
  readOnly: z.boolean(),
  parameters: z.array(ToolParameterSchema).default([]),
  requestBody: RequestBodySchema.optional(),
  bodyProperty: z.string().default("body"),
  inputSchema: JsonSchemaSchema,
  security: z.array(z.record(z.string(), z.array(z.string()))).optional(),
});
export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

export const ManifestServerSchema = z.object({
  url: z.string(),
  description: z.string().optional(),
});
export type ManifestServer = z.infer<typeof ManifestServerSchema>;

export const ToolManifestSchema = z.object({
  manifestVersion: z.literal(MANIFEST_VERSION),
  source: z.string(),
  title: z.string().optional(),
  version: z.string().optional(),
  baseUrl: z.string().optional(),
  servers: z.array(ManifestServerSchema).default([]),
  securitySchemes: z.record(z.string(), z.unknown()).optional(),
  tools: z.array(ToolDefinitionSchema),
  generatedAt: z.string(),
});
export type ToolManifest = z.infer<typeof ToolManifestSchema>;

export const AuthConfigSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("none"),
  }),
  z.object({
    type: z.literal("bearer"),
    token: z.string().optional(),
    tokenEnv: z.string().optional(),
  }),
  z.object({
    type: z.literal("apiKey"),
    in: z.enum(["header", "query"]).default("header"),
    name: z.string().default("X-API-Key"),
    value: z.string().optional(),
    valueEnv: z.string().optional(),
  }),
  z.object({
    type: z.literal("basic"),
    username: z.string(),
    password: z.string().optional(),
    passwordEnv: z.string().optional(),
  }),
]);
export type AuthConfig = z.infer<typeof AuthConfigSchema>;

export const AuditConfigSchema = z.object({
  enabled: z.boolean().default(true),
  path: z.string().default(".mcpforge/audit.log"),
});
export type AuditConfig = z.infer<typeof AuditConfigSchema>;

export const SecurityConfigSchema = z.object({
  readOnly: z.boolean().default(true),
  allowlist: z.array(z.string()).default([]),
  denylist: z.array(z.string()).default([]),
  rateLimitPerMinute: z.number().int().positive().default(60),
  timeoutMs: z.number().int().positive().default(30_000),
  maxResponseBytes: z.number().int().positive().default(1_048_576),
  audit: AuditConfigSchema.prefault({}),
});
export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;

export const HttpConfigSchema = z.object({
  host: z.string().default("127.0.0.1"),
  port: z.number().int().positive().max(65_535).default(7331),
});
export type HttpConfig = z.infer<typeof HttpConfigSchema>;

export const McpForgeConfigSchema = z.object({
  name: z.string().default("mcpforge"),
  version: z.string().default(MCPFORGE_VERSION),
  manifest: z.string().default("mcpforge.json"),
  baseUrl: z.string().optional(),
  transport: z.enum(["stdio", "http"]).default("stdio"),
  http: HttpConfigSchema.prefault({}),
  auth: AuthConfigSchema.default({ type: "none" }),
  security: SecurityConfigSchema.prefault({}),
  headers: z.record(z.string(), z.string()).default({}),
});
export type McpForgeConfig = z.infer<typeof McpForgeConfigSchema>;
export type McpForgeConfigInput = z.input<typeof McpForgeConfigSchema>;

export function defineConfig(config: McpForgeConfigInput): McpForgeConfigInput {
  return config;
}

export function parseConfig(value: unknown): McpForgeConfig {
  return McpForgeConfigSchema.parse(value);
}

export function parseManifest(value: unknown): ToolManifest {
  return ToolManifestSchema.parse(value);
}

export function isReadOnlyMethod(method: HttpMethod): boolean {
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
}

export class McpForgeError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "McpForgeError";
  }
}
