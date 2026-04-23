# Show Me Your Prompt · Browser Extension

Chrome MV3 extension that renders `.prompttrace.jsonl` files on GitHub file pages.

## Dev

    npm install
    npm run build        # produces dist/
    npm test

Then in Chrome: `chrome://extensions` → Developer mode → Load unpacked → select `dist/`.

## Security

- Only fetches from `github.com` and `raw.githubusercontent.com`
- No storage, cookies, or third-party network requests
- Sanitization in `.prompttrace.jsonl` is best-effort (see CLI README) — this extension renders what the CLI wrote

## Manual QA (run before each release)

Load `dist/` in `chrome://extensions` (Developer mode → Load unpacked), then verify:

- [ ] Open a public GitHub repo with a `.prompttrace.jsonl` file — renders correctly
- [ ] Click `Raw` in the toolbar — native GitHub view reappears; `Rendered` restores
- [ ] Navigate (via GitHub SPA) to another `.prompttrace.jsonl` — prior container disposed, new one mounts
- [ ] Navigate away to README.md — extension container disappears, no errors in console
- [ ] Expand a `tool_use` — pretty-printed JSON with key/string coloring, `\n` inside strings renders as real newlines
- [ ] Expand a `tool_result` — body is only added to DOM on click; collapse removes it
- [ ] `.prompttrace.jsonl` containing a >100 KB tool_result — truncated head/tail visible; "Show all" link works
- [ ] Navigate to a private-repo `.prompttrace.jsonl` (signed in) — extension does NOT appear; native view works
- [ ] Offline test (DevTools → Network → Offline) — error bar with Retry button; clicking Retry triggers a new fetch
- [ ] Create a `.prompttrace.jsonl` with `schema_version: 2` — warning bar appears; messages not rendered; native view stays visible
- [ ] Create a malformed `.prompttrace.jsonl` (first line `not json`) — no extension UI; `console.error` entry logged
- [ ] DevTools → Network — confirm no requests to any host other than `github.com` / `raw.githubusercontent.com`
- [ ] DevTools → Application → Storage — confirm no cookies/localStorage/IndexedDB entries created by the extension

## Security self-audit

- [ ] `grep -R "innerHTML" extension/src` returns 0 matches
- [ ] `manifest.json` contains only `github.com` + `raw.githubusercontent.com` in `host_permissions`; `permissions` array is empty
- [ ] `grep -RE "fetch|XMLHttpRequest|WebSocket|EventSource" extension/src` — every hit goes to a raw.githubusercontent.com URL
