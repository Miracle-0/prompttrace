import { h } from "../../lib/dom.js";
import { renderMarkdownText, type MarkdownMarker } from "../markdown.js";

const MARKER_RE = /<REDACTED:[A-Z_]+>|<TRUNCATED:[^>]+>/g;
const SENTINEL_PREFIX = "\uE000PT_MARKER_";
const SENTINEL_SUFFIX = "\uE001";

export function renderTextBlock(text: string): HTMLElement {
  const wrap = h("div", { class: "pt-text pt-md" });
  const { markdown, markers } = replaceMarkersWithSentinels(text);
  const fragment = renderMarkdownText(markdown, markers);
  trimTrailingWhitespaceText(fragment);
  wrap.appendChild(fragment);
  return wrap;
}

function replaceMarkersWithSentinels(text: string): {
  markdown: string;
  markers: MarkdownMarker[];
} {
  let markdown = "";
  let lastIndex = 0;
  const markers: MarkdownMarker[] = [];

  for (const m of text.matchAll(MARKER_RE)) {
    const i = m.index!;
    if (i > lastIndex) {
      markdown += text.slice(lastIndex, i);
    }

    const marker = m[0];
    const sentinel = `${SENTINEL_PREFIX}${markers.length}${SENTINEL_SUFFIX}`;
    markers.push({
      sentinel,
      createNode: () => renderMarker(marker),
    });
    markdown += sentinel;
    lastIndex = i + marker.length;
  }

  if (lastIndex < text.length) {
    markdown += text.slice(lastIndex);
  }

  return { markdown, markers };
}

function renderMarker(marker: string): HTMLElement {
  if (marker.startsWith("<TRUNCATED:")) {
    return h(
      "span",
      { class: "pt-truncated", title: "Output truncated to keep the page responsive" },
      marker,
    );
  }
  return h(
    "span",
    { class: "pt-redacted", title: "This position was redacted by the CLI" },
    marker,
  );
}

function trimTrailingWhitespaceText(fragment: DocumentFragment): void {
  const lastChild = fragment.lastChild;
  if (lastChild?.nodeType === 3 && /^\s+$/.test(lastChild.textContent ?? "")) {
    lastChild.remove();
  }
}
