import { beforeAll, afterAll, describe, expect, test } from "vitest";
import {
  callTool,
  getModelObjectIds,
  normalizeNameForTest,
  resolveLandscapeId,
  startTestServer,
} from "./helpers/mcp.js";

const hasCredentials = Boolean(
  (process.env.API_KEY || process.env.ICEPANEL_MCP_API_KEY) &&
    (process.env.ORGANIZATION_ID || process.env.ICEPANEL_MCP_ORGANIZATION_ID)
);
const TARGET_LANDSCAPE_NAME = process.env.ICEPANEL_MCP_TEST_LANDSCAPE_NAME || "Alex's landscape";

const integrationDescribe = hasCredentials ? describe : describe.skip;

integrationDescribe("MCP read tools (integration)", () => {
  let baseUrl = "";
  let closeServer: (() => Promise<void>) | null = null;
  let landscapeId: string | null = null;
  let modelObjectId: string | null = null;

  beforeAll(async () => {
    const organizationId =
      process.env.ORGANIZATION_ID || (process.env.ICEPANEL_MCP_ORGANIZATION_ID as string);
    const started = await startTestServer(organizationId);
    baseUrl = started.baseUrl;
    closeServer = started.close;

    landscapeId = await resolveLandscapeId(baseUrl, TARGET_LANDSCAPE_NAME);
    const modelObjectIds = await getModelObjectIds(baseUrl, landscapeId, 1);
    modelObjectId = modelObjectIds[0] ?? null;
  });

  afterAll(async () => {
    if (closeServer) {
      await closeServer();
    }
  });

  test("list landscapes", async () => {
    const result = await callTool(baseUrl, "icepanel_list_landscapes", {
      response_format: "json",
      limit: 10,
      offset: 0,
    });
    const structured = result.structuredContent as { items?: { name?: string }[] } | undefined;
    const names = (structured?.items || [])
      .map((item) => item.name)
      .filter(Boolean)
      .map((name) => normalizeNameForTest(name as string));
    expect(names).toContain(normalizeNameForTest(TARGET_LANDSCAPE_NAME));
  });

  test("get landscape", async () => {
    if (!landscapeId) {
      return;
    }
    const result = await callTool(baseUrl, "icepanel_get_landscape", {
      response_format: "json",
      landscapeId,
    });
    const structured = result.structuredContent as { id?: string; landscape?: { id?: string } } | undefined;
    const resolvedId = structured?.id ?? structured?.landscape?.id;
    expect(resolvedId).toBe(landscapeId);
  });

  test("list model objects", async () => {
    if (!landscapeId) {
      return;
    }
    const result = await callTool(baseUrl, "icepanel_list_model_objects", {
      response_format: "json",
      landscapeId,
      limit: 10,
      offset: 0,
    });
    const structured = result.structuredContent as { items?: unknown[] } | undefined;
    expect(structured?.items).toBeDefined();
  });

  test("get model object", async () => {
    if (!landscapeId || !modelObjectId) {
      return;
    }
    const result = await callTool(baseUrl, "icepanel_get_model_object", {
      response_format: "json",
      landscapeId,
      modelObjectId,
      includeHierarchicalInfo: false,
    });
    const structured = result.structuredContent as { modelObject?: { id?: string } } | undefined;
    expect(structured?.modelObject?.id).toBe(modelObjectId);
  });

  test("get model object connections", async () => {
    if (!landscapeId || !modelObjectId) {
      return;
    }
    const result = await callTool(baseUrl, "icepanel_get_model_object_connections", {
      response_format: "json",
      landscapeId,
      modelObjectId,
    });
    const structured = result.structuredContent as {
      modelObject?: { id?: string };
      incomingConnections?: unknown[];
      outgoingConnections?: unknown[];
    } | undefined;
    expect(structured?.modelObject?.id).toBe(modelObjectId);
    expect(structured?.incomingConnections).toBeDefined();
    expect(structured?.outgoingConnections).toBeDefined();
  });

  test("list technologies", async () => {
    const result = await callTool(baseUrl, "icepanel_list_technologies", {
      response_format: "json",
      limit: 5,
      offset: 0,
    });
    const structured = result.structuredContent as { items?: unknown[] } | undefined;
    expect(structured?.items).toBeDefined();
  });

});
