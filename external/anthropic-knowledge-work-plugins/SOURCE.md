# Anthropic Knowledge Work Plugins — vendored skills

- Upstream: https://github.com/anthropics/knowledge-work-plugins
- Commit: `e050c2ec856373787143d7057663a6ebd1277df3`
- Fetched: 2026-11-08
- License: Apache-2.0 (see `LICENSE` in this directory)

## What is vendored

Only the `SKILL.md` files and their skill directories from:

- `engineering/skills/` (10 skills)
- `design/skills/` (7 skills)

Not vendored: `.claude-plugin/`, `.mcp.json`, `CONNECTORS.md`, plugin README.
Those are Claude Code plugin/MCP packaging. OpenCode discovers `SKILL.md`
directories, and MCP servers belong in the operator's `mcp.servers` config.

## Why a library instead of a plugin install

The upstream packages are not an agent runtime. They are Markdown guidance that
optionally uses MCP connectors. Vendoring at a fixed commit keeps the source
visible, avoids an unpinned remote update path, and lets a project opt in to
only the skills it needs.

## Update procedure

1. Fetch upstream at a new commit and record the SHA here.
2. Diff `engineering/skills` and `design/skills` against this copy.
3. Re-run `node scripts/install-external-skills.mjs --list` and the installer
   tests before publishing.
