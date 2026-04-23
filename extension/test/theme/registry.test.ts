import { describe, it, expect } from "vitest";
import { themeFor } from "../../src/theme/registry.js";

describe("themeFor", () => {
  it("returns claude-code theme for claude-code source", () => {
    expect(themeFor("claude-code").id).toBe("claude-code");
  });
  it("falls back to claude-code for unknown source", () => {
    expect(themeFor("cursor").id).toBe("claude-code");
  });
});
