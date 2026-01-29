import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createTag, deleteTag, handleApiError, updateTag } from "../services/icepanel-client.js";
import { ColorSchema, IcePanelIdSchema } from "../schemas/index.js";

const CreateTagSchema = z
  .object({
    landscapeId: IcePanelIdSchema,
    name: z.string().min(1).max(255),
    groupId: IcePanelIdSchema,
    color: ColorSchema.optional(),
  })
  .strict();

const UpdateTagSchema = z
  .object({
    landscapeId: IcePanelIdSchema,
    tagId: IcePanelIdSchema,
    name: z.string().min(1).max(255).optional(),
    color: ColorSchema.optional(),
  })
  .strict();

const DeleteTagSchema = z
  .object({
    landscapeId: IcePanelIdSchema,
    tagId: IcePanelIdSchema,
  })
  .strict();

export function registerTagTools(server: McpServer) {
  server.registerTool(
    "icepanel_create_tag",
    {
      title: "Create IcePanel Tag",
      description: `Create a new tag in an IcePanel landscape.`,
      inputSchema: CreateTagSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ landscapeId, ...data }) => {
      try {
        const result = await createTag(landscapeId, data);
        return {
          content: [
            { type: "text", text: `# Tag Created\n\n- ID: ${result.tag.id}\n- Name: ${result.tag.name}` },
          ],
          structuredContent: { tag: result.tag },
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "icepanel_update_tag",
    {
      title: "Update IcePanel Tag",
      description: `Update an existing tag in IcePanel.`,
      inputSchema: UpdateTagSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ landscapeId, tagId, ...data }) => {
      try {
        const updateData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
        const result = await updateTag(landscapeId, tagId, updateData);
        return {
          content: [
            { type: "text", text: `# Tag Updated\n\n- ID: ${result.tag.id}\n- Name: ${result.tag.name}` },
          ],
          structuredContent: { tag: result.tag },
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "icepanel_delete_tag",
    {
      title: "Delete IcePanel Tag",
      description: `Delete a tag from IcePanel. WARNING: This action cannot be undone.`,
      inputSchema: DeleteTagSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ landscapeId, tagId }) => {
      try {
        await deleteTag(landscapeId, tagId);
        return {
          content: [{ type: "text", text: `# Tag Deleted\n\nDeleted tag (ID: ${tagId}).` }],
          structuredContent: { deleted: { id: tagId } },
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );
}
