import { describe, it, expect } from "vitest";
import {
  SUPPORTED_SCHEMA_VERSIONS,
  isMetaRecord,
  isMessageRecord,
  isSupportedSchemaVersion,
} from "../../src/parser/schema.js";

describe("SUPPORTED_SCHEMA_VERSIONS", () => {
  it("includes 1", () => {
    expect(SUPPORTED_SCHEMA_VERSIONS).toEqual([1]);
  });
});

describe("isSupportedSchemaVersion", () => {
  it("accepts 1", () => {
    expect(isSupportedSchemaVersion(1)).toBe(true);
  });
  it("rejects 2 and 0", () => {
    expect(isSupportedSchemaVersion(2)).toBe(false);
    expect(isSupportedSchemaVersion(0)).toBe(false);
  });
  it("rejects non-numbers", () => {
    expect(isSupportedSchemaVersion("1" as unknown as number)).toBe(false);
  });
});

describe("isMetaRecord", () => {
  it("accepts minimal meta", () => {
    const m = {
      type: "meta",
      schema_version: 1,
      source: "claude-code",
      exported_at: "2026-04-22T10:00:00Z",
      exported_by: "prompttrace-cli/0.1.0",
      title: "t",
      sanitization: { rules_applied: [], redaction_count: 0 },
    };
    expect(isMetaRecord(m)).toBe(true);
  });
  it("rejects missing type", () => {
    expect(isMetaRecord({ schema_version: 1 })).toBe(false);
  });
  it("rejects wrong type field", () => {
    expect(isMetaRecord({ type: "message" })).toBe(false);
  });
});

describe("isMessageRecord", () => {
  it("accepts a text-only user message", () => {
    const r = {
      type: "message",
      role: "user",
      uuid: "u1",
      parent_uuid: null,
      timestamp: "2026-04-22T10:00:00Z",
      content: [{ type: "text", text: "hi" }],
    };
    expect(isMessageRecord(r)).toBe(true);
  });
  it("rejects missing content", () => {
    expect(
      isMessageRecord({
        type: "message",
        role: "user",
        uuid: "u1",
        parent_uuid: null,
        timestamp: "2026-04-22T10:00:00Z",
      }),
    ).toBe(false);
  });
  it("rejects wrong role", () => {
    expect(
      isMessageRecord({
        type: "message",
        role: "system",
        uuid: "u1",
        parent_uuid: null,
        timestamp: "x",
        content: [],
      }),
    ).toBe(false);
  });
});
