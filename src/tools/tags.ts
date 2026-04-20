import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import Fuse from "fuse.js";
import {
  createTag,
  deleteTag,
  getTag,
  getTagGroups,
  getTags,
  getTagGroup,
  handleApiError,
  updateTag,
} from "../services/icepanel-client.js";
import { ColorSchema, IcePanelIdSchema, PaginationSchema, ResponseFormatSchema } from "../schemas/index.js";
import { applyCharacterLimit, formatOutput, paginateArray } from "./utils.js";

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

const ListTagsSchema = PaginationSchema.extend({
  landscapeId: IcePanelIdSchema,
  search: z.string().optional(),
  response_format: ResponseFormatSchema,
}).strict();

const GetTagSchema = z
  .object({
    landscapeId: IcePanelIdSchema,
    tagId: IcePanelIdSchema,
    response_format: ResponseFormatSchema,
  })
  .strict();

const ListTagGroupsSchema = PaginationSchema.extend({
  landscapeId: IcePanelIdSchema,
  search: z.string().optional(),
  response_format: ResponseFormatSchema,
}).strict();

const GetTagGroupSchema = z
  .object({
    landscapeId: IcePanelIdSchema,
    tagGroupId: IcePanelIdSchema,
    response_format: ResponseFormatSchema,
  })
  .strict();

function formatTagItem(tag: { id?: string; name?: string; color?: string }) {
  const name = tag.name ?? "Untitled tag";
  const id = tag.id ?? "unknown";
  const color = tag.color ? `\n- Color: ${tag.color}` : "";
  return `# ${name}\n- ID: ${id}${color}`;
}

function formatTagGroupItem(tagGroup: { id?: string; name?: string; color?: string }) {
  const name = tagGroup.name ?? "Untitled tag group";
  const id = tagGroup.id ?? "unknown";
  const color = tagGroup.color ? `\n- Color: ${tagGroup.color}` : "";
  return `# ${name}\n- ID: ${id}${color}`;
}

export function registerTagTools(server: McpServer) {
  server.registerTool(
    "icepanel_list_tags",
    {
      title: "List IcePanel Tags",
      description: `Get tags in an IcePanel landscape.

Args:
  - landscapeId (string): Landscape ID (20 characters)
  - limit (number): Max results to return (default: 50)
  - offset (number): Number of results to skip (default: 0)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Paginated list of tags with IDs and names.`,
      inputSchema: ListTagsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ landscapeId, search, limit, offset, response_format }) => {
      try {
        const result = await getTags(landscapeId);
        let tags = result.tags ?? [];
        if (search) {
          const fuse = new Fuse(tags, { keys: ["name"], threshold: 0.3 });
          tags = fuse.search(search).map((item) => item.item);
        }

        const paged = paginateArray(tags, offset, limit);
        const { output, rendered } = applyCharacterLimit(
          { ...paged },
          response_format,
          (current) => current.items.map((item) => formatTagItem(item as Record<string, any>)).join("\n\n")
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
    "icepanel_get_tag",
    {
      title: "Get IcePanel Tag",
      description: `Get a single tag by ID.`,
      inputSchema: GetTagSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ landscapeId, tagId, response_format }) => {
      try {
        const result = await getTag(landscapeId, tagId);
        const tag = result.tag;
        const markdown = formatTagItem(tag);
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
    "icepanel_list_tag_groups",
    {
      title: "List IcePanel Tag Groups",
      description: `Get tag groups in an IcePanel landscape.

Args:
  - landscapeId (string): Landscape ID (20 characters)
  - limit (number): Max results to return (default: 50)
  - offset (number): Number of results to skip (default: 0)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Paginated list of tag groups with IDs and names.`,
      inputSchema: ListTagGroupsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ landscapeId, search, limit, offset, response_format }) => {
      try {
        const result = await getTagGroups(landscapeId);
        let tagGroups = result.tagGroups ?? [];
        if (search) {
          const fuse = new Fuse(tagGroups, { keys: ["name"], threshold: 0.3 });
          tagGroups = fuse.search(search).map((item) => item.item);
        }

        const paged = paginateArray(tagGroups, offset, limit);
        const { output, rendered } = applyCharacterLimit(
          { ...paged },
          response_format,
          (current) => current.items.map((item) => formatTagGroupItem(item as Record<string, any>)).join("\n\n")
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
    "icepanel_get_tag_group",
    {
      title: "Get IcePanel Tag Group",
      description: `Get a single tag group by ID.`,
      inputSchema: GetTagGroupSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ landscapeId, tagGroupId, response_format }) => {
      try {
        const result = await getTagGroup(landscapeId, tagGroupId);
        const tagGroup = result.tagGroup;
        const markdown = formatTagGroupItem(tagGroup);
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
