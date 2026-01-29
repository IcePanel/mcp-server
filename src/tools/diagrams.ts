import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import Fuse from "fuse.js";
import {
  getDiagram,
  getDiagramThumbnail,
  getDiagramThumbnails,
  getDiagrams,
  handleApiError,
} from "../services/icepanel-client.js";
import { IcePanelIdSchema, PaginationSchema, ResponseFormatSchema } from "../schemas/index.js";
import { applyCharacterLimit, formatOutput, paginateArray } from "./utils.js";

const ListDiagramsSchema = PaginationSchema.extend({
  landscapeId: IcePanelIdSchema,
  search: z.string().optional(),
  response_format: ResponseFormatSchema,
}).strict();

const GetDiagramSchema = z
  .object({
    landscapeId: IcePanelIdSchema,
    diagramId: IcePanelIdSchema,
    response_format: ResponseFormatSchema,
  })
  .strict();

const ListDiagramThumbnailsSchema = PaginationSchema.extend({
  landscapeId: IcePanelIdSchema,
  response_format: ResponseFormatSchema,
}).strict();

const GetDiagramThumbnailSchema = z
  .object({
    landscapeId: IcePanelIdSchema,
    diagramId: IcePanelIdSchema,
    response_format: ResponseFormatSchema,
  })
  .strict();

function formatDiagramItem(diagram: { id?: string; name?: string; type?: string; status?: string }) {
  const name = diagram.name ?? "Untitled diagram";
  const id = diagram.id ?? "unknown";
  const type = diagram.type ? `\n- Type: ${diagram.type}` : "";
  const status = diagram.status ? `\n- Status: ${diagram.status}` : "";
  return `# ${name}\n- ID: ${id}${type}${status}`;
}

function formatDiagramThumbnailItem(thumbnail: { id?: string; diagramId?: string; url?: string }) {
  const id = thumbnail.id ?? "unknown";
  const diagramId = thumbnail.diagramId ? `\n- Diagram ID: ${thumbnail.diagramId}` : "";
  const url = thumbnail.url ? `\n- URL: ${thumbnail.url}` : "";
  return `# Diagram Thumbnail\n- ID: ${id}${diagramId}${url}`;
}

export function registerDiagramTools(server: McpServer) {
  server.registerTool(
    "icepanel_list_diagrams",
    {
      title: "List IcePanel Diagrams",
      description: `Get diagrams in an IcePanel landscape.

Args:
  - landscapeId (string): Landscape ID (20 characters)
  - limit (number): Max results to return (default: 50)
  - offset (number): Number of results to skip (default: 0)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Paginated list of diagrams with IDs and basic metadata.`,
      inputSchema: ListDiagramsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ landscapeId, search, limit, offset, response_format }) => {
      try {
        const result = await getDiagrams(landscapeId);
        let diagrams = result.diagrams ?? [];
        if (search) {
          const fuse = new Fuse(diagrams, { keys: ["name", "description"], threshold: 0.3 });
          diagrams = fuse.search(search).map((item) => item.item);
        }

        const paged = paginateArray(diagrams, offset, limit);
        const { output, rendered } = applyCharacterLimit(
          { ...paged },
          response_format,
          (current) => current.items.map((item) => formatDiagramItem(item as Record<string, any>)).join("\n\n")
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
    "icepanel_get_diagram",
    {
      title: "Get IcePanel Diagram",
      description: `Get a single diagram by ID.`,
      inputSchema: GetDiagramSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ landscapeId, diagramId, response_format }) => {
      try {
        const result = await getDiagram(landscapeId, diagramId);
        const diagram = result.diagram;
        const markdown = formatDiagramItem(diagram);
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
    "icepanel_list_diagram_thumbnails",
    {
      title: "List IcePanel Diagram Thumbnails",
      description: `List diagram thumbnails in an IcePanel landscape.`,
      inputSchema: ListDiagramThumbnailsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ landscapeId, limit, offset, response_format }) => {
      try {
        const result = await getDiagramThumbnails(landscapeId);
        const thumbnails = result.thumbnails ?? [];
        const paged = paginateArray(thumbnails, offset, limit);
        const { output, rendered } = applyCharacterLimit(
          { ...paged },
          response_format,
          (current) =>
            current.items.map((item) => formatDiagramThumbnailItem(item as Record<string, any>)).join("\n\n")
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
    "icepanel_get_diagram_thumbnail",
    {
      title: "Get IcePanel Diagram Thumbnail",
      description: `Get a diagram thumbnail by diagram ID.`,
      inputSchema: GetDiagramThumbnailSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ landscapeId, diagramId, response_format }) => {
      try {
        const result = await getDiagramThumbnail(landscapeId, diagramId);
        const markdown = formatDiagramThumbnailItem(result.thumbnail);
        return {
          content: [{ type: "text", text: formatOutput(response_format, markdown, result) }],
          structuredContent: result,
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );
}
