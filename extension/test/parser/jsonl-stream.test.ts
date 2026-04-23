import { describe, it, expect } from "vitest";
import { JsonlStreamDecoder } from "../../src/parser/jsonl-stream.js";

function enc(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

describe("JsonlStreamDecoder", () => {
  it("parses a complete buffer", () => {
    const d = new JsonlStreamDecoder();
    const out = d.push(enc('{"a":1}\n{"b":2}\n'));
    expect(out).toEqual([{ a: 1 }, { b: 2 }]);
    expect(d.flush()).toEqual([]);
  });

  it("handles a chunk boundary mid-line", () => {
    const d = new JsonlStreamDecoder();
    const a = d.push(enc('{"a":1}\n{"b":'));
    const b = d.push(enc('2}\n'));
    expect(a).toEqual([{ a: 1 }]);
    expect(b).toEqual([{ b: 2 }]);
  });

  it("handles a chunk boundary mid-multi-byte utf8", () => {
    // "…" is E2 80 A6
    const full = enc('{"s":"…"}\n');
    const first = full.slice(0, full.length - 4);
    const second = full.slice(full.length - 4);
    const d = new JsonlStreamDecoder();
    const a = d.push(first);
    const b = d.push(second);
    expect(a).toEqual([]);
    expect(b).toEqual([{ s: "…" }]);
  });

  it("ignores empty lines", () => {
    const d = new JsonlStreamDecoder();
    expect(d.push(enc('\n{"a":1}\n\n{"b":2}\n\n'))).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("flush emits the last line without trailing newline", () => {
    const d = new JsonlStreamDecoder();
    expect(d.push(enc('{"a":1}'))).toEqual([]);
    expect(d.flush()).toEqual([{ a: 1 }]);
  });

  it("strips a UTF-8 BOM at start", () => {
    const d = new JsonlStreamDecoder();
    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const body = enc('{"a":1}\n');
    const buf = new Uint8Array(bom.length + body.length);
    buf.set(bom, 0);
    buf.set(body, bom.length);
    expect(d.push(buf)).toEqual([{ a: 1 }]);
  });

  it("throws on malformed JSON with line number in error", () => {
    const d = new JsonlStreamDecoder();
    expect(() => d.push(enc("not json\n"))).toThrow(/line 1/);
  });
});
