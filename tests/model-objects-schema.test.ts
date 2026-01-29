import { describe, expect, test } from "vitest";
import { ListModelObjectsSchema } from "../src/tools/model-objects.js";

describe("ListModelObjectsSchema", () => {
  test("does not default external filter", () => {
    const parsed = ListModelObjectsSchema.parse({
      landscapeId: "abcdefghijklmnopqrst",
      limit: 10,
      offset: 0,
      response_format: "json",
    });

    expect("external" in parsed).toBe(false);
  });

  test("keeps explicit external filter", () => {
    const parsed = ListModelObjectsSchema.parse({
      landscapeId: "abcdefghijklmnopqrst",
      limit: 10,
      offset: 0,
      response_format: "json",
      external: true,
    });

    expect(parsed.external).toBe(true);
  });
});
