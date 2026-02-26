#!/usr/bin/env node
import { readFileSync } from "fs";
import { opStatus, opStart, opAdvance, opBack, opLoop, opCheck, opEnd, opFlows, opPrompt, opStatusline, type OpResult } from "./ops.js";

function print(result: OpResult) {
  if (result.ok) {
    console.log(result.message);
  } else {
    console.error(`❌ ${result.error}`);
    process.exit(1);
  }
}

const [, , cmd, ...args] = process.argv;

switch (cmd) {
  case "status":
  case "s":
    print(opStatus());
    break;

  case "start":
    if (!args[0]) {
      console.error("Usage: wp start <flow-id>");
      process.exit(1);
    }
    print(opStart(args[0]));
    break;

  case "advance":
  case "next":
  case "a":
    print(opAdvance());
    break;

  case "back":
  case "b":
    print(opBack());
    break;

  case "loop":
  case "l":
    print(opLoop());
    break;

  case "check":
  case "c": {
    const n = parseInt(args[0], 10);
    if (isNaN(n)) {
      console.error("Usage: wp check <item-number>");
      process.exit(1);
    }
    print(opCheck(n));
    break;
  }

  case "end":
  case "done":
    print(opEnd());
    break;

  case "flows":
  case "list":
    print(opFlows());
    break;

  case "prompt":
  case "p": {
    const result = opPrompt();
    if (result.ok && result.message) {
      console.log(result.message);
    }
    break;
  }

  case "statusline":
  case "sl": {
    let cwd = "";
    try {
      if (!process.stdin.isTTY) {
        const raw = readFileSync(0, "utf8");
        const parsed = JSON.parse(raw);
        cwd = parsed.cwd ?? "";
      }
    } catch {
      // no stdin or invalid JSON — fall through with empty cwd
    }
    const slResult = opStatusline(cwd);
    if (slResult.ok && slResult.message) {
      console.log(slResult.message);
    }
    break;
  }

  default:
    console.log(`workflow-pilot (wp) — workflow state manager for AI coding sessions

Usage:
  wp flows              List available workflows
  wp start <flow-id>    Start a workflow session
  wp status             Show current stage, checklist, transitions
  wp advance            Move to next stage
  wp back               Go to previous stage
  wp loop               Repeat current stage
  wp check <n>          Toggle checklist item n
  wp end                End current session
  wp prompt             Compact stage info for zsh prompt
  wp statusline         ANSI breadcrumb for Claude Code status line

Aliases: s=status, a=advance, b=back, l=loop, c=check, p=prompt, sl=statusline

State: ~/.workflow-pilot/state.json
Flows: ~/.workflow-pilot/flows/*.yaml`);
    break;
}
