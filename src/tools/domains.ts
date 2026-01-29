import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createDomain, deleteDomain, handleApiError, updateDomain } from "../services/icepanel-client.js";
import { ColorSchema, IcePanelIdSchema } from "../schemas/index.js";

const CreateDomainSchema = z
  .object({
    landscapeId: IcePanelIdSchema,
    name: z.string().min(1).max(255),
    color: ColorSchema.optional(),
  })
  .strict();

const UpdateDomainSchema = z
  .object({
    landscapeId: IcePanelIdSchema,
    domainId: IcePanelIdSchema,
    name: z.string().min(1).max(255).optional(),
    color: ColorSchema.optional(),
  })
  .strict();

const DeleteDomainSchema = z
  .object({
    landscapeId: IcePanelIdSchema,
    domainId: IcePanelIdSchema,
  })
  .strict();

export function registerDomainTools(server: McpServer) {
  server.registerTool(
    "icepanel_create_domain",
    {
      title: "Create IcePanel Domain",
      description: `Create a new domain in an IcePanel landscape. Domains organize model objects into logical groupings.`,
      inputSchema: CreateDomainSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ landscapeId, ...data }) => {
      try {
        const result = await createDomain(landscapeId, data);
        return {
          content: [
            {
              type: "text",
              text: `# Domain Created\n\n- ID: ${result.domain.id}\n- Name: ${result.domain.name}`,
            },
          ],
          structuredContent: { domain: result.domain },
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "icepanel_update_domain",
    {
      title: "Update IcePanel Domain",
      description: `Update an existing domain in IcePanel.`,
      inputSchema: UpdateDomainSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ landscapeId, domainId, ...data }) => {
      try {
        const updateData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
        const result = await updateDomain(landscapeId, domainId, updateData);
        return {
          content: [
            {
              type: "text",
              text: `# Domain Updated\n\n- ID: ${result.domain.id}\n- Name: ${result.domain.name}`,
            },
          ],
          structuredContent: { domain: result.domain },
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "icepanel_delete_domain",
    {
      title: "Delete IcePanel Domain",
      description: `Delete a domain from IcePanel. WARNING: This action cannot be undone.`,
      inputSchema: DeleteDomainSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ landscapeId, domainId }) => {
      try {
        await deleteDomain(landscapeId, domainId);
        return {
          content: [{ type: "text", text: `# Domain Deleted\n\nDeleted domain (ID: ${domainId}).` }],
          structuredContent: { deleted: { id: domainId } },
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );
}
