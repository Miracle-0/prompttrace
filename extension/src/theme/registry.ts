import { CLAUDE_CODE_CSS } from "./claude-code.js";

export interface Theme {
  id: string;
  css: string;
}

const THEMES: Record<string, Theme> = {
  "claude-code": { id: "claude-code", css: CLAUDE_CODE_CSS },
};

export function themeFor(source: string): Theme {
  return THEMES[source] ?? THEMES["claude-code"]!;
}
