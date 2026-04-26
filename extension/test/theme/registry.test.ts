import { describe, it, expect } from "vitest";
import { CLAUDE_CODE_CSS } from "../../src/theme/claude-code.js";
import { themeFor } from "../../src/theme/registry.js";

describe("themeFor", () => {
  it("returns claude-code theme for claude-code source", () => {
    expect(themeFor("claude-code").id).toBe("claude-code");
  });

  it("falls back to claude-code for unknown source", () => {
    expect(themeFor("cursor").id).toBe("claude-code");
  });

  it("includes scoped markdown styles", () => {
    const requiredSelectors = [
      ".pt-md p",
      ".pt-md h1",
      ".pt-md h2",
      ".pt-md ul",
      ".pt-md ol",
      ".pt-md li",
      ".pt-md blockquote",
      ".pt-md code",
      ".pt-md pre",
      ".pt-md pre code",
      ".pt-md a",
    ];

    for (const selector of requiredSelectors) {
      expect(CLAUDE_CODE_CSS).toContain(selector);
    }
  });
});
