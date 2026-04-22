# Show Me Your Prompt · 设计文档

- 日期：2026-04-22
- 状态：设计草案，待实现
- 适用范围：v1 (MVP)

## 1. 背景与目标

GitHub 是分享"代码"的事实标准平台，但没有对应地分享"与 AI 的协作过程"的便利方式。随着 AI Coding Agent 普及，**一次会话记录本身（含完整工具调用、迭代轨迹）比最终产出的代码更具学习价值**——它展示了作者如何拆解问题、如何给出上下文、如何纠偏。

目标：让开发者能把自己与 AI Coding Agent 的会话以**结构化、可读、带脱敏保护**的方式提交到 GitHub 仓库，并让任何人在 GitHub 网页上**直接看到可读的会话 UI**，无需下载文件、无需跳转第三方站点。

### 1.1 目标用户

AI 编程开发者，主要分享用 AI Coding Agent（v1 = Claude Code）完成的编码会话。

### 1.2 非目标（明确排除）

- 不做独立索引站 / 排行榜 / 社区功能
- 不做实时协作或多人评论
- 不做会话的统计分析
- v1 不支持 Cursor、Codex、Aider、自研 Agent
- v1 不支持"命令行继续他人会话"（resume）

### 1.3 v1 成功判定

作者端：从一次真实 Claude Code 会话结束，到 `.prompttrace.jsonl` 提交至 GitHub，< 2 分钟，无敏感信息泄露。
读者端：在 GitHub 网页打开 `.prompttrace.jsonl` 文件，默认看到渲染后的会话 UI；切回原始 JSONL 需 1 次点击。

## 2. 架构总览

三个独立可交付物，通过**文件格式**这一个契约解耦：

```
[Claude Code]          [prompttrace CLI]           [GitHub repo]           [Browser Extension]
~/.claude/projects/  →  脱敏 + 确认 + 写出  →  .prompttrace/*.jsonl  →  在 GitHub 文件页渲染
    (JSONL)                                                                  (Chrome MV3)
```

契约 = `.prompttrace.jsonl` 文件格式（见 §3）。CLI 与扩展之间没有其他耦合，可各自独立演进、独立测试、独立发版。

**设计原则**：
- **保真优先**：保留原生 JSONL 的结构化信息（`tool_use` / `tool_result`），不翻译成文本
- **脱敏用占位符替换，不静默删除**：读者能看到"这里有东西被删了"
- **扩展在任何未知情况下都让路给 GitHub 原生视图**
- **主题由数据驱动**：v1 内置 Claude 风格主题；未来多 Agent 时每个 source 有各自主题

## 3. 文件格式 `.prompttrace.jsonl`

### 3.1 基本约定

- 路径：`<repo>/.prompttrace/<slug>.prompttrace.jsonl`
- 编码：UTF-8、JSON Lines（每行一个 JSON 对象）
- 第 1 行必须是 `meta` 记录，后续按时间顺序的 `message` 记录

### 3.2 meta 记录

```json
{
  "type": "meta",
  "schema_version": 1,
  "source": "claude-code",
  "source_session_id": "9b6b5c63-...",
  "exported_at": "2026-04-22T10:00:00Z",
  "exported_by": "prompttrace-cli/0.1.0",
  "title": "用 Claude Code 搭建博客",
  "summary": "把静态博客从 Jekyll 迁到 Astro",
  "tags": ["astro", "migration"],
  "sanitization": {
    "rules_applied": ["abs-path", "api-key", "env-var"],
    "redaction_count": 17
  }
}
```

字段说明：
- `schema_version`：整数，扩展以此判定是否支持。v1 固定为 `1`
- `source`：驱动渲染主题；v1 仅 `"claude-code"`
- `source_session_id`：可选，用户可选择不写出
- `title`、`summary`、`tags`：CLI 交互式采集
- `sanitization.rules_applied`：本次实际应用的规则 ID 列表
- `sanitization.redaction_count`：被替换为占位符的片段总数

### 3.3 message 记录

保留 Claude Code 原生 JSONL 的核心字段，**只裁剪不翻译**：

```json
{
  "type": "message",
  "role": "user" | "assistant" | "tool",
  "uuid": "...",
  "parent_uuid": "...",
  "timestamp": "2026-04-22T10:01:00Z",
  "content": [
    { "type": "text", "text": "..." },
    { "type": "tool_use", "name": "Read", "input": { "file_path": "<REDACTED:ABS_PATH>/posts/hello.md" } },
    { "type": "tool_result", "tool_use_id": "...", "output": "..." }
  ]
}
```

- `parent_uuid` 保留 → 未来可渲染分支/编辑点
- `tool_use` / `tool_result` 保持结构化 block，不拍平成文本
- 脱敏以**占位符**替换（下节），不删整行

### 3.4 脱敏规则（v1 内置）

| 规则 ID | 匹配 | 替换 |
|---|---|---|
| `abs-path` | `/Users/xxx/...`、`/home/xxx/...`、`C:\Users\...` | `<REDACTED:ABS_PATH>/<保留文件名>` |
| `api-key` | `sk-ant-...`、`ghp_...`、`AKIA...`、通用 entropy 启发 | `<REDACTED:API_KEY>` |
| `env-var` | `.env` 读取内容里的 `KEY=value` | `<REDACTED:ENV_VAR>` |
| `email` | `x@y.z` | `<REDACTED:EMAIL>` |
| `long-tool-result` | 超过阈值（默认 64 KB）的 tool_result | 保留前/后几行 + `<TRUNCATED: N bytes>` |

所有规则**在 CLI 里可按 session 开关**，实际应用了哪些记录在 `meta.sanitization.rules_applied`。

### 3.5 版本策略

- CLI 每次写出都带 `schema_version`
- 扩展维护 `SUPPORTED_SCHEMA_VERSIONS = [1]`
- 遇到未知版本：扩展渲染顶部警告条"此文件由更新版本的 prompttrace 生成，建议升级插件"，降级为不渲染（让 GitHub 原生预览接管）

## 4. prompttrace CLI

### 4.1 语言与分发

- 语言：TypeScript / Node.js
- Node 版本要求：≥ 20
- 分发：npm 包 `prompttrace`，`npm i -g prompttrace`
- 依赖极简：`commander` + `@inquirer/prompts` + `diff`，其余用 Node 内置

### 4.2 命令集（v1）

```
prompttrace list                   # 列出 ~/.claude/projects/ 下所有会话
prompttrace export <session>       # 交互式导出指定会话到当前仓库
prompttrace export --latest        # 导出最近一次会话
prompttrace export --from-hook     # Stop hook 触发时使用的模式
prompttrace rules                  # 列出当前脱敏规则
prompttrace install-hook           # 把 Stop hook 写入 ~/.claude/settings.json
prompttrace uninstall-hook         # 反向操作
```

### 4.3 `export` 的交互流程

1. 定位会话（由参数指定 / `--latest` / hook 触发时的最近一次）
2. 交互采集 `title`、`summary`、`tags`
3. 扫描全部消息，运行脱敏规则，统计每条规则命中数
4. 输出脱敏摘要，用户可选：
   - `y` 应用全部
   - `n` 都不脱敏（危险，二次确认）
   - `e` 逐规则选择
   - `d` 开 `$PAGER` 看 unified diff 预览
5. 写出到 `<git-root>/.prompttrace/<slug>.prompttrace.jsonl`
   - slug 由 title 自动 slugify，冲突时加短 hash
6. **不自动 git add**，打印"下一步：git diff 看一眼脱敏是否到位，然后 git add && git commit"

### 4.4 `install-hook` 行为

读写 `~/.claude/settings.json`，在 `hooks.Stop` 数组追加：

```json
{
  "matcher": "",
  "hooks": [{
    "type": "command",
    "command": "prompttrace export --latest --from-hook"
  }]
}
```

幂等：已含相同命令则跳过。

### 4.5 `--from-hook` 模式的差异

- 若 session cwd 不在任何 git repo 内 → 静默退出（hook 场景不骚扰）
- 交互式提问默认答案为 N，Enter 即跳过

### 4.6 内部模块边界

```
src/
  adapters/
    claude-code.ts       # 唯一知道 Claude Code JSONL 细节的地方
  sanitize/
    rules/
      abs-path.ts
      api-key.ts
      env-var.ts
      email.ts
      long-tool-result.ts
    engine.ts            # 对统一 Session 结构应用规则
  writer/
    prompttrace.ts       # Session → .prompttrace.jsonl
  cli/
    list.ts
    export.ts
    rules.ts
    install-hook.ts
  lib/
    session.ts           # 内部统一 Session 类型
```

**不变式**：`adapters/claude-code.ts` 是唯一耦合 Claude Code 格式的模块。v2 加 Cursor 支持时新增 `adapters/cursor.ts`，其他模块无需改动。

## 5. 浏览器扩展

### 5.1 目标与范围

- Chrome MV3（Firefox/Safari 留 v2）
- 只做 content script，无后端、无账号、无上报
- 包体积目标：< 200 KB

### 5.2 权限

```json
{
  "manifest_version": 3,
  "permissions": [],
  "host_permissions": [
    "https://github.com/*",
    "https://raw.githubusercontent.com/*"
  ]
}
```

不要 `storage` / `tabs` / `activeTab` / `scripting`。

### 5.3 触发条件

URL 形如 `https://github.com/<user>/<repo>/blob/<ref>/.../*.prompttrace.jsonl`。其他页面 v1 不触发。

### 5.4 工作流程

1. content script 监听 URL 变化（GitHub 是 SPA）
2. URL 匹配扩展名 → 从 raw URL 抓取 `https://raw.githubusercontent.com/.../x.prompttrace.jsonl`
3. 流式解析 JSONL → meta + messages[]
4. 在 GitHub 原生文件预览区上方注入独立容器（不替换 DOM）
5. 顶部放 `Rendered | Raw` 切换按钮，默认 Rendered

### 5.5 渲染 UI

- **头部**：`meta.title` 大标题，下方元信息条（source / exported_at / message count / redaction_count warning），下方 tag chips
- **user message**：右对齐气泡
- **assistant message**：左对齐，text block 直接渲染
- **tool_use block**：折叠卡片（工具名 + input 摘要），可点开看完整 input
- **tool_result block**：跟在对应 `tool_use_id` 之后，**默认折叠**，点开才 DOM-append
- **脱敏占位符**：`<REDACTED:*>` 渲染为灰底 pill（虚线描边），悬停显示"该位置已脱敏"
- **截断占位符**：`<TRUNCATED: N bytes>` 同上

### 5.6 主题系统

- 主题按 `meta.source` 分派；v1 内置 `claude-code` 主题
- 配色：暖米色背景 `#F5F2EC`、橘棕主色 `#CC7859`、白卡片、暖灰描边
- 未来加 source 时新增主题模块即可，无需改渲染骨架

### 5.7 性能

- JSONL 流式解析，边下边渲染首屏
- tool_result 按需渲染（点开才 DOM-append）
- 单条超过 100 KB 的 text/output 内部二次截断（显示"显示全部"）

### 5.8 降级与失败

| 场景 | 行为 |
|---|---|
| 文件非合法 JSONL | 不拦截，控制台记错 |
| meta 行缺失 | 顶部警告条，降级为不渲染 |
| schema_version 超出支持范围 | 顶部警告条"建议升级插件"，降级 |
| raw 403（私有 repo） | 不拦截 |
| 网络抓取失败 | 容器内显示"加载失败，重试" |

**共通原则**：扩展在任何未知情况下都让路给 GitHub 原生视图，绝不黑屏。

## 6. 测试策略

### 6.1 CLI

- 单元测试（`node --test`）
  - 每条脱敏规则：命中 / 不命中 / 边界
  - JSONL writer：meta + messages 顺序、parent_uuid 保留、特殊字符转义
  - hook 读写：幂等、已有其他 hook 时不破坏
- 集成测试：fixtures 目录放若干预脱敏的 Claude Code JSONL，端到端跑 `list` / `export --latest --yes`，断言输出内容
- 手动回归清单：Ctrl+C、覆盖提示、diff 预览

### 6.2 文件格式

- 共享 fixture 集 `fixtures/schema-v1/*.prompttrace.jsonl`，同时作为：
  - CLI writer 的断言目标
  - 扩展 parser 的输入
- 一份数据两边共用，把契约具象化

### 6.3 扩展

- 单元测试（vitest + jsdom）
  - JSONL 流式 parser
  - 脱敏占位符渲染组件
  - `source` → 主题映射
- 手动 E2E 清单
  - 真实 GitHub public repo 中的 `.prompttrace.jsonl` 渲染正确
  - Rendered / Raw 切换
  - 私有 repo 403 降级
  - 未知 schema_version 提示条

### 6.4 安全自查（发版前必做）

- [ ] 扩展不发起任何非 github.com / raw.githubusercontent.com 的请求
- [ ] 扩展不读 localStorage / cookie
- [ ] CLI 不发起任何网络请求
- [ ] CLI 写入前先生成 diff 让用户眼见为实
- [ ] README 明确声明"自动脱敏是尽力而为，不保证覆盖所有敏感内容"

## 7. 范围清单

### 7.1 v1 包含

- CLI：`list` / `export` / `rules` / `install-hook` / `uninstall-hook`
- Claude Code JSONL → `.prompttrace.jsonl` 的 adapter 与 writer
- 五条内置脱敏规则 + unified diff 预览
- Chrome MV3 扩展在 GitHub 文件页的渲染
- `claude-code` 主题
- schema v1

### 7.2 明确不在 v1

- 命令行 `resume` / 继续他人对话
- Cursor / Codex / Aider / 其他 Agent 适配
- 独立索引站 / 搜索 / 排行榜
- Firefox / Safari
- 会话统计分析
- 自定义脱敏规则（DSL 或插件机制）
- `prompttrace watch` 后台 inbox 模式

## 8. 风险与未决

- **脱敏漏网**：regex 与 entropy 启发都是尽力而为。缓解方式：强制 diff 预览 + README 免责声明 + 社区反馈迭代规则
- **Claude Code JSONL 格式变更**：官方未承诺格式稳定。缓解方式：adapter 隔离，格式变更只影响 `adapters/claude-code.ts`
- **GitHub DOM 变更**：采用"注入独立容器、不替换 DOM"策略降低脆弱度
- **tool_result 体量极大**：流式 + 默认折叠 + 二次截断三重保护
