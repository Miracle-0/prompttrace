import { describe, it, expect, beforeEach } from "vitest";
import { JSDOM } from "jsdom";
import { renderTextBlock } from "../../src/render/blocks/text.js";

beforeEach(() => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  (globalThis as any).document = dom.window.document;
});

describe("renderTextBlock", () => {
  it("renders plain text as a text node", () => {
    const el = renderTextBlock("hello world");
    expect(el.textContent).toBe("hello world");
    expect(el.querySelector(".pt-redacted")).toBeNull();
  });

  it("wraps <REDACTED:ABS_PATH> in a pill with tooltip", () => {
    const el = renderTextBlock("see <REDACTED:ABS_PATH>/x.md for details");
    const pills = el.querySelectorAll(".pt-redacted");
    expect(pills.length).toBe(1);
    expect(pills[0]!.textContent).toBe("<REDACTED:ABS_PATH>");
    expect(pills[0]!.getAttribute("title")).toMatch(/redacted/i);
  });

  it("handles multiple redactions in one string", () => {
    const el = renderTextBlock("<REDACTED:API_KEY> then <REDACTED:EMAIL>");
    expect(el.querySelectorAll(".pt-redacted").length).toBe(2);
  });

  it("wraps <TRUNCATED: N bytes> in a truncation pill", () => {
    const el = renderTextBlock("head\n<TRUNCATED: 1024 bytes>\ntail");
    const pills = el.querySelectorAll(".pt-truncated");
    expect(pills.length).toBe(1);
    expect(pills[0]!.textContent).toContain("TRUNCATED");
  });

  it("escapes literal < characters that are not markers", () => {
    const el = renderTextBlock("1 < 2 is true");
    // textContent should preserve the '<' as literal text, not parse as HTML
    expect(el.textContent).toBe("1 < 2 is true");
  });
});
