#!/bin/bash
# Claude Code status line for workflow-pilot
# Displays current workflow stage, checklist progress, and session context usage

STATE="$HOME/.workflow-pilot/state.json"

# Consume stdin (Claude Code session JSON)
input=$(cat)

# No state file = no workflow active, just show session info
if [[ ! -f "$STATE" ]]; then
  exit 0
fi

python3 -c "
import json, os, sys, re

# Read workflow state
try:
    with open(os.path.expanduser('~/.workflow-pilot/state.json')) as f:
        s = json.load(f)
except Exception:
    sys.exit(0)

flow = s.get('active_flow', '')
stage = s.get('current_stage', '')
loop = s.get('loop_count', 0)
checklist = s.get('checklist', {}).get(stage, [])
checked = sum(1 for x in checklist if x)
total = len(checklist)

# Parse all stages from flow YAML into a lookup
stages = {}  # id -> {icon, name, can_loop, next, back}
flow_path = os.path.expanduser(f'~/.workflow-pilot/flows/{flow}.yaml')
try:
    with open(flow_path) as f:
        content = f.read()
    blocks = re.split(r'(?=  - id: )', content)
    for block in blocks:
        id_m = re.search(r'- id:\s*(\S+)', block)
        if not id_m:
            continue
        sid = id_m.group(1).strip()
        im = re.search(r'icon:\s*\"(.+?)\"', block)
        nm = re.search(r'name:\s*(.+)', block)
        cl = re.search(r'can_loop:\s*(true|false)', block)
        nx = re.search(r'next:\s*(\S+)', block)
        bk = re.search(r'back:\s*(\S+)', block)
        stages[sid] = {
            'icon': im.group(1).strip() if im else '⚙',
            'name': nm.group(1).strip() if nm else sid.capitalize(),
            'can_loop': cl and cl.group(1) == 'true',
            'next': nx.group(1).strip() if nx else None,
            'back': bk.group(1).strip() if bk else None,
        }
except Exception:
    pass

cur = stages.get(stage, {'icon': '⚙', 'name': stage.capitalize(), 'can_loop': False, 'next': None, 'back': None})
prev_id = cur.get('back')
next_id = cur.get('next')
prev = stages.get(prev_id) if prev_id else None
nxt = stages.get(next_id) if next_id else None

# Build stage display
CYAN = '\033[36m'
DIM = '\033[2m'
RESET = '\033[0m'
BOLD = '\033[1m'

parts = []

# Flow name (dimmed)
parts.append(f'{DIM}{flow}{RESET}')

# Separator
parts.append(f'{DIM}|{RESET}')

# Breadcrumb: prev → current → next
breadcrumb = ''
if prev:
    breadcrumb += f'{DIM}{prev[\"icon\"]} {prev[\"name\"]} →{RESET} '
breadcrumb += f'{BOLD}{CYAN}{cur[\"icon\"]} {cur[\"name\"]}{RESET}'
if loop > 0:
    breadcrumb += f' {DIM}#{loop}{RESET}'
if nxt:
    breadcrumb += f' {DIM}→ {nxt[\"icon\"]} {nxt[\"name\"]}{RESET}'
parts.append(breadcrumb)

# Loop indicator
if cur.get('can_loop'):
    parts.append(f'{DIM}↺{RESET}')

# Checklist progress
if total > 0:
    if checked == total:
        parts.append(f'\033[32m✓ {checked}/{total}{RESET}')
    else:
        parts.append(f'{DIM}□ {checked}/{total}{RESET}')

print(' '.join(parts))
" 2>/dev/null
