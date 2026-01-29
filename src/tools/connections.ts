import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import Fuse from "fuse.js";
import {
  createConnection,
  deleteConnection,
  getConnection,
  getModelConnectionsCsv,
  getModelConnections,
  handleApiError,
  updateConnection,
} from "../services/icepanel-client.js";
import {
  ConnectionDirectionSchema,
  IcePanelIdSchema,
  PaginationSchema,
  ResponseFormatSchema,
  StatusSchema,
} from "../schemas/index.js";
import { applyCharacterLimit, formatOutput, paginateArray } from "./utils.js";

const CreateConnectionSchema = z
  .object({
    landscapeId: IcePanelIdSchema,
    name: z.string().min(1).max(255),
    originId: IcePanelIdSchema,
    targetId: IcePanelIdSchema,
    direction: ConnectionDirectionSchema,
    description: z.string().optional(),
    status: StatusSchema.default("live"),
  })
  .strict();

const UpdateConnectionSchema = z
  .object({
    landscapeId: IcePanelIdSchema,
    connectionId: IcePanelIdSchema,
    name: z.string().min(1).max(255).optional(),
    direction: ConnectionDirectionSchema.optional(),
    description: z.string().optional(),
    status: StatusSchema.optional(),
  })
  .strict();

const DeleteConnectionSchema = z
  .object({
    landscapeId: IcePanelIdSchema,
    connectionId: IcePanelIdSchema,
  })
  .strict();

const IdOrIdsSchema = z.union([IcePanelIdSchema, z.array(IcePanelIdSchema)]);

const ListConnectionsSchema = PaginationSchema.extend({
  landscapeId: IcePanelIdSchema,
  direction: ConnectionDirectionSchema.optional(),
  originId: IdOrIdsSchema.optional(),
  targetId: IdOrIdsSchema.optional(),
  status: z.union([StatusSchema, z.array(StatusSchema)]).optional(),
  name: z.string().optional(),
  handleId: z.string().optional(),
  search: z.string().optional(),
  response_format: ResponseFormatSchema,
}).strict();

const GetConnectionSchema = z
  .object({
    landscapeId: IcePanelIdSchema,
    connectionId: IcePanelIdSchema,
    response_format: ResponseFormatSchema,
  })
  .strict();

const GetConnectionsCsvSchema = z
  .object({
    landscapeId: IcePanelIdSchema,
    response_format: ResponseFormatSchema,
  })
  .strict();

function formatConnectionItem(connection: {
  id?: string;
  name?: string;
  status?: string;
  direction?: string | null;
  originId?: string;
  targetId?: string;
}) {
  const name = connection.name ?? "Untitled connection";
  const id = connection.id ?? "unknown";
  const status = connection.status ? `\n- Status: ${connection.status}` : "";
  const direction = connection.direction ? `\n- Direction: ${connection.direction}` : "";
  const origin = connection.originId ? `\n- Origin ID: ${connection.originId}` : "";
  const target = connection.targetId ? `\n- Target ID: ${connection.targetId}` : "";
  return `# ${name}\n- ID: ${id}${status}${direction}${origin}${target}`;
}

export function registerConnectionTools(server: McpServer) {
  server.registerTool(
    "icepanel_list_connections",
    {
      title: "List IcePanel Connections",
      description: `Get connections between model objects in a landscape.

Args:
  - landscapeId (string): Landscape ID (20 characters)
  - limit (number): Max results to return (default: 50)
  - offset (number): Number of results to skip (default: 0)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Paginated list of connections with IDs and basic metadata.`,
      inputSchema: ListConnectionsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ landscapeId, search, limit, offset, response_format, ...filters }) => {
      try {
        const result = await getModelConnections(landscapeId, "latest", { filter: filters });
        let connections = result.modelConnections ?? [];
        if (search) {
          const fuse = new Fuse(connections, { keys: ["name", "description"], threshold: 0.3 });
          connections = fuse.search(search).map((item) => item.item);
        }

        const paged = paginateArray(connections, offset, limit);
        const { output, rendered } = applyCharacterLimit(
          { ...paged },
          response_format,
          (current) => current.items.map((item) => formatConnectionItem(item as Record<string, any>)).join("\n\n")
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
    "icepanel_get_connection",
    {
      title: "Get IcePanel Connection",
      description: `Get a single connection by ID.`,
      inputSchema: GetConnectionSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ landscapeId, connectionId, response_format }) => {
      try {
        const result = await getConnection(landscapeId, "latest", connectionId);
        const connection = result.modelConnection;
        const markdown = formatConnectionItem(connection);
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
    "icepanel_get_model_connections_csv",
    {
      title: "Get IcePanel Connections CSV",
      description: `Export model connections as CSV.`,
      inputSchema: GetConnectionsCsvSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ landscapeId, response_format }) => {
      try {
        const csv = await getModelConnectionsCsv(landscapeId);
        const structured = { csv };
        return {
          content: [{ type: "text", text: formatOutput(response_format, csv, structured) }],
          structuredContent: structured,
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "icepanel_create_connection",
    {
      title: "Create IcePanel Connection",
      description: `Create a new connection between model objects in IcePanel.`,
      inputSchema: CreateConnectionSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ landscapeId, ...data }) => {
      try {
        const result = await createConnection(landscapeId, data);
        const conn = result.modelConnection;
        return {
          content: [
            {
              type: "text",
              text: `# Connection Created\n\n- ID: ${conn.id}\n- Name: ${conn.name}\n- Status: ${conn.status}`,
            },
          ],
          structuredContent: { connection: conn },
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "icepanel_update_connection",
    {
      title: "Update IcePanel Connection",
      description: `Update an existing connection in IcePanel. Only provided fields will be updated.`,
      inputSchema: UpdateConnectionSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ landscapeId, connectionId, ...data }) => {
      try {
        const updateData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
        const result = await updateConnection(landscapeId, connectionId, updateData);
        return {
          content: [
            {
              type: "text",
              text: `# Connection Updated\n\n- ID: ${result.modelConnection.id}\n- Name: ${result.modelConnection.name}`,
            },
          ],
          structuredContent: { connection: result.modelConnection },
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "icepanel_delete_connection",
    {
      title: "Delete IcePanel Connection",
      description: `Delete a connection from IcePanel. WARNING: This action cannot be undone.`,
      inputSchema: DeleteConnectionSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ landscapeId, connectionId }) => {
      try {
        const existing = await getConnection(landscapeId, "latest", connectionId);
        await deleteConnection(landscapeId, connectionId);
        return {
          content: [
            {
              type: "text",
              text: `# Connection Deleted\n\nDeleted "${existing.modelConnection.name}" (ID: ${connectionId}).`,
            },
          ],
          structuredContent: { deleted: { id: connectionId, name: existing.modelConnection.name } },
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );
}
