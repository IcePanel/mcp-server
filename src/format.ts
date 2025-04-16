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
  let formatString = '';

  if (modelObject.name) {
    formatString += `# ${modelObject.name}\n`;
  }

  if (modelObject.id) {
    formatString += `- ID: ${modelObject.id}\n`;
  }

  if (modelObject.name) {
    formatString += `- Name: ${modelObject.name}\n`;
  }

  if (modelObject.type) {
    formatString += `- Type: ${modelObject.type}\n`;
  }

  if (modelObject.external !== undefined) {
    formatString += `- External: ${modelObject.external}\n`;
  }

  if (modelObject.status) {
    formatString += `- Status: ${modelObject.status}\n`;
  }

  return formatString;
}


export const formatModelObjectItem = (landscapeId: string, modelObject: ModelObject): string => {
  let formatString = '';

  if (modelObject.name) {
    formatString += `# ${modelObject.name}\n`;
  }

  if (modelObject.id) {
    formatString += `- ID: ${modelObject.id}\n`;
  }

  if (modelObject.name) {
    formatString += `- Name: ${modelObject.name}\n`;
  }

  formatString += `- View in IcePanel: ${modelObjectUrl(landscapeId, modelObject.handleId)}\n`;

  if (modelObject.description) {
    formatString += `- Description:\n\`\`\`\n${modelObject.description}\n\`\`\`\n`;
  }

  if (modelObject.type) {
    formatString += `- Type: ${modelObject.type}\n`;
  }

  if (modelObject.external !== undefined) {
    formatString += `- External: ${modelObject.external}\n`;
  }

  if (modelObject.status) {
    formatString += `- Status: ${modelObject.status}\n`;
  }

  if (modelObject.technologies && Object.values(modelObject.technologies).length > 0) {
    formatString += `- Technologies: ${Object.values(modelObject.technologies).map(t => t.name).join(", ")}\n`;
  }

  if (modelObject.teamIds && modelObject.teamIds.length > 0) {
    formatString += `- Teams: ${modelObject.teamIds.join(", ")}\n`;
  }

  return formatString;
}
