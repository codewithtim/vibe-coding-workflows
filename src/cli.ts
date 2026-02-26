#!/usr/bin/env node
import { opStatus, opStart, opAdvance, opBack, opLoop, opCheck, opEnd, opFlows, type OpResult } from "./ops.js";

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

Aliases: s=status, a=advance, b=back, l=loop, c=check

State: ~/.workflow-pilot/state.json
Flows: ~/.workflow-pilot/flows/*.yaml`);
    break;
}
