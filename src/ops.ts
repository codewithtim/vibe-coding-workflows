import { readState, writeState, clearState } from "./state.js";
import { loadFlow, listFlows, getStage } from "./flows.js";
import type { WorkflowState, Flow, Stage } from "./types.js";

// ANSI helpers for statusline output
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";

export type OpResult =
  | { ok: true; message: string; state?: WorkflowState; flow?: Flow; stage?: Stage }
  | { ok: false; error: string };

export function opStatus(): OpResult {
  const state = readState();
  if (!state) return { ok: false, error: "No active workflow. Run: wp start <flow-id>" };

  const flow = loadFlow(state.active_flow);
  if (!flow) return { ok: false, error: `Flow not found: ${state.active_flow}` };

  const stage = getStage(flow, state.current_stage);
  if (!stage) return { ok: false, error: `Stage not found: ${state.current_stage}` };

  const checkItems = state.checklist[stage.id] ?? stage.checklist.map(() => false);
  const checked = checkItems.filter(Boolean).length;
  const stageIndex = flow.stages.findIndex((s) => s.id === stage.id) + 1;

  const lines: string[] = [
    `CURRENT WORKFLOW: ${flow.name}`,
    `CURRENT STAGE: ${stage.icon} ${stage.name} (stage ${stageIndex}/${flow.stages.length})`,
    ...(state.loop_count > 0 ? [`LOOP COUNT: ${state.loop_count}`] : []),
    ``,
    `YOUR INSTRUCTIONS FOR THIS STAGE:`,
    stage.instructions.trim() || "(no specific instructions)",
    ``,
  ];

  if (stage.keywords && stage.keywords.length > 0) {
    lines.push(`KEY PHRASES TO USE:`);
    stage.keywords.forEach((k) => lines.push(`- ${k}`));
    lines.push(``);
  }

  lines.push(`CHECKLIST (${checked}/${stage.checklist.length}):`);
  stage.checklist.forEach((item, i) => {
    const done = checkItems[i] ?? false;
    lines.push(`${done ? "☑" : "□"} [${i + 1}] ${item}`);
  });
  lines.push(``);

  const transitions: string[] = [];
  if (stage.transitions.next) transitions.push(`→ next: ${stage.transitions.next}`);
  if (stage.transitions.back) transitions.push(`← back: ${stage.transitions.back}`);
  if (stage.can_loop) transitions.push(`↺ loop (repeat this stage)`);
  if (transitions.length) {
    lines.push(`AVAILABLE TRANSITIONS:`);
    transitions.forEach((t) => lines.push(`  ${t}`));
  }

  return { ok: true, message: lines.join("\n"), state, flow, stage };
}

export function opStart(flowId: string): OpResult {
  const flow = loadFlow(flowId);
  if (!flow) return { ok: false, error: `Flow not found: "${flowId}". Run: wp flows` };
  if (flow.stages.length === 0) return { ok: false, error: `Flow has no stages: ${flowId}` };

  const firstStage = flow.stages[0];
  const newState: WorkflowState = {
    active_flow: flowId,
    current_stage: firstStage.id,
    loop_count: 0,
    checklist: {},
    history: [],
    started_at: new Date().toISOString(),
    project_dir: process.cwd(),
  };
  writeState(newState);
  return {
    ok: true,
    message: `Started workflow: ${flow.name}\nCurrent stage: ${firstStage.icon} ${firstStage.name}`,
    state: newState,
    flow,
    stage: firstStage,
  };
}

export function opAdvance(): OpResult {
  const state = readState();
  if (!state) return { ok: false, error: "No active workflow." };
  const flow = loadFlow(state.active_flow);
  if (!flow) return { ok: false, error: `Flow not found: ${state.active_flow}` };
  const stage = getStage(flow, state.current_stage);
  if (!stage) return { ok: false, error: `Stage not found: ${state.current_stage}` };
  if (!stage.transitions.next) return { ok: false, error: `No next stage from: ${stage.name}` };
  const nextStage = getStage(flow, stage.transitions.next);
  if (!nextStage) return { ok: false, error: `Next stage not found: ${stage.transitions.next}` };

  state.history.push({ from: state.current_stage, to: nextStage.id, at: new Date().toISOString() });
  state.current_stage = nextStage.id;
  state.loop_count = 0;
  writeState(state);
  return { ok: true, message: `Advanced to: ${nextStage.icon} ${nextStage.name}`, state, flow, stage: nextStage };
}

export function opBack(): OpResult {
  const state = readState();
  if (!state) return { ok: false, error: "No active workflow." };
  const flow = loadFlow(state.active_flow);
  if (!flow) return { ok: false, error: `Flow not found: ${state.active_flow}` };
  const stage = getStage(flow, state.current_stage);
  if (!stage) return { ok: false, error: `Stage not found: ${state.current_stage}` };
  if (!stage.transitions.back) return { ok: false, error: `No back stage from: ${stage.name}` };
  const backStage = getStage(flow, stage.transitions.back);
  if (!backStage) return { ok: false, error: `Back stage not found: ${stage.transitions.back}` };

  state.history.push({ from: state.current_stage, to: backStage.id, at: new Date().toISOString() });
  state.current_stage = backStage.id;
  state.loop_count = 0;
  writeState(state);
  return { ok: true, message: `Went back to: ${backStage.icon} ${backStage.name}`, state, flow, stage: backStage };
}

export function opLoop(): OpResult {
  const state = readState();
  if (!state) return { ok: false, error: "No active workflow." };
  const flow = loadFlow(state.active_flow);
  if (!flow) return { ok: false, error: `Flow not found: ${state.active_flow}` };
  const stage = getStage(flow, state.current_stage);
  if (!stage) return { ok: false, error: `Stage not found: ${state.current_stage}` };
  if (!stage.can_loop) return { ok: false, error: `Stage does not support looping: ${stage.name}` };

  state.loop_count += 1;
  state.checklist[stage.id] = stage.checklist.map(() => false);
  state.history.push({ from: state.current_stage, to: state.current_stage, at: new Date().toISOString() });
  writeState(state);
  return { ok: true, message: `Looping ${stage.icon} ${stage.name} (loop #${state.loop_count})`, state, flow, stage };
}

export function opCheck(itemIndex: number): OpResult {
  const state = readState();
  if (!state) return { ok: false, error: "No active workflow." };
  const flow = loadFlow(state.active_flow);
  if (!flow) return { ok: false, error: `Flow not found: ${state.active_flow}` };
  const stage = getStage(flow, state.current_stage);
  if (!stage) return { ok: false, error: `Stage not found: ${state.current_stage}` };

  if (itemIndex < 1 || itemIndex > stage.checklist.length) {
    return { ok: false, error: `Item index out of range. Valid: 1–${stage.checklist.length}` };
  }
  if (!state.checklist[stage.id]) {
    state.checklist[stage.id] = stage.checklist.map(() => false);
  }

  const idx = itemIndex - 1;
  state.checklist[stage.id][idx] = !state.checklist[stage.id][idx];
  writeState(state);

  const done = state.checklist[stage.id][idx];
  return { ok: true, message: `${done ? "☑" : "□"} [${itemIndex}] ${stage.checklist[idx]}` };
}

export function opEnd(): OpResult {
  const state = readState();
  if (!state) return { ok: false, error: "No active workflow." };
  const flowName = state.active_flow;
  clearState();
  return { ok: true, message: `Ended workflow: ${flowName}` };
}

export function opFlows(): OpResult {
  const flows = listFlows();
  if (flows.length === 0) {
    return { ok: true, message: `No flows found in ~/.workflow-pilot/flows/\nAdd YAML files there to create flows.` };
  }
  const lines = flows.map((f) => `  ${f.id.padEnd(20)} ${f.name}\n${"".padEnd(22)}${f.description}`);
  return { ok: true, message: `Available flows:\n\n${lines.join("\n\n")}` };
}

export function opPrompt(): OpResult {
  const state = readState();
  if (!state) return { ok: true, message: "" };

  const flow = loadFlow(state.active_flow);
  if (!flow) return { ok: true, message: "" };

  const stage = getStage(flow, state.current_stage);
  if (!stage) return { ok: true, message: "" };

  const parts: string[] = [stage.id];

  if (state.loop_count > 0) {
    parts.push(`#${state.loop_count}`);
  }

  const checkItems = state.checklist[stage.id] ?? stage.checklist.map(() => false);
  const total = stage.checklist.length;
  if (total > 0) {
    const checked = checkItems.filter(Boolean).length;
    parts.push(`□ ${checked}/${total}`);
  }

  return { ok: true, message: parts.join(" ") };
}

export function opStatusline(cwd: string): OpResult {
  const state = readState(cwd);
  if (!state) return { ok: true, message: "" };

  const flow = loadFlow(state.active_flow);
  if (!flow) return { ok: true, message: "" };

  const stage = getStage(flow, state.current_stage);
  if (!stage) return { ok: true, message: "" };

  const stageIndex = flow.stages.findIndex((s) => s.id === stage.id);
  const prevStage = stageIndex > 0 ? flow.stages[stageIndex - 1] : null;
  const nextStage = stageIndex < flow.stages.length - 1 ? flow.stages[stageIndex + 1] : null;

  const parts: string[] = [];

  // Flow name (dimmed)
  parts.push(`${DIM}${state.active_flow}${RESET}`);

  // Separator
  parts.push(`${DIM}|${RESET}`);

  // Breadcrumb: prev → current → next
  let breadcrumb = "";
  if (prevStage) {
    breadcrumb += `${DIM}${prevStage.icon} ${prevStage.name} →${RESET} `;
  }
  breadcrumb += `${BOLD}${CYAN}${stage.icon} ${stage.name}${RESET}`;
  if (state.loop_count > 0) {
    breadcrumb += ` ${DIM}#${state.loop_count}${RESET}`;
  }
  if (nextStage) {
    breadcrumb += ` ${DIM}→ ${nextStage.icon} ${nextStage.name}${RESET}`;
  }
  parts.push(breadcrumb);

  // Loop indicator
  if (stage.can_loop) {
    parts.push(`${DIM}↺${RESET}`);
  }

  // Checklist progress
  const checkItems = state.checklist[stage.id] ?? stage.checklist.map(() => false);
  const total = stage.checklist.length;
  if (total > 0) {
    const checked = checkItems.filter(Boolean).length;
    if (checked === total) {
      parts.push(`${GREEN}✓ ${checked}/${total}${RESET}`);
    } else {
      parts.push(`${DIM}□ ${checked}/${total}${RESET}`);
    }
  }

  return { ok: true, message: parts.join(" ") };
}
