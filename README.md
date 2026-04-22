# Show Me Your Prompt

> Talk is cheap. Show me your ~~code~~ **prompt**.

GitHub is where we share code. This project is an attempt to make it also the place where we share **how we worked with an AI coding agent** — the full transcript, with tool calls and iteration trail preserved — so readers can learn not just *what* you built, but *how you got the AI to build it with you*.

## What's in the repo

Three independent pieces, coupled only by a single file format:

```
[Claude Code]         [prompttrace CLI]         [GitHub repo]         [Browser Extension]
~/.claude/projects/ → sanitize + confirm → .prompttrace/*.jsonl → renders as chat UI
   (native JSONL)                                                     (Chrome MV3, v2)
```

| Piece | Location | Status |
|---|---|---|
| CLI that exports + sanitizes Claude Code sessions | [`prompttrace-cli/`](./prompttrace-cli) | v1 landed |
| `.prompttrace.jsonl` file format (schema v1) | [`prompttrace-cli/docs/schema-v1.md`](./prompttrace-cli/docs/schema-v1.md) | stable |
| Chrome extension that renders the format on GitHub file pages | — | planned, v2 |

## Quick start

```bash
npm install -g prompttrace
prompttrace install-hook          # auto-export on session end (optional)
prompttrace export --latest       # or run it manually
git add .prompttrace && git commit -m "share: session notes"
```

See [`prompttrace-cli/README.md`](./prompttrace-cli/README.md) for the full command reference and the interactive sanitization flow.

## Design principles

- **Fidelity first.** Keep `tool_use` / `tool_result` as structured blocks — don't flatten them into prose.
- **Redact with placeholders, never silent deletes.** `<REDACTED:API_KEY>` is better than a missing line.
- **Sanitization is best-effort.** The CLI shows a unified diff before writing; the README ships a disclaimer. Review the output before you commit.
- **One adapter per agent.** Today: Claude Code only. Future support for other agents adds `adapters/<tool>.ts` and leaves everything else alone.

## Docs

- [Design doc (v1)](./docs/superpowers/specs/2026-04-22-show-me-your-prompt-design.md) — full spec, architecture rationale, non-goals
- [Schema v1](./prompttrace-cli/docs/schema-v1.md) — the file format contract shared by CLI and extension
- [CLI README](./prompttrace-cli/README.md) — install, commands, sanitization rules

## Status

v1 is the CLI plus the file format. The browser extension is v2 — the format is stable enough to start building against.
