import { describe, it, expect, beforeEach } from "vitest";
import { JSDOM } from "jsdom";
import { renderToolUse } from "../../src/render/blocks/tool-use.js";

beforeEach(() => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  (globalThis as any).document = dom.window.document;
  (globalThis as any).HTMLElement = dom.window.HTMLElement;
});

describe("renderToolUse", () => {
  it("shows tool name and summary line collapsed by default", () => {
    const el = renderToolUse({
      type: "tool_use",
      id: "t1",
      name: "Read",
      input: { file_path: "<REDACTED:ABS_PATH>/x.md" },
    });
    expect(el.classList.contains("pt-tool")).toBe(true);
    expect(el.querySelector(".pt-tool-name")!.textContent).toBe("Read");
    const summary = el.querySelector(".pt-tool-summary")!.textContent!;
    expect(summary).toContain("file_path");
    // Body not in DOM yet
    expect(el.querySelector(".pt-tool-input-body")).toBeNull();
  });

  it("expands to show pretty-printed input when head is clicked", () => {
    const el = renderToolUse({
      type: "tool_use",
      id: "t1",
      name: "Edit",
      input: { file_path: "x", old_string: "a\nb" },
    });
    const head = el.querySelector(".pt-tool-head") as HTMLElement;
    head.click();
    const body = el.querySelector(".pt-tool-input-body");
    expect(body).not.toBeNull();
    // JSON formatter was used
    expect(body!.querySelector(".pt-json-k")).not.toBeNull();
  });

  it("collapses again on second click", () => {
    const el = renderToolUse({
      type: "tool_use",
      id: "t1",
      name: "Edit",
      input: { a: 1 },
    });
    const head = el.querySelector(".pt-tool-head") as HTMLElement;
    head.click();
    expect(el.querySelector(".pt-tool-input-body")).not.toBeNull();
    head.click();
    expect(el.querySelector(".pt-tool-input-body")).toBeNull();
  });

  it("renders primitive input types without crashing", () => {
    const el = renderToolUse({
      type: "tool_use",
      id: "t1",
      name: "X",
      input: "just a string",
    });
    expect(el.querySelector(".pt-tool-summary")).not.toBeNull();
  });
});
