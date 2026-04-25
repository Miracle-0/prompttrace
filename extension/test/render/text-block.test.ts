import { describe, it, expect, beforeEach } from "vitest";
import { JSDOM } from "jsdom";
import { renderTextBlock } from "../../src/render/blocks/text.js";

beforeEach(() => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  (globalThis as any).window = dom.window;
  (globalThis as any).document = dom.window.document;
  (globalThis as any).HTMLElement = dom.window.HTMLElement;
});

describe("renderTextBlock", () => {
  it("preserves plain text content", () => {
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
    expect(el.textContent).toContain("/x.md for details");
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
    expect(el.textContent).toBe("1 < 2 is true");
    expect(el.querySelector("script")).toBeNull();
  });

  it("renders markdown inside text blocks", () => {
    const el = renderTextBlock("# Plan\n\nUse **bold** and `code`.");
    expect(el.classList.contains("pt-md")).toBe(true);
    expect(el.querySelector("h1")!.textContent).toBe("Plan");
    expect(el.querySelector("strong")!.textContent).toBe("bold");
    expect(el.querySelector("code")!.textContent).toBe("code");
  });

  it("renders markdown while preserving redacted marker pills", () => {
    const el = renderTextBlock("See **file** <REDACTED:ABS_PATH>/notes.md");
    expect(el.querySelector("strong")!.textContent).toBe("file");
    const pill = el.querySelector(".pt-redacted");
    expect(pill).not.toBeNull();
    expect(pill!.textContent).toBe("<REDACTED:ABS_PATH>");
    expect(el.textContent).toContain("/notes.md");
  });

  it("keeps marker pills inside markdown list items", () => {
    const el = renderTextBlock("- path <REDACTED:ABS_PATH>/a.md\n- done");
    const items = el.querySelectorAll("ul > li");
    expect(items.length).toBe(2);
    expect(items[0]!.querySelector(".pt-redacted")).not.toBeNull();
    expect(items[0]!.textContent).toContain("/a.md");
  });
});
