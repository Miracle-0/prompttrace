# Markdown Rendering v1.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render message `text` blocks as safe Markdown in the browser extension while preserving redaction/truncation pills and leaving tool blocks unchanged.

**Architecture:** Add a focused Markdown helper at `extension/src/render/markdown.ts` that owns `marked`, `DOMPurify`, raw-HTML escaping, link hardening, and marker sentinel replacement. `extension/src/render/blocks/text.ts` finds existing marker tokens, replaces them with private-use sentinels, calls the helper once for the whole text block, then receives a safe `DocumentFragment`. Theme updates stay scoped to `.pt-md`.

**Tech Stack:** TypeScript 5, Vitest + jsdom, esbuild, `marked@18.0.2`, `dompurify@3.4.1`, Chrome MV3. Reference spec: `docs/superpowers/specs/2026-04-25-markdown-rendering-design.md`.

---

## File Structure

```
extension/
  package.json                         # Add runtime dependencies: marked, dompurify
  package-lock.json                    # npm install output
  src/
    render/
      markdown.ts                      # New safe Markdown rendering helper
      blocks/
        text.ts                        # Existing text block renderer; add sentinel integration
    theme/
      claude-code.ts                   # Existing theme CSS; add .pt-md scoped rules
  test/
    render/
      markdown.test.ts                 # New helper tests: Markdown + XSS + links
      text-block.test.ts               # Existing tests plus marker/Markdown integration
    theme/
      registry.test.ts                 # Existing tests plus markdown CSS selector coverage
```

`tool-use.ts`, `tool-result.ts`, `pretty-json.ts`, parser files, GitHub mounting files, and the manifest are not modified for v1.1.

---

### Task 1: Add Markdown Runtime Dependencies

**Files:**
- Modify: `extension/package.json`
- Modify: `extension/package-lock.json`

- [ ] **Step 1: Install exact dependency versions with a project-safe npm cache**

Run:

```bash
npm_config_cache=/tmp/prompttrace-npm-cache npm install marked@18.0.2 dompurify@3.4.1
```

Expected: command exits 0. `extension/package.json` gains:

```json
"dependencies": {
  "dompurify": "^3.4.1",
  "marked": "^18.0.2"
}
```

The exact order may be normalized by npm. `extension/package-lock.json` records both packages.

- [ ] **Step 2: Run the current extension tests after dependency install**

Run:

```bash
npm test
```

Expected: PASS. Baseline before Markdown behavior remains `10` test files and `59` tests passing.

- [ ] **Step 3: Commit dependency changes**

Run:

```bash
git add extension/package.json extension/package-lock.json
git commit -m "chore(extension): add markdown rendering dependencies"
```

Expected: commit succeeds and includes only dependency files.

---

### Task 2: Build the Safe Markdown Helper with Tests

**Files:**
- Create: `extension/test/render/markdown.test.ts`
- Create: `extension/src/render/markdown.ts`

- [ ] **Step 1: Write the failing Markdown helper test**

Create `extension/test/render/markdown.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the new helper test to verify RED**

Run:

```bash
npm test -- test/render/markdown.test.ts
```

Expected: FAIL because `../../src/render/markdown.js` does not exist.

- [ ] **Step 3: Implement the Markdown helper**

Create `extension/src/render/markdown.ts`:

```ts
import createDOMPurify from "dompurify";
import { Marked, Renderer } from "marked";

export interface MarkdownMarker {
  sentinel: string;
  createNode: () => HTMLElement;
}

const ALLOWED_TAGS = [
  "a",
  "blockquote",
  "br",
  "code",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "li",
  "ol",
  "p",
  "pre",
  "strong",
  "ul",
];

const ALLOWED_ATTR = ["href", "title"];

const renderer = new Renderer();
renderer.html = ({ text }) => escapeHtml(text);
renderer.image = ({ text }) => escapeHtml(text);

const marked = new Marked({
  async: false,
  breaks: false,
  gfm: true,
  renderer,
});

export function renderMarkdownText(
  markdown: string,
  markers: MarkdownMarker[] = [],
): DocumentFragment {
  const fallback = () => {
    const fragment = document.createDocumentFragment();
    fragment.appendChild(document.createTextNode(markdown));
    replaceMarkerSentinels(fragment, markers);
    return fragment;
  };

  try {
    const html = marked.parse(markdown) as string;
    const purify = createDOMPurify(globalThis.window);
    const clean = purify.sanitize(html, {
      ALLOW_DATA_ATTR: false,
      ALLOWED_ATTR,
      ALLOWED_TAGS,
      RETURN_DOM_FRAGMENT: true,
    });
    hardenLinks(clean);
    replaceMarkerSentinels(clean, markers);
    return clean;
  } catch {
    return fallback();
  }
}

function hardenLinks(root: DocumentFragment): void {
  for (const link of root.querySelectorAll("a")) {
    const href = link.getAttribute("href");
    if (href && isSafeHref(href)) {
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener");
    } else {
      link.removeAttribute("href");
      link.removeAttribute("target");
      link.setAttribute("rel", "noopener");
    }
  }
}

function isSafeHref(href: string): boolean {
  const trimmed = href.trim();
  if (trimmed.length === 0) return false;

  const protocolMatch = /^[a-zA-Z][a-zA-Z\d+.-]*:/.exec(trimmed);
  if (!protocolMatch) return true;

  const protocol = protocolMatch[0].toLowerCase();
  return protocol === "http:" || protocol === "https:" || protocol === "mailto:";
}

function replaceMarkerSentinels(
  root: DocumentFragment,
  markers: MarkdownMarker[],
): void {
  if (markers.length === 0) return;

  const markerBySentinel = new Map(markers.map((m) => [m.sentinel, m]));
  const pattern = new RegExp(markers.map((m) => escapeRegExp(m.sentinel)).join("|"), "g");
  const walker = document.createTreeWalker(root, 4);
  const textNodes: Text[] = [];

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  for (const textNode of textNodes) {
    const value = textNode.nodeValue ?? "";
    let lastIndex = 0;
    let replaced = false;
    const fragment = document.createDocumentFragment();

    for (const match of value.matchAll(pattern)) {
      const marker = markerBySentinel.get(match[0]);
      if (!marker) continue;

      const index = match.index ?? 0;
      if (index > lastIndex) {
        fragment.appendChild(document.createTextNode(value.slice(lastIndex, index)));
      }
      fragment.appendChild(marker.createNode());
      lastIndex = index + match[0].length;
      replaced = true;
    }

    if (!replaced) continue;

    if (lastIndex < value.length) {
      fragment.appendChild(document.createTextNode(value.slice(lastIndex)));
    }
    textNode.replaceWith(fragment);
  }
}

function escapeHtml(value: string): string {
  const replacements: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (ch) => replacements[ch]!);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
```

- [ ] **Step 4: Run the helper test to verify GREEN**

Run:

```bash
npm test -- test/render/markdown.test.ts
```

Expected: PASS for `extension/test/render/markdown.test.ts`.

- [ ] **Step 5: Commit helper and tests**

Run:

```bash
git add extension/src/render/markdown.ts extension/test/render/markdown.test.ts
git commit -m "feat(extension): add safe markdown renderer"
```

Expected: commit succeeds and contains only the helper and its tests.

---

### Task 3: Integrate Markdown Rendering into Text Blocks

**Files:**
- Modify: `extension/test/render/text-block.test.ts`
- Modify: `extension/src/render/blocks/text.ts`

- [ ] **Step 1: Replace the text block test file with Markdown integration expectations**

Replace `extension/test/render/text-block.test.ts` with:

```ts
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
```

- [ ] **Step 2: Run the text block test to verify RED**

Run:

```bash
npm test -- test/render/text-block.test.ts
```

Expected: FAIL because the current renderer does not create `h1`, `strong`, `code`, or `.pt-md`.

- [ ] **Step 3: Replace the text block renderer with sentinel integration**

Replace `extension/src/render/blocks/text.ts` with:

```ts
import { h } from "../../lib/dom.js";
import { renderMarkdownText, type MarkdownMarker } from "../markdown.js";

const MARKER_RE = /<REDACTED:[A-Z_]+>|<TRUNCATED:[^>]+>/g;
const SENTINEL_PREFIX = "\uE000PT_MARKER_";
const SENTINEL_SUFFIX = "\uE001";

export function renderTextBlock(text: string): HTMLElement {
  const wrap = h("div", { class: "pt-text pt-md" });
  const { markdown, markers } = replaceMarkersWithSentinels(text);
  wrap.appendChild(renderMarkdownText(markdown, markers));
  return wrap;
}

function replaceMarkersWithSentinels(text: string): {
  markdown: string;
  markers: MarkdownMarker[];
} {
  let markdown = "";
  let lastIndex = 0;
  const markers: MarkdownMarker[] = [];

  for (const m of text.matchAll(MARKER_RE)) {
    const i = m.index!;
    if (i > lastIndex) {
      markdown += text.slice(lastIndex, i);
    }

    const marker = m[0];
    const sentinel = `${SENTINEL_PREFIX}${markers.length}${SENTINEL_SUFFIX}`;
    markers.push({
      sentinel,
      createNode: () => renderMarker(marker),
    });
    markdown += sentinel;
    lastIndex = i + marker.length;
  }

  if (lastIndex < text.length) {
    markdown += text.slice(lastIndex);
  }

  return { markdown, markers };
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

- [ ] **Step 4: Run the text block test to verify GREEN**

Run:

```bash
npm test -- test/render/text-block.test.ts
```

Expected: PASS for all text block tests.

- [ ] **Step 5: Run tool block regression tests**

Run:

```bash
npm test -- test/render/tool-use.test.ts test/render/tool-result.test.ts
```

Expected: PASS. This confirms `tool_use` and `tool_result` remain outside Markdown rendering.

- [ ] **Step 6: Commit text block integration**

Run:

```bash
git add extension/src/render/blocks/text.ts extension/test/render/text-block.test.ts
git commit -m "feat(extension): render message text blocks as markdown"
```

Expected: commit succeeds and contains only text block integration changes.

---

### Task 4: Add Scoped Markdown Theme Rules

**Files:**
- Modify: `extension/test/theme/registry.test.ts`
- Modify: `extension/src/theme/claude-code.ts`

- [ ] **Step 1: Add failing theme selector coverage**

Replace `extension/test/theme/registry.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import { CLAUDE_CODE_CSS } from "../../src/theme/claude-code.js";
import { themeFor } from "../../src/theme/registry.js";

describe("themeFor", () => {
  it("returns claude-code theme for claude-code source", () => {
    expect(themeFor("claude-code").id).toBe("claude-code");
  });

  it("falls back to claude-code for unknown source", () => {
    expect(themeFor("cursor").id).toBe("claude-code");
  });

  it("includes scoped markdown styles", () => {
    const requiredSelectors = [
      ".pt-md p",
      ".pt-md h1",
      ".pt-md h2",
      ".pt-md ul",
      ".pt-md ol",
      ".pt-md li",
      ".pt-md blockquote",
      ".pt-md code",
      ".pt-md pre",
      ".pt-md pre code",
      ".pt-md a",
    ];

    for (const selector of requiredSelectors) {
      expect(CLAUDE_CODE_CSS).toContain(selector);
    }
  });
});
```

- [ ] **Step 2: Run the theme test to verify RED**

Run:

```bash
npm test -- test/theme/registry.test.ts
```

Expected: FAIL because `.pt-md` Markdown selectors are not present yet.

- [ ] **Step 3: Add `.pt-md` CSS rules to the Claude Code theme**

In `extension/src/theme/claude-code.ts`, replace the existing `.pt-text` line:

```css
.pt-text { white-space: pre-wrap; }
```

with this block:

```css
.pt-text { overflow-wrap: anywhere; }
.pt-md p { margin: 0 0 10px; }
.pt-md p:last-child { margin-bottom: 0; }
.pt-md h1, .pt-md h2, .pt-md h3, .pt-md h4, .pt-md h5, .pt-md h6 { color: #1a1614; font-weight: 650; line-height: 1.25; margin: 14px 0 8px; }
.pt-md h1:first-child, .pt-md h2:first-child, .pt-md h3:first-child, .pt-md h4:first-child, .pt-md h5:first-child, .pt-md h6:first-child { margin-top: 0; }
.pt-md h1 { font-size: 20px; }
.pt-md h2 { font-size: 18px; }
.pt-md h3 { font-size: 16px; }
.pt-md h4, .pt-md h5, .pt-md h6 { font-size: 14px; }
.pt-md ul, .pt-md ol { margin: 0 0 10px 22px; padding: 0; }
.pt-md li { margin: 3px 0; }
.pt-md li > ul, .pt-md li > ol { margin-top: 4px; margin-bottom: 4px; }
.pt-md blockquote { margin: 0 0 10px; padding: 6px 12px; border-left: 3px solid #CC7859; background: #FBF8F1; color: #5a4f42; }
.pt-md code { background: #F5F2EC; border: 1px solid #E5DFD4; border-radius: 4px; color: #3d342a; font-family: "SF Mono", Consolas, monospace; font-size: 12px; padding: 1px 4px; }
.pt-md pre { background: #FBF8F1; border: 1px solid #E5DFD4; border-radius: 6px; color: #3d342a; font-family: "SF Mono", Consolas, monospace; font-size: 12px; line-height: 1.5; margin: 0 0 10px; overflow-x: auto; padding: 10px 12px; white-space: pre; }
.pt-md pre code { background: transparent; border: 0; border-radius: 0; color: inherit; display: block; font-size: inherit; padding: 0; white-space: inherit; }
.pt-md a { color: #B85F43; text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 2px; }
.pt-msg-user .pt-md h1, .pt-msg-user .pt-md h2, .pt-msg-user .pt-md h3, .pt-msg-user .pt-md h4, .pt-msg-user .pt-md h5, .pt-msg-user .pt-md h6 { color: white; }
.pt-msg-user .pt-md a { color: white; }
.pt-msg-user .pt-md blockquote { background: rgba(255,255,255,0.12); border-left-color: rgba(255,255,255,0.7); color: rgba(255,255,255,0.9); }
.pt-msg-user .pt-md code { background: rgba(255,255,255,0.16); border-color: rgba(255,255,255,0.35); color: white; }
.pt-msg-user .pt-md pre { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.28); color: white; }
```

Do not change `.pt-redacted`, `.pt-truncated`, `.pt-tool-*`, or `.pt-json-*` rules in this task.

- [ ] **Step 4: Run the theme test to verify GREEN**

Run:

```bash
npm test -- test/theme/registry.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit scoped theme rules**

Run:

```bash
git add extension/src/theme/claude-code.ts extension/test/theme/registry.test.ts
git commit -m "style(extension): add markdown text block theme"
```

Expected: commit succeeds and contains only theme CSS and theme test changes.

---

### Task 5: Final Verification

**Files:**
- Read: `docs/superpowers/specs/2026-04-25-markdown-rendering-design.md`
- Read: changed files from Tasks 1-4

- [ ] **Step 1: Run all extension tests**

Run:

```bash
npm test
```

Expected: PASS. The suite should include the new `test/render/markdown.test.ts` file and the expanded text/theme tests.

- [ ] **Step 2: Run the extension build**

Run:

```bash
npm run build
```

Expected: PASS. `extension/dist/content.js` and `extension/dist/manifest.json` are produced. `dist/` remains ignored.

- [ ] **Step 3: Check for whitespace errors**

Run from repo root:

```bash
git diff --check HEAD
```

Expected: no output and exit code 0.

- [ ] **Step 4: Confirm acceptance criteria against the spec**

Read `docs/superpowers/specs/2026-04-25-markdown-rendering-design.md` and verify:

```text
message text blocks render Markdown: covered by markdown.test.ts + text-block.test.ts
marked and DOMPurify are used: covered by extension/src/render/markdown.ts
raw HTML inactive: covered by markdown.test.ts raw HTML and script tests
javascript/data links stripped: covered by markdown.test.ts link tests
safe links open in new tab: covered by markdown.test.ts safe link test
redacted/truncated pills preserved: covered by text-block.test.ts
tool_use/tool_result unchanged: covered by tool-use.test.ts + tool-result.test.ts
.pt-md theme present: covered by registry.test.ts
extension build succeeds: covered by npm run build
```

Expected: every line maps to an implemented file or passing command.

- [ ] **Step 5: Report manual QA status**

If Chrome manual QA is performed, report the exact GitHub `.prompttrace.jsonl` URL used and whether `Rendered | Raw` toggling, Markdown text, marker pills, and tool blocks behaved correctly. If manual QA is not performed in the current session, report that automated verification passed and manual browser QA remains unrun.
