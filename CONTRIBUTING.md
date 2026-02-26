# Contributing to Workflow Pilot

Thanks for your interest in contributing! This guide covers how to get started, how to create custom workflow flows, and the project conventions.

## Getting Started

1. **Fork and clone** the repository
2. **Install dependencies**: `pnpm install`
3. **Build**: `pnpm build`
4. **Run tests**: `pnpm test`

## Project Structure

```
src/
  index.ts        # Main entry and CLI/MCP exports
  types.ts        # TypeScript interfaces (Flow, Stage, WorkflowState)
  ops.ts          # Workflow operations (start, advance, back, loop, check, end)
  state.ts        # Session state persistence (read/write/clear)
  flows.ts        # YAML flow loading and listing
  cli.ts          # CLI command definitions
  mcp.ts          # MCP server for AI tool integration
  __tests__/      # Vitest test suite
flows/            # Built-in flow definitions (YAML)
statusline/       # Shell prompt and statusline integrations
```

## Creating a Flow

Flows are YAML files that define a sequence of stages an AI coding assistant should follow. Each flow lives in `~/.workflow-pilot/flows/` at runtime, or in the `flows/` directory when contributing to the project.

### Flow Schema

```yaml
id: my-flow                           # Unique identifier (used in `wp start my-flow`)
name: My Flow                         # Display name
description: Stage A → Stage B → Done # One-line summary of the sequence

stages:
  - id: stage-a
    name: Stage A
    icon: "🔍"
    instructions: |
      Multi-line instructions injected into the AI's context.
      Tell the AI exactly what to do (and what NOT to do) at this stage.
    keywords:                          # Optional — guide the AI's tone/language
      - investigate
      - don't implement yet
    transitions:
      next: stage-b                    # Stage ID to advance to (omit if terminal)
      back: null                       # Stage ID to go back to (omit if first)
    checklist:
      - First task to complete
      - Second task to complete
    can_loop: false                    # Whether `wp loop` can repeat this stage

  - id: stage-b
    name: Stage B
    icon: "🚀"
    instructions: |
      Instructions for the second stage.
    transitions:
      next: done
      back: stage-a
    checklist:
      - Implement the thing
      - Tests pass
    can_loop: false

  - id: done
    name: Done
    icon: "✅"
    instructions: ""
    transitions: {}
    checklist: []
    can_loop: false
```

### Field Reference

#### Flow (root level)

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | Unique identifier, used as the filename and in `wp start <id>` |
| `name` | string | Yes | Human-readable display name |
| `description` | string | Yes | One-line summary showing the stage sequence (use `→` arrows) |
| `stages` | Stage[] | Yes | Ordered array of stage definitions |

#### Stage

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | Unique identifier within the flow |
| `name` | string | Yes | Display name shown in CLI, prompt, and statusline |
| `icon` | string | Yes | Single emoji for visual identification |
| `instructions` | string | Yes | Multi-line instructions injected into the AI's context. Use YAML `\|` for block scalars |
| `keywords` | string[] | No | Phrases that guide the AI's language and focus |
| `transitions` | object | Yes | Navigation rules — can be empty `{}` for terminal stages |
| `transitions.next` | string | No | Stage ID to advance to. Omit if the stage has no next step |
| `transitions.back` | string | No | Stage ID to go back to. Omit if the stage has no prior step |
| `checklist` | string[] | Yes | Tasks to complete at this stage. Can be empty `[]` |
| `can_loop` | boolean | Yes | If `true`, `wp loop` resets the checklist and repeats this stage |

### Design Guidelines

**Write clear instructions.** The `instructions` field is the most important part of a stage — it's injected directly into the AI's context. Be explicit about what the AI should do and, crucially, what it should **not** do.

```yaml
instructions: |
  Read all relevant source files and understand the architecture.
  Write findings into research.md.
  Do NOT plan or implement anything yet.
```

**Use stage boundaries to enforce discipline.** The whole point of a workflow is preventing the AI from jumping ahead. Research stages should forbid implementation. Plan stages should forbid coding. This is what makes flows valuable.

**Keep checklists actionable.** Each item should be a concrete, verifiable outcome — not a vague goal.

```yaml
# Good
checklist:
  - Root cause identified
  - diagnosis.md written
  - Fix approach decided

# Bad
checklist:
  - Understand the bug
  - Think about it
```

**Use `can_loop` for refinement stages.** Stages like "Annotate" or "Feedback" often need multiple passes. Set `can_loop: true` so the user can iterate without restarting.

**Include a progress bar in instructions (optional).** The built-in flows use ASCII progress indicators to show where the user is in the overall sequence:

```yaml
instructions: |
  ┌──────────────────────────────────────────────────┐
  │ Research → ▸ Plan → Implement → Done             │
  │ ← Research   next → Implement                    │
  └──────────────────────────────────────────────────┘
  Write a detailed plan...
```

**End with a terminal stage.** Every flow should have a final stage (typically `done`) with empty transitions `{}`, an empty checklist `[]`, and `can_loop: false` (or `true` if you want to allow cycling back to the beginning).

### Example: Minimal Flow

A simple two-stage flow for quick tasks:

```yaml
id: quick-task
name: Quick Task
description: Plan → Do → Done

stages:
  - id: plan
    name: Plan
    icon: "📋"
    instructions: |
      Outline what needs to be done. Write a brief plan.
      Do NOT start implementing.
    transitions:
      next: do
    checklist:
      - Plan written
    can_loop: false

  - id: do
    name: Do
    icon: "🚀"
    instructions: |
      Implement the plan. Run tests when done.
    transitions:
      next: done
      back: plan
    checklist:
      - Implementation complete
      - Tests pass
    can_loop: false

  - id: done
    name: Done
    icon: "✅"
    instructions: ""
    transitions: {}
    checklist: []
    can_loop: false
```

## Code Contributions

### Conventions

- **TypeScript** with strict mode enabled
- **ES Modules** (`"type": "module"` in package.json)
- **Vitest** for testing
- **Zod** for runtime validation of YAML inputs
- Keep changes minimal and focused — don't refactor unrelated code

### Running Locally

```bash
# Build and run CLI
pnpm build && node dist/cli.js status

# Development mode (no build step)
pnpm dev:cli status
pnpm dev:mcp

# Run tests
pnpm test
pnpm test:watch
```

### Submitting Changes

1. Create a feature branch from `main`
2. Make your changes
3. Run `pnpm build && pnpm test` to verify
4. Open a pull request with a clear description of what changed and why
