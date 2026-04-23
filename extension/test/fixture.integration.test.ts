import { describe, it, expect, beforeEach } from "vitest";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JsonlStreamDecoder } from "../src/parser/jsonl-stream.js";
import { isMetaRecord, isMessageRecord } from "../src/parser/schema.js";
import { renderRoot } from "../src/render/root.js";

const FIXTURE = resolve(
  __dirname,
  "../../prompttrace-cli/fixtures/schema-v1/minimal.prompttrace.jsonl",
);

beforeEach(() => {
  const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>");
  (globalThis as any).window = dom.window;
  (globalThis as any).document = dom.window.document;
  (globalThis as any).HTMLElement = dom.window.HTMLElement;
});

describe("fixture integration: minimal.prompttrace.jsonl", () => {
  it("parses meta + 3 messages and renders without throwing", () => {
    const bytes = readFileSync(FIXTURE);
    const d = new JsonlStreamDecoder();
    const records = [...d.push(new Uint8Array(bytes)), ...d.flush()];
    expect(records.length).toBe(4);
    expect(isMetaRecord(records[0])).toBe(true);
    expect(isMessageRecord(records[1])).toBe(true);

    const meta = records[0] as any;
    const api = renderRoot(meta, { onToggleRendered: () => {} });
    for (let i = 1; i < records.length; i++) api.appendMessage(records[i] as any);

    expect(api.element.querySelector(".pt-title")!.textContent).toBe(meta.title);
    expect(api.element.querySelectorAll(".pt-msg").length).toBe(3);
    expect(api.element.querySelector(".pt-redacted")!.textContent).toBe(
      "<REDACTED:ABS_PATH>",
    );
  });
});
