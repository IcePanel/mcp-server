import { CHARACTER_LIMIT } from "../constants.js";
import type { ResponseFormat } from "../schemas/index.js";

export function formatOutput(
  responseFormat: ResponseFormat,
  markdown: string,
  structuredContent: unknown
): string {
  if (responseFormat === "json") {
    return JSON.stringify(structuredContent, null, 2);
  }
  return markdown;
}

export function paginateArray<T>(items: T[], offset: number, limit: number) {
  const total = items.length;
  const pagedItems = items.slice(offset, offset + limit);
  const hasMore = offset + pagedItems.length < total;
  return {
    total,
    count: pagedItems.length,
    offset,
    items: pagedItems,
    has_more: hasMore,
    next_offset: hasMore ? offset + pagedItems.length : undefined,
  };
}

export function applyCharacterLimit<T extends { items?: unknown[]; count?: number; has_more?: boolean; next_offset?: number }>(
  output: T,
  responseFormat: ResponseFormat,
  markdownRenderer: (current: T) => string
) {
  let rendered = formatOutput(responseFormat, markdownRenderer(output), output);

  if (!Array.isArray(output.items)) {
    return { output, rendered };
  }

  while (rendered.length > CHARACTER_LIMIT && output.items.length > 1) {
    output.items = output.items.slice(0, Math.ceil(output.items.length / 2));
    output.count = output.items.length;
    output.has_more = true;
    const offset = (output as T & { offset?: number }).offset ?? 0;
    output.next_offset = offset + output.items.length;
    (output as T & { truncated?: boolean; truncation_message?: string }).truncated = true;
    (output as T & { truncation_message?: string }).truncation_message =
      "Response truncated to fit size limits. Use limit/offset or filters to page through results.";

    rendered = formatOutput(responseFormat, markdownRenderer(output), output);
  }

  return { output, rendered };
}
