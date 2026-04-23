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
