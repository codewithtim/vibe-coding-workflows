# workflow-pilot

[![npm version](https://img.shields.io/npm/v/workflow-pilot.svg)](https://www.npmjs.com/package/workflow-pilot)

Workflow state manager for AI coding sessions.

Shows your current workflow stage in your zsh prompt and injects stage-appropriate context into Claude Code / opencode via MCP.

## Install

```bash
npm install -g workflow-pilot
```

Or install from source:
```bash
git clone https://github.com/timknight/workflow-pilot.git
cd workflow-pilot
npm install
npm run build
npm install -g .
```

## Setup

### 1. Install flows

```bash
mkdir -p ~/.workflow-pilot/flows

# Copy the bundled flows
cp flows/boris-feature.yaml ~/.workflow-pilot/flows/
cp flows/bugfix.yaml ~/.workflow-pilot/flows/
```

### 2. Add zsh prompt segment

Add to your `~/.zshrc`:

```bash
workflow_pilot_prompt() {
  local sessions_dir="$HOME/.workflow-pilot/sessions"
  [[ -d "$sessions_dir" ]] || return

  # Walk up from cwd to find a session state file (python3, no deps)
  local info
  info=$(python3 -c "
import json, sys, os, hashlib
sessions_dir = os.path.expanduser('~/.workflow-pilot/sessions')
d = os.getcwd()
s = None
while True:
  h = hashlib.sha256(d.encode()).hexdigest()[:16]
  p = os.path.join(sessions_dir, h + '.json')
  if os.path.isfile(p):
    try:
      with open(p) as f:
        s = json.load(f)
      break
    except Exception:
      pass
  parent = os.path.dirname(d)
  if parent == d:
    break
  d = parent
if not s:
  sys.exit(0)
flow = s.get('active_flow', '')
stage = s.get('current_stage', '')
loop = s.get('loop_count', 0)
checklist = s.get('checklist', {}).get(stage, [])
checked = sum(1 for x in checklist if x)
total = len(checklist)
loop_str = f' #{loop}' if loop > 0 else ''
check_str = f' □ {checked}/{total}' if total > 0 else ''
print(f'{stage}{loop_str}{check_str}')
" 2>/dev/null)

  [[ -n "$info" ]] && echo "%F{cyan}⚙ ${info}%f "
}

# Add to your prompt — pick one:
RPROMPT='$(workflow_pilot_prompt)'           # right prompt
# Or add to PROMPT if you prefer left side
```

### 3. Add Claude Code status line (optional)

The status line shows your current workflow stage persistently at the bottom of Claude Code — even while the LLM is responding.

Copy the status line script:

```bash
cp statusline/workflow-statusline.sh ~/.claude/workflow-statusline.sh
chmod +x ~/.claude/workflow-statusline.sh
```

Add to your `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/workflow-statusline.sh"
  }
}
```

This displays: `boris-feature | 🚀 Implement □ 1/3`

Restart Claude Code to activate the status line.

### 4. Configure MCP for Claude Code

Add to your Claude Code MCP config (`~/.claude/mcp.json` or `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "workflow-pilot": {
      "command": "workflow-pilot-mcp",
      "args": []
    }
  }
}
```

For opencode, add to your project's `.mcp.json`:
```json
{
  "mcpServers": {
    "workflow-pilot": {
      "command": "workflow-pilot-mcp",
      "args": [],
      "type": "stdio"
    }
  }
}
```

### 5. Add CLAUDE.md to your project

Copy `CLAUDE.md` into your project root (or append to existing):

```bash
cat CLAUDE.md >> /path/to/your/project/CLAUDE.md
```

## Usage

```bash
wp flows                    # list available workflows
wp start boris-feature      # start a workflow
wp status                   # show current stage
wp advance                  # move to next stage
wp back                     # go to previous stage
wp loop                     # repeat current stage
wp check 1                  # toggle checklist item 1
wp end                      # end session
```

Aliases: `a`=advance, `b`=back, `l`=loop, `c`=check, `s`=status

## Creating custom flows

Drop a YAML file in `~/.workflow-pilot/flows/`:

```yaml
id: my-flow
name: My Custom Flow
description: Step A → Step B → Done

stages:
  - id: step-a
    name: Step A
    icon: "🔍"
    instructions: |
      Do step A things.
      Do NOT do step B yet.
    keywords:
      - step a phrase
    transitions:
      next: step-b
    checklist:
      - Step A complete
    can_loop: false

  - id: step-b
    name: Step B
    icon: "🚀"
    instructions: |
      Do step B things.
    transitions:
      next: done
      back: step-a
    checklist:
      - Step B complete
    can_loop: true

  - id: done
    name: Done
    icon: "✅"
    instructions: ""
    transitions: {}
    checklist: []
    can_loop: false
```

## How it works

```
┌──────────────────────────────────────┐
│  MCP Server (stdio)                  │
│  workflow_status, advance, back...   │
│  LLM calls these to get stage rules  │
└──────────┬───────────────────────────┘
           │ reads/writes
           ▼
    ~/.workflow-pilot/sessions/<hash>.json
           ▲
           │ reads/writes
┌──────────────────────────────────────┐
│  wp (CLI)                            │
│  Manual control from terminal        │
└──────────────────────────────────────┘

    Session files are also read by:

    Zsh RPROMPT segment          Claude Code status line
    ⚙ annotate #2 □ 1/3         boris-feature | 🚀 Implement □ 1/3
```

Each project gets its own session file under `~/.workflow-pilot/sessions/`, keyed by a SHA-256 hash of the project directory. Multiple workflows can run concurrently in different projects.

## Files

```
~/.workflow-pilot/
├── sessions/
│   ├── <hash>.json     per-project session state
│   └── ...
└── flows/
    ├── boris-feature.yaml
    ├── bugfix.yaml
    └── your-custom-flow.yaml

~/.claude/
├── settings.json       statusLine config
└── workflow-statusline.sh  status line script
```

## Inspiration

This project was inspired by Boris Tane's excellent article [How I Use Claude Code](https://boristane.com/blog/how-i-use-claude-code/), which describes a structured approach to AI-assisted coding with explicit research, planning, and implementation phases. Workflow Pilot generalises that approach into a reusable tool with custom YAML-defined flows.
