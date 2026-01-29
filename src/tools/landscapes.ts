import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { handleApiError, getLandscape, getLandscapes } from "../services/icepanel-client.js";
import { ResponseFormatSchema, PaginationSchema, IcePanelIdSchema } from "../schemas/index.js";
import { applyCharacterLimit, formatOutput, paginateArray } from "./utils.js";

const ListLandscapesSchema = PaginationSchema.extend({
  response_format: ResponseFormatSchema,
}).strict();

const GetLandscapeSchema = z
  .object({
    landscapeId: IcePanelIdSchema,
    response_format: ResponseFormatSchema,
  })
  .strict();

function formatLandscapeItem(landscape: Record<string, any>) {
  const name = landscape.name ?? "Untitled landscape";
  const id = landscape.id ?? "unknown";
  const description = landscape.description ? `\n- Description: ${landscape.description}` : "";
  return `# ${name}\n- ID: ${id}${description}`;
}

export function registerLandscapeTools(server: McpServer, organizationId: string) {
  server.registerTool(
    "icepanel_list_landscapes",
    {
      title: "List IcePanel Landscapes",
      description: `Get all landscapes in your IcePanel organization.

Args:
  - limit (number): Max results to return (default: 50)
  - offset (number): Number of results to skip (default: 0)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Paginated list of landscapes with ID, name, and description when available.
  Includes pagination metadata: total, count, has_more, next_offset.`,
      inputSchema: ListLandscapesSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ limit, offset, response_format }) => {
      try {
        const result = await getLandscapes(organizationId);
        const landscapes = Array.isArray((result as any).landscapes)
          ? (result as any).landscapes
          : Array.isArray(result)
          ? result
          : [];

        const paged = paginateArray(landscapes, offset, limit);
        const { output, rendered } = applyCharacterLimit(
          { ...paged },
          response_format,
          (current) => current.items.map((item) => formatLandscapeItem(item as Record<string, any>)).join("\n\n")
        );

        return {
          content: [{ type: "text", text: rendered }],
          structuredContent: output,
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: handleApiError(error) }],
        };
      }
    }
  );

  server.registerTool(
    "icepanel_get_landscape",
    {
      title: "Get IcePanel Landscape",
      description: `Get details for a single IcePanel landscape by ID.

Args:
  - landscapeId (string): Landscape ID (20 characters)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Landscape details including ID, name, and metadata.`,
      inputSchema: GetLandscapeSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ landscapeId, response_format }) => {
      try {
        const result = await getLandscape(organizationId, landscapeId);
        const markdown = formatLandscapeItem(result as Record<string, any>);
        return {
          content: [{ type: "text", text: formatOutput(response_format, markdown, result) }],
          structuredContent: result,
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: handleApiError(error) }],
        };
      }
    }
  );
}
