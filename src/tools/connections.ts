import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  createConnection,
  deleteConnection,
  getConnection,
  handleApiError,
  updateConnection,
} from "../services/icepanel-client.js";
import { ConnectionDirectionSchema, IcePanelIdSchema, StatusSchema } from "../schemas/index.js";

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

export function registerConnectionTools(server: McpServer) {
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
