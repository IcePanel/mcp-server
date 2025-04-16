import type { CatalogTechnology, ModelObject, Team } from "./types.js";

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

  if (modelObject.description) {
   formatString += `- Description: \n`
   const maxLength = 150;
   let truncatedDescription = modelObject.description;
   if (truncatedDescription.length > maxLength) {
     const lastSpaceIndex = truncatedDescription.lastIndexOf(' ', maxLength);
     truncatedDescription = truncatedDescription.slice(0, lastSpaceIndex > 0 ? lastSpaceIndex : maxLength);
   }
   formatString += `${truncatedDescription}...\n`
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

export const formatModelObjectRelatedItem = (modelObject: ModelObject): string => {
  let formatString = '';

  if (modelObject.name) {
    formatString += `##### ${modelObject.name}\n`;
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

  if (modelObject.status) {
    formatString += `- Status: ${modelObject.status}\n`;
  }

  return formatString;
}

export const formatModelObjectItem = (landscapeId: string, modelObject: ModelObject, teams: Team[], parentObject?: ModelObject, childObjects?: ModelObject[]): string => {
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
    formatString += `- Teams: ${modelObject.teamIds.map(teamId => teams.find(t => t.id === teamId)?.name).filter(it => !!it).join(', ')}\n`;
  }

  if (parentObject) {
    formatString += `### Parent Object\n\n`
    formatString += formatModelObjectRelatedItem(parentObject) + '\n\n'
  }

  if (childObjects) {
    formatString += `### Child Objects\n\n`
    formatString += childObjects.map(o => formatModelObjectRelatedItem(o)).join('\n\n')
  }

  return formatString;
}

export const formatCatalogTechnology = (technology: CatalogTechnology) => {
  let formatString = '';

  formatString += `# ${technology.name}\n\n`;
  formatString += `- Name: ${technology.name}\n`;
  formatString += `- ID: ${technology.id}\n`;


  if (technology.nameShort) {
    formatString += `- Short Name: ${technology.nameShort}\n`;
  }

  if (technology.description) {
    formatString += `- Description: ${technology.description}\n`;
  }

  if (technology.docsUrl) {
    formatString += `- Documentation: ${toMarkdownLink('Docs', technology.docsUrl)}\n`;
  }

  if (technology.websiteUrl) {
    formatString += `- Website: ${toMarkdownLink('Website', technology.websiteUrl)}\n`;
  }

  if (technology.status) {
    formatString += `- Status: ${technology.status}\n`;
  }

  if (technology.type) {
    formatString += `- Type: ${technology.type}\n`;
  }

  if (technology.provider) {
    formatString += `- Provider: ${technology.provider}\n`;
  }

  if (technology.category) {
    formatString += `- Category: ${technology.category}\n`;
  }

  if (technology.defaultSlug) {
    formatString += `- Slug: ${technology.defaultSlug}\n`;
  }

  return formatString;
}


export const formatTeam = (team: Team): string => {
  let formatString = '';

  if (team.name) {
    formatString += `# ${team.name}\n`;
  }

  if (team.id) {
    formatString += `- ID: ${team.id}\n`;
  }

  if (team.name) {
      formatString += `- Name: ${team.name}\n`;
    }

  if (team.userIds && team.userIds.length > 0) {
    formatString += `- Team size: ${team.userIds.length}\n`;
  }

  return formatString;
}
