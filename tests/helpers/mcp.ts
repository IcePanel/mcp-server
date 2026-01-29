import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { startHttpServer } from "../../src/transports/http-server.js";
import { registerAllTools } from "../../src/tools/index.js";

type McpResult = {
  content: { type: string; text?: string }[];
  structuredContent?: unknown;
  isError?: boolean;
};

type McpResponse = {
  jsonrpc: string;
  id: number | string | null;
  result?: McpResult;
  error?: { code: number; message: string; data?: unknown };
};

export async function callTool(baseUrl: string, name: string, args: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });

  const payload = (await response.json()) as McpResponse;

  if (payload.error) {
    throw new Error(`MCP error ${payload.error.code}: ${payload.error.message}`);
  }
  if (!payload.result) {
    throw new Error("Missing MCP result");
  }

  if (payload.result.isError) {
    const message = payload.result.content?.[0]?.text || "Unknown MCP tool error";
    throw new Error(message);
  }

  return payload.result;
}

function ensureTestEnv() {
  if (process.env.ICEPANEL_MCP_API_KEY) {
    process.env.API_KEY = process.env.ICEPANEL_MCP_API_KEY;
  }
  if (process.env.ICEPANEL_MCP_ORGANIZATION_ID) {
    process.env.ORGANIZATION_ID = process.env.ICEPANEL_MCP_ORGANIZATION_ID;
  }

  if (!process.env.API_KEY) {
    throw new Error("Missing API_KEY (or ICEPANEL_MCP_API_KEY) for integration tests");
  }
  if (!process.env.ORGANIZATION_ID) {
    throw new Error("Missing ORGANIZATION_ID (or ICEPANEL_MCP_ORGANIZATION_ID) for integration tests");
  }
}

export async function startTestServer(organizationId: string) {
  ensureTestEnv();
  const server = new McpServer({ name: "icepanel-mcp-server-test", version: "test" });
  registerAllTools(server, organizationId);

  const started = await startHttpServer(server, 0, { enableShutdownHandlers: false });
  const baseUrl = `http://localhost:${started.port}`;

  return {
    baseUrl,
    close: started.close,
  };
}

function normalizeLandscapeName(name: string): string {
  return name.trim().toLowerCase().replace(/[’]/g, "'");
}

export async function resolveLandscapeId(baseUrl: string, landscapeName: string): Promise<string> {
  if (process.env.ICEPANEL_MCP_TEST_LANDSCAPE_ID) {
    return process.env.ICEPANEL_MCP_TEST_LANDSCAPE_ID;
  }

  const listResult = await callTool(baseUrl, "icepanel_list_landscapes", {
    response_format: "json",
    limit: 100,
    offset: 0,
  });
  const structured = listResult.structuredContent as { items?: { id?: string; name?: string }[] } | undefined;
  if (!structured?.items) {
    const text = listResult.content?.[0]?.text || "No content returned";
    throw new Error(`List landscapes failed: ${text}`);
  }
  const target = normalizeLandscapeName(landscapeName);
  const match = structured?.items?.find((item) => normalizeLandscapeName(item.name || "") === target);
  if (!match?.id) {
    const names = structured?.items?.map((item) => item.name).filter(Boolean).join(", ") || "none";
    throw new Error(`Landscape "${landscapeName}" not found. Available: ${names}`);
  }
  return match.id;
}

export function normalizeNameForTest(name: string): string {
  return normalizeLandscapeName(name);
}

export async function getModelObjectIds(
  baseUrl: string,
  landscapeId: string,
  limit: number = 2
): Promise<string[]> {
  const modelObjectsResult = await callTool(baseUrl, "icepanel_list_model_objects", {
    response_format: "json",
    landscapeId,
    limit,
    offset: 0,
  });
  const structured = modelObjectsResult.structuredContent as { items?: { id?: string }[] } | undefined;
  return (structured?.items || [])
    .map((item) => item.id)
    .filter((id): id is string => Boolean(id));
}

export async function listModelObjects(
  baseUrl: string,
  landscapeId: string,
  limit: number = 50
): Promise<{ id?: string; type?: string }[]> {
  const modelObjectsResult = await callTool(baseUrl, "icepanel_list_model_objects", {
    response_format: "json",
    landscapeId,
    limit,
    offset: 0,
  });
  const structured = modelObjectsResult.structuredContent as { items?: { id?: string; type?: string }[] } | undefined;
  return structured?.items || [];
}
