import { h } from "../../lib/dom.js";

const MARKER_RE = /<REDACTED:[A-Z_]+>|<TRUNCATED:[^>]+>/g;

export function renderTextBlock(text: string): HTMLElement {
  const wrap = h("span", { class: "pt-text" });
  let lastIndex = 0;
  for (const m of text.matchAll(MARKER_RE)) {
    const i = m.index!;
    if (i > lastIndex) {
      wrap.appendChild(document.createTextNode(text.slice(lastIndex, i)));
    }
    wrap.appendChild(renderMarker(m[0]));
    lastIndex = i + m[0].length;
  }
  if (lastIndex < text.length) {
    wrap.appendChild(document.createTextNode(text.slice(lastIndex)));
  }
  return wrap;
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
