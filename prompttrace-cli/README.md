# prompttrace

Share your AI coding sessions on GitHub — a small CLI that turns native Claude Code JSONL logs into a portable, sanitized `.prompttrace.jsonl` file you can commit to any repo.

> Part of the **Show Me Your Prompt** project. The `.prompttrace.jsonl` format defined here is the shared contract consumed by the forthcoming browser extension.

## Install

```bash
npm install -g prompttrace
```

Requires Node.js ≥ 20.

## Quick start

```bash
# 1. List the Claude Code sessions on this machine
prompttrace list

# 2. Export the most recent one into <repo>/.prompttrace/
prompttrace export --latest

# 3. Commit the result
git add .prompttrace && git commit -m "share: session notes"
```

The export command walks you through sanitization interactively:

- Shows how many redactions each rule produced
- Lets you review a unified diff in your `$PAGER`
- Lets you apply all rules, pick rule-by-rule, or skip entirely (with a confirm)
- Prompts for an optional title / summary / tags

For CI or scripting, use `--yes` to auto-apply every rule and accept the default title:

```bash
prompttrace export --latest --yes
```

## Commands

| Command | What it does |
| --- | --- |
| `prompttrace list` | List Claude Code sessions at `~/.claude/projects/` newest first |
| `prompttrace rules` | Print the built-in sanitization rules |
| `prompttrace export` | Interactively export a session as `.prompttrace.jsonl` |
| `prompttrace install-hook` | Add a `Stop` hook to `~/.claude/settings.json` so every ended session prompts for export |
| `prompttrace uninstall-hook` | Remove the hook |

`export` flags:

- `--session <id>` — export a specific session (default: most recent)
- `--latest` — explicit alias for the default
- `--from-hook` — silent-when-no-session, prompts before doing anything (used by the Claude Code hook)
- `-y, --yes` — non-interactive: apply every rule, accept default metadata, skip diff preview

## Sanitization rules

Run `prompttrace rules` to see the current list. Rules operate on individual text blocks; the engine skips (rather than aborts) any rule that throws. Rules ship as built-ins today:

- `abs-path` — `/Users/<name>`, `/home/<name>`, `C:\Users\<name>`
- `api-key` — `sk-ant-…`, `ghp_…`, `AKIA…`
- `env-var` — `KEY=value` pairs, **only inside `tool_result` blocks**
- `email` — standard addresses
- `long-tool-result` — truncates oversized (> 64 KB) `tool_result` blocks, keeping head + tail

Every rule id that actually ran is recorded in `meta.sanitization.rules_applied`; the total count of replacements lives in `meta.sanitization.redaction_count`.

## Output layout

Exports land at `<git-root>/.prompttrace/<slug>.prompttrace.jsonl`. Slugs are derived from the session title, lowercased and ASCII-folded; on collision a 7-char hex suffix is appended. The file is newline-terminated JSONL with a leading `meta` record followed by one `message` record per turn — see [docs/schema-v1.md](./docs/schema-v1.md).

## Auto-export on session end

```bash
prompttrace install-hook
```

This appends a `Stop` hook to `~/.claude/settings.json` that runs `prompttrace export --latest --from-hook` whenever a Claude Code session ends. The hook:

- Stays silent if there are no sessions (fresh install)
- Asks once before doing anything
- Preserves any other `Stop` hooks you already have
- Is idempotent — re-running `install-hook` won't duplicate it

## Project status

- **Schema:** v1 (stable). See [docs/schema-v1.md](./docs/schema-v1.md).
- **License:** MIT
