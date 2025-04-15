import type { ModelObject } from "./types.js";

/**
 * Converts text and URL into a markdown link.
 * @param text - The display text for the link.
 * @param url - The URL the link points to.
 * @returns A string formatted as a markdown link.
 */
export function toMarkdownLink(text: string, url: string): string {
    return `[${text}](${url})`;
}

export const BASE_PATH = 'http://localhost:8080';


export const modelObjectUrl = (landscapeId: string, modelObjectHandle: string): string => {
  return `${BASE_PATH}/landscapes/${landscapeId}/versions/latest/model/objects?object_tab=details&object=${modelObjectHandle}`
}


export const formatModelObjectListItem = (landscapeId: string, modelObject: ModelObject): string => {
  return `
  # ${modelObject.name}
  - Name: ${modelObject.name}
  - View in IcePanel: ${modelObjectUrl(landscapeId, modelObject.handleId)}
  - Description:
  \`\`\`
  ${modelObject.description}
  \`\`\`
  - Type: ${modelObject.type}
  - External: ${modelObject.external}
  - Status: ${modelObject.status}
  - Technologies: ${Object.values(modelObject.technologies).map(t => t.name).join(", ")}
  - Teams: ${modelObject.teamIds.join(", ")}
  `
}
