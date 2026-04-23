// v1: single theme. Export a CSS string that the render root injects once.
export const CLAUDE_CODE_CSS = `
#prompttrace-container {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}
.pt-root {
  background: #F5F2EC; color: #2b2622;
  font-family: -apple-system, "SF Pro Text", system-ui, sans-serif;
  font-size: 14px; line-height: 1.55;
  padding: 16px clamp(12px, 2vw, 24px);
  border: 1px solid #E5DFD4; border-radius: 8px;
  margin: 12px 0;
}
.pt-toolbar {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 18px; padding-bottom: 14px;
  border-bottom: 1px solid #E5DFD4;
}
.pt-toggle { display: inline-flex; background: white; border: 1px solid #D9D1C2; border-radius: 6px; overflow: hidden; font-size: 12px; }
.pt-toggle button { padding: 5px 12px; background: none; border: 0; cursor: pointer; color: #6e6356; font-weight: 500; }
.pt-toggle button.active { background: #CC7859; color: white; }
.pt-source-chip { background: white; border: 1px solid #D9D1C2; padding: 4px 10px; border-radius: 999px; font-size: 11px; color: #6e6356; display: inline-flex; align-items: center; gap: 6px; }
.pt-source-chip .dot { width: 8px; height: 8px; border-radius: 50%; background: #CC7859; display: inline-block; }
.pt-title { font-size: 20px; font-weight: 600; margin: 0 0 4px; color: #1a1614; }
.pt-summary { color: #5a4f42; font-size: 14px; margin: 2px 0 10px; max-width: 60ch; }
.pt-meta { color: #8a7e6e; font-size: 12px; display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 10px; }
.pt-meta .sep { color: #C5BBA8; }
.pt-warn { background: #FFF3E0; border: 1px solid #E8C394; color: #8B5A1B; padding: 6px 10px; border-radius: 4px; font-size: 12px; display: inline-flex; align-items: center; gap: 6px; margin-bottom: 10px; }
.pt-error { background: #FCEAE7; border: 1px solid #E8B4A8; color: #8B2E1B; padding: 10px 14px; border-radius: 4px; font-size: 13px; display: flex; align-items: center; gap: 10px; }
.pt-error button { margin-left: auto; background: white; border: 1px solid #D9A89C; color: #8B2E1B; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-weight: 500; }
.pt-tags { display: flex; gap: 6px; flex-wrap: wrap; }
.pt-tag { background: white; border: 1px solid #D9D1C2; color: #6e6356; padding: 2px 10px; border-radius: 999px; font-size: 11px; }
.pt-messages { margin: 20px auto 0; max-width: 1100px; width: 100%; display: flex; flex-direction: column; gap: 14px; }
.pt-msg { max-width: 82%; }
.pt-msg-user { align-self: flex-end; max-width: 72%; background: #CC7859; color: white; padding: 10px 14px; border-radius: 16px 16px 4px 16px; }
.pt-msg-assistant, .pt-msg-tool { align-self: flex-start; background: white; border: 1px solid #E5DFD4; padding: 12px 14px; border-radius: 4px 16px 16px 16px; }
.pt-msg-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #B39A7C; margin-bottom: 4px; font-weight: 600; }
.pt-msg-user .pt-msg-label { color: rgba(255,255,255,0.75); }
.pt-text { white-space: pre-wrap; }
.pt-redacted { background: #EFE8DB; border: 1px dashed #C5BBA8; color: #8B7A5A; padding: 0 6px; border-radius: 3px; font-family: "SF Mono", Consolas, monospace; font-size: 12px; cursor: help; }
.pt-truncated { background: #EFE8DB; border: 1px dashed #C5BBA8; color: #8B7A5A; padding: 0 6px; border-radius: 3px; font-family: "SF Mono", Consolas, monospace; font-size: 12px; }
.pt-msg-user .pt-redacted { background: rgba(255,255,255,0.18); border-color: rgba(255,255,255,0.45); color: white; }
.pt-tool { border: 1px solid #E5DFD4; border-radius: 6px; background: #FAF7F0; margin-top: 10px; overflow: hidden; }
.pt-tool-head { padding: 8px 12px; display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; }
.pt-tool.pt-tool-expanded .pt-tool-head { border-bottom: 1px solid #E5DFD4; }
.pt-caret { color: #B39A7C; font-size: 10px; font-family: monospace; width: 10px; display: inline-block; }
.pt-tool-name { background: white; border: 1px solid #D9D1C2; padding: 1px 7px; border-radius: 3px; font-family: "SF Mono", Consolas, monospace; font-size: 11px; color: #8B5A1B; font-weight: 600; }
.pt-tool-summary { font-family: "SF Mono", Consolas, monospace; font-size: 12px; color: #6e6356; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
.pt-tool-input-body { padding: 10px 12px; background: #FDFBF6; border-bottom: 1px solid #E5DFD4; }
.pt-tool-result { border: 1px solid #E5DFD4; border-radius: 6px; background: #FAF7F0; margin-top: 8px; overflow: hidden; }
.pt-tool-result-head { padding: 7px 12px; background: #F0EADC; font-size: 12px; color: #6e6356; display: flex; align-items: center; gap: 6px; cursor: pointer; }
.pt-tool-result-size { margin-left: auto; color: #8a7e6e; }
.pt-tool-result-body { background: white; padding: 10px 12px; font-family: "SF Mono", Consolas, monospace; font-size: 12px; color: #3d342a; white-space: pre; overflow-x: auto; margin: 0; }
.pt-expand-all { color: #CC7859; font-size: 11px; cursor: pointer; text-decoration: underline dotted; }
.pt-json { background: transparent; font-family: "SF Mono", Consolas, monospace; font-size: 12px; color: #3d342a; margin: 0; white-space: pre; overflow-x: auto; }
.pt-json-k { color: #CC7859; }
.pt-json-s { color: #4e7a3a; }
.pt-json-n { color: #8B5A1B; }
.pt-json-null { color: #8a7e6e; font-style: italic; }
.pt-json-punct { color: #8a7e6e; }
`;
