import { describe, it, expect, beforeEach } from "vitest";
import { JSDOM } from "jsdom";
import { renderMarkdownText, type MarkdownMarker } from "../../src/render/markdown.js";

beforeEach(() => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  (globalThis as any).window = dom.window;
  (globalThis as any).document = dom.window.document;
  (globalThis as any).HTMLElement = dom.window.HTMLElement;
});

describe("renderMarkdownText", () => {
  it("renders headings and paragraphs", () => {
    const fragment = renderMarkdownText("# Title\n\nHello world");
    expect(fragment.querySelector("h1")!.textContent).toBe("Title");
    expect(fragment.querySelector("p")!.textContent).toBe("Hello world");
  });

  it("renders nested ordered and unordered lists", () => {
    const fragment = renderMarkdownText("- one\n  1. nested\n  2. second\n- two");
    expect(fragment.querySelectorAll("ul > li").length).toBe(2);
    expect(fragment.querySelectorAll("ol > li").length).toBe(2);
    expect(fragment.textContent).toContain("nested");
  });

  it("renders bold, italic, and inline code", () => {
    const fragment = renderMarkdownText("Use **bold**, *italic*, and `code`.");
    expect(fragment.querySelector("strong")!.textContent).toBe("bold");
    expect(fragment.querySelector("em")!.textContent).toBe("italic");
    expect(fragment.querySelector("code")!.textContent).toBe("code");
  });

  it("renders fenced code blocks without syntax highlighting", () => {
    const fragment = renderMarkdownText("```ts\nconst x = 1;\n```");
    const pre = fragment.querySelector("pre");
    expect(pre).not.toBeNull();
    expect(pre!.querySelector("code")!.textContent).toContain("const x = 1;");
    expect(pre!.querySelector("[class]")).toBeNull();
  });

  it("renders blockquotes", () => {
    const fragment = renderMarkdownText("> quoted\n>\n> text");
    const quote = fragment.querySelector("blockquote");
    expect(quote).not.toBeNull();
    expect(quote!.textContent).toContain("quoted");
    expect(quote!.textContent).toContain("text");
  });

  it("hardens safe links for a new tab", () => {
    const fragment = renderMarkdownText("[site](https://example.com/path)");
    const link = fragment.querySelector("a")!;
    expect(link.textContent).toBe("site");
    expect(link.getAttribute("href")).toBe("https://example.com/path");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener");
  });

  it("escapes raw HTML instead of activating it", () => {
    const fragment = renderMarkdownText("<em>raw</em>");
    expect(fragment.querySelector("em")).toBeNull();
    expect(fragment.textContent).toContain("<em>raw</em>");
  });

  it("strips script tags from raw HTML", () => {
    const fragment = renderMarkdownText("<script>alert(1)</script>");
    expect(fragment.querySelector("script")).toBeNull();
    expect(fragment.textContent).toContain("<script>alert(1)</script>");
  });

  it("does not keep event handler attributes from raw HTML", () => {
    const fragment = renderMarkdownText("<img src=x onerror=alert(1)>");
    expect(fragment.querySelector("img")).toBeNull();
    expect(fragment.textContent).toContain("onerror=alert(1)");
  });

  it("removes javascript hrefs", () => {
    const fragment = renderMarkdownText("[x](javascript:alert(1))");
    const link = fragment.querySelector("a")!;
    expect(link.textContent).toBe("x");
    expect(link.hasAttribute("href")).toBe(false);
  });

  it("removes data hrefs", () => {
    const fragment = renderMarkdownText("[x](data:text/html;base64,PHNjcmlwdD4=)");
    const link = fragment.querySelector("a")!;
    expect(link.textContent).toBe("x");
    expect(link.hasAttribute("href")).toBe(false);
  });

  it("replaces marker sentinels with supplied DOM nodes", () => {
    const marker: MarkdownMarker = {
      sentinel: "\uE000PT_MARKER_0\uE001",
      createNode: () => {
        const el = document.createElement("span");
        el.className = "pt-redacted";
        el.textContent = "<REDACTED:ABS_PATH>";
        return el;
      },
    };
    const fragment = renderMarkdownText("Path \uE000PT_MARKER_0\uE001/file.md", [marker]);
    const pill = fragment.querySelector(".pt-redacted");
    expect(pill).not.toBeNull();
    expect(pill!.textContent).toBe("<REDACTED:ABS_PATH>");
    expect(fragment.textContent).toContain("/file.md");
  });
});
