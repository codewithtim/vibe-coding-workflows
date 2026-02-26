#!/bin/bash
# Claude Code status line for workflow-pilot
# Displays current workflow stage, checklist progress, and session context usage

SESSIONS_DIR="$HOME/.workflow-pilot/sessions"

# No sessions directory = no workflows active
if [[ ! -d "$SESSIONS_DIR" ]]; then
  exit 0
fi

# Read Claude Code session JSON from stdin, pass via env var
export WP_SESSION_JSON="$(cat)"

python3 << 'PYEOF'
import json, os, sys, re, hashlib

sessions_dir = os.path.expanduser('~/.workflow-pilot/sessions')

# Get the project directory from the Claude Code session JSON
try:
    session = json.loads(os.environ.get('WP_SESSION_JSON', '{}'))
    project_dir = session.get('cwd', '')
except Exception:
    sys.exit(0)

if not project_dir:
    sys.exit(0)

# Only look for a state file matching this exact directory (no walk-up)
h = hashlib.sha256(project_dir.encode()).hexdigest()[:16]
state_path = os.path.join(sessions_dir, h + '.json')
try:
    with open(state_path) as f:
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
        im = re.search(r'icon:\s*"(.+?)"', block)
        nm = re.search(r'name:\s*(.+)', block)
        cl = re.search(r'can_loop:\s*(true|false)', block)
        nx = re.search(r'next:\s*(\S+)', block)
        bk = re.search(r'back:\s*(\S+)', block)
        stages[sid] = {
            'icon': im.group(1).strip() if im else '\u2699',
            'name': nm.group(1).strip() if nm else sid.capitalize(),
            'can_loop': cl and cl.group(1) == 'true',
            'next': nx.group(1).strip() if nx else None,
            'back': bk.group(1).strip() if bk else None,
        }
except Exception:
    pass

cur = stages.get(stage, {'icon': '\u2699', 'name': stage.capitalize(), 'can_loop': False, 'next': None, 'back': None})
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

# Breadcrumb: prev -> current -> next
breadcrumb = ''
if prev:
    breadcrumb += f'{DIM}{prev["icon"]} {prev["name"]} \u2192{RESET} '
breadcrumb += f'{BOLD}{CYAN}{cur["icon"]} {cur["name"]}{RESET}'
if loop > 0:
    breadcrumb += f' {DIM}#{loop}{RESET}'
if nxt:
    breadcrumb += f' {DIM}\u2192 {nxt["icon"]} {nxt["name"]}{RESET}'
parts.append(breadcrumb)

# Loop indicator
if cur.get('can_loop'):
    parts.append(f'{DIM}\u21ba{RESET}')

# Checklist progress
if total > 0:
    if checked == total:
        parts.append(f'\033[32m\u2713 {checked}/{total}{RESET}')
    else:
        parts.append(f'{DIM}\u25a1 {checked}/{total}{RESET}')

print(' '.join(parts))
PYEOF
