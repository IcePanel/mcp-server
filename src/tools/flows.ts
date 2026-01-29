import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import Fuse from "fuse.js";
import {
  getFlow,
  getFlowCode,
  getFlowMermaid,
  getFlowText,
  getFlowThumbnail,
  getFlowThumbnails,
  getFlows,
  handleApiError,
} from "../services/icepanel-client.js";
import { IcePanelIdSchema, PaginationSchema, ResponseFormatSchema } from "../schemas/index.js";
import { applyCharacterLimit, formatOutput, paginateArray } from "./utils.js";

const ListFlowsSchema = PaginationSchema.extend({
  landscapeId: IcePanelIdSchema,
  search: z.string().optional(),
  response_format: ResponseFormatSchema,
}).strict();

const GetFlowSchema = z
  .object({
    landscapeId: IcePanelIdSchema,
    flowId: IcePanelIdSchema,
    response_format: ResponseFormatSchema,
  })
  .strict();

const ListFlowThumbnailsSchema = PaginationSchema.extend({
  landscapeId: IcePanelIdSchema,
  response_format: ResponseFormatSchema,
}).strict();

const GetFlowThumbnailSchema = z
  .object({
    landscapeId: IcePanelIdSchema,
    flowId: IcePanelIdSchema,
    response_format: ResponseFormatSchema,
  })
  .strict();

const GetFlowExportSchema = z
  .object({
    landscapeId: IcePanelIdSchema,
    flowId: IcePanelIdSchema,
    response_format: ResponseFormatSchema,
  })
  .strict();

function formatFlowItem(flow: { id?: string; name?: string; status?: string }) {
  const name = flow.name ?? "Untitled flow";
  const id = flow.id ?? "unknown";
  const status = flow.status ? `\n- Status: ${flow.status}` : "";
  return `# ${name}\n- ID: ${id}${status}`;
}

function formatFlowThumbnailItem(thumbnail: { id?: string; flowId?: string; url?: string }) {
  const id = thumbnail.id ?? "unknown";
  const flowId = thumbnail.flowId ? `\n- Flow ID: ${thumbnail.flowId}` : "";
  const url = thumbnail.url ? `\n- URL: ${thumbnail.url}` : "";
  return `# Flow Thumbnail\n- ID: ${id}${flowId}${url}`;
}

export function registerFlowTools(server: McpServer) {
  server.registerTool(
    "icepanel_list_flows",
    {
      title: "List IcePanel Flows",
      description: `Get flows in an IcePanel landscape.

Args:
  - landscapeId (string): Landscape ID (20 characters)
  - limit (number): Max results to return (default: 50)
  - offset (number): Number of results to skip (default: 0)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Paginated list of flows with IDs and names.`,
      inputSchema: ListFlowsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ landscapeId, search, limit, offset, response_format }) => {
      try {
        const result = await getFlows(landscapeId);
        let flows = result.flows ?? [];
        if (search) {
          const fuse = new Fuse(flows, { keys: ["name", "description"], threshold: 0.3 });
          flows = fuse.search(search).map((item) => item.item);
        }

        const paged = paginateArray(flows, offset, limit);
        const { output, rendered } = applyCharacterLimit(
          { ...paged },
          response_format,
          (current) => current.items.map((item) => formatFlowItem(item as Record<string, any>)).join("\n\n")
        );

        return {
          content: [{ type: "text", text: rendered }],
          structuredContent: output,
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "icepanel_get_flow",
    {
      title: "Get IcePanel Flow",
      description: `Get a single flow by ID.`,
      inputSchema: GetFlowSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ landscapeId, flowId, response_format }) => {
      try {
        const result = await getFlow(landscapeId, flowId);
        const flow = result.flow;
        const markdown = formatFlowItem(flow);
        return {
          content: [{ type: "text", text: formatOutput(response_format, markdown, result) }],
          structuredContent: result,
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "icepanel_list_flow_thumbnails",
    {
      title: "List IcePanel Flow Thumbnails",
      description: `List flow thumbnails in an IcePanel landscape.`,
      inputSchema: ListFlowThumbnailsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ landscapeId, limit, offset, response_format }) => {
      try {
        const result = await getFlowThumbnails(landscapeId);
        const thumbnails = result.thumbnails ?? [];
        const paged = paginateArray(thumbnails, offset, limit);
        const { output, rendered } = applyCharacterLimit(
          { ...paged },
          response_format,
          (current) =>
            current.items.map((item) => formatFlowThumbnailItem(item as Record<string, any>)).join("\n\n")
        );

        return {
          content: [{ type: "text", text: rendered }],
          structuredContent: output,
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "icepanel_get_flow_thumbnail",
    {
      title: "Get IcePanel Flow Thumbnail",
      description: `Get a flow thumbnail by flow ID.`,
      inputSchema: GetFlowThumbnailSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ landscapeId, flowId, response_format }) => {
      try {
        const result = await getFlowThumbnail(landscapeId, flowId);
        const markdown = formatFlowThumbnailItem(result.thumbnail);
        return {
          content: [{ type: "text", text: formatOutput(response_format, markdown, result) }],
          structuredContent: result,
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "icepanel_get_flow_text",
    {
      title: "Get IcePanel Flow Text",
      description: `Export a flow as plain text.`,
      inputSchema: GetFlowExportSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ landscapeId, flowId, response_format }) => {
      try {
        const text = await getFlowText(landscapeId, flowId);
        const structured = { text };
        return {
          content: [{ type: "text", text: formatOutput(response_format, text, structured) }],
          structuredContent: structured,
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "icepanel_get_flow_code",
    {
      title: "Get IcePanel Flow Code",
      description: `Export a flow as code.`,
      inputSchema: GetFlowExportSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ landscapeId, flowId, response_format }) => {
      try {
        const code = await getFlowCode(landscapeId, flowId);
        const structured = { code };
        return {
          content: [{ type: "text", text: formatOutput(response_format, code, structured) }],
          structuredContent: structured,
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "icepanel_get_flow_mermaid",
    {
      title: "Get IcePanel Flow Mermaid",
      description: `Export a flow as Mermaid.`,
      inputSchema: GetFlowExportSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ landscapeId, flowId, response_format }) => {
      try {
        const mermaid = await getFlowMermaid(landscapeId, flowId);
        const structured = { mermaid };
        return {
          content: [{ type: "text", text: formatOutput(response_format, mermaid, structured) }],
          structuredContent: structured,
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );
}
