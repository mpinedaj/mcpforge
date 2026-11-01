import { describe, expect, it, vi } from "vitest";
import { ToolDefinitionSchema } from "@mcpforge/shared";
import { buildUrl, executeTool, resolveAuth } from "@mcpforge/runtime";

const listPets = ToolDefinitionSchema.parse({
  name: "list_pets",
  description: "List pets",
  method: "GET",
  path: "/pets/{petId}",
  readOnly: true,
  parameters: [
    {
      name: "petId",
      in: "path",
      required: true,
      schema: { type: "string" },
    },
    {
      name: "status",
      in: "query",
      required: false,
      schema: { type: "string" },
    },
    {
      name: "x-trace",
      in: "header",
      required: false,
      schema: { type: "string" },
    },
  ],
  inputSchema: { type: "object" },
});

const createPet = ToolDefinitionSchema.parse({
  name: "create_pet",
  description: "Create a pet",
  method: "POST",
  path: "/pets",
  readOnly: false,
  requestBody: {
    required: true,
    contentType: "application/json",
    schema: { type: "object" },
  },
  inputSchema: { type: "object" },
});

describe("buildUrl", () => {
  it("encodes path parameters and serializes query arrays", () => {
    const url = buildUrl("https://api.example.com/v1/", listPets, {
      petId: "a/b",
      status: ["available", "sold"],
      "x-trace": "trace-1",
    });

    expect(url.pathname).toBe("/v1/pets/a%2Fb");
    expect(url.searchParams.getAll("status")).toEqual(["available", "sold"]);
  });

  it("throws when a required path parameter is missing", () => {
    expect(() => buildUrl("https://api.example.com", listPets, {})).toThrow(/petId/);
  });
});

describe("executeTool", () => {
  it("sends the request and parses the JSON response", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ id: 1, name: "doggie" }), {
        status: 200,
        headers: { "content-type": "application/json", "x-request-id": "abc" },
      });
    });
    const fetchImpl = fetchMock as unknown as typeof fetch;

    const result = await executeTool(
      listPets,
      { petId: "1", status: "available", "x-trace": "trace-1" },
      {
        baseUrl: "https://api.example.com/v1",
        timeoutMs: 5000,
        maxResponseBytes: 1024,
        fetchImpl,
      },
    );

    expect(result.status).toBe(200);
    expect(result.ok).toBe(true);
    expect(result.body).toEqual({ id: 1, name: "doggie" });
    expect(result.headers["x-request-id"]).toBe("abc");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe("https://api.example.com/v1/pets/1?status=available");
    expect(init.method).toBe("GET");
    expect(new Headers(init.headers).get("x-trace")).toBe("trace-1");
  });

  it("serializes request bodies and applies auth headers", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    const fetchImpl = fetchMock as unknown as typeof fetch;

    const result = await executeTool(
      createPet,
      { body: { name: "doggie" } },
      {
        baseUrl: "https://api.example.com",
        auth: { headers: { authorization: "Bearer test" }, query: {} },
        timeoutMs: 5000,
        maxResponseBytes: 1024,
        fetchImpl,
      },
    );

    expect(result.status).toBe(204);
    expect(result.body).toBeNull();

    const [, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ name: "doggie" }));
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer test");
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");
  });

  it("throws when a required body is missing", async () => {
    await expect(
      executeTool(createPet, {}, {
        baseUrl: "https://api.example.com",
        timeoutMs: 5000,
        maxResponseBytes: 1024,
        fetchImpl: (async () => new Response(null)) as typeof fetch,
      }),
    ).rejects.toThrow(/request body/);
  });

  it("truncates responses above maxResponseBytes", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response("x".repeat(200), {
        status: 200,
        headers: { "content-type": "text/plain" },
      });
    }) as unknown as typeof fetch;

    const result = await executeTool(listPets, { petId: "1" }, {
      baseUrl: "https://api.example.com",
      timeoutMs: 5000,
      maxResponseBytes: 50,
      fetchImpl,
    });

    expect(result.truncated).toBe(true);
    expect(String(result.body).length).toBeLessThanOrEqual(50);
  });
});

describe("resolveAuth", () => {
  it("resolves bearer tokens from environment variables", () => {
    const auth = resolveAuth({ type: "bearer", tokenEnv: "API_TOKEN" }, { API_TOKEN: "secret" });
    expect(auth?.headers.authorization).toBe("Bearer secret");
  });

  it("throws when a configured token is missing", () => {
    expect(() => resolveAuth({ type: "bearer" }, {})).toThrow(/MCPFORGE_AUTH_TOKEN/);
  });
});
