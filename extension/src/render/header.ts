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
