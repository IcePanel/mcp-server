import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import Fuse from "fuse.js";
import {
  getCatalogTechnologies,
  getOrganizationTechnologies,
  handleApiError,
} from "../services/icepanel-client.js";
import { formatCatalogTechnology } from "../services/formatters.js";
import {
  CatalogProviderSchema,
  CatalogRestrictionSchema,
  CatalogTechnologyTypeSchema,
  PaginationSchema,
  ResponseFormatSchema,
} from "../schemas/index.js";
import { applyCharacterLimit, paginateArray } from "./utils.js";

const ProviderOrArraySchema = z.union([CatalogProviderSchema, z.array(CatalogProviderSchema)]);
const TypeOrArraySchema = z.union([CatalogTechnologyTypeSchema, z.array(CatalogTechnologyTypeSchema)]);
const RestrictionsOrArraySchema = z.union([CatalogRestrictionSchema, z.array(CatalogRestrictionSchema)]);

const ListTechnologiesSchema = PaginationSchema.extend({
  provider: ProviderOrArraySchema.nullable().optional(),
  type: TypeOrArraySchema.nullable().optional(),
  restrictions: RestrictionsOrArraySchema.optional(),
  search: z.string().optional(),
  response_format: ResponseFormatSchema,
}).strict();

export function registerTechnologyTools(server: McpServer, organizationId: string) {
  server.registerTool(
    "icepanel_list_technologies",
    {
      title: "List IcePanel Technologies",
      description: `Get the technology catalog in IcePanel.

Args:
  - provider (string|string[], optional): Provider filter (aws, azure, gcp, microsoft, salesforce, atlassian, apache, supabase)
  - type (string|string[], optional): Technology type filter
  - restrictions (string|string[], optional): Restrictions filter
  - search (string, optional): Search by name/description
  - limit (number): Max results to return (default: 50)
  - offset (number): Number of results to skip (default: 0)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Paginated list of technologies from catalog and organization.`,
      inputSchema: ListTechnologiesSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ provider, type, restrictions, search, limit, offset, response_format }) => {
      try {
        const result = await getCatalogTechnologies({
          filter: { provider, type, restrictions, status: "approved" },
        });
        const organizationResult = await getOrganizationTechnologies(organizationId, {
          filter: { provider, type, restrictions },
        });

        let combinedTechnologies = result.catalogTechnologies.concat(
          organizationResult.catalogTechnologies
        );

        if (search) {
          const fuse = new Fuse(combinedTechnologies, {
            keys: ["name", "description"],
            threshold: 0.3,
          });
          combinedTechnologies = fuse.search(search).map((resultItem) => resultItem.item);
        }

        const paged = paginateArray(combinedTechnologies, offset, limit);
        const { output, rendered } = applyCharacterLimit(
          { ...paged },
          response_format,
          (current) => current.items.map((item) => formatCatalogTechnology(item)).join("\n")
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
}
