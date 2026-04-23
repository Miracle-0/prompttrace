// Typed manifest; build.mjs imports and writes dist/manifest.json.
export const manifest = {
  manifest_version: 3,
  name: "Show Me Your Prompt",
  version: "0.1.0",
  description: "Render .prompttrace.jsonl on GitHub file pages.",
  permissions: [],
  host_permissions: [
    "https://github.com/*",
    "https://raw.githubusercontent.com/*",
  ],
  content_scripts: [
    {
      matches: ["https://github.com/*"],
      js: ["content.js"],
      run_at: "document_idle",
      all_frames: false,
    },
  ],
} as const;
