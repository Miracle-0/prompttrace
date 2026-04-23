import { describe, it, expect, beforeEach } from "vitest";
import { JSDOM } from "jsdom";
import { renderToolResult, __TRUNCATE_BYTES_CAP_FOR_TEST } from "../../src/render/blocks/tool-result.js";

beforeEach(() => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  (globalThis as any).document = dom.window.document;
  (globalThis as any).HTMLElement = dom.window.HTMLElement;
});

describe("renderToolResult", () => {
  it("renders head only, with no body in DOM by default", () => {
    const el = renderToolResult({
      type: "tool_result",
      tool_use_id: "t1",
      output: "some content",
    });
    expect(el.querySelector(".pt-tool-result-head")).not.toBeNull();
    expect(el.querySelector(".pt-tool-result-body")).toBeNull();
  });

  it("DOM-appends output only after click", () => {
    const el = renderToolResult({
      type: "tool_result",
      tool_use_id: "t1",
      output: "one\ntwo\nthree",
    });
    (el.querySelector(".pt-tool-result-head") as HTMLElement).click();
    const body = el.querySelector(".pt-tool-result-body")!;
    expect(body.textContent).toBe("one\ntwo\nthree");
  });

  it("second click removes the body again", () => {
    const el = renderToolResult({
      type: "tool_result",
      tool_use_id: "t1",
      output: "x",
    });
    const head = el.querySelector(".pt-tool-result-head") as HTMLElement;
    head.click();
    head.click();
    expect(el.querySelector(".pt-tool-result-body")).toBeNull();
  });

  it("applies 100KB secondary truncation with head + tail + pill", () => {
    const cap = __TRUNCATE_BYTES_CAP_FOR_TEST;
    const head = "HEADLINE\n".repeat(10);
    const tail = "TAILLINE\n".repeat(10);
    const filler = "x".repeat(cap * 3);
    const output = head + filler + tail;
    const el = renderToolResult({
      type: "tool_result",
      tool_use_id: "t1",
      output,
    });
    (el.querySelector(".pt-tool-result-head") as HTMLElement).click();
    const body = el.querySelector(".pt-tool-result-body")!;
    expect(body.textContent).toContain("HEADLINE");
    expect(body.textContent).toContain("TAILLINE");
    expect(body.querySelector(".pt-truncated")).not.toBeNull();
    // The middle filler must NOT be present in full
    expect(body.textContent).not.toContain("x".repeat(cap));
  });

  it("shows an 'Expand all' link when truncated; clicking it renders full", () => {
    const cap = __TRUNCATE_BYTES_CAP_FOR_TEST;
    const output = "a".repeat(cap * 3);
    const el = renderToolResult({
      type: "tool_result",
      tool_use_id: "t1",
      output,
    });
    (el.querySelector(".pt-tool-result-head") as HTMLElement).click();
    const link = el.querySelector(".pt-expand-all") as HTMLElement;
    expect(link).not.toBeNull();
    link.click();
    const body = el.querySelector(".pt-tool-result-body")!;
    expect(body.textContent!.length).toBeGreaterThanOrEqual(output.length);
  });
});
