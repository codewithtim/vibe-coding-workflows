# Changelog

## 0.1.0

Initial release.

- CLI (`wp`) and MCP server (`workflow-pilot-mcp`) for managing workflow stages
- Per-project session state stored in `~/.workflow-pilot/sessions/`, keyed by SHA-256 hashed project paths
- Zsh prompt segment and Claude Code status line integration
- YAML-based flow definitions with stages, transitions, checklists, and loop support
- Bundled flows: `boris-feature` and `bugfix`
