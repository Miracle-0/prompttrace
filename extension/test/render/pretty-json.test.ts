import { describe, it, expect, beforeEach } from "vitest";
import { JSDOM } from "jsdom";
import { renderPrettyJson } from "../../src/render/pretty-json.js";

beforeEach(() => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  (globalThis as any).document = dom.window.document;
  (globalThis as any).HTMLElement = dom.window.HTMLElement;
});

describe("renderPrettyJson", () => {
  it("renders a simple object with colored key + string", () => {
    const node = renderPrettyJson({ a: "x" });
    const text = node.textContent;
    expect(text).toContain('"a"');
    expect(text).toContain('"x"');
    expect(node.querySelector(".pt-json-k")).not.toBeNull();
    expect(node.querySelector(".pt-json-s")).not.toBeNull();
  });

  it("expands embedded newlines in strings", () => {
    const node = renderPrettyJson({ code: "line1\nline2" });
    // Literal newline must be in the output, not the escape sequence "\\n".
    expect(node.textContent).toContain("line1\nline2");
  });

  it("renders numbers, booleans, and null with distinct classes", () => {
    const node = renderPrettyJson({ n: 3, b: true, x: null });
    expect(node.querySelector(".pt-json-n")).not.toBeNull();
    expect(node.querySelector(".pt-json-null")).not.toBeNull();
  });

  it("renders nested arrays with indentation", () => {
    const node = renderPrettyJson({ arr: [{ x: 1 }] });
    const text = node.textContent!;
    expect(text).toMatch(/\[\n {4}\{/);
  });
});
