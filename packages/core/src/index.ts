import { promises as fs } from "node:fs";
import { dirname } from "node:path";
import SwaggerParser from "@apidevtools/swagger-parser";
import type { OpenAPIV3 } from "openapi-types";
import {
  MANIFEST_VERSION,
  McpForgeError,
  isReadOnlyMethod,
  parseManifest,
  type HttpMethod,
  type JsonSchema,
  type ToolDefinition,
  type ToolManifest,
  type ToolParameter,
} from "@mcpforge/shared";

export interface GenerateOptions {
  source?: string;
  baseUrl?: string;
  includeTags?: string[];
  excludeTags?: string[];
  includeOperationIds?: string[];
  excludeOperationIds?: string[];
}

type ParameterObject = OpenAPIV3.ParameterObject;
type OperationObject = OpenAPIV3.OperationObject;
type PathItemObject = OpenAPIV3.PathItemObject;
type RequestBodyObject = OpenAPIV3.RequestBodyObject;
type SchemaObject = OpenAPIV3.SchemaObject;

const METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

export async function generateManifest(
  input: string | OpenAPIV3.Document,
  options: GenerateOptions = {},
): Promise<ToolManifest> {
  let api: OpenAPIV3.Document;
  try {
    api = (await SwaggerParser.dereference(input as string, {
      dereference: { circular: "ignore" },
    })) as unknown as OpenAPIV3.Document;
  } catch (error) {
    throw new McpForgeError(
      `Could not parse the OpenAPI document: ${error instanceof Error ? error.message : String(error)}`,
      "PARSE_ERROR",
    );
  }

  if (!api.openapi || !api.openapi.startsWith("3.")) {
    throw new McpForgeError(
      "Only OpenAPI 3.x documents are supported. Convert Swagger 2.0 specs first.",
      "UNSUPPORTED_SPEC",
    );
  }

  const source = options.source ?? (typeof input === "string" ? input : "inline");
  const servers = (api.servers ?? []).map((server) => ({
    url: resolveServerUrl(server),
    description: server.description,
  }));
  const baseUrl = options.baseUrl ?? servers[0]?.url;

  const tools: ToolDefinition[] = [];
  const usedNames = new Map<string, number>();

  for (const [path, pathItem] of Object.entries(api.paths ?? {})) {
    if (!pathItem || isReference(pathItem)) continue;

    for (const method of METHODS) {
      const operation = (pathItem as PathItemObject)[method.toLowerCase() as Lowercase<HttpMethod>] as
        | OperationObject
        | undefined;
      if (!operation) continue;

      if (options.includeTags?.length && !operation.tags?.some((tag) => options.includeTags!.includes(tag))) {
        continue;
      }
      if (options.excludeTags?.length && operation.tags?.some((tag) => options.excludeTags!.includes(tag))) {
        continue;
      }
      if (options.includeOperationIds?.length && (!operation.operationId || !options.includeOperationIds.includes(operation.operationId))) {
        continue;
      }
      if (options.excludeOperationIds?.length && operation.operationId && options.excludeOperationIds.includes(operation.operationId)) {
        continue;
      }

      const parameters = collectParameters(pathItem as PathItemObject, operation);
      const requestBody = toRequestBody(operation.requestBody);
      const rawName =
        operation.operationId ??
        `${method.toLowerCase()}_${path.replace(/[{}]/g, "").replace(/[^a-zA-Z0-9]+/g, "_")}`;
      const name = uniqueName(sanitizeName(rawName), usedNames);
      const bodyProperty = parameters.some((parameter) => parameter.name === "body") ? "requestBody" : "body";

      tools.push({
        name,
        title: operation.summary,
        description: buildDescription(method, path, operation),
        method,
        path,
        operationId: operation.operationId,
        tags: operation.tags ?? [],
        readOnly: isReadOnlyMethod(method),
        parameters: parameters.map(toToolParameter),
        requestBody,
        bodyProperty,
        inputSchema: buildInputSchema(parameters, requestBody, bodyProperty),
        security: operation.security ?? api.security,
      });
    }
  }

  return {
    manifestVersion: MANIFEST_VERSION,
    source,
    title: api.info?.title,
    version: api.info?.version,
    baseUrl,
    servers,
    securitySchemes: api.components?.securitySchemes as Record<string, unknown> | undefined,
    tools,
    generatedAt: new Date().toISOString(),
  };
}

export async function readManifest(path: string): Promise<ToolManifest> {
  let raw: string;
  try {
    raw = await fs.readFile(path, "utf8");
  } catch (error) {
    throw new McpForgeError(
      `Could not read manifest at ${path}: ${error instanceof Error ? error.message : String(error)}`,
      "MANIFEST_READ_ERROR",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new McpForgeError(
      `Manifest at ${path} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      "MANIFEST_PARSE_ERROR",
    );
  }

  try {
    return parseManifest(parsed);
  } catch (error) {
    throw new McpForgeError(
      `Manifest at ${path} does not match the MCPForge schema: ${error instanceof Error ? error.message : String(error)}`,
      "MANIFEST_VALIDATION_ERROR",
    );
  }
}

export async function writeManifest(path: string, manifest: ToolManifest): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function resolveServerUrl(server: OpenAPIV3.ServerObject): string {
  let url = server.url;
  for (const [name, variable] of Object.entries(server.variables ?? {})) {
    url = url.replace(new RegExp(`\\{${name}\\}`, "g"), variable.default ?? "");
  }
  return url.replace(/\/$/, "");
}

function collectParameters(pathItem: PathItemObject, operation: OperationObject): ParameterObject[] {
  const merged = new Map<string, ParameterObject>();
  for (const parameter of [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])]) {
    if (isReference(parameter)) continue;
    merged.set(`${parameter.in}:${parameter.name}`, parameter);
  }
  return [...merged.values()];
}

function toToolParameter(parameter: ParameterObject): ToolParameter {
  return {
    name: parameter.name,
    in: parameter.in as ToolParameter["in"],
    required: parameter.required ?? false,
    description: parameter.description,
    schema: normalizeSchema(parameter.schema as SchemaObject | undefined) ?? { type: "string" },
  };
}

function toRequestBody(requestBody: OperationObject["requestBody"]): ToolDefinition["requestBody"] {
  if (!requestBody || isReference(requestBody)) return undefined;

  const body = requestBody as RequestBodyObject;
  const entries = Object.entries(body.content ?? {});
  if (entries.length === 0) {
    return {
      required: body.required ?? false,
      contentType: "application/json",
      schema: { type: "object" },
    };
  }

  const [contentType, media] =
    entries.find(([type]) => type.includes("json")) ?? entries[0];
  const schema = (media as { schema?: SchemaObject }).schema;

  return {
    required: body.required ?? false,
    contentType,
    schema: normalizeSchema(schema) ?? { type: "object" },
  };
}

function buildInputSchema(
  parameters: ParameterObject[],
  requestBody: ToolDefinition["requestBody"],
  bodyProperty: string,
): JsonSchema {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const parameter of parameters) {
    const schema = normalizeSchema(parameter.schema as SchemaObject | undefined) ?? { type: "string" };
    properties[parameter.name] = {
      ...schema,
      ...(parameter.description ? { description: parameter.description } : {}),
    };
    if (parameter.required) required.push(parameter.name);
  }

  if (requestBody) {
    properties[bodyProperty] = {
      ...requestBody.schema,
      description: "Request body payload.",
    };
    if (requestBody.required) required.push(bodyProperty);
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

function normalizeSchema(schema: SchemaObject | undefined): JsonSchema | undefined {
  if (!schema) return undefined;

  const clone = structuredClone(schema) as Record<string, unknown>;
  delete clone.example;
  delete clone.externalDocs;

  if (clone.nullable === true) {
    delete clone.nullable;
    if (typeof clone.type === "string") {
      clone.type = [clone.type, "null"];
    }
  }

  return clone;
}

function buildDescription(method: HttpMethod, path: string, operation: OperationObject): string {
  const summary = operation.summary ?? operation.description ?? operation.operationId;
  const headline = summary ? `${summary}` : `${method} ${path}`;
  return `${headline}\n\nHTTP: ${method} ${path}`;
}

function sanitizeName(raw: string): string {
  const cleaned = raw
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 128);
  return cleaned.length > 0 ? cleaned : "tool";
}

function uniqueName(name: string, used: Map<string, number>): string {
  const count = used.get(name) ?? 0;
  used.set(name, count + 1);
  if (count === 0) return name;
  return `${name.slice(0, 124)}_${count + 1}`;
}

function isReference(value: unknown): value is OpenAPIV3.ReferenceObject {
  return typeof value === "object" && value !== null && "$ref" in value;
}
