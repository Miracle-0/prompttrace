import { h } from "../lib/dom.js";
import type { MetaRecord, MessageRecord } from "../parser/schema.js";
import { themeFor } from "../theme/registry.js";
import { renderHeader } from "./header.js";
import { renderMessage } from "./message.js";

export interface RootApi {
  element: HTMLElement;
  appendMessage: (m: MessageRecord) => void;
  setMode: (mode: "rendered" | "raw") => void;
  showWarning: (text: string) => void;
  showError: (text: string, onRetry?: () => void) => void;
}

export interface RootCallbacks {
  onToggleRendered: (rendered: boolean) => void;
}

let themeInjected = false;

export function renderRoot(
  meta: MetaRecord,
  cb: RootCallbacks,
): RootApi {
  ensureTheme(meta.source);
  const messagesWrap = h("div", { class: "pt-messages" });
  const header = renderHeader(meta, 0, cb);
  const metaEl = header.root.querySelector(".pt-meta .pt-count") as HTMLElement | null;
  const messagesCountEl = header.root.querySelectorAll(".pt-meta span")[2] as HTMLElement;

  const root = h("div", { class: "pt-root", "data-theme": meta.source },
    header.root,
    messagesWrap,
  );

  let count = 0;
  const appendMessage = (m: MessageRecord) => {
    count += 1;
    messagesWrap.appendChild(renderMessage(m));
    if (messagesCountEl) messagesCountEl.textContent = `${count} messages`;
  };

  const showWarning = (text: string) => {
    header.root.appendChild(h("div", { class: "pt-warn" }, text));
  };

  const showError = (text: string, onRetry?: () => void) => {
    const existing = root.querySelector(".pt-error");
    if (existing) existing.remove();
    const children: Node[] = [h("span", {}, `✕ ${text}`)];
    if (onRetry) {
      const btn = h("button", {}, "Retry");
      btn.addEventListener("click", () => {
        btn.disabled = true;
        onRetry();
      });
      children.push(btn);
    }
    root.appendChild(h("div", { class: "pt-error" }, ...children));
  };

  return { element: root, appendMessage, setMode: header.setMode, showWarning, showError };
}

function ensureTheme(source: string): void {
  if (themeInjected) return;
  themeInjected = true;
  const style = document.createElement("style");
  style.id = "prompttrace-theme";
  style.textContent = themeFor(source).css;
  document.head.appendChild(style);
}
