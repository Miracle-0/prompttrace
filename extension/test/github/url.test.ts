import { describe, it, expect } from "vitest";
import { isPrompttraceBlobUrl, blobToRawUrl, parseBlobUrl } from "../../src/github/url.js";

describe("isPrompttraceBlobUrl", () => {
  it("matches a plain blob URL", () => {
    expect(
      isPrompttraceBlobUrl(
        "https://github.com/u/r/blob/main/.prompttrace/x.prompttrace.jsonl",
      ),
    ).toBe(true);
  });
  it("matches with query and fragment", () => {
    expect(
      isPrompttraceBlobUrl(
        "https://github.com/u/r/blob/main/a/b/x.prompttrace.jsonl?plain=1#L10",
      ),
    ).toBe(true);
  });
  it("rejects files not ending in .prompttrace.jsonl", () => {
    expect(
      isPrompttraceBlobUrl("https://github.com/u/r/blob/main/README.md"),
    ).toBe(false);
    expect(
      isPrompttraceBlobUrl("https://github.com/u/r/blob/main/x.jsonl"),
    ).toBe(false);
  });
  it("rejects non-blob paths", () => {
    expect(
      isPrompttraceBlobUrl("https://github.com/u/r/tree/main/x.prompttrace.jsonl"),
    ).toBe(false);
  });
  it("rejects non-github origins", () => {
    expect(
      isPrompttraceBlobUrl("https://gitlab.com/u/r/blob/main/x.prompttrace.jsonl"),
    ).toBe(false);
  });
});

describe("parseBlobUrl", () => {
  it("extracts owner, repo, ref, path", () => {
    expect(
      parseBlobUrl(
        "https://github.com/acme/proj/blob/v1.2/dir/x.prompttrace.jsonl?q=1",
      ),
    ).toEqual({
      owner: "acme",
      repo: "proj",
      ref: "v1.2",
      path: "dir/x.prompttrace.jsonl",
    });
  });
  it("returns null on mismatch", () => {
    expect(parseBlobUrl("https://example.com")).toBeNull();
  });
});

describe("blobToRawUrl", () => {
  it("converts blob URL to raw URL", () => {
    expect(
      blobToRawUrl(
        "https://github.com/acme/proj/blob/main/.prompttrace/s.prompttrace.jsonl",
      ),
    ).toBe(
      "https://raw.githubusercontent.com/acme/proj/main/.prompttrace/s.prompttrace.jsonl",
    );
  });
  it("drops query and fragment from raw URL", () => {
    expect(
      blobToRawUrl(
        "https://github.com/a/b/blob/main/x.prompttrace.jsonl?plain=1#L1",
      ),
    ).toBe("https://raw.githubusercontent.com/a/b/main/x.prompttrace.jsonl");
  });
});
