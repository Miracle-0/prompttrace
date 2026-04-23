# Show Me Your Prompt · v1.0 Fixes 设计

- 日期：2026-04-23
- 状态：设计草案，待实现
- 适用范围：`prompttrace-cli` 与 `extension` 各自一次小改动
- 依赖契约：[`prompttrace-cli/docs/schema-v1.md`](../../../prompttrace-cli/docs/schema-v1.md)（不变）
- 母文档：
  - [`2026-04-22-show-me-your-prompt-design.md`](./2026-04-22-show-me-your-prompt-design.md)
  - [`2026-04-23-browser-extension-design.md`](./2026-04-23-browser-extension-design.md)
- 参考北极星：Claude Code 自身的 `/share` 页面 — **human-facing 优先于 faithful-to-raw**。当设计选择是"忠实原始 JSONL"还是"干净的对话流"时，选后者。

## 1. 目标与非目标

### 1.1 v1.0 blocker（必须修）

- **FIX-1** · CLI · `prompttrace-cli/src/adapters/claude-code.ts`
  role 归属错乱：`tool_result` 消息被归为 user，`<local-command-*>` 元消息被归为 user
- **FIX-2** · extension · `src/github/mount.ts` + `src/theme/claude-code.ts`
  挂载位置错乱：容器全屏覆盖，应挂到 `[data-testid="code-view"]` 所在的 grid cell 内
- **FIX-3** · extension · 由 FIX-2 附带解决
  首次打开不渲染：去掉 `"main"` 兜底选择器后，`waitForFileView` 不再在 React 完成前假阳性命中

### 1.2 明确不在 v1.0 范围

- Markdown 渲染（v1.1 单独立项）
- SPA 导航的强化测试（v1.2，方案 A 落地后自然解锁）
- rAF 批量 append / controller 单测等 v1.1 观察项
- schema v1 的任何改动（不改）

## 2. FIX-1：CLI role 归属重写

### 2.1 问题边界

Claude Code 原生 JSONL 里，`entry.type` 字段在传输层是 `user | assistant`，但在**语义层**实际有四种：

| 原生 `entry.type` | `message.content` 特征 | 语义 | schema role 应为 |
|---|---|---|---|
| `user` | 纯 text，无特殊标记 | 真的用户输入 | `user` |
| `user` | 含 `tool_result` block | 工具调用结果（模型协议注入给模型的） | `tool` |
| `user` | 纯 text，含 `<local-command-caveat>` / `<command-name>` / `<local-command-stdout>` / `<local-command-stderr>` | Claude Code 客户端注入的控制消息 | **丢弃** |
| `assistant` | 任意 | 模型输出 | `assistant` |

### 2.2 实现

在 `prompttrace-cli/src/adapters/claude-code.ts` 的 `parseSessionFile` 主循环内，把 `entry.type === 'user' ? 'user' : 'assistant'` 替换为一次 `inferRole(entry)` 调用；返回 `null` 的 entry 直接跳过（既不计入 messages，也不计入 parseErrors）。

```ts
type InferredRole = 'user' | 'assistant' | 'tool' | null;

function inferRole(entry: RawEntry): InferredRole {
  if (entry.type === 'assistant') return 'assistant';
  if (entry.type !== 'user') return null;
  const content = entry.message?.content;

  if (typeof content === 'string') {
    return isLocalCommandText(content) ? null : 'user';
  }

  if (Array.isArray(content)) {
    if (content.some((b) => b && typeof b === 'object' && (b as RawBlock).type === 'tool_result')) {
      return 'tool';
    }
    const texts = content.filter(
      (b): b is { type: 'text'; text: string } =>
        !!b && typeof b === 'object' && (b as RawBlock).type === 'text' &&
        typeof (b as RawBlock).text === 'string',
    );
    if (texts.length > 0 && texts.every((b) => isLocalCommandText(b.text))) return null;
    return 'user';
  }
  return 'user';
}

function isLocalCommandText(s: string): boolean {
  return /<local-command-(caveat|stdout|stderr)>|<command-name>\//.test(s);
}
```

**处理顺序优先级**（当一条 user entry 同时有 tool_result 和 local-command 文本时）：
**tool_result 存在 → tool**。现实 JSONL 中这种混合几乎不出现，但规则明确避免将来歧义。

### 2.3 schema 兼容性

- schema v1 第 69 行已明确支持 `role: "tool"`，**不需要 bump schema_version**
- 扩展 `extension/src/parser/schema.ts` 的 `Role` 类型已经是 `"user" | "assistant" | "tool"`
- 扩展 `extension/src/render/message.ts` 的 tool role 分支走 assistant 卡片样式（spec §6.3 表格最后一行）
- fixture `prompttrace-cli/fixtures/schema-v1/minimal.prompttrace.jsonl` 不涉及 tool_result，**不改**

### 2.4 测试

扩展 `prompttrace-cli/test/adapters/claude-code.test.ts`（已存在）添加：

1. **`entry.type:user` + `tool_result` block → `role: 'tool'`**
2. **`entry.type:user` + 纯文本 `<local-command-caveat>...` → 被丢弃**（不出现在 `session.messages`，不出现在 `parseErrors`）
3. **`entry.type:user` + 混合 text + tool_result → `role: 'tool'`**
4. **`entry.type:user` + 纯文本（无 local-command 标签）→ `role: 'user'`**（现有行为回归保护）
5. **`entry.type:assistant` 任意 content → `role: 'assistant'`**（现有行为回归保护）

另加一个集成测试 `prompttrace-cli/test/adapters/real-sample.test.ts`：若用户提供的真实样本（或类似结构的 fixture）存在，断言：
- 没有任何 `role: 'user'` 的消息包含 `tool_result` content block
- 没有任何消息的文本 block 包含 `<local-command-caveat>` / `<command-name>/`

若样本不存在，测试优雅跳过（`it.skip`）。

## 3. FIX-2 / FIX-3：挂载到 code-view 所在的 grid cell

### 3.1 修改 `extension/src/github/mount.ts`

**去掉 `"main"` 兜底**：

```ts
const SELECTORS = [
  '[data-testid="code-view"]',                 // GitHub React file view (主路径)
  'react-app[app-name="react-code-view"]',     // 二级 fallback (未来 DOM 变动)
];
```

**挂载改为"填入同一父节点"**：把容器以 `insertBefore(codeView)` 放在 code-view 前面，同一个 grid cell 内。Rendered 模式下隐藏 code-view，容器自然填满 cell，file tree 所在的另一个 grid column 不受影响。

```ts
export function mountIntoFileView(codeView: HTMLElement): Mounted {
  removeExistingContainer();
  const parent = codeView.parentElement;
  if (!parent) throw new Error('code-view has no parent');
  const container = document.createElement("div");
  container.id = CONTAINER_ID;
  parent.insertBefore(container, codeView);
  const originalDisplay = codeView.style.display;
  codeView.style.display = "none";
  const unmount = () => {
    container.remove();
    codeView.style.display = originalDisplay;
  };
  return { container, nativeView: codeView, unmount };
}
```

**重命名 `insertContainerAbove` → `mountIntoFileView`**（更准确反映"填入 cell"而非"插在外层上方"）。`setNativeViewVisible` 保持语义不变，`Mounted` 接口形状不变。

**超时行为**：`waitForFileView` 3s 未命中 → controller 走静默 dispose 分支。等价于 spec §7 第 4 行（私有 repo 403 路径）。

### 3.2 修改 `extension/src/theme/claude-code.ts`

在 `CLAUDE_CODE_CSS` 常量里新增三组选择器（其它 token 不变）：

```css
#prompttrace-container {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.pt-root {
  padding: 16px 20px;
}

.pt-messages {
  max-width: 960px;
  margin: 0 auto;
}
```

- `#prompttrace-container` 确保容器不自己产生横向溢出
- `.pt-root` 的 padding 只声明一次，如果原 theme 里已有同名规则，**替换**而非叠加
- `.pt-messages` 限制消息流宽度到 ~960px，消息气泡 `max-width: 72% / 82%` 在此基础上叠加，对齐 Claude Code `/share` 的阅读宽度

### 3.3 controller.ts 跟随改名

`extension/src/controller.ts` 当前调用 `insertContainerAbove(nativeView)`，改为 `mountIntoFileView(codeView)`。语义等价，仅名字变化。其它状态机逻辑不动。

### 3.4 content.ts / navigation.ts 不动

FIX-3 不需要改入口或导航。去掉 `"main"` 兜底后，`waitForFileView` 只在 React 真的挂好 code-view 后才返回，首次打开的时序问题自然消失。

## 4. 测试策略

| 层 | 测试 | 文件 |
|---|---|---|
| CLI unit | 5 条 role 推断 | `prompttrace-cli/test/adapters/claude-code.test.ts`（扩展） |
| CLI integration | 真实样本回归（无 user 含 tool_result、无 local-command 残留） | `prompttrace-cli/test/adapters/real-sample.test.ts`（新建） |
| extension unit | `mount.ts`：selectors 不含 `main`、父节点存在/不存在两路径 | `extension/test/github/mount.test.ts`（**新文件**） |
| extension manual QA | 重测 README.md 的 13 条清单；重点：首次打开不需刷新、file tree 保留、文件切换自然 | `extension/README.md` |

自动化测试目标：`cd prompttrace-cli && npm test` 与 `cd extension && npm test` 在修改后全绿。

## 5. 与母文档的契约关系

- schema v1 不动 → CLI 和扩展的契约边界不受影响
- 扩展 spec §3 模块边界不变：`github/mount.ts` 仍是唯一耦合 GitHub DOM 的位置
- 扩展 spec §7 降级表新增第 7 行：`code-view selector 3s 未命中 → dispose()`，等价于私有 repo 403
  - 此改动在 v1.1 spec 汇总时合入母文档；本次 fix 里仅在实现层落地，不改母 spec 文件
- CLI schema-v1.md 不变；role `tool` 本就是文档里定义的合法值

## 6. 分支与提交

- 分支 `feat/browser-extension-impl`（延续）
- 预计 3 个提交（自上而下）：
  1. `fix(cli): infer role from content blocks, drop local-command meta messages`
  2. `fix(extension): mount into code-view grid cell, drop main fallback`
  3. `test: regression coverage for role inference + mount target`

## 7. 风险与未决

- **CLI role 规则遗漏新的 `<local-command-*>` 变体**：当前匹配 `caveat|stdout|stderr`。若 Claude Code 未来加新变体（如 `<local-command-image>`），`isLocalCommandText` 需扩展正则。属于低频维护负担，不阻塞 v1.0。
- **GitHub DOM 变更**：`[data-testid="code-view"]` 是 GitHub 2024 React 重构后的稳定 testid；但若 GitHub 将来改属性名，fallback `react-app[app-name="react-code-view"]` 兜底。再往下就是 3s 超时 → dispose 静默。
- **code-view 父节点意外为 null**：`mountIntoFileView` 显式 throw，被 controller 顶层 catch 静默吞掉。行为和 degraded 路径等价。
