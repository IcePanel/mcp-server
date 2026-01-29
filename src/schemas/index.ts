import { z } from "zod";

export const ResponseFormatSchema = z.enum(["markdown", "json"]).default("markdown");

export const IcePanelIdSchema = z.string().length(20);

export const PaginationSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
}).strict();

export const StatusSchema = z.enum(["deprecated", "future", "live", "removed"]);

export const ModelObjectTypeSchema = z.enum([
  "actor",
  "app",
  "component",
  "group",
  "root",
  "store",
  "system",
]);

export const ConnectionDirectionSchema = z.enum(["outgoing", "bidirectional"]).nullable();

export const ColorNameSchema = z.enum([
  "blue",
  "green",
  "yellow",
  "orange",
  "red",
  "beaver",
  "dark-blue",
  "purple",
  "pink",
  "white",
  "grey",
  "black",
]);

export const ColorSchema = z.union([ColorNameSchema, z.string().regex(/^#[0-9A-Fa-f]{6}$/)]);

export const CatalogProviderSchema = z.enum([
  "aws",
  "azure",
  "gcp",
  "microsoft",
  "salesforce",
  "atlassian",
  "apache",
  "supabase",
]);

export const CatalogTechnologyTypeSchema = z.enum([
  "data-storage",
  "deployment",
  "framework-library",
  "gateway",
  "other",
  "language",
  "message-broker",
  "network",
  "protocol",
  "runtime",
  "service-tool",
]);

export const CatalogRestrictionSchema = z.enum([
  "actor",
  "app",
  "component",
  "connection",
  "group",
  "store",
  "system",
]);

export type ResponseFormat = z.infer<typeof ResponseFormatSchema>;
