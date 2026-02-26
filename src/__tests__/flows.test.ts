import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Flow, Stage } from "../types.js";

vi.mock("fs", () => ({
  default: {
    mkdirSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    readdirSync: vi.fn(),
  },
}));

import fs from "fs";
import { loadFlow, listFlows, getStage } from "../flows.js";

const sampleFlowYaml = `
id: test-flow
name: Test Flow
description: A test workflow
stages:
  - id: step-one
    name: Step One
    icon: "1️⃣"
    instructions: "Do step one"
    transitions:
      next: step-two
    checklist:
      - First item
    can_loop: false
  - id: step-two
    name: Step Two
    icon: "2️⃣"
    instructions: "Do step two"
    transitions:
      back: step-one
    checklist:
      - Second item
    can_loop: true
`;

const sampleFlow: Flow = {
  id: "test-flow",
  name: "Test Flow",
  description: "A test workflow",
  stages: [
    {
      id: "step-one",
      name: "Step One",
      icon: "1️⃣",
      instructions: "Do step one\n",
      transitions: { next: "step-two" },
      checklist: ["First item"],
      can_loop: false,
    },
    {
      id: "step-two",
      name: "Step Two",
      icon: "2️⃣",
      instructions: "Do step two\n",
      transitions: { back: "step-one" },
      checklist: ["Second item"],
      can_loop: true,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loadFlow", () => {
  it("should load and parse a YAML flow file", () => {
    vi.mocked(fs.readFileSync).mockReturnValue(sampleFlowYaml);
    const flow = loadFlow("test-flow");
    expect(flow).not.toBeNull();
    expect(flow!.id).toBe("test-flow");
    expect(flow!.name).toBe("Test Flow");
    expect(flow!.stages).toHaveLength(2);
    expect(flow!.stages[0].id).toBe("step-one");
    expect(flow!.stages[1].can_loop).toBe(true);
  });

  it("should return null when flow file does not exist", () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });
    const flow = loadFlow("nonexistent");
    expect(flow).toBeNull();
  });
});

describe("listFlows", () => {
  it("should list all YAML flow files", () => {
    vi.mocked(fs.readdirSync).mockReturnValue(
      ["test-flow.yaml", "other.yaml"] as unknown as ReturnType<typeof fs.readdirSync>
    );
    vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
      if (String(filePath).includes("test-flow")) return sampleFlowYaml;
      return `
id: other
name: Other Flow
description: Another flow
stages: []
`;
    });

    const flows = listFlows();
    expect(flows).toHaveLength(2);
    expect(flows[0]).toEqual({
      id: "test-flow",
      name: "Test Flow",
      description: "A test workflow",
    });
    expect(flows[1]).toEqual({
      id: "other",
      name: "Other Flow",
      description: "Another flow",
    });
  });

  it("should filter out non-YAML files", () => {
    vi.mocked(fs.readdirSync).mockReturnValue(
      ["test-flow.yaml", "readme.md", "config.json"] as unknown as ReturnType<typeof fs.readdirSync>
    );
    vi.mocked(fs.readFileSync).mockReturnValue(sampleFlowYaml);

    const flows = listFlows();
    expect(flows).toHaveLength(1);
  });

  it("should return empty array when flows directory doesn't exist", () => {
    vi.mocked(fs.readdirSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });
    const flows = listFlows();
    expect(flows).toEqual([]);
  });

  it("should skip files that fail to parse", () => {
    vi.mocked(fs.readdirSync).mockReturnValue(
      ["good.yaml", "bad.yaml"] as unknown as ReturnType<typeof fs.readdirSync>
    );
    vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
      if (String(filePath).includes("bad")) throw new Error("parse error");
      return sampleFlowYaml;
    });

    const flows = listFlows();
    expect(flows).toHaveLength(1);
  });
});

describe("getStage", () => {
  it("should find a stage by ID", () => {
    const stage = getStage(sampleFlow, "step-one");
    expect(stage).not.toBeNull();
    expect(stage!.name).toBe("Step One");
  });

  it("should return null for unknown stage ID", () => {
    const stage = getStage(sampleFlow, "nonexistent");
    expect(stage).toBeNull();
  });

  it("should find second stage", () => {
    const stage = getStage(sampleFlow, "step-two");
    expect(stage).not.toBeNull();
    expect(stage!.can_loop).toBe(true);
  });
});
