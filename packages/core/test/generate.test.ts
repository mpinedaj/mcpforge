import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { generateManifest } from "@mcpforge/core";
import type { OpenAPIV3 } from "openapi-types";

const petstorePath = fileURLToPath(new URL("../../../examples/petstore.yaml", import.meta.url));

describe("generateManifest", () => {
  it("compiles an OpenAPI document into a tool manifest", async () => {
    const manifest = await generateManifest(petstorePath);

    expect(manifest.manifestVersion).toBe("1");
    expect(manifest.title).toBe("Swagger Petstore");
    expect(manifest.baseUrl).toBe("https://petstore3.swagger.io/api/v3");
    expect(manifest.tools).toHaveLength(5);

    const names = manifest.tools.map((tool) => tool.name);
    expect(names).toEqual([
      "findPetsByStatus",
      "getPetById",
      "deletePet",
      "addPet",
      "getInventory",
    ]);
  });

  it("marks read-only methods and builds input schemas", async () => {
    const manifest = await generateManifest(petstorePath);
    const getPet = manifest.tools.find((tool) => tool.name === "getPetById")!;
    const addPet = manifest.tools.find((tool) => tool.name === "addPet")!;

    expect(getPet.readOnly).toBe(true);
    expect(getPet.inputSchema).toMatchObject({
      type: "object",
      required: ["petId"],
      properties: { petId: { type: "integer", format: "int64" } },
    });

    expect(addPet.readOnly).toBe(false);
    expect(addPet.requestBody?.contentType).toBe("application/json");
    expect(addPet.inputSchema).toMatchObject({
      type: "object",
      required: ["body"],
    });
  });

  it("filters operations by tag", async () => {
    const manifest = await generateManifest(petstorePath, { excludeTags: ["store"] });
    expect(manifest.tools.map((tool) => tool.name)).not.toContain("getInventory");
    expect(manifest.tools).toHaveLength(4);
  });

  it("generates unique names for duplicate operationIds", async () => {
    const spec: OpenAPIV3.Document = {
      openapi: "3.0.3",
      info: { title: "Duplicates", version: "1.0.0" },
      servers: [{ url: "https://example.com" }],
      paths: {
        "/a": {
          get: { operationId: "same", responses: { "200": { description: "ok" } } },
        },
        "/b": {
          get: { operationId: "same", responses: { "200": { description: "ok" } } },
        },
      },
    };

    const manifest = await generateManifest(spec, { source: "inline" });
    expect(manifest.tools.map((tool) => tool.name)).toEqual(["same", "same_2"]);
  });

  it("rejects Swagger 2.0 documents", async () => {
    await expect(
      generateManifest({ swagger: "2.0", info: { title: "old", version: "1" }, paths: {} } as never),
    ).rejects.toThrow(/OpenAPI 3.x/);
  });
});
