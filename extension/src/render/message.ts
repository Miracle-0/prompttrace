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
