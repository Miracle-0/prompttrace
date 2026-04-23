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
