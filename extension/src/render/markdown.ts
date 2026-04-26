import createDOMPurify from "dompurify";
import { Marked, Renderer } from "marked";

export interface MarkdownMarker {
  sentinel: string;
  createNode: () => HTMLElement;
}

const ALLOWED_TAGS = [
  "a",
  "blockquote",
  "br",
  "code",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "li",
  "ol",
  "p",
  "pre",
  "strong",
  "ul",
];

const ALLOWED_ATTR = ["href", "title"];

const renderer = new Renderer();
renderer.html = ({ text }) => escapeHtml(text);
renderer.image = ({ text }) => escapeHtml(text);

const marked = new Marked({
  async: false,
  breaks: false,
  gfm: true,
  renderer,
});

export function renderMarkdownText(
  markdown: string,
  markers: MarkdownMarker[] = [],
): DocumentFragment {
  const fallback = () => {
    const fragment = document.createDocumentFragment();
    fragment.appendChild(document.createTextNode(markdown));
    replaceMarkerSentinels(fragment, markers);
    return fragment;
  };

  try {
    const html = marked.parse(markdown) as string;
    const purify = createDOMPurify(globalThis.window);
    const clean = purify.sanitize(html, {
      ALLOW_DATA_ATTR: false,
      ALLOWED_ATTR,
      ALLOWED_TAGS,
      RETURN_DOM_FRAGMENT: true,
    });
    hardenLinks(clean);
    replaceMarkerSentinels(clean, markers);
    return clean;
  } catch {
    return fallback();
  }
}

function hardenLinks(root: DocumentFragment): void {
  for (const link of root.querySelectorAll("a")) {
    const href = link.getAttribute("href");
    if (href && isSafeHref(href)) {
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener");
    } else {
      link.removeAttribute("href");
      link.removeAttribute("target");
      link.setAttribute("rel", "noopener");
    }
  }
}

function isSafeHref(href: string): boolean {
  const trimmed = href.trim();
  if (trimmed.length === 0) return false;

  const protocolMatch = /^[a-zA-Z][a-zA-Z\d+.-]*:/.exec(trimmed);
  if (!protocolMatch) return true;

  const protocol = protocolMatch[0].toLowerCase();
  return protocol === "http:" || protocol === "https:" || protocol === "mailto:";
}

function replaceMarkerSentinels(
  root: DocumentFragment,
  markers: MarkdownMarker[],
): void {
  if (markers.length === 0) return;

  const markerBySentinel = new Map(markers.map((m) => [m.sentinel, m]));
  const pattern = new RegExp(markers.map((m) => escapeRegExp(m.sentinel)).join("|"), "g");
  const walker = document.createTreeWalker(root, 4);
  const textNodes: Text[] = [];

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  for (const textNode of textNodes) {
    const value = textNode.nodeValue ?? "";
    let lastIndex = 0;
    let replaced = false;
    const fragment = document.createDocumentFragment();

    for (const match of value.matchAll(pattern)) {
      const marker = markerBySentinel.get(match[0]);
      if (!marker) continue;

      const index = match.index ?? 0;
      if (index > lastIndex) {
        fragment.appendChild(document.createTextNode(value.slice(lastIndex, index)));
      }
      fragment.appendChild(marker.createNode());
      lastIndex = index + match[0].length;
      replaced = true;
    }

    if (!replaced) continue;

    if (lastIndex < value.length) {
      fragment.appendChild(document.createTextNode(value.slice(lastIndex)));
    }
    textNode.replaceWith(fragment);
  }
}

function escapeHtml(value: string): string {
  const replacements: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (ch) => replacements[ch]!);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
