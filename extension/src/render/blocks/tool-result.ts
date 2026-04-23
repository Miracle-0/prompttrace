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
