import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import Fuse from "fuse.js";
import {
  createDomain,
  deleteDomain,
  getDomain,
  getDomains,
  handleApiError,
  updateDomain,
} from "../services/icepanel-client.js";
import { ColorSchema, IcePanelIdSchema, PaginationSchema, ResponseFormatSchema } from "../schemas/index.js";
import { applyCharacterLimit, formatOutput, paginateArray } from "./utils.js";

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

const ListDomainsSchema = PaginationSchema.extend({
  landscapeId: IcePanelIdSchema,
  search: z.string().optional(),
  response_format: ResponseFormatSchema,
}).strict();

const GetDomainSchema = z
  .object({
    landscapeId: IcePanelIdSchema,
    domainId: IcePanelIdSchema,
    response_format: ResponseFormatSchema,
  })
  .strict();

function formatDomainItem(domain: { id?: string; name?: string; color?: string }) {
  const name = domain.name ?? "Untitled domain";
  const id = domain.id ?? "unknown";
  const color = domain.color ? `\n- Color: ${domain.color}` : "";
  return `# ${name}\n- ID: ${id}${color}`;
}

export function registerDomainTools(server: McpServer) {
  server.registerTool(
    "icepanel_list_domains",
    {
      title: "List IcePanel Domains",
      description: `Get domains in an IcePanel landscape.

Args:
  - landscapeId (string): Landscape ID (20 characters)
  - limit (number): Max results to return (default: 50)
  - offset (number): Number of results to skip (default: 0)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Paginated list of domains with IDs and names.`,
      inputSchema: ListDomainsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ landscapeId, search, limit, offset, response_format }) => {
      try {
        const result = await getDomains(landscapeId);
        let domains = result.domains ?? [];
        if (search) {
          const fuse = new Fuse(domains, { keys: ["name"], threshold: 0.3 });
          domains = fuse.search(search).map((item) => item.item);
        }

        const paged = paginateArray(domains, offset, limit);
        const { output, rendered } = applyCharacterLimit(
          { ...paged },
          response_format,
          (current) => current.items.map((item) => formatDomainItem(item as Record<string, any>)).join("\n\n")
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
    "icepanel_get_domain",
    {
      title: "Get IcePanel Domain",
      description: `Get a single domain by ID.`,
      inputSchema: GetDomainSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ landscapeId, domainId, response_format }) => {
      try {
        const result = await getDomain(landscapeId, domainId);
        const domain = result.domain;
        const markdown = formatDomainItem(domain);
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
