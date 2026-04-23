# Show Me Your Prompt · Browser Extension 设计

- 日期：2026-04-23
- 状态：设计草案，待实现
- 适用范围：`extension/` v0.1.0（对应 schema v1）
- 依赖契约：[`prompttrace-cli/docs/schema-v1.md`](../../../prompttrace-cli/docs/schema-v1.md)
- 母文档：[`2026-04-22-show-me-your-prompt-design.md`](./2026-04-22-show-me-your-prompt-design.md) §5

## 1. 目标与范围

把 GitHub 文件页上的 `.prompttrace.jsonl` 直接渲染成可读的会话 UI，不跳转第三方站点、不要账号、不上报。

### 1.1 v1 包含

- Chrome MV3 扩展，content script 形态，零后端、零账号、零上报
- 匹配 `https://github.com/<user>/<repo>/blob/<ref>/.../*.prompttrace.jsonl`
- 在 GitHub 原生文件预览上方注入独立容器，不替换原生 DOM
- 顶部 `Rendered | Raw` 切换（默认 Rendered）
- `claude-code` 主题（暖米色底 `#F5F2EC` + 橘棕主色 `#CC7859`）
- 流式 JSONL 解析、tool_result 按需 DOM-append、超大 output 二次截断
- 五种降级场景（见 §7）

### 1.2 明确不在 v1

- Firefox / Safari（母文档 §7.2）
- 非 `claude-code` 主题（骨架预留，v1 不实现第二种 source）
- 搜索 / 过滤 / 跳转锚点
- 任何向第三方域名的请求
- 存储用户偏好（无 `storage` 权限）
- Markdown 渲染 assistant 消息（v1 按纯文本处理）
- syntax highlight tool_result 输出

## 2. 架构总览

```
github.com/.../*.prompttrace.jsonl
        │
  content script (单文件 bundle)
        │
  ┌─────┴─────┐      ┌──────────────┐
  │navigation │─────▶│  controller  │
  │(SPA hook) │      │ (per URL)    │
  └───────────┘      └──┬─────────┬─┘
                        │         │
                    ┌───▼───┐ ┌───▼───┐
                    │ fetch │ │ mount │
                    │  raw  │ │  DOM  │
                    └───┬───┘ └───┬───┘
                        │         │
                    ┌───▼───┐ ┌───▼────┐
                    │parser │ │ render │──▶ theme/claude-code
                    └───────┘ └────────┘
```

- 三个独立可交付物（CLI / 文件格式 / 扩展）通过 schema v1 文件格式耦合，与此母文档一致
- 内部进一步分层：`github/`（唯一耦合 GitHub DOM）、`parser/`（纯函数）、`render/`（纯 DOM 操作）、`theme/`（唯一耦合视觉）
- 异常分支统一走"降级表"（§7），GitHub 原生视图永远保底

## 3. 目录与模块边界

```
extension/
  manifest.json
  package.json              # 依赖：typescript / esbuild / vitest / jsdom
  tsconfig.json
  build.mjs                 # esbuild 构建脚本，产出 dist/
  src/
    content.ts              # 入口：安装 SPA 导航监听 → 触发 controller
    controller.ts           # 单 URL 的生命周期（fetch → parse → render → 切换态）
    github/
      url.ts                # blob URL ↔ raw URL（纯函数）
      navigation.ts         # wrap pushState/replaceState + popstate → prompttrace:navigate
      mount.ts              # 在文件视图上方挂载独立容器，不替换 DOM
    parser/
      jsonl-stream.ts       # Uint8Array chunk → JSON 对象流（处理跨 chunk 换行）
      schema.ts             # meta / message / content-block 类型 + 守卫
    render/
      root.ts               # toolbar + header + messages 骨架
      header.ts             # title / summary / meta 条 / warn 条 / tag chips
      message.ts            # user / assistant / tool 三种 role
      blocks/
        text.ts             # 含 <REDACTED:*> / <TRUNCATED:*> pill 渲染
        tool-use.ts         # 折叠卡片 + 按需 pretty-print input
        tool-result.ts      # 默认折叠 + 按需 DOM-append + 100KB 二次截断
      pretty-json.ts        # ~80 行 JSON formatter + key/string/number 上色
    theme/
      claude-code.ts        # v1 唯一主题，导出 CSS 字符串
      registry.ts           # source → theme 映射
    lib/
      dom.ts                # h()、cls()、小工具，禁用 innerHTML
      escape.ts             # 文本插入 DOM 前的显式转义
  test/
    parser/jsonl-stream.test.ts
    parser/schema.test.ts
    github/url.test.ts
    render/placeholder.test.ts
    render/tool-result.test.ts
    render/pretty-json.test.ts
    theme/registry.test.ts
    fixture.integration.test.ts   # 读 ../prompttrace-cli/fixtures/schema-v1/
  dist/                     # .gitignore 忽略
    content.js
    manifest.json
```

**不变式**：

- `github/` 是唯一耦合 GitHub DOM 的目录；GitHub DOM 变化只需改这里
- `theme/` 是唯一耦合视觉的目录；未来新增 source 只加文件不改骨架
- `parser/` 纯函数、零 DOM，可在 jsdom 下独测
- `render/` 不碰网络、不碰路由；输入 `meta + messages[]`，输出 DOM
- 全局禁用 `innerHTML`（CSP 友好），一律 `document.createElement` + `textContent`

## 4. Manifest 与权限

```json
{
  "manifest_version": 3,
  "name": "Show Me Your Prompt",
  "version": "0.1.0",
  "description": "Render .prompttrace.jsonl on GitHub file pages.",
  "permissions": [],
  "host_permissions": [
    "https://github.com/*",
    "https://raw.githubusercontent.com/*"
  ],
  "content_scripts": [{
    "matches": ["https://github.com/*"],
    "js": ["content.js"],
    "run_at": "document_idle",
    "all_frames": false
  }]
}
```

- **没有** `storage` / `tabs` / `activeTab` / `scripting` / background service worker
- `host_permissions` 白名单到 github.com + raw.githubusercontent.com，所有 fetch 都只能去这两个域名
- 构建时产出单个 `content.js`，manifest 引用单文件
- 包体积目标：< 200 KB（母文档 §5.1），实测预期 50-80 KB

## 5. 生命周期与 SPA 导航

GitHub 用 Turbo 做 SPA 导航，history 方法 + popstate 都会触发。扩展统一成一个内部自定义事件，避免依赖具体的 `turbo:load`（随时可能被换掉）。

```
content.ts (加载一次，document_idle)
  ├─ navigation.install()
  │    wrap history.pushState / replaceState
  │    addEventListener('popstate', ...)
  │    每次 URL 变化 → 派发 'prompttrace:navigate' CustomEvent
  ├─ addEventListener('prompttrace:navigate', onNav)
  └─ 首次触发：手动调一次 onNav(location.href)

onNav(url):
  1. activeController?.dispose()        // 销毁上一个：abort + 移除容器 + 恢复原生视图显示
  2. if (!isPrompttraceBlobUrl(url)) return
  3. activeController = new Controller(url)
  4. activeController.run()
```

**URL 匹配**（`github/url.ts`）：

```
^https://github\.com/[^/]+/[^/]+/blob/[^/]+/.+\.prompttrace\.jsonl(\?.*)?(#.*)?$
                    user    repo    ref    path

→ rawUrl = https://raw.githubusercontent.com/<user>/<repo>/<ref>/<path>
```

纯函数、单测覆盖：匹配 / 不匹配 / query string / fragment / 带点号的路径。

### 5.1 Controller 状态机

```
new → loading → rendered ⇄ raw
  │      │
  │      ├──▶ degraded (warn bar，GitHub 原生视图保留)
  │      └──▶ error    (error bar + 重试)
  │
  └──▶ disposed (URL 改变或用户离开时)
```

职责：

1. 等 GitHub 原生文件视图 DOM 就绪（MutationObserver，超时 3s 触发 `degraded`）
2. `mount.insertContainerAbove(fileViewEl)`
3. `fetch(rawUrl, { signal: abort.signal })`
   - 200 → 流式 parse → 增量渲染
   - 403 → 静默 `dispose()`（见 §7 ③）
   - 其他 4xx/5xx → `degraded`
   - 网络错误 → `error`，容器显示"加载失败 · 重试"按钮
4. header 右上放 `Rendered | Raw` 切换按钮
   - Rendered：显示自建容器，隐藏 GitHub 原生代码视图（CSS `display:none`）
   - Raw：隐藏自建容器，恢复原生视图显示
   - 切换不重新 fetch
5. `dispose()`：`abort.abort()` → 移除容器 → 恢复原生视图显示

## 6. 渲染 UI（claude-code 主题）

### 6.1 主题 token

| Token | 值 |
| --- | --- |
| 背景 | `#F5F2EC` |
| 主色 | `#CC7859` |
| 卡片 / 气泡底 | `#FFFFFF` |
| 暖灰描边 | `#E5DFD4` / `#D9D1C2` |
| 文字主色 | `#1a1614` |
| 文字弱化 | `#6e6356` / `#8a7e6e` |
| 脱敏 pill 底 | `#EFE8DB` 虚线描边 `#C5BBA8` |

字体：`-apple-system, "SF Pro Text", system-ui, sans-serif`；等宽：`"SF Mono", Consolas, monospace`。

### 6.2 Header

自上而下：

1. Toolbar：左 source chip（`● claude-code`），右 `Rendered | Raw` 切换
2. `<h1>` title（19px / 600）
3. `summary` 行（14px / `#5a4f42` / max-width 60ch）—— 仅在 `meta.summary` 非空时渲染
4. Meta 条（12px / 弱化色）：`exported <ts>` · `<N> messages` · `<exported_by>`
5. Warn 条（仅 `redaction_count > 0` 时）：`⚠ N redactions applied · rules: a, b, c`
6. Tag chips（仅 `tags` 非空时）

### 6.3 消息

| Role | 容器 | 对齐 | 样式 |
| --- | --- | --- | --- |
| `user` | 橘棕气泡 `#CC7859` 白字 | 右对齐 | 圆角 `16 16 4 16`，max-width 72% |
| `assistant` | 白卡片 | 左对齐 | 圆角 `4 16 16 16`，max-width 82% |
| `tool` | 同 assistant 样式 | 左对齐 | 作为 tool_result 的补充，实际主渲染在 assistant 消息内嵌的 tool block |

每条消息上方一个小 label（`USER` / `ASSISTANT`，10px uppercase letter-spacing 0.8px）。

### 6.4 Content blocks

#### `text`

- 直接渲染为文本节点（`textContent`，禁用 innerHTML）
- 扫描 `<REDACTED:TYPE>` 和 `<TRUNCATED: ...>` 字面量，替换为 `<span class="pt-redacted">` pill（灰底虚线边），`title` 提示"该位置已脱敏"
- v1 不做 Markdown 渲染

#### `tool_use`

折叠卡片：

```
┌─────────────────────────────────────────────────────────┐
│ ▸  [Read]  file_path: <REDACTED:ABS_PATH>/proj/config   │  ← 摘要行
├─────────────────────────────────────────────────────────┤  ← 点开后
│ {                                                        │
│   "file_path": "<REDACTED:ABS_PATH>/proj/config"        │  ← pretty-print
│ }                                                        │     + 上色
├─────────────────────────────────────────────────────────┤
│ ▸ tool_result                         click to expand   │
└─────────────────────────────────────────────────────────┘
```

- **摘要行**：工具名徽章 + input 第一个字段的 `key: value`（溢出省略）
- **展开态（pretty-print input）**：
  - 缩进 2 空格的 JSON
  - key 橘棕 `#CC7859`、string 墨绿 `#4e7a3a`、number 深棕 `#8B5A1B`、null 灰斜体
  - 字符串里的 `\n` 真正展开为换行
  - 单条 input > 100KB → 同 tool_result 二次截断
  - 实现：`render/blocks/pretty-json.ts`，~80 行 TS，零依赖
- caret：`▸` 折叠 / `▾` 展开

#### `tool_result`

- **默认完全不 DOM-append**——只渲染一个占位 head 条：`▸ tool_result · click to expand`
- 点击 head 才创建 body DOM，展示 output 内容
- 单条 output > 100KB → 二次截断：保留前 N 行 + `<TRUNCATED: ~M KB hidden>` pill + 后 N 行
- 末尾附 `显示全部（可能卡顿）` 链接，点击才渲染完整字符串
- 不做 syntax highlight
- 等宽字体、`white-space: pre`、横向滚动

## 7. 降级与失败（§5.8 决策表）

| 触发条件 | 扩展行为 | GitHub 原生视图 |
| --- | --- | --- |
| `schema_version` 超出 `SUPPORTED_SCHEMA_VERSIONS = [1]` | 顶部黄色警告条："此文件由更新版本的 prompttrace 生成 · 建议升级插件"，不渲染 messages | 继续显示 |
| meta 行缺失 / 首行不是 `type:"meta"` | 顶部黄色警告条："无法识别的 .prompttrace.jsonl 格式"，不渲染 messages | 继续显示 |
| raw fetch 网络错误（超时 / DNS / offline） | 红色错误条 + "重试"按钮（复用同一个 controller，不重载页面） | 继续显示 |
| raw fetch 403 (私有 repo，raw 不带 cookie) | `controller.dispose()`，扩展不出现 | 继续显示 |
| 完全非 JSONL（line 1 `JSON.parse` 抛错） | `controller.dispose()` + `console.error`，扩展不出现 | 继续显示 |
| 单条消息 content block `type` 未知 | 渲染继续 + 对该 block 显示 `<unknown block: type=xxx>` pill | Rendered 时隐藏 |

**共通原则**：扩展失效时 GitHub 原生视图永远可见，绝不黑屏。任何未预期的 exception 被顶层 `try/catch` 捕获后走 `dispose()` 静默路径。

## 8. 性能

- JSONL 流式解析：`response.body.getReader()` + 自写解码器，每拿到完整一行就增量推入 render 队列
- `requestAnimationFrame` 批量 DOM-append，首屏可交互 < 300ms（小文件）
- `tool_result` 完全懒渲染，几十上百个 block 也不会卡
- `pretty-json` 只在展开 `tool_use` 时跑
- 单条 text / output > 100KB → 内部二次截断
- 整个 DOM 不超过 O(messages × 4) 个节点（每消息约：wrapper + label + text + tool 折叠 head）

## 9. 构建与分发

- 语言：TypeScript 5.x
- 构建：`esbuild`（单入口 `src/content.ts` → `dist/content.js`，IIFE，minify）
- `build.mjs`：纯 ESM 脚本，`npm run build` 产出 `dist/`
- `npm run dev`：watch 模式 + source map（不 minify）
- 加载方式：`chrome://extensions` → 开发者模式 → 加载已解压 `dist/`
- 发布：v1 不上架 Chrome Web Store；README 里说明如何手动加载。未来上架前补 store 截图、隐私声明、icons

## 10. 测试策略

### 10.1 单元测试（vitest + jsdom）

- `parser/jsonl-stream.test.ts`：跨 chunk 换行、空行、尾部无换行、BOM、UTF-8 多字节截断
- `parser/schema.test.ts`：合法 meta、`schema_version` 超限、缺字段
- `github/url.test.ts`：匹配 / 不匹配 / query / fragment / 多层路径
- `render/placeholder.test.ts`：`<REDACTED:*>` 与 `<TRUNCATED:*>` 渲染成 pill，title 正确
- `render/tool-result.test.ts`：默认不 DOM-append、点击才插入、100KB 二次截断
- `render/pretty-json.test.ts`：缩进、换行展开、key/string/number 上色
- `theme/registry.test.ts`：未知 source 回退 / 正确分派

### 10.2 集成测试

- `test/fixture.integration.test.ts` 以相对路径读 `../prompttrace-cli/fixtures/schema-v1/minimal.prompttrace.jsonl`
- 走完整 parser → render 管线，断言 DOM 结构
- Fixture 与 CLI 共享一份，实现母文档 §6.2 "把契约具象化"

### 10.3 手动 E2E 清单（发版前）

- [ ] 真实 GitHub public repo 中的 `.prompttrace.jsonl` 渲染正确
- [ ] Rendered / Raw 切换功能正常
- [ ] SPA 导航（点侧栏进入另一个 `.prompttrace.jsonl`）正确销毁 + 重挂
- [ ] 私有 repo 403 降级（扩展不出现）
- [ ] 未知 schema_version 警告条
- [ ] 离线状态下错误条 + 重试按钮
- [ ] 包含几十个 tool_result 的大会话不卡

### 10.4 安全自查

- [ ] manifest 仅 `host_permissions: [github.com, raw.githubusercontent.com]`
- [ ] 全仓搜索 `innerHTML` 应为 0 命中
- [ ] 不读 / 不写 `localStorage` / `cookie` / `IndexedDB`
- [ ] 不发起任何其他域名的 fetch / WebSocket / img src
- [ ] README 声明"自动脱敏是尽力而为，不保证覆盖所有敏感内容"（与 CLI README 呼应）

## 11. 与 CLI 的契约边界

- 唯一契约 = `schema-v1.md`。扩展不依赖 CLI 的任何行为，不解析 CLI 版本号语义
- `SUPPORTED_SCHEMA_VERSIONS` 在 `src/parser/schema.ts` 常量化，升级时改一处
- Fixture 共享同一份文件（`prompttrace-cli/fixtures/schema-v1/minimal.prompttrace.jsonl`），一份数据两边用，改 schema 时任一端走样都会立刻暴露

## 12. 风险与未决

- **GitHub DOM 变更**：靠 `mount.ts` 一处缓冲。MutationObserver 超时 3s 触发 `degraded`，不会因为 DOM 变了就黑屏
- **Turbo 未来换实现**：`navigation.ts` 用 history API hook，不依赖具体 `turbo:*` 事件
- **非常大的会话（上千条 message）**：流式 + 懒渲染 + 二次截断 三重保护；实测 case 留到 v1.1 基于真实数据优化
- **Raw URL 权限越界**：白名单在 `host_permissions`，即使 bug 也只能 fetch 这两个域
- **多 source 主题骨架未经实战验证**：v1 只有 `claude-code`；`theme/registry.ts` 对未知 source 回退到该主题，v2 加新 source 时再验证
