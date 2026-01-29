import { describe, expect, test } from "vitest";
import { parseCliConfig } from "../src/cli/config.js";

describe("parseCliConfig", () => {
  test("uses MCP env defaults when no args", () => {
    const env = { MCP_TRANSPORT: "http", MCP_PORT: "8123" };
    const result = parseCliConfig([], env);
    expect(result.transport).toBe("http");
    expect(result.port).toBe(8123);
  });

  test("applies KEY=value args before defaults", () => {
    const result = parseCliConfig(["MCP_TRANSPORT=http", "MCP_PORT=9123"], {});
    expect(result.transport).toBe("http");
    expect(result.port).toBe(9123);
  });

  test("flags override MCP env and KEY=value args", () => {
    const result = parseCliConfig(
      ["MCP_TRANSPORT=stdio", "--transport", "http", "MCP_PORT=3001", "--port", "4000"],
      { MCP_TRANSPORT: "stdio", MCP_PORT: "3000" }
    );
    expect(result.transport).toBe("http");
    expect(result.port).toBe(4000);
  });

  test("maps deprecated sse transport to http", () => {
    const result = parseCliConfig(["MCP_TRANSPORT=sse"], {});
    expect(result.transport).toBe("http");
    expect(result.usedDeprecatedSse).toBe(true);
  });
});
