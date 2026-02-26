# Changelog

## 0.2.0

Replace Python-based statusline and prompt with native CLI commands.

The original statusline script shelled out to an inline `python3` heredoc from a
bash script — an absurd choice given this is a Node.js CLI tool that already
exists on `$PATH`. Claude made a questionable decision to reach for Python inside
a zsh/bash script when `wp` was right there the whole time. This release fixes
that by adding `wp prompt` and `wp statusline` subcommands so everything runs
through the existing Node.js CLI with zero external dependencies.

### Added

- `wp prompt` / `wp p` — compact stage info for zsh `RPROMPT` (replaces inline Python)
- `wp statusline` / `wp sl` — ANSI breadcrumb output for Claude Code status line (replaces inline Python)
- Full test coverage for both new commands (opPrompt, opStatusline)

### Changed

- `statusline/workflow-statusline.sh` reduced from ~115 lines of bash+Python to a 3-line wrapper calling `wp statusline`
- README updated: zsh prompt now uses `wp prompt`, statusline uses `wp statusline`, no more copy-paste Python blobs
- README simplified: primary setup points to `wp` commands, shell script offered as optional alternative

### Removed

- Inline Python heredoc from `workflow-statusline.sh` — good riddance
- Inline Python heredoc from README zsh prompt example

## 0.1.0

Initial release.

- CLI (`wp`) and MCP server (`workflow-pilot-mcp`) for managing workflow stages
- Per-project session state stored in `~/.workflow-pilot/sessions/`, keyed by SHA-256 hashed project paths
- Zsh prompt segment and Claude Code status line integration
- YAML-based flow definitions with stages, transitions, checklists, and loop support
- Bundled flows: `boris-feature` and `bugfix`
