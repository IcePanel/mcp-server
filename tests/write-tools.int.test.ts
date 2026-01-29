import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  callTool,
  listModelObjects,
  resolveLandscapeId,
  startTestServer,
} from "./helpers/mcp.js";

const hasCredentials = Boolean(
  (process.env.API_KEY || process.env.ICEPANEL_MCP_API_KEY) &&
    (process.env.ORGANIZATION_ID || process.env.ICEPANEL_MCP_ORGANIZATION_ID)
);
const TARGET_LANDSCAPE_NAME = process.env.ICEPANEL_MCP_TEST_LANDSCAPE_NAME;
const TARGET_LANDSCAPE_ID = process.env.ICEPANEL_MCP_TEST_LANDSCAPE_ID;

const organizationId =
  process.env.ORGANIZATION_ID || (process.env.ICEPANEL_MCP_ORGANIZATION_ID as string);

async function detectWriteAccess(): Promise<boolean> {
  const started = await startTestServer(organizationId);
  try {
    if (!TARGET_LANDSCAPE_NAME && !TARGET_LANDSCAPE_ID) {
      throw new Error(
        "Set ICEPANEL_MCP_TEST_LANDSCAPE_NAME or ICEPANEL_MCP_TEST_LANDSCAPE_ID for integration tests"
      );
    }
    const landscapeId = await resolveLandscapeId(started.baseUrl, TARGET_LANDSCAPE_NAME || "");
    const probeName = `Test MCP Write Probe ${Date.now()}`;
    const createResult = await callTool(started.baseUrl, "icepanel_create_domain", {
      landscapeId,
      name: probeName,
      color: "grey",
    });
    const domainId = (createResult.structuredContent as { domain?: { id?: string } } | undefined)?.domain
      ?.id;

    if (domainId) {
      await callTool(started.baseUrl, "icepanel_delete_domain", { landscapeId, domainId });
    }
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Authentication failed") || message.includes("Permission denied")) {
      return false;
    }
    throw error;
  } finally {
    await started.close();
  }
}

const writeEnabled = hasCredentials ? await detectWriteAccess() : false;
const integrationDescribe = writeEnabled ? describe.sequential : describe.skip;

integrationDescribe("MCP write tools (integration)", () => {
  let baseUrl = "";
  let closeServer: (() => Promise<void>) | null = null;
  let landscapeId = "";
  let cleanupConnectionId: string | null = null;
  let cleanupModelObjectIds: string[] = [];
  let cleanupTagId: string | null = null;
  let cleanupDomainId: string | null = null;

  const suffix = `mcp-${Date.now()}`;
  const tagGroupId = process.env.ICEPANEL_MCP_TAG_GROUP_ID;

  beforeAll(async () => {
    const started = await startTestServer(organizationId);
    baseUrl = started.baseUrl;
    closeServer = started.close;
    if (!TARGET_LANDSCAPE_NAME && !TARGET_LANDSCAPE_ID) {
      throw new Error(
        "Set ICEPANEL_MCP_TEST_LANDSCAPE_NAME or ICEPANEL_MCP_TEST_LANDSCAPE_ID for integration tests"
      );
    }
    landscapeId = await resolveLandscapeId(baseUrl, TARGET_LANDSCAPE_NAME || "");
  });

  afterAll(async () => {
    if (cleanupConnectionId) {
      await callTool(baseUrl, "icepanel_delete_connection", {
        landscapeId,
        connectionId: cleanupConnectionId,
      });
    }

    for (const modelObjectId of cleanupModelObjectIds) {
      await callTool(baseUrl, "icepanel_delete_model_object", {
        landscapeId,
        modelObjectId,
      });
    }

    if (cleanupTagId) {
      await callTool(baseUrl, "icepanel_delete_tag", { landscapeId, tagId: cleanupTagId });
    }

    if (cleanupDomainId) {
      await callTool(baseUrl, "icepanel_delete_domain", { landscapeId, domainId: cleanupDomainId });
    }


    if (closeServer) {
      await closeServer();
    }
  });


  const tagTest = tagGroupId ? test : test.skip;

  tagTest("create/read/delete tag", async () => {
    const createResult = await callTool(baseUrl, "icepanel_create_tag", {
      landscapeId,
      name: `Test MCP Tag ${suffix}`,
      groupId: tagGroupId as string,
      color: "green",
    });
    const tag = createResult.structuredContent as { tag?: { id?: string; name?: string } } | undefined;
    cleanupTagId = tag?.tag?.id ?? null;
    expect(cleanupTagId).toBeTruthy();

    await callTool(baseUrl, "icepanel_delete_tag", { landscapeId, tagId: cleanupTagId });
    cleanupTagId = null;
  });

  test("create/read/delete domain", async () => {
    const createResult = await callTool(baseUrl, "icepanel_create_domain", {
      landscapeId,
      name: `Test MCP Domain ${suffix}`,
      color: "purple",
    });
    const domain = createResult.structuredContent as {
      domain?: { id?: string; name?: string };
    } | undefined;
    cleanupDomainId = domain?.domain?.id ?? null;
    expect(cleanupDomainId).toBeTruthy();

    await callTool(baseUrl, "icepanel_delete_domain", { landscapeId, domainId: cleanupDomainId });
    cleanupDomainId = null;
  });

  test("create/read/delete model object", async () => {
    const existingObjects = await listModelObjects(baseUrl, landscapeId, 50);
    const parent = existingObjects.find((obj) => obj.type === "app");
    const parentId = parent?.id;
    if (!parentId) {
      throw new Error("No app model objects found to use as parentId");
    }

    const createResult = await callTool(baseUrl, "icepanel_create_model_object", {
      landscapeId,
      name: `Test MCP Object ${suffix}`,
      type: "component",
      parentId,
      status: "live",
      external: false,
    });
    const modelObject = createResult.structuredContent as {
      modelObject?: { id?: string; name?: string };
    } | undefined;
    const modelObjectId = modelObject?.modelObject?.id ?? null;
    expect(modelObjectId).toBeTruthy();
    if (modelObjectId) {
      cleanupModelObjectIds.push(modelObjectId);
    }

    const getResult = await callTool(baseUrl, "icepanel_get_model_object", {
      response_format: "json",
      landscapeId,
      modelObjectId,
      includeHierarchicalInfo: false,
    });
    const getStructured = getResult.structuredContent as { modelObject?: { id?: string } } | undefined;
    expect(getStructured?.modelObject?.id).toBe(modelObjectId);

    await callTool(baseUrl, "icepanel_delete_model_object", { landscapeId, modelObjectId });
    cleanupModelObjectIds = cleanupModelObjectIds.filter((id) => id !== modelObjectId);
  });

  test("create/read/delete connection", async () => {
    const existingObjects = await listModelObjects(baseUrl, landscapeId, 50);
    const parent = existingObjects.find((obj) => obj.type === "app");
    const parentId = parent?.id;
    if (!parentId) {
      throw new Error("No app model objects found to use as parentId");
    }

    const createOrigin = await callTool(baseUrl, "icepanel_create_model_object", {
      landscapeId,
      name: `Test MCP Origin ${suffix}`,
      type: "component",
      parentId,
      status: "live",
      external: false,
    });
    const createTarget = await callTool(baseUrl, "icepanel_create_model_object", {
      landscapeId,
      name: `Test MCP Target ${suffix}`,
      type: "component",
      parentId,
      status: "live",
      external: false,
    });

    const originId = (createOrigin.structuredContent as { modelObject?: { id?: string } } | undefined)?.modelObject
      ?.id;
    const targetId = (createTarget.structuredContent as { modelObject?: { id?: string } } | undefined)?.modelObject
      ?.id;

    if (!originId || !targetId) {
      throw new Error("Failed to create model objects for connection test");
    }

    cleanupModelObjectIds.push(originId, targetId);

    const createConnectionResult = await callTool(baseUrl, "icepanel_create_connection", {
      landscapeId,
      name: `Test MCP Connection ${suffix}`,
      originId,
      targetId,
      direction: "outgoing",
      status: "live",
    });
    const connection = createConnectionResult.structuredContent as {
      connection?: { id?: string };
    } | undefined;
    cleanupConnectionId = connection?.connection?.id ?? null;
    expect(cleanupConnectionId).toBeTruthy();

    const getConnections = await callTool(baseUrl, "icepanel_get_model_object_connections", {
      response_format: "json",
      landscapeId,
      modelObjectId: originId,
    });
    const structured = getConnections.structuredContent as {
      outgoingConnections?: { id?: string }[];
    } | undefined;
    const connectionIds = structured?.outgoingConnections?.map((c) => c.id) || [];
    expect(connectionIds).toContain(cleanupConnectionId);

    await callTool(baseUrl, "icepanel_delete_connection", {
      landscapeId,
      connectionId: cleanupConnectionId,
    });
    cleanupConnectionId = null;

    await callTool(baseUrl, "icepanel_delete_model_object", { landscapeId, modelObjectId: originId });
    await callTool(baseUrl, "icepanel_delete_model_object", { landscapeId, modelObjectId: targetId });
    cleanupModelObjectIds = cleanupModelObjectIds.filter((id) => id !== originId && id !== targetId);
  });
});
