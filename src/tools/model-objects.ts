import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import Fuse from "fuse.js";
import {
  createModelObject,
  deleteModelObject,
  getModelConnections,
  getModelObject,
  getModelObjects,
  handleApiError,
  updateModelObject,
} from "../services/icepanel-client.js";
import {
  formatConnections,
  formatModelObjectItem,
  formatModelObjectListItem,
} from "../services/formatters.js";
import {
  IcePanelIdSchema,
  ModelObjectTypeSchema,
  ResponseFormatSchema,
  StatusSchema,
  PaginationSchema,
} from "../schemas/index.js";
import { applyCharacterLimit, formatOutput, paginateArray } from "./utils.js";

const IdOrIdsSchema = z.union([IcePanelIdSchema, z.array(IcePanelIdSchema)]);
const MutableModelObjectTypeSchema = z.enum(["actor", "app", "component", "group", "store", "system"]);

const ListModelObjectsSchema = z
  .object({
    landscapeId: IcePanelIdSchema,
    domainId: IdOrIdsSchema.optional(),
    external: z.boolean().optional().default(false),
    name: z.string().optional(),
    parentId: z.string().nullable().optional(),
    status: z.union([StatusSchema, z.array(StatusSchema)]).optional(),
    type: z.union([ModelObjectTypeSchema, z.array(ModelObjectTypeSchema)]).optional(),
    technologyId: IdOrIdsSchema.optional(),
    search: z.string().optional(),
    limit: PaginationSchema.shape.limit,
    offset: PaginationSchema.shape.offset,
    response_format: ResponseFormatSchema,
  })
  .strict();

const GetModelObjectSchema = z
  .object({
    landscapeId: IcePanelIdSchema,
    modelObjectId: IcePanelIdSchema,
    includeHierarchicalInfo: z
      .boolean()
      .default(false)
      .describe(
        "Include hierarchical information like parent and child objects. (Only use this when necessary as it is an expensive operation.)"
      ),
    response_format: ResponseFormatSchema,
  })
  .strict();

const GetModelObjectConnectionsSchema = z
  .object({
    landscapeId: IcePanelIdSchema,
    modelObjectId: IcePanelIdSchema,
    response_format: ResponseFormatSchema,
  })
  .strict();

const CreateModelObjectSchema = z
  .object({
    landscapeId: IcePanelIdSchema,
    name: z.string().min(1).max(255),
    type: MutableModelObjectTypeSchema,
    parentId: IcePanelIdSchema,
    description: z.string().optional(),
    status: StatusSchema.default("live"),
    external: z.boolean().default(false),
    technologyIds: z.array(IcePanelIdSchema).optional(),
    caption: z.string().optional(),
  })
  .strict();

const UpdateModelObjectSchema = z
  .object({
    landscapeId: IcePanelIdSchema,
    modelObjectId: IcePanelIdSchema,
    name: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    status: StatusSchema.optional(),
    external: z.boolean().optional(),
    parentId: IcePanelIdSchema.optional(),
    type: MutableModelObjectTypeSchema.optional(),
    technologyIds: z.array(IcePanelIdSchema).optional(),
    caption: z.string().optional(),
  })
  .strict();

const DeleteModelObjectSchema = z
  .object({
    landscapeId: IcePanelIdSchema,
    modelObjectId: IcePanelIdSchema,
  })
  .strict();

export function registerModelObjectTools(server: McpServer, organizationId: string) {
  server.registerTool(
    "icepanel_list_model_objects",
    {
      title: "List IcePanel Model Objects",
      description: `Get model objects within an IcePanel landscape.

IcePanel is a C4 diagramming tool. C4 is a framework for visualizing the architecture of software systems.
To get the C1 level objects - query for 'system' type.
To get the C2 level objects - query for 'app' and 'store' component types.
To get the C3 level objects - query for the 'component' type.

The 'group' and 'actor' types can be used in any of the levels, and should generally be included in user queries.
- 'group' - is a type agnostic group which groups objects together
- 'actor' - is a actor in the system, typically a kind of user. Ex. 'our customer', 'admin user', etc.

Args:
  - landscapeId (string): Landscape ID (20 characters)
  - limit (number): Max results to return (default: 50)
  - offset (number): Number of results to skip (default: 0)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Paginated list of model objects with IDs and basic metadata.`,
      inputSchema: ListModelObjectsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ landscapeId, search, limit, offset, response_format, ...filters }) => {
      try {
        const result = await getModelObjects(landscapeId, "latest", {
          filter: filters,
        });
        let modelObjects = result.modelObjects;
        if (search) {
          const fuseInstance = new Fuse(modelObjects, {
            keys: ["name", "description"],
            threshold: 0.3,
          });
          modelObjects = fuseInstance.search(search).map((resultItem) => resultItem.item);
        }

        const paged = paginateArray(modelObjects, offset, limit);
        const { output, rendered } = applyCharacterLimit(
          { ...paged },
          response_format,
          (current) =>
            current.items.map((item) => formatModelObjectListItem(landscapeId, item)).join("\n")
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
    "icepanel_get_model_object",
    {
      title: "Get IcePanel Model Object",
      description: `Get detailed information about a model object in IcePanel.

IcePanel is a C4 diagramming tool. C4 is a framework for visualizing the architecture of software systems.
Use this tool to get detailed information about a model object, such as its description, type, hierarchical information (parent and children),
and technologies it uses.`,
      inputSchema: GetModelObjectSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ landscapeId, modelObjectId, includeHierarchicalInfo, response_format }) => {
      try {
        const result = await getModelObject(landscapeId, modelObjectId);
        const modelObject = result.modelObject;

        let parentObject;
        let childObjects;

        if (includeHierarchicalInfo) {
          const listResult = await getModelObjects(landscapeId);
          const modelObjectList = listResult.modelObjects;
          parentObject =
            modelObject.parentId && modelObject.parentId !== "root"
              ? modelObjectList.find((o) => o.id === modelObject.parentId)
              : undefined;
          childObjects =
            modelObject.childIds && modelObject.childIds.length > 0
              ? modelObjectList.filter((o) => modelObject.childIds.includes(o.id))
              : undefined;
        }

        const markdown = formatModelObjectItem(landscapeId, modelObject, parentObject, childObjects);
        const structuredContent = {
          modelObject,
          parentObject,
          childObjects,
        };

        return {
          content: [{ type: "text", text: formatOutput(response_format, markdown, structuredContent) }],
          structuredContent,
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
    "icepanel_get_model_object_connections",
    {
      title: "Get IcePanel Model Object Connections",
      description: `Get information about the relationships a model object has in IcePanel.

Use this tool when you want to know about what objects are related to the current object. It provides a succinct list of related items.`,
      inputSchema: GetModelObjectConnectionsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ landscapeId, modelObjectId, response_format }) => {
      try {
        const modelObjectResult = await getModelObject(landscapeId, modelObjectId);
        const modelObjectsResult = await getModelObjects(landscapeId);
        const outgoingConnectionsResult = await getModelConnections(landscapeId, "latest", {
          filter: {
            originId: modelObjectId,
          },
        });
        const incomingConnectionsResult = await getModelConnections(landscapeId, "latest", {
          filter: {
            targetId: modelObjectId,
          },
        });

        const markdown = formatConnections(
          modelObjectResult.modelObject,
          incomingConnectionsResult.modelConnections,
          outgoingConnectionsResult.modelConnections,
          modelObjectsResult.modelObjects
        );

        const structuredContent = {
          modelObject: modelObjectResult.modelObject,
          incomingConnections: incomingConnectionsResult.modelConnections,
          outgoingConnections: outgoingConnectionsResult.modelConnections,
        };

        return {
          content: [{ type: "text", text: formatOutput(response_format, markdown, structuredContent) }],
          structuredContent,
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
    "icepanel_create_model_object",
    {
      title: "Create IcePanel Model Object",
      description: `Create a new model object (system, app, component, etc.) in IcePanel.

This tool CREATES a new C4 architecture element in your landscape.`,
      inputSchema: CreateModelObjectSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ landscapeId, ...data }) => {
      try {
        const result = await createModelObject(landscapeId, data);
        const markdown = `# Model Object Created Successfully\n\n${formatModelObjectItem(
          landscapeId,
          result.modelObject
        )}`;
        return {
          content: [{ type: "text", text: markdown }],
          structuredContent: { modelObject: result.modelObject },
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
    "icepanel_update_model_object",
    {
      title: "Update IcePanel Model Object",
      description: `Update an existing model object in IcePanel. Only provided fields will be updated.`,
      inputSchema: UpdateModelObjectSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ landscapeId, modelObjectId, ...data }) => {
      try {
        const updateData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
        const result = await updateModelObject(landscapeId, modelObjectId, updateData);
        const markdown = `# Model Object Updated Successfully\n\n${formatModelObjectItem(
          landscapeId,
          result.modelObject
        )}`;
        return {
          content: [{ type: "text", text: markdown }],
          structuredContent: { modelObject: result.modelObject },
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
    "icepanel_delete_model_object",
    {
      title: "Delete IcePanel Model Object",
      description: `Delete a model object from IcePanel. WARNING: This action cannot be undone.`,
      inputSchema: DeleteModelObjectSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ landscapeId, modelObjectId }) => {
      try {
        const existing = await getModelObject(landscapeId, modelObjectId);
        const objectName = existing.modelObject.name;

        await deleteModelObject(landscapeId, modelObjectId);
        return {
          content: [
            {
              type: "text",
              text: `# Model Object Deleted\n\nSuccessfully deleted model object "${objectName}" (ID: ${modelObjectId}).`,
            },
          ],
          structuredContent: { deleted: { id: modelObjectId, name: objectName } },
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
