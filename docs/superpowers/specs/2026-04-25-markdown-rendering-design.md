# Show Me Your Prompt v1.1 · Markdown Rendering 设计

- 日期：2026-04-25
- 状态：已批准设计，待实现计划
- 适用范围：`extension/` v1.1
- 背景 issue：<https://github.com/Miracle-0/prompttrace/issues/5>
- 依赖契约：[`prompttrace-cli/docs/schema-v1.md`](../../../prompttrace-cli/docs/schema-v1.md)

## 1. 目标与范围

v1.1 为 browser extension 的 message `text` content block 增加安全 Markdown 渲染，让 Claude Code 会话中的标题、列表、强调、行内代码、代码块、链接和引用块更接近 Claude Code `/share` 的可读体验。

### 1.1 v1.1 包含

- 只渲染 message `text` blocks 中的 Markdown
- 支持 headings `h1`-`h6`、ordered/unordered/nested lists、bold、italic、inline code、code fences、links、blockquotes
- 使用 `marked` 解析 Markdown
- 使用 `DOMPurify` 清洗解析后的 HTML
- 禁止 raw HTML 生效
- 清洗 `javascript:` / `data:` 等危险链接
- 正常链接打开新标签页，并带 `rel="noopener"`
- 保留现有 `<REDACTED:*>` / `<TRUNCATED:*>` pill 行为
- 新增 `.pt-md` scoped theme 样式
- 新增 Markdown 渲染测试和 XSS/sanitization 测试

### 1.2 明确不在 v1.1

- Syntax highlighting
- Markdown inside `tool_use` input
- Markdown inside `tool_result` output
- 修改 schema v1
- 新增浏览器权限、后台服务或远端服务
- 搜索、过滤、锚点跳转、用户偏好存储

## 2. 推荐方案

采用方案 A：新增独立 Markdown helper，把 `marked` / `DOMPurify` / link policy 封装在 `extension/src/render/markdown.ts`。`extension/src/render/blocks/text.ts` 继续负责识别 marker 和创建 pill DOM；Markdown helper 负责整段 text block 渲染，并在安全 DOM 中把 marker sentinel 替换成 pill。

这个边界让安全逻辑集中、测试直接，也避免让 `text.ts` 同时承担 Markdown parser 配置、sanitizer 配置、link policy 和现有 marker 逻辑。

## 3. 架构与数据流

```
MessageRecord.content[type=text].text
        │
        ▼
renderTextBlock(text)
        │
        ├─ find <REDACTED:*> / <TRUNCATED:*>
        ├─ replace markers with private-use sentinels
        │
        └─ renderMarkdownText()
              │
              ├─ marked with raw-HTML renderer disabled
              ├─ DOMPurify returning a DocumentFragment
              ├─ link post-processing
              └─ replace sentinel text nodes with marker pill DOM
        │
        ▼
<div class="pt-text pt-md">...</div>
```

`tool_use` 和 `tool_result` 不进入这条链路。它们继续分别走 pretty JSON 和 preformatted output 的既有渲染逻辑。

## 4. 文件边界

### 4.1 新增文件

- `extension/src/render/markdown.ts`
  - 导出 `renderMarkdownText(markdown: string, markers: MarkdownMarker[]): DocumentFragment`
  - 定义 `MarkdownMarker`，包含 sentinel 和 replacement DOM factory
  - 配置 `marked`
  - 配置 `DOMPurify`
  - 统一处理 link attributes
  - 把 sentinel text node 替换为 marker pill DOM
  - 在异常时退回纯文本 fragment

- `extension/test/render/markdown.test.ts`
  - 覆盖 Markdown helper 的单元行为
  - 覆盖 XSS 和危险链接

### 4.2 修改文件

- `extension/src/render/blocks/text.ts`
  - 外层容器从纯 `.pt-text` 调整为 `.pt-text pt-md`
  - 把 marker 替换为 private-use sentinel 后调用 `renderMarkdownText`
  - marker pill 创建逻辑保持现有 DOM API 写法

- `extension/test/render/text-block.test.ts`
  - 保留现有 plain text、redacted、truncated 测试
  - 新增 marker 与 Markdown 混排回归测试

- `extension/src/theme/claude-code.ts`
  - 添加 `.pt-md` scoped 样式
  - 样式只影响 message text block，不影响 GitHub 页面或 tool blocks

- `extension/package.json`
  - 添加运行时依赖 `marked`、`dompurify`

- `extension/package-lock.json`
  - 由 `npm install` 更新

## 5. Security Design

Markdown 内容来自导出的 session，是不可信输入。安全链路固定为：

```
marked -> DOMPurify -> DOM
```

规则：

- 不把 untrusted Markdown 直接赋给页面 DOM
- `marked` 负责 Markdown 到 HTML 的解析，并通过 custom renderer 将 raw HTML token escape 为文本
- `DOMPurify` 负责清洗 parser 输出中的脚本、事件属性和危险 URL；raw HTML token 在进入 sanitizer 前已被 `marked` custom renderer 转义为文本
- 渲染后的 fragment 再追加到 `.pt-md`
- 链接渲染后统一设置 `target="_blank"` 和 `rel="noopener"`
- 对清洗后缺少安全 `href` 的链接，不补回原始 href
- Markdown helper 捕获异常并退回 `document.createTextNode(markdown)`

测试必须覆盖：

- `<script>alert(1)</script>` 不产生 `script` 节点
- `<em>raw</em>` 保持为文本，不变成 DOM element
- `<img src=x onerror=alert(1)>` 不产生可执行事件属性
- `[x](javascript:alert(1))` 不保留危险 `href`
- `[x](data:text/html;base64,...)` 不保留危险 `href`
- 普通 `https://` 链接保留并带新标签属性

## 6. Rendering Behavior

### 6.1 Markdown 支持

- `#` through `######` render to heading tags
- `-` / `*` unordered lists render to nested `ul/li`
- `1.` ordered lists render to nested `ol/li`
- `**bold**` and `*italic*` render inline
- Backtick inline code renders as `code`
- Triple-backtick fences render as `pre > code`
- `>` blockquotes render as `blockquote`
- Markdown links render as `a`

### 6.2 Marker preservation

Marker preservation uses private-use sentinels so the whole text block can be parsed as one Markdown document:

- `<REDACTED:ABS_PATH>` becomes `.pt-redacted` pill
- `<TRUNCATED: 1024 bytes>` becomes `.pt-truncated` pill
- Text before and after the marker can still render Markdown
- Marker text is inserted through DOM APIs, not interpreted as HTML
- Markdown structures such as paragraphs, list items, and blockquotes can contain marker pills without being split into separate rendered fragments

Example:

```md
See **file** <REDACTED:ABS_PATH>/notes.md
```

Expected DOM:

- `strong` element for `file`
- `.pt-redacted` pill for `<REDACTED:ABS_PATH>`
- literal `/notes.md` text after the pill

## 7. Theme Design

All new Markdown CSS is scoped under `.pt-md` in `extension/src/theme/claude-code.ts`.

Style targets:

- Keep message bubbles compact and readable
- Use existing warm cream background and subtle borders
- Avoid marketing-page typography; this is a conversation transcript
- Keep code blocks visually distinct without syntax highlighting
- Preserve existing user/assistant bubble contrast

Required selectors:

- `.pt-md p`
- `.pt-md h1`, `.pt-md h2`, `.pt-md h3`, `.pt-md h4`, `.pt-md h5`, `.pt-md h6`
- `.pt-md ul`, `.pt-md ol`, `.pt-md li`
- `.pt-md blockquote`
- `.pt-md code`
- `.pt-md pre`
- `.pt-md pre code`
- `.pt-md a`

## 8. Testing Plan

Use TDD for implementation.

### 8.1 Red tests first

Add Markdown tests before implementation:

- Renders headings and paragraphs
- Renders ordered and unordered nested lists
- Renders bold, italic, and inline code
- Renders fenced code blocks without syntax highlighting
- Renders blockquotes
- Renders safe links with `target="_blank"` and `rel="noopener"`
- Preserves redacted/truncated marker pills among Markdown
- Strips script tags
- Strips event handler attributes
- Strips `javascript:` links
- Strips `data:` links

### 8.2 Existing regression tests

All existing extension tests must keep passing:

- `extension/test/render/text-block.test.ts`
- `extension/test/render/tool-use.test.ts`
- `extension/test/render/tool-result.test.ts`
- `extension/test/fixture.integration.test.ts`
- Parser, GitHub URL/mount, theme, and pretty JSON tests

### 8.3 Build verification

Run:

```bash
cd extension
npm test
npm run build
```

## 9. Manual QA

After implementation:

1. Build the extension.
2. Load `extension/dist/` in Chrome as an unpacked extension.
3. Open a real `.prompttrace.jsonl` session on GitHub.
4. Confirm message text blocks render Markdown readably.
5. Confirm `tool_use` and `tool_result` remain unchanged.
6. Confirm redaction and truncation markers remain visually obvious.
7. Confirm unsafe link examples do not execute and do not keep dangerous hrefs.
8. Toggle `Rendered | Raw` and confirm the raw GitHub view still works.

## 10. Acceptance Criteria

- Message `text` blocks render Markdown using `marked` and `DOMPurify`
- Raw HTML does not execute or survive as active DOM
- Dangerous `javascript:` / `data:` links are stripped
- Safe links open in a new tab with `rel="noopener"`
- Existing redacted/truncated marker pill behavior is preserved
- `tool_use` and `tool_result` rendering is unchanged
- `.pt-md` styles match the existing Claude Code-inspired theme
- Existing tests pass
- New Markdown and XSS tests pass
- `npm run build` succeeds for the extension
