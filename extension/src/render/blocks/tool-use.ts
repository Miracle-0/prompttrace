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
