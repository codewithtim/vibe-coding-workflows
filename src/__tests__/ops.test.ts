import { describe, it, expect, vi, beforeEach } from "vitest";
import type { WorkflowState, Flow, Stage } from "../types.js";

// Mock state module
vi.mock("../state.js", () => ({
  readState: vi.fn(),
  writeState: vi.fn(),
  clearState: vi.fn(),
  ensureDirs: vi.fn(),
  PILOT_DIR: "/mock/.workflow-pilot",
  SESSIONS_DIR: "/mock/.workflow-pilot/sessions",
  FLOWS_DIR: "/mock/.workflow-pilot/flows",
  dirHash: vi.fn(),
  stateFileForDir: vi.fn(),
}));

// Mock flows module
vi.mock("../flows.js", () => ({
  loadFlow: vi.fn(),
  listFlows: vi.fn(),
  getStage: vi.fn(),
}));

import { readState, writeState, clearState } from "../state.js";
import { loadFlow, listFlows, getStage } from "../flows.js";
import { opStatus, opStart, opAdvance, opBack, opLoop, opCheck, opEnd, opFlows } from "../ops.js";

// --- Test fixtures ---

const stageResearch: Stage = {
  id: "research",
  name: "Research",
  icon: "🔍",
  instructions: "Read the code deeply.",
  keywords: ["deeply", "don't implement yet"],
  transitions: { next: "plan" },
  checklist: ["Codebase read", "research.md written"],
  can_loop: false,
};

const stagePlan: Stage = {
  id: "plan",
  name: "Plan",
  icon: "📋",
  instructions: "Write a detailed plan.",
  transitions: { next: "annotate", back: "research" },
  checklist: ["plan.md written", "Code snippets included"],
  can_loop: false,
};

const stageAnnotate: Stage = {
  id: "annotate",
  name: "Annotate",
  icon: "✏️",
  instructions: "Address all notes.",
  transitions: { next: "implement", back: "plan" },
  checklist: ["Notes addressed", "Plan approved"],
  can_loop: true,
};

const stageDone: Stage = {
  id: "done",
  name: "Done",
  icon: "✅",
  instructions: "",
  transitions: {},
  checklist: [],
  can_loop: false,
};

const testFlow: Flow = {
  id: "test-flow",
  name: "Test Flow",
  description: "A test workflow",
  stages: [stageResearch, stagePlan, stageAnnotate, stageDone],
};

function makeState(overrides: Partial<WorkflowState> = {}): WorkflowState {
  return {
    active_flow: "test-flow",
    current_stage: "research",
    loop_count: 0,
    checklist: {},
    history: [],
    started_at: "2026-01-01T00:00:00.000Z",
    project_dir: "/mock/project",
    ...overrides,
  };
}

function setupMocks(state: WorkflowState | null, flow: Flow | null = testFlow) {
  vi.mocked(readState).mockReturnValue(state);
  vi.mocked(loadFlow).mockReturnValue(flow);
  if (flow) {
    vi.mocked(getStage).mockImplementation((_flow, stageId) =>
      flow.stages.find((s) => s.id === stageId) ?? null
    );
  } else {
    vi.mocked(getStage).mockReturnValue(null);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── opStatus ────────────────────────────────────────────────

describe("opStatus", () => {
  it("should return error when no active workflow", () => {
    setupMocks(null);
    const result = opStatus();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("No active workflow");
  });

  it("should return error when flow not found", () => {
    setupMocks(makeState(), null);
    const result = opStatus();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Flow not found");
  });

  it("should return error when stage not found", () => {
    setupMocks(makeState({ current_stage: "nonexistent" }));
    vi.mocked(getStage).mockReturnValue(null);
    const result = opStatus();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Stage not found");
  });

  it("should return status message for active workflow", () => {
    setupMocks(makeState());
    const result = opStatus();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message).toContain("Test Flow");
      expect(result.message).toContain("🔍 Research");
      expect(result.message).toContain("stage 1/4");
      expect(result.message).toContain("YOUR INSTRUCTIONS");
      expect(result.message).toContain("Read the code deeply");
      expect(result.state).toEqual(makeState());
      expect(result.flow).toEqual(testFlow);
      expect(result.stage).toEqual(stageResearch);
    }
  });

  it("should display keywords when present", () => {
    setupMocks(makeState());
    const result = opStatus();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message).toContain("KEY PHRASES");
      expect(result.message).toContain("deeply");
    }
  });

  it("should display checklist with unchecked items", () => {
    setupMocks(makeState());
    const result = opStatus();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message).toContain("CHECKLIST (0/2)");
      expect(result.message).toContain("□ [1] Codebase read");
      expect(result.message).toContain("□ [2] research.md written");
    }
  });

  it("should display checked items from state", () => {
    setupMocks(makeState({ checklist: { research: [true, false] } }));
    const result = opStatus();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message).toContain("CHECKLIST (1/2)");
      expect(result.message).toContain("☑ [1] Codebase read");
      expect(result.message).toContain("□ [2] research.md written");
    }
  });

  it("should display available transitions", () => {
    setupMocks(makeState());
    const result = opStatus();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message).toContain("AVAILABLE TRANSITIONS");
      expect(result.message).toContain("→ next: plan");
    }
  });

  it("should display loop count when > 0", () => {
    setupMocks(makeState({ current_stage: "annotate", loop_count: 3 }));
    const result = opStatus();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message).toContain("LOOP COUNT: 3");
    }
  });

  it("should not display loop count when 0", () => {
    setupMocks(makeState());
    const result = opStatus();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message).not.toContain("LOOP COUNT");
    }
  });

  it("should show loop transition for loopable stages", () => {
    setupMocks(makeState({ current_stage: "annotate" }));
    const result = opStatus();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message).toContain("↺ loop");
    }
  });

  it("should show back transition when available", () => {
    setupMocks(makeState({ current_stage: "plan" }));
    const result = opStatus();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message).toContain("← back: research");
    }
  });
});

// ─── opStart ─────────────────────────────────────────────────

describe("opStart", () => {
  it("should return error when flow not found", () => {
    vi.mocked(loadFlow).mockReturnValue(null);
    const result = opStart("nonexistent");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Flow not found");
      expect(result.error).toContain("nonexistent");
    }
  });

  it("should return error when flow has no stages", () => {
    vi.mocked(loadFlow).mockReturnValue({
      id: "empty",
      name: "Empty",
      description: "No stages",
      stages: [],
    });
    const result = opStart("empty");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("no stages");
  });

  it("should start workflow at first stage", () => {
    vi.mocked(loadFlow).mockReturnValue(testFlow);
    const result = opStart("test-flow");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message).toContain("Started workflow: Test Flow");
      expect(result.message).toContain("🔍 Research");
      expect(result.state!.active_flow).toBe("test-flow");
      expect(result.state!.current_stage).toBe("research");
      expect(result.state!.loop_count).toBe(0);
      expect(result.state!.checklist).toEqual({});
      expect(result.state!.history).toEqual([]);
      expect(result.flow).toEqual(testFlow);
      expect(result.stage).toEqual(stageResearch);
    }
  });

  it("should write state to disk", () => {
    vi.mocked(loadFlow).mockReturnValue(testFlow);
    opStart("test-flow");
    expect(writeState).toHaveBeenCalledOnce();
    const writtenState = vi.mocked(writeState).mock.calls[0][0];
    expect(writtenState.active_flow).toBe("test-flow");
    expect(writtenState.current_stage).toBe("research");
  });
});

// ─── opAdvance ───────────────────────────────────────────────

describe("opAdvance", () => {
  it("should return error when no active workflow", () => {
    setupMocks(null);
    const result = opAdvance();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("No active workflow");
  });

  it("should return error when flow not found", () => {
    setupMocks(makeState(), null);
    const result = opAdvance();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Flow not found");
  });

  it("should return error when no next transition", () => {
    setupMocks(makeState({ current_stage: "done" }));
    const result = opAdvance();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("No next stage");
  });

  it("should advance to next stage", () => {
    setupMocks(makeState());
    const result = opAdvance();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message).toContain("Advanced to: 📋 Plan");
      expect(result.stage).toEqual(stagePlan);
    }
  });

  it("should update state with new stage and history", () => {
    setupMocks(makeState());
    opAdvance();
    expect(writeState).toHaveBeenCalledOnce();
    const writtenState = vi.mocked(writeState).mock.calls[0][0];
    expect(writtenState.current_stage).toBe("plan");
    expect(writtenState.loop_count).toBe(0);
    expect(writtenState.history).toHaveLength(1);
    expect(writtenState.history[0].from).toBe("research");
    expect(writtenState.history[0].to).toBe("plan");
  });

  it("should reset loop count on advance", () => {
    setupMocks(makeState({ current_stage: "research", loop_count: 5 }));
    opAdvance();
    const writtenState = vi.mocked(writeState).mock.calls[0][0];
    expect(writtenState.loop_count).toBe(0);
  });
});

// ─── opBack ──────────────────────────────────────────────────

describe("opBack", () => {
  it("should return error when no active workflow", () => {
    setupMocks(null);
    const result = opBack();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("No active workflow");
  });

  it("should return error when no back transition", () => {
    setupMocks(makeState({ current_stage: "research" }));
    const result = opBack();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("No back stage");
  });

  it("should go back to previous stage", () => {
    setupMocks(makeState({ current_stage: "plan" }));
    const result = opBack();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message).toContain("Went back to: 🔍 Research");
      expect(result.stage).toEqual(stageResearch);
    }
  });

  it("should update state with history entry", () => {
    setupMocks(makeState({ current_stage: "plan" }));
    opBack();
    expect(writeState).toHaveBeenCalledOnce();
    const writtenState = vi.mocked(writeState).mock.calls[0][0];
    expect(writtenState.current_stage).toBe("research");
    expect(writtenState.history).toHaveLength(1);
    expect(writtenState.history[0].from).toBe("plan");
    expect(writtenState.history[0].to).toBe("research");
  });

  it("should reset loop count on back", () => {
    setupMocks(makeState({ current_stage: "annotate", loop_count: 3 }));
    opBack();
    const writtenState = vi.mocked(writeState).mock.calls[0][0];
    expect(writtenState.loop_count).toBe(0);
  });
});

// ─── opLoop ──────────────────────────────────────────────────

describe("opLoop", () => {
  it("should return error when no active workflow", () => {
    setupMocks(null);
    const result = opLoop();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("No active workflow");
  });

  it("should return error when stage does not support looping", () => {
    setupMocks(makeState({ current_stage: "research" }));
    const result = opLoop();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("does not support looping");
  });

  it("should loop on a loopable stage", () => {
    setupMocks(makeState({ current_stage: "annotate" }));
    const result = opLoop();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message).toContain("Looping ✏️ Annotate");
      expect(result.message).toContain("loop #1");
    }
  });

  it("should increment loop count", () => {
    setupMocks(makeState({ current_stage: "annotate", loop_count: 2 }));
    opLoop();
    const writtenState = vi.mocked(writeState).mock.calls[0][0];
    expect(writtenState.loop_count).toBe(3);
  });

  it("should reset checklist for the looped stage", () => {
    setupMocks(
      makeState({
        current_stage: "annotate",
        checklist: { annotate: [true, true] },
      })
    );
    opLoop();
    const writtenState = vi.mocked(writeState).mock.calls[0][0];
    expect(writtenState.checklist["annotate"]).toEqual([false, false]);
  });

  it("should add history entry pointing to same stage", () => {
    setupMocks(makeState({ current_stage: "annotate" }));
    opLoop();
    const writtenState = vi.mocked(writeState).mock.calls[0][0];
    expect(writtenState.history).toHaveLength(1);
    expect(writtenState.history[0].from).toBe("annotate");
    expect(writtenState.history[0].to).toBe("annotate");
  });
});

// ─── opCheck ─────────────────────────────────────────────────

describe("opCheck", () => {
  it("should return error when no active workflow", () => {
    setupMocks(null);
    const result = opCheck(1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("No active workflow");
  });

  it("should return error when index is too low", () => {
    setupMocks(makeState());
    const result = opCheck(0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("out of range");
  });

  it("should return error when index is too high", () => {
    setupMocks(makeState());
    const result = opCheck(99);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("out of range");
  });

  it("should check an unchecked item", () => {
    setupMocks(makeState());
    const result = opCheck(1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message).toContain("☑");
      expect(result.message).toContain("[1]");
      expect(result.message).toContain("Codebase read");
    }
  });

  it("should uncheck a checked item (toggle)", () => {
    setupMocks(makeState({ checklist: { research: [true, false] } }));
    const result = opCheck(1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message).toContain("□");
    }
  });

  it("should write updated checklist to state", () => {
    setupMocks(makeState());
    opCheck(2);
    expect(writeState).toHaveBeenCalledOnce();
    const writtenState = vi.mocked(writeState).mock.calls[0][0];
    expect(writtenState.checklist["research"]).toEqual([false, true]);
  });

  it("should initialize checklist if not yet in state", () => {
    setupMocks(makeState({ checklist: {} }));
    opCheck(1);
    const writtenState = vi.mocked(writeState).mock.calls[0][0];
    expect(writtenState.checklist["research"]).toBeDefined();
    expect(writtenState.checklist["research"][0]).toBe(true);
  });
});

// ─── opEnd ───────────────────────────────────────────────────

describe("opEnd", () => {
  it("should return error when no active workflow", () => {
    setupMocks(null);
    const result = opEnd();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("No active workflow");
  });

  it("should end the workflow and clear state", () => {
    setupMocks(makeState());
    const result = opEnd();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message).toContain("Ended workflow: test-flow");
    }
    expect(clearState).toHaveBeenCalledOnce();
  });
});

// ─── opFlows ─────────────────────────────────────────────────

describe("opFlows", () => {
  it("should show message when no flows found", () => {
    vi.mocked(listFlows).mockReturnValue([]);
    const result = opFlows();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message).toContain("No flows found");
    }
  });

  it("should list available flows", () => {
    vi.mocked(listFlows).mockReturnValue([
      { id: "bugfix", name: "Bugfix Flow", description: "Fix bugs" },
      { id: "feature", name: "Feature Flow", description: "Build features" },
    ]);
    const result = opFlows();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message).toContain("Available flows");
      expect(result.message).toContain("bugfix");
      expect(result.message).toContain("Bugfix Flow");
      expect(result.message).toContain("Fix bugs");
      expect(result.message).toContain("feature");
      expect(result.message).toContain("Feature Flow");
    }
  });
});
