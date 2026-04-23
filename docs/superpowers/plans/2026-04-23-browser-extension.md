# Browser Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome MV3 extension that renders `.prompttrace.jsonl` files on GitHub file pages into a readable conversation UI.

**Architecture:** Single content script (vanilla TypeScript + DOM APIs, no framework). Layers: `github/` (only place that touches GitHub DOM) → `parser/` (pure functions) → `render/` (pure DOM) → `theme/` (only place that styles). Controller owns a single URL lifecycle; SPA navigation via history-API hooks triggers controller reset. Zero network outside host permissions; zero storage; zero background worker.

**Tech Stack:** TypeScript 5, esbuild (IIFE bundle), vitest + jsdom, Chrome MV3. Reference: `docs/superpowers/specs/2026-04-23-browser-extension-design.md` + `prompttrace-cli/docs/schema-v1.md`.

---

## File Structure (locked during planning)

```
extension/
  manifest.json
  package.json
  tsconfig.json
  build.mjs
  .gitignore
  README.md
  src/
    content.ts                     # Entry, installs navigation + listens
    controller.ts                  # Per-URL lifecycle state machine
    github/
      url.ts                       # blob ↔ raw URL (pure)
      navigation.ts                # history wrap → 'prompttrace:navigate'
      mount.ts                     # insert container above file view
    parser/
      schema.ts                    # Types + guards + SUPPORTED_SCHEMA_VERSIONS
      jsonl-stream.ts              # chunk stream → JSON objects
    render/
      root.ts                      # toolbar + header + messages frame
      header.ts                    # title / summary / meta / warn / tags
      message.ts                   # user / assistant / tool bubbles
      blocks/
        text.ts                    # text + REDACTED/TRUNCATED pills
        tool-use.ts                # folded card + pretty-print on expand
        tool-result.ts             # lazy DOM-append + 100KB cap
      pretty-json.ts               # ~80 LOC formatter + key/string/number color
    theme/
      claude-code.ts               # theme CSS string
      registry.ts                  # source → theme
    lib/
      dom.ts                       # h(), cls(), no-innerHTML helpers
      escape.ts                    # text escape helpers
  test/
    github/url.test.ts
    parser/jsonl-stream.test.ts
    parser/schema.test.ts
    render/pretty-json.test.ts
    render/text-block.test.ts
    render/tool-use.test.ts
    render/tool-result.test.ts
    theme/registry.test.ts
    fixture.integration.test.ts
  dist/                             # gitignored build output
```

**Each task below corresponds to one file pair (src + test) or one coherent scaffold step.**

---

## Task 1: Scaffold `extension/` package

**Files:**
- Create: `extension/package.json`
- Create: `extension/tsconfig.json`
- Create: `extension/.gitignore`
- Create: `extension/README.md`

- [ ] **Step 1: Create `extension/package.json`**

```json
{
  "name": "show-me-your-prompt-extension",
  "private": true,
  "version": "0.1.0",
  "description": "Chrome MV3 extension that renders .prompttrace.jsonl on GitHub.",
  "type": "module",
  "scripts": {
    "build": "node build.mjs",
    "dev": "node build.mjs --watch",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.268",
    "@types/node": "^20.14.0",
    "esbuild": "^0.23.0",
    "jsdom": "^24.1.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `extension/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["chrome", "node"],
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": false,
    "noEmit": true
  },
  "include": ["src/**/*.ts", "test/**/*.ts", "build.mjs"]
}
```

- [ ] **Step 3: Create `extension/.gitignore`**

```
node_modules/
dist/
*.log
.DS_Store
```

- [ ] **Step 4: Create `extension/README.md`**

```markdown
# Show Me Your Prompt · Browser Extension

Chrome MV3 extension that renders `.prompttrace.jsonl` files on GitHub file pages.

## Dev

    npm install
    npm run build        # produces dist/
    npm test

Then in Chrome: `chrome://extensions` → Developer mode → Load unpacked → select `dist/`.

## Security

- Only fetches from `github.com` and `raw.githubusercontent.com`
- No storage, cookies, or third-party network requests
- Sanitization in `.prompttrace.jsonl` is best-effort (see CLI README) — this extension renders what the CLI wrote
```

- [ ] **Step 5: Install deps and commit**

```bash
cd extension && npm install
git add extension/package.json extension/tsconfig.json extension/.gitignore extension/README.md extension/package-lock.json
git commit -m "chore(extension): scaffold package with typescript + esbuild + vitest"
```

Expected: `npm install` finishes with no errors; `extension/node_modules/` populated; commit includes lockfile but not `node_modules/`.

---

## Task 2: Build script (`build.mjs`) and manifest

**Files:**
- Create: `extension/build.mjs`
- Create: `extension/src/manifest.ts`
- Create: `extension/src/content.ts` (stub)

- [ ] **Step 1: Create `extension/src/manifest.ts`** (single source of truth for manifest, emitted during build)

```ts
// Typed manifest; build.mjs imports and writes dist/manifest.json.
export const manifest = {
  manifest_version: 3,
  name: "Show Me Your Prompt",
  version: "0.1.0",
  description: "Render .prompttrace.jsonl on GitHub file pages.",
  permissions: [],
  host_permissions: [
    "https://github.com/*",
    "https://raw.githubusercontent.com/*",
  ],
  content_scripts: [
    {
      matches: ["https://github.com/*"],
      js: ["content.js"],
      run_at: "document_idle",
      all_frames: false,
    },
  ],
} as const;
```

- [ ] **Step 2: Create `extension/src/content.ts` stub**

```ts
// Entry point. Real lifecycle wiring lands in Task 11.
console.debug("[show-me-your-prompt] content script loaded");
```

- [ ] **Step 3: Create `extension/build.mjs`**

```js
#!/usr/bin/env node
import { build, context } from "esbuild";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";

const DIST = path.resolve("dist");
const watch = process.argv.includes("--watch");

async function writeManifest() {
  const mod = await import(pathToFileURL(path.resolve("src/manifest.ts")).href)
    .catch(async () => {
      // esbuild TS -> we transpile on demand for manifest
      const { transform } = await import("esbuild");
      const { readFile } = await import("node:fs/promises");
      const src = await readFile("src/manifest.ts", "utf8");
      const out = await transform(src, { loader: "ts", format: "esm" });
      const dataUrl =
        "data:text/javascript;base64," + Buffer.from(out.code).toString("base64");
      return await import(dataUrl);
    });
  await writeFile(
    path.join(DIST, "manifest.json"),
    JSON.stringify(mod.manifest, null, 2) + "\n",
  );
}

async function run() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  const opts = {
    entryPoints: ["src/content.ts"],
    bundle: true,
    format: "iife",
    target: "chrome114",
    outfile: path.join(DIST, "content.js"),
    sourcemap: watch ? "inline" : false,
    minify: !watch,
    legalComments: "none",
    logLevel: "info",
  };

  if (watch) {
    const ctx = await context(opts);
    await ctx.watch();
    await writeManifest();
    console.log("watching…");
  } else {
    await build(opts);
    await writeManifest();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 4: Run build to verify**

```bash
cd extension && npm run build
ls dist
```

Expected: `dist/content.js` and `dist/manifest.json` exist. `content.js` < 5 KB (stub).

- [ ] **Step 5: Commit**

```bash
git add extension/src/manifest.ts extension/src/content.ts extension/build.mjs
git commit -m "feat(extension): esbuild bundle + MV3 manifest emission"
```

---

## Task 3: `github/url.ts` — blob URL matching (pure function)

**Files:**
- Create: `extension/src/github/url.ts`
- Test: `extension/test/github/url.test.ts`

- [ ] **Step 1: Write failing tests**

Create `extension/test/github/url.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd extension && npm test -- github/url
```

Expected: tests fail because `src/github/url.ts` does not exist.

- [ ] **Step 3: Implement `src/github/url.ts`**

```ts
const BLOB_RE =
  /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+?\.prompttrace\.jsonl)(\?[^#]*)?(#.*)?$/;

export interface BlobParts {
  owner: string;
  repo: string;
  ref: string;
  path: string;
}

export function parseBlobUrl(url: string): BlobParts | null {
  const m = BLOB_RE.exec(url);
  if (!m) return null;
  return { owner: m[1]!, repo: m[2]!, ref: m[3]!, path: m[4]! };
}

export function isPrompttraceBlobUrl(url: string): boolean {
  return parseBlobUrl(url) !== null;
}

export function blobToRawUrl(url: string): string | null {
  const p = parseBlobUrl(url);
  if (!p) return null;
  return `https://raw.githubusercontent.com/${p.owner}/${p.repo}/${p.ref}/${p.path}`;
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm test -- github/url
```

Expected: 3 describes / ~8 assertions pass.

- [ ] **Step 5: Commit**

```bash
git add extension/src/github/url.ts extension/test/github/url.test.ts
git commit -m "feat(extension): github blob URL parser + raw URL mapper"
```

---

## Task 4: `parser/schema.ts` — types + guards

**Files:**
- Create: `extension/src/parser/schema.ts`
- Test: `extension/test/parser/schema.test.ts`

- [ ] **Step 1: Write failing tests**

Create `extension/test/parser/schema.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify fail**

```bash
npm test -- parser/schema
```

Expected: module not found.

- [ ] **Step 3: Implement `src/parser/schema.ts`**

```ts
export const SUPPORTED_SCHEMA_VERSIONS = [1] as const;
export type SupportedSchemaVersion = (typeof SUPPORTED_SCHEMA_VERSIONS)[number];

export interface SanitizationMeta {
  rules_applied: string[];
  redaction_count: number;
}

export interface MetaRecord {
  type: "meta";
  schema_version: number;
  source: string;
  source_session_id?: string;
  exported_at: string;
  exported_by: string;
  title: string;
  summary?: string;
  tags?: string[];
  sanitization: SanitizationMeta;
}

export type Role = "user" | "assistant" | "tool";

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}

export interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  output: string;
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export interface MessageRecord {
  type: "message";
  role: Role;
  uuid: string;
  parent_uuid: string | null;
  timestamp: string;
  content: ContentBlock[];
}

export type PrompttraceRecord = MetaRecord | MessageRecord;

export function isSupportedSchemaVersion(v: unknown): v is SupportedSchemaVersion {
  return typeof v === "number" && (SUPPORTED_SCHEMA_VERSIONS as readonly number[]).includes(v);
}

export function isMetaRecord(x: unknown): x is MetaRecord {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return (
    r.type === "meta" &&
    typeof r.schema_version === "number" &&
    typeof r.source === "string" &&
    typeof r.exported_at === "string" &&
    typeof r.exported_by === "string" &&
    typeof r.title === "string" &&
    !!r.sanitization &&
    typeof r.sanitization === "object"
  );
}

export function isMessageRecord(x: unknown): x is MessageRecord {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return (
    r.type === "message" &&
    (r.role === "user" || r.role === "assistant" || r.role === "tool") &&
    typeof r.uuid === "string" &&
    (r.parent_uuid === null || typeof r.parent_uuid === "string") &&
    typeof r.timestamp === "string" &&
    Array.isArray(r.content)
  );
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- parser/schema
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add extension/src/parser/schema.ts extension/test/parser/schema.test.ts
git commit -m "feat(extension): schema v1 types + runtime guards"
```

---

## Task 5: `parser/jsonl-stream.ts` — streaming JSONL decoder

**Files:**
- Create: `extension/src/parser/jsonl-stream.ts`
- Test: `extension/test/parser/jsonl-stream.test.ts`

- [ ] **Step 1: Write failing tests**

Create `extension/test/parser/jsonl-stream.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify fail**

```bash
npm test -- parser/jsonl-stream
```

- [ ] **Step 3: Implement `src/parser/jsonl-stream.ts`**

```ts
export class JsonlStreamDecoder {
  private readonly decoder = new TextDecoder("utf-8", { fatal: false });
  private buffer = "";
  private lineNo = 0;
  private seenFirstChunk = false;

  push(chunk: Uint8Array): unknown[] {
    let text = this.decoder.decode(chunk, { stream: true });
    if (!this.seenFirstChunk) {
      this.seenFirstChunk = true;
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    }
    this.buffer += text;
    return this.drainCompleteLines();
  }

  flush(): unknown[] {
    const tail = this.decoder.decode();
    if (tail) this.buffer += tail;
    if (this.buffer.length === 0) return [];
    // Treat remaining buffer as one final line (no trailing newline).
    const results: unknown[] = [];
    const trimmed = this.buffer.trim();
    this.buffer = "";
    if (trimmed.length > 0) {
      this.lineNo += 1;
      results.push(this.parseLine(trimmed, this.lineNo));
    }
    return results;
  }

  private drainCompleteLines(): unknown[] {
    const results: unknown[] = [];
    let idx: number;
    while ((idx = this.buffer.indexOf("\n")) !== -1) {
      const raw = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + 1);
      this.lineNo += 1;
      const trimmed = raw.trim();
      if (trimmed.length === 0) continue;
      results.push(this.parseLine(trimmed, this.lineNo));
    }
    return results;
  }

  private parseLine(line: string, no: number): unknown {
    try {
      return JSON.parse(line);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Invalid JSON on line ${no}: ${msg}`);
    }
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- parser/jsonl-stream
```

Expected: all 7 pass.

- [ ] **Step 5: Commit**

```bash
git add extension/src/parser/jsonl-stream.ts extension/test/parser/jsonl-stream.test.ts
git commit -m "feat(extension): streaming JSONL decoder with UTF-8 + BOM handling"
```

---

## Task 6: `lib/dom.ts` + `lib/escape.ts` — DOM helpers

**Files:**
- Create: `extension/src/lib/dom.ts`
- Create: `extension/src/lib/escape.ts`

No dedicated test file; these get exercised by the render-layer tests. Keep them tiny.

- [ ] **Step 1: Create `src/lib/escape.ts`**

```ts
// Explicit text-to-DOM helper. Everything that becomes visible goes through here.
export function textNode(s: string): Text {
  return document.createTextNode(s);
}
```

- [ ] **Step 2: Create `src/lib/dom.ts`**

```ts
type Attrs = Record<string, string | number | boolean | null | undefined>;
type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = String(v);
    else if (k.startsWith("data-")) el.setAttribute(k, String(v));
    else if (k in el) {
      // Direct assignment is safe for known DOM props, avoids innerHTML.
      (el as unknown as Record<string, unknown>)[k] = v;
    } else {
      el.setAttribute(k, String(v));
    }
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (typeof c === "string") el.appendChild(document.createTextNode(c));
    else el.appendChild(c);
  }
  return el;
}

export function cls(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
```

- [ ] **Step 3: Commit**

```bash
git add extension/src/lib/dom.ts extension/src/lib/escape.ts
git commit -m "feat(extension): DOM helpers (h, cls, textNode) — no innerHTML anywhere"
```

---

## Task 7: `render/pretty-json.ts` — JSON formatter with syntax color

**Files:**
- Create: `extension/src/render/pretty-json.ts`
- Test: `extension/test/render/pretty-json.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
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
```

- [ ] **Step 2: Run to verify fail**

```bash
npm test -- render/pretty-json
```

- [ ] **Step 3: Implement `src/render/pretty-json.ts`**

```ts
import { h } from "../lib/dom.js";

const INDENT = "  ";

export function renderPrettyJson(value: unknown): HTMLElement {
  const pre = h("pre", { class: "pt-json" });
  emit(pre, value, 0);
  return pre;
}

function emit(out: HTMLElement, v: unknown, depth: number): void {
  if (v === null) {
    span(out, "pt-json-null", "null");
    return;
  }
  if (typeof v === "boolean") {
    span(out, "pt-json-n", String(v));
    return;
  }
  if (typeof v === "number") {
    span(out, "pt-json-n", String(v));
    return;
  }
  if (typeof v === "string") {
    emitString(out, v);
    return;
  }
  if (Array.isArray(v)) {
    emitArray(out, v, depth);
    return;
  }
  if (typeof v === "object") {
    emitObject(out, v as Record<string, unknown>, depth);
    return;
  }
  // Fallback for undefined / function / symbol — shouldn't occur in JSON input.
  span(out, "pt-json-null", "null");
}

function emitString(out: HTMLElement, s: string): void {
  // Preserve real newlines inside string bodies so multi-line strings render readably.
  // Escape only the wrapping quotes and backslashes — NOT \n.
  const escaped = s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  span(out, "pt-json-s", `"${escaped}"`);
}

function emitArray(out: HTMLElement, arr: unknown[], depth: number): void {
  if (arr.length === 0) {
    span(out, "pt-json-punct", "[]");
    return;
  }
  span(out, "pt-json-punct", "[");
  const pad = INDENT.repeat(depth + 1);
  const outerPad = INDENT.repeat(depth);
  for (let i = 0; i < arr.length; i++) {
    out.appendChild(document.createTextNode("\n" + pad));
    emit(out, arr[i], depth + 1);
    if (i < arr.length - 1) span(out, "pt-json-punct", ",");
  }
  out.appendChild(document.createTextNode("\n" + outerPad));
  span(out, "pt-json-punct", "]");
}

function emitObject(out: HTMLElement, obj: Record<string, unknown>, depth: number): void {
  const keys = Object.keys(obj);
  if (keys.length === 0) {
    span(out, "pt-json-punct", "{}");
    return;
  }
  span(out, "pt-json-punct", "{");
  const pad = INDENT.repeat(depth + 1);
  const outerPad = INDENT.repeat(depth);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]!;
    out.appendChild(document.createTextNode("\n" + pad));
    span(out, "pt-json-k", JSON.stringify(k));
    span(out, "pt-json-punct", ": ");
    emit(out, obj[k], depth + 1);
    if (i < keys.length - 1) span(out, "pt-json-punct", ",");
  }
  out.appendChild(document.createTextNode("\n" + outerPad));
  span(out, "pt-json-punct", "}");
}

function span(out: HTMLElement, klass: string, text: string): void {
  out.appendChild(h("span", { class: klass }, text));
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- render/pretty-json
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add extension/src/render/pretty-json.ts extension/test/render/pretty-json.test.ts
git commit -m "feat(extension): pretty-json formatter with key/string/number coloring"
```

---

## Task 8: `render/blocks/text.ts` — text block with REDACTED/TRUNCATED pills

**Files:**
- Create: `extension/src/render/blocks/text.ts`
- Test: `extension/test/render/text-block.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
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
```

- [ ] **Step 2: Run to fail**

```bash
npm test -- render/text-block
```

- [ ] **Step 3: Implement `src/render/blocks/text.ts`**

```ts
import { h } from "../../lib/dom.js";

const MARKER_RE = /<REDACTED:[A-Z_]+>|<TRUNCATED:[^>]+>/g;

export function renderTextBlock(text: string): HTMLElement {
  const wrap = h("span", { class: "pt-text" });
  let lastIndex = 0;
  for (const m of text.matchAll(MARKER_RE)) {
    const i = m.index!;
    if (i > lastIndex) {
      wrap.appendChild(document.createTextNode(text.slice(lastIndex, i)));
    }
    wrap.appendChild(renderMarker(m[0]));
    lastIndex = i + m[0].length;
  }
  if (lastIndex < text.length) {
    wrap.appendChild(document.createTextNode(text.slice(lastIndex)));
  }
  return wrap;
}

function renderMarker(marker: string): HTMLElement {
  if (marker.startsWith("<TRUNCATED:")) {
    return h(
      "span",
      { class: "pt-truncated", title: "Output truncated to keep the page responsive" },
      marker,
    );
  }
  return h(
    "span",
    { class: "pt-redacted", title: "This position was redacted by the CLI" },
    marker,
  );
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- render/text-block
```

- [ ] **Step 5: Commit**

```bash
git add extension/src/render/blocks/text.ts extension/test/render/text-block.test.ts
git commit -m "feat(extension): text block with REDACTED/TRUNCATED pill rendering"
```

---

## Task 9: `render/blocks/tool-use.ts` + `render/blocks/tool-result.ts`

**Files:**
- Create: `extension/src/render/blocks/tool-use.ts`
- Create: `extension/src/render/blocks/tool-result.ts`
- Test: `extension/test/render/tool-use.test.ts`
- Test: `extension/test/render/tool-result.test.ts`

### Part A: tool-use

- [ ] **Step 1: Write `test/render/tool-use.test.ts`**

```ts
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
```

- [ ] **Step 2: Run to fail**

```bash
npm test -- render/tool-use
```

- [ ] **Step 3: Implement `src/render/blocks/tool-use.ts`**

```ts
import { h } from "../../lib/dom.js";
import type { ToolUseBlock } from "../../parser/schema.js";
import { renderPrettyJson } from "../pretty-json.js";

export function renderToolUse(block: ToolUseBlock): HTMLElement {
  const el = h("div", { class: "pt-tool" });
  const caret = h("span", { class: "pt-caret" }, "▸");
  const name = h("span", { class: "pt-tool-name" }, block.name);
  const summary = h("span", { class: "pt-tool-summary" }, summarizeInput(block.input));
  const head = h("div", { class: "pt-tool-head", role: "button", tabindex: 0 },
    caret, name, summary);
  el.appendChild(head);

  let expanded = false;
  let bodyEl: HTMLElement | null = null;
  const toggle = () => {
    expanded = !expanded;
    caret.textContent = expanded ? "▾" : "▸";
    if (expanded) {
      bodyEl = h("div", { class: "pt-tool-input-body" }, renderPrettyJson(block.input));
      head.insertAdjacentElement("afterend", bodyEl);
      el.classList.add("pt-tool-expanded");
    } else if (bodyEl) {
      bodyEl.remove();
      bodyEl = null;
      el.classList.remove("pt-tool-expanded");
    }
  };
  head.addEventListener("click", toggle);
  head.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
  });
  return el;
}

function summarizeInput(input: unknown): string {
  if (input === null || input === undefined) return "";
  if (typeof input === "string") return truncate(input);
  if (typeof input !== "object") return truncate(String(input));
  const keys = Object.keys(input as Record<string, unknown>);
  if (keys.length === 0) return "{}";
  const k = keys[0]!;
  const v = (input as Record<string, unknown>)[k];
  const vs = typeof v === "string" ? v : JSON.stringify(v);
  return truncate(`${k}: ${vs}`);
}

function truncate(s: string, max = 120): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}
```

- [ ] **Step 4: Run**

```bash
npm test -- render/tool-use
```

### Part B: tool-result

- [ ] **Step 5: Write `test/render/tool-result.test.ts`**

```ts
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
```

- [ ] **Step 6: Implement `src/render/blocks/tool-result.ts`**

```ts
import { h } from "../../lib/dom.js";
import type { ToolResultBlock } from "../../parser/schema.js";

const TRUNCATE_BYTES_CAP = 100 * 1024;
const KEEP_EACH_SIDE = 4 * 1024;
export const __TRUNCATE_BYTES_CAP_FOR_TEST = TRUNCATE_BYTES_CAP;

export function renderToolResult(block: ToolResultBlock): HTMLElement {
  const el = h("div", { class: "pt-tool-result" });
  const caret = h("span", { class: "pt-caret" }, "▸");
  const label = h("span", {}, "tool_result");
  const size = h("span", { class: "pt-tool-result-size" }, formatBytes(block.output.length));
  const head = h(
    "div",
    { class: "pt-tool-result-head", role: "button", tabindex: 0 },
    caret, label, size,
  );
  el.appendChild(head);

  let expanded = false;
  let bodyEl: HTMLElement | null = null;

  const toggle = () => {
    expanded = !expanded;
    caret.textContent = expanded ? "▾" : "▸";
    if (expanded) {
      bodyEl = buildBody(block.output);
      head.insertAdjacentElement("afterend", bodyEl);
    } else if (bodyEl) {
      bodyEl.remove();
      bodyEl = null;
    }
  };
  head.addEventListener("click", toggle);
  head.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
  });
  return el;
}

function buildBody(output: string): HTMLElement {
  const body = h("pre", { class: "pt-tool-result-body" });
  if (output.length <= TRUNCATE_BYTES_CAP) {
    body.appendChild(document.createTextNode(output));
    return body;
  }
  const headPart = output.slice(0, KEEP_EACH_SIDE);
  const tailPart = output.slice(output.length - KEEP_EACH_SIDE);
  const hidden = output.length - headPart.length - tailPart.length;

  body.appendChild(document.createTextNode(headPart));
  body.appendChild(document.createTextNode("\n"));
  body.appendChild(
    h(
      "span",
      { class: "pt-truncated", title: "Client-side secondary truncation" },
      `<TRUNCATED: ${formatBytes(hidden)} hidden>`,
    ),
  );
  body.appendChild(document.createTextNode("\n"));
  body.appendChild(document.createTextNode(tailPart));

  const expandAll = h(
    "a",
    { class: "pt-expand-all", href: "#", role: "button" },
    "Show all (may be slow)",
  );
  expandAll.addEventListener("click", (e) => {
    e.preventDefault();
    body.textContent = output;
  });
  body.appendChild(document.createTextNode("\n"));
  body.appendChild(expandAll);
  return body;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
```

- [ ] **Step 7: Run both suites and commit**

```bash
npm test -- render/tool-use render/tool-result
git add extension/src/render/blocks/tool-use.ts extension/src/render/blocks/tool-result.ts \
        extension/test/render/tool-use.test.ts extension/test/render/tool-result.test.ts
git commit -m "feat(extension): tool_use (expandable pretty input) + tool_result (lazy + 100KB cap)"
```

---

## Task 10: `theme/` — claude-code theme + registry

**Files:**
- Create: `extension/src/theme/claude-code.ts`
- Create: `extension/src/theme/registry.ts`
- Test: `extension/test/theme/registry.test.ts`

- [ ] **Step 1: Create `src/theme/claude-code.ts`**

```ts
// v1: single theme. Export a CSS string that the render root injects once.
export const CLAUDE_CODE_CSS = `
.pt-root {
  background: #F5F2EC; color: #2b2622;
  font-family: -apple-system, "SF Pro Text", system-ui, sans-serif;
  font-size: 14px; line-height: 1.55;
  padding: 20px 24px;
  border: 1px solid #E5DFD4; border-radius: 8px;
  margin: 12px 0;
}
.pt-toolbar {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 18px; padding-bottom: 14px;
  border-bottom: 1px solid #E5DFD4;
}
.pt-toggle { display: inline-flex; background: white; border: 1px solid #D9D1C2; border-radius: 6px; overflow: hidden; font-size: 12px; }
.pt-toggle button { padding: 5px 12px; background: none; border: 0; cursor: pointer; color: #6e6356; font-weight: 500; }
.pt-toggle button.active { background: #CC7859; color: white; }
.pt-source-chip { background: white; border: 1px solid #D9D1C2; padding: 4px 10px; border-radius: 999px; font-size: 11px; color: #6e6356; display: inline-flex; align-items: center; gap: 6px; }
.pt-source-chip .dot { width: 8px; height: 8px; border-radius: 50%; background: #CC7859; display: inline-block; }
.pt-title { font-size: 20px; font-weight: 600; margin: 0 0 4px; color: #1a1614; }
.pt-summary { color: #5a4f42; font-size: 14px; margin: 2px 0 10px; max-width: 60ch; }
.pt-meta { color: #8a7e6e; font-size: 12px; display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 10px; }
.pt-meta .sep { color: #C5BBA8; }
.pt-warn { background: #FFF3E0; border: 1px solid #E8C394; color: #8B5A1B; padding: 6px 10px; border-radius: 4px; font-size: 12px; display: inline-flex; align-items: center; gap: 6px; margin-bottom: 10px; }
.pt-error { background: #FCEAE7; border: 1px solid #E8B4A8; color: #8B2E1B; padding: 10px 14px; border-radius: 4px; font-size: 13px; display: flex; align-items: center; gap: 10px; }
.pt-error button { margin-left: auto; background: white; border: 1px solid #D9A89C; color: #8B2E1B; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-weight: 500; }
.pt-tags { display: flex; gap: 6px; flex-wrap: wrap; }
.pt-tag { background: white; border: 1px solid #D9D1C2; color: #6e6356; padding: 2px 10px; border-radius: 999px; font-size: 11px; }
.pt-messages { margin-top: 20px; display: flex; flex-direction: column; gap: 14px; }
.pt-msg { max-width: 82%; }
.pt-msg-user { align-self: flex-end; max-width: 72%; background: #CC7859; color: white; padding: 10px 14px; border-radius: 16px 16px 4px 16px; }
.pt-msg-assistant, .pt-msg-tool { align-self: flex-start; background: white; border: 1px solid #E5DFD4; padding: 12px 14px; border-radius: 4px 16px 16px 16px; }
.pt-msg-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #B39A7C; margin-bottom: 4px; font-weight: 600; }
.pt-msg-user .pt-msg-label { color: rgba(255,255,255,0.75); }
.pt-text { white-space: pre-wrap; }
.pt-redacted { background: #EFE8DB; border: 1px dashed #C5BBA8; color: #8B7A5A; padding: 0 6px; border-radius: 3px; font-family: "SF Mono", Consolas, monospace; font-size: 12px; cursor: help; }
.pt-truncated { background: #EFE8DB; border: 1px dashed #C5BBA8; color: #8B7A5A; padding: 0 6px; border-radius: 3px; font-family: "SF Mono", Consolas, monospace; font-size: 12px; }
.pt-msg-user .pt-redacted { background: rgba(255,255,255,0.18); border-color: rgba(255,255,255,0.45); color: white; }
.pt-tool { border: 1px solid #E5DFD4; border-radius: 6px; background: #FAF7F0; margin-top: 10px; overflow: hidden; }
.pt-tool-head { padding: 8px 12px; display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; }
.pt-tool.pt-tool-expanded .pt-tool-head { border-bottom: 1px solid #E5DFD4; }
.pt-caret { color: #B39A7C; font-size: 10px; font-family: monospace; width: 10px; display: inline-block; }
.pt-tool-name { background: white; border: 1px solid #D9D1C2; padding: 1px 7px; border-radius: 3px; font-family: "SF Mono", Consolas, monospace; font-size: 11px; color: #8B5A1B; font-weight: 600; }
.pt-tool-summary { font-family: "SF Mono", Consolas, monospace; font-size: 12px; color: #6e6356; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
.pt-tool-input-body { padding: 10px 12px; background: #FDFBF6; border-bottom: 1px solid #E5DFD4; }
.pt-tool-result { border: 1px solid #E5DFD4; border-radius: 6px; background: #FAF7F0; margin-top: 8px; overflow: hidden; }
.pt-tool-result-head { padding: 7px 12px; background: #F0EADC; font-size: 12px; color: #6e6356; display: flex; align-items: center; gap: 6px; cursor: pointer; }
.pt-tool-result-size { margin-left: auto; color: #8a7e6e; }
.pt-tool-result-body { background: white; padding: 10px 12px; font-family: "SF Mono", Consolas, monospace; font-size: 12px; color: #3d342a; white-space: pre; overflow-x: auto; margin: 0; }
.pt-expand-all { color: #CC7859; font-size: 11px; cursor: pointer; text-decoration: underline dotted; }
.pt-json { background: transparent; font-family: "SF Mono", Consolas, monospace; font-size: 12px; color: #3d342a; margin: 0; white-space: pre; overflow-x: auto; }
.pt-json-k { color: #CC7859; }
.pt-json-s { color: #4e7a3a; }
.pt-json-n { color: #8B5A1B; }
.pt-json-null { color: #8a7e6e; font-style: italic; }
.pt-json-punct { color: #8a7e6e; }
`;
```

- [ ] **Step 2: Create `src/theme/registry.ts`**

```ts
import { CLAUDE_CODE_CSS } from "./claude-code.js";

export interface Theme {
  id: string;
  css: string;
}

const THEMES: Record<string, Theme> = {
  "claude-code": { id: "claude-code", css: CLAUDE_CODE_CSS },
};

export function themeFor(source: string): Theme {
  return THEMES[source] ?? THEMES["claude-code"]!;
}
```

- [ ] **Step 3: Write `test/theme/registry.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { themeFor } from "../../src/theme/registry.js";

describe("themeFor", () => {
  it("returns claude-code theme for claude-code source", () => {
    expect(themeFor("claude-code").id).toBe("claude-code");
  });
  it("falls back to claude-code for unknown source", () => {
    expect(themeFor("cursor").id).toBe("claude-code");
  });
});
```

- [ ] **Step 4: Run & commit**

```bash
npm test -- theme/registry
git add extension/src/theme/claude-code.ts extension/src/theme/registry.ts extension/test/theme/registry.test.ts
git commit -m "feat(extension): claude-code theme + source→theme registry"
```

---

## Task 11: `render/message.ts` + `render/header.ts` + `render/root.ts`

**Files:**
- Create: `extension/src/render/message.ts`
- Create: `extension/src/render/header.ts`
- Create: `extension/src/render/root.ts`

These wire the primitives from Tasks 7-10 together. Integration coverage comes in Task 13 via the fixture test.

- [ ] **Step 1: Create `src/render/message.ts`**

```ts
import { h } from "../lib/dom.js";
import type { MessageRecord, ContentBlock } from "../parser/schema.js";
import { renderTextBlock } from "./blocks/text.js";
import { renderToolUse } from "./blocks/tool-use.js";
import { renderToolResult } from "./blocks/tool-result.js";

export function renderMessage(msg: MessageRecord): HTMLElement {
  const wrap = h("div", { class: `pt-msg pt-msg-${msg.role}` });
  wrap.appendChild(h("div", { class: "pt-msg-label" }, msg.role));
  for (const block of msg.content) {
    const node = renderBlock(block);
    if (node) wrap.appendChild(node);
  }
  return wrap;
}

function renderBlock(block: ContentBlock): HTMLElement | null {
  switch (block.type) {
    case "text": return renderTextBlock(block.text);
    case "tool_use": return renderToolUse(block);
    case "tool_result": return renderToolResult(block);
    default: {
      const unknown = block as { type?: string };
      return h(
        "span",
        { class: "pt-unknown-block", title: "Unknown content block" },
        `<unknown block: type=${unknown.type ?? "?"}>`,
      );
    }
  }
}
```

- [ ] **Step 2: Create `src/render/header.ts`**

```ts
import { h } from "../lib/dom.js";
import type { MetaRecord } from "../parser/schema.js";

export interface HeaderCallbacks {
  onToggleRendered: (rendered: boolean) => void;
}

export function renderHeader(
  meta: MetaRecord,
  messageCount: number,
  cb: HeaderCallbacks,
): { root: HTMLElement; setMode: (mode: "rendered" | "raw") => void } {
  const sourceChip = h(
    "span",
    { class: "pt-source-chip" },
    h("span", { class: "dot" }),
    meta.source,
  );
  const renderedBtn = h("button", { class: "active" }, "Rendered");
  const rawBtn = h("button", {}, "Raw");
  const toggle = h("div", { class: "pt-toggle" }, renderedBtn, rawBtn);
  renderedBtn.addEventListener("click", () => cb.onToggleRendered(true));
  rawBtn.addEventListener("click", () => cb.onToggleRendered(false));

  const toolbar = h("div", { class: "pt-toolbar" }, sourceChip, toggle);
  const title = h("h1", { class: "pt-title" }, meta.title);

  const children: Node[] = [toolbar, title];
  if (meta.summary && meta.summary.trim().length > 0) {
    children.push(h("p", { class: "pt-summary" }, meta.summary));
  }
  children.push(h(
    "div",
    { class: "pt-meta" },
    h("span", {}, `exported ${meta.exported_at}`),
    h("span", { class: "sep" }, "·"),
    h("span", {}, `${messageCount} messages`),
    h("span", { class: "sep" }, "·"),
    h("span", {}, meta.exported_by),
  ));
  if (meta.sanitization.redaction_count > 0) {
    children.push(h(
      "div",
      { class: "pt-warn" },
      `⚠ ${meta.sanitization.redaction_count} redactions applied · rules: ${meta.sanitization.rules_applied.join(", ")}`,
    ));
  }
  if (meta.tags && meta.tags.length > 0) {
    const tagEls = meta.tags.map((t) => h("span", { class: "pt-tag" }, t));
    children.push(h("div", { class: "pt-tags" }, ...tagEls));
  }

  const root = h("div", {}, ...children);

  const setMode = (mode: "rendered" | "raw") => {
    renderedBtn.className = mode === "rendered" ? "active" : "";
    rawBtn.className = mode === "raw" ? "active" : "";
  };

  return { root, setMode };
}
```

- [ ] **Step 3: Create `src/render/root.ts`**

```ts
import { h } from "../lib/dom.js";
import type { MetaRecord, MessageRecord } from "../parser/schema.js";
import { themeFor } from "../theme/registry.js";
import { renderHeader } from "./header.js";
import { renderMessage } from "./message.js";

export interface RootApi {
  element: HTMLElement;
  appendMessage: (m: MessageRecord) => void;
  setMode: (mode: "rendered" | "raw") => void;
  showWarning: (text: string) => void;
  showError: (text: string, onRetry?: () => void) => void;
}

export interface RootCallbacks {
  onToggleRendered: (rendered: boolean) => void;
}

let themeInjected = false;

export function renderRoot(
  meta: MetaRecord,
  cb: RootCallbacks,
): RootApi {
  ensureTheme(meta.source);
  const messagesWrap = h("div", { class: "pt-messages" });
  const header = renderHeader(meta, 0, cb);
  const metaEl = header.root.querySelector(".pt-meta .pt-count") as HTMLElement | null;
  const messagesCountEl = header.root.querySelectorAll(".pt-meta span")[2] as HTMLElement;

  const root = h("div", { class: "pt-root", "data-theme": meta.source },
    header.root,
    messagesWrap,
  );

  let count = 0;
  const appendMessage = (m: MessageRecord) => {
    count += 1;
    messagesWrap.appendChild(renderMessage(m));
    if (messagesCountEl) messagesCountEl.textContent = `${count} messages`;
  };

  const showWarning = (text: string) => {
    header.root.appendChild(h("div", { class: "pt-warn" }, text));
  };

  const showError = (text: string, onRetry?: () => void) => {
    const existing = root.querySelector(".pt-error");
    if (existing) existing.remove();
    const children: Node[] = [h("span", {}, `✕ ${text}`)];
    if (onRetry) {
      const btn = h("button", {}, "Retry");
      btn.addEventListener("click", () => {
        btn.disabled = true;
        onRetry();
      });
      children.push(btn);
    }
    root.appendChild(h("div", { class: "pt-error" }, ...children));
  };

  return { element: root, appendMessage, setMode: header.setMode, showWarning, showError };
}

function ensureTheme(source: string): void {
  if (themeInjected) return;
  themeInjected = true;
  const style = document.createElement("style");
  style.id = "prompttrace-theme";
  style.textContent = themeFor(source).css;
  document.head.appendChild(style);
}
```

- [ ] **Step 4: Commit**

```bash
git add extension/src/render/message.ts extension/src/render/header.ts extension/src/render/root.ts
git commit -m "feat(extension): render root + header + message dispatch"
```

---

## Task 12: `github/navigation.ts` + `github/mount.ts`

**Files:**
- Create: `extension/src/github/navigation.ts`
- Create: `extension/src/github/mount.ts`

No tests — these are the thin DOM-observation layer. Tested end-to-end via the manual QA checklist (Task 15).

- [ ] **Step 1: Create `src/github/navigation.ts`**

```ts
export const NAV_EVENT = "prompttrace:navigate";

let installed = false;

export function installNavigationListener(): void {
  if (installed) return;
  installed = true;
  const fire = () => window.dispatchEvent(new CustomEvent(NAV_EVENT, { detail: { url: location.href } }));
  for (const m of ["pushState", "replaceState"] as const) {
    const orig = history[m];
    history[m] = function (this: History, ...args: Parameters<typeof orig>) {
      const ret = orig.apply(this, args as any);
      fire();
      return ret;
    } as typeof orig;
  }
  window.addEventListener("popstate", fire);
}
```

- [ ] **Step 2: Create `src/github/mount.ts`**

```ts
const CONTAINER_ID = "prompttrace-container";

const SELECTORS = [
  'react-app[app-name="react-code-view"]',
  '[data-testid="code-view"]',
  "#repo-content-turbo-frame",
  "#repo-content-pjax-container",
  "main",
];

export async function waitForFileView(timeoutMs = 3000): Promise<HTMLElement | null> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    const check = () => {
      for (const sel of SELECTORS) {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (el) return resolve(el);
      }
      if (Date.now() > deadline) return resolve(null);
      setTimeout(check, 100);
    };
    check();
  });
}

export interface Mounted {
  container: HTMLElement;
  nativeView: HTMLElement;
  unmount: () => void;
}

export function insertContainerAbove(nativeView: HTMLElement): Mounted {
  removeExistingContainer();
  const container = document.createElement("div");
  container.id = CONTAINER_ID;
  nativeView.parentElement?.insertBefore(container, nativeView);
  const originalDisplay = nativeView.style.display;
  const unmount = () => {
    container.remove();
    nativeView.style.display = originalDisplay;
  };
  return { container, nativeView, unmount };
}

export function setNativeViewVisible(m: Mounted, visible: boolean): void {
  m.nativeView.style.display = visible ? "" : "none";
}

function removeExistingContainer(): void {
  document.getElementById(CONTAINER_ID)?.remove();
}
```

- [ ] **Step 3: Commit**

```bash
git add extension/src/github/navigation.ts extension/src/github/mount.ts
git commit -m "feat(extension): SPA navigation hook + native-view mount"
```

---

## Task 13: `controller.ts` + fixture integration test

**Files:**
- Create: `extension/src/controller.ts`
- Test: `extension/test/fixture.integration.test.ts`

- [ ] **Step 1: Write failing integration test**

```ts
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
```

- [ ] **Step 2: Run to verify fail** (controller not needed for this test yet, but wire the fixture works)

```bash
npm test -- fixture.integration
```

Expected: pass (all pieces already implemented in Tasks 4-11). If it fails, fix before Step 3.

- [ ] **Step 3: Implement `src/controller.ts`**

```ts
import { blobToRawUrl } from "./github/url.js";
import { waitForFileView, insertContainerAbove, setNativeViewVisible, type Mounted } from "./github/mount.js";
import { JsonlStreamDecoder } from "./parser/jsonl-stream.js";
import { isMetaRecord, isMessageRecord, isSupportedSchemaVersion, type MetaRecord } from "./parser/schema.js";
import { renderRoot, type RootApi } from "./render/root.js";

type State = "init" | "loading" | "rendered" | "raw" | "degraded" | "error" | "disposed";

export class Controller {
  private state: State = "init";
  private abort = new AbortController();
  private mounted: Mounted | null = null;
  private api: RootApi | null = null;
  private readonly blobUrl: string;

  constructor(blobUrl: string) { this.blobUrl = blobUrl; }

  async run(): Promise<void> {
    this.state = "loading";
    const nativeView = await waitForFileView();
    if (this.state === "disposed") return;
    if (!nativeView) { this.state = "degraded"; return; }
    this.mounted = insertContainerAbove(nativeView);
    try {
      await this.fetchAndRender();
    } catch (e) {
      if (this.state === "disposed") return;
      if ((e as Error).name === "AbortError") return;
      console.error("[show-me-your-prompt]", e);
      this.state = "degraded";
      this.dispose();
    }
  }

  dispose(): void {
    if (this.state === "disposed") return;
    this.state = "disposed";
    this.abort.abort();
    this.mounted?.unmount();
    this.mounted = null;
  }

  private async fetchAndRender(): Promise<void> {
    const raw = blobToRawUrl(this.blobUrl);
    if (!raw) { this.dispose(); return; }
    let resp: Response;
    try {
      resp = await fetch(raw, { signal: this.abort.signal });
    } catch (e) {
      this.showFetchError();
      return;
    }
    if (resp.status === 403) { this.dispose(); return; }
    if (!resp.ok || !resp.body) { this.showDegraded(`HTTP ${resp.status}`); return; }

    const reader = resp.body.getReader();
    const dec = new JsonlStreamDecoder();
    let meta: MetaRecord | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const records = dec.push(value);
      if (!this.consume(records, (m) => (meta = m))) return;
      if (!meta) continue;
    }
    const tail = dec.flush();
    this.consume(tail, (m) => (meta = m));

    if (!meta) {
      this.showDegraded("missing meta record");
    }
  }

  private consume(records: unknown[], onMeta: (m: MetaRecord) => void): boolean {
    for (const r of records) {
      if (isMetaRecord(r)) {
        if (!isSupportedSchemaVersion(r.schema_version)) {
          this.showUnsupportedVersion(r);
          return false;
        }
        if (!this.api) {
          this.api = renderRoot(r, { onToggleRendered: (on) => this.setRendered(on) });
          this.mounted!.container.appendChild(this.api.element);
          this.state = "rendered";
          setNativeViewVisible(this.mounted!, false);
        }
        onMeta(r);
      } else if (isMessageRecord(r)) {
        this.api?.appendMessage(r);
      }
    }
    return true;
  }

  private setRendered(on: boolean): void {
    if (!this.api || !this.mounted) return;
    this.api.element.style.display = on ? "" : "none";
    setNativeViewVisible(this.mounted, !on);
    this.api.setMode(on ? "rendered" : "raw");
    this.state = on ? "rendered" : "raw";
  }

  private showFetchError(): void {
    if (!this.mounted) return;
    if (!this.api) {
      const fallbackMeta: MetaRecord = {
        type: "meta",
        schema_version: 1,
        source: "claude-code",
        exported_at: "",
        exported_by: "",
        title: ".prompttrace.jsonl",
        sanitization: { rules_applied: [], redaction_count: 0 },
      };
      this.api = renderRoot(fallbackMeta, { onToggleRendered: () => {} });
      this.mounted.container.appendChild(this.api.element);
    }
    this.api.showError("Failed to load .prompttrace.jsonl — network error", () => {
      this.abort = new AbortController();
      this.fetchAndRender().catch((e) => console.error(e));
    });
    this.state = "error";
  }

  private showUnsupportedVersion(r: MetaRecord): void {
    if (!this.mounted) return;
    this.api = renderRoot(
      { ...r, title: r.title },
      { onToggleRendered: () => {} },
    );
    this.mounted.container.appendChild(this.api.element);
    this.api.showWarning(
      `⚠ This file was generated by a newer prompttrace (schema_version ${r.schema_version}). Please upgrade the extension.`,
    );
    this.state = "degraded";
  }

  private showDegraded(reason: string): void {
    if (!this.mounted) return;
    if (!this.api) {
      const fallbackMeta: MetaRecord = {
        type: "meta",
        schema_version: 1,
        source: "claude-code",
        exported_at: "",
        exported_by: "",
        title: "Unrecognized .prompttrace.jsonl",
        sanitization: { rules_applied: [], redaction_count: 0 },
      };
      this.api = renderRoot(fallbackMeta, { onToggleRendered: () => {} });
      this.mounted.container.appendChild(this.api.element);
    }
    this.api.showWarning(`⚠ Unrecognized .prompttrace.jsonl format (${reason}). Falling back to raw view.`);
    setNativeViewVisible(this.mounted, true);
    this.state = "degraded";
  }
}
```

- [ ] **Step 4: Run full test suite**

```bash
cd extension && npm test
```

Expected: all tests across tasks 3-10 + fixture integration pass.

- [ ] **Step 5: Commit**

```bash
git add extension/src/controller.ts extension/test/fixture.integration.test.ts
git commit -m "feat(extension): controller state machine + fixture integration test"
```

---

## Task 14: Wire `content.ts` entry and verify bundle

**Files:**
- Modify: `extension/src/content.ts`

- [ ] **Step 1: Replace stub with real entry**

```ts
import { installNavigationListener, NAV_EVENT } from "./github/navigation.js";
import { isPrompttraceBlobUrl } from "./github/url.js";
import { Controller } from "./controller.js";

let active: Controller | null = null;

function onNav(url: string): void {
  active?.dispose();
  active = null;
  if (!isPrompttraceBlobUrl(url)) return;
  active = new Controller(url);
  active.run().catch((e) => console.error("[show-me-your-prompt]", e));
}

installNavigationListener();
window.addEventListener(NAV_EVENT, (e) => onNav((e as CustomEvent).detail.url));
onNav(location.href);
```

- [ ] **Step 2: Build and inspect bundle size**

```bash
cd extension && npm run build
wc -c dist/content.js
```

Expected: `dist/content.js` under 100 KB (minified). If larger, inspect with `esbuild --analyze` and trim.

- [ ] **Step 3: Full test run**

```bash
npm test
```

Expected: all suites green.

- [ ] **Step 4: Commit**

```bash
git add extension/src/content.ts
git commit -m "feat(extension): wire content entry — install navigation + dispatch controller"
```

---

## Task 15: Manual QA checklist + security self-audit

**Files:**
- Modify: `extension/README.md` (append QA section)

- [ ] **Step 1: Append the manual QA + security self-audit checklist to `extension/README.md`**

```markdown

## Manual QA (run before each release)

Load `dist/` in `chrome://extensions` (Developer mode → Load unpacked), then verify:

- [ ] Open a public GitHub repo with a `.prompttrace.jsonl` file — renders correctly
- [ ] Click `Raw` in the toolbar — native GitHub view reappears; `Rendered` restores
- [ ] Navigate (via GitHub SPA) to another `.prompttrace.jsonl` — prior container disposed, new one mounts
- [ ] Navigate away to README.md — extension container disappears, no errors in console
- [ ] Expand a `tool_use` — pretty-printed JSON with key/string coloring, `\n` inside strings renders as real newlines
- [ ] Expand a `tool_result` — body is only added to DOM on click; collapse removes it
- [ ] `.prompttrace.jsonl` containing a >100 KB tool_result — truncated head/tail visible; "Show all" link works
- [ ] Navigate to a private-repo `.prompttrace.jsonl` (signed in) — extension does NOT appear; native view works
- [ ] Offline test (DevTools → Network → Offline) — error bar with Retry button; clicking Retry triggers a new fetch
- [ ] Create a `.prompttrace.jsonl` with `schema_version: 2` — warning bar appears; messages not rendered; native view stays visible
- [ ] Create a malformed `.prompttrace.jsonl` (first line `not json`) — no extension UI; `console.error` entry logged
- [ ] DevTools → Network — confirm no requests to any host other than `github.com` / `raw.githubusercontent.com`
- [ ] DevTools → Application → Storage — confirm no cookies/localStorage/IndexedDB entries created by the extension

## Security self-audit

- [ ] `grep -R "innerHTML" extension/src` returns 0 matches
- [ ] `manifest.json` contains only `github.com` + `raw.githubusercontent.com` in `host_permissions`; `permissions` array is empty
- [ ] `grep -RE "fetch|XMLHttpRequest|WebSocket|EventSource" extension/src` — every hit goes to a raw.githubusercontent.com URL
```

- [ ] **Step 2: Run the two grep checks to verify they pass today**

```bash
cd extension
grep -R "innerHTML" src && echo "FAIL: innerHTML present" || echo "OK: no innerHTML"
grep -RE "fetch|XMLHttpRequest|WebSocket|EventSource" src
```

Expected: 0 innerHTML hits; the fetch grep should show only the `fetch(raw, ...)` call in `controller.ts`.

- [ ] **Step 3: Commit**

```bash
git add extension/README.md
git commit -m "docs(extension): manual QA checklist + security self-audit steps"
```

---

## Task 16: Self-review against the spec

- [ ] **Step 1: Read the spec and walk the plan**

Open `docs/superpowers/specs/2026-04-23-browser-extension-design.md` side-by-side with this plan. For each numbered section verify a task covers it:

| Spec section | Covered by |
| --- | --- |
| §3 Directory & module invariants | Tasks 1, 3-12 |
| §4 Manifest & permissions | Task 2 |
| §5 Lifecycle & SPA navigation | Tasks 12, 13, 14 |
| §6.1 Theme tokens | Task 10 |
| §6.2 Header (incl. summary row) | Task 11 |
| §6.3 Message bubbles | Tasks 10, 11 |
| §6.4 text block (pills) | Task 8 |
| §6.4 tool_use (pretty-print) | Tasks 7, 9 |
| §6.4 tool_result (lazy + 100KB cap) | Task 9 |
| §7 Degradation table | Task 13 (controller) |
| §8 Performance (streaming, lazy, cap) | Tasks 5, 9, 13 |
| §9 Build & distribute | Tasks 1, 2 |
| §10.1 Unit tests | Tasks 3-10 |
| §10.2 Fixture integration | Task 13 |
| §10.3 Manual E2E | Task 15 |
| §10.4 Security self-audit | Task 15 |

- [ ] **Step 2: If any row has no covered task, add one before Task 16**

- [ ] **Step 3: Final commit**

```bash
git commit --allow-empty -m "chore(extension): plan coverage verified against spec"
```
