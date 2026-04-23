// Explicit text-to-DOM helper. Everything that becomes visible goes through here.
export function textNode(s: string): Text {
  return document.createTextNode(s);
}
