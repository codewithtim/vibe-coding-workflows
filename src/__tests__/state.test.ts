import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import path from "path";
import type { WorkflowState } from "../types.js";

vi.mock("fs", () => ({
  default: {
    mkdirSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  },
}));

import fs from "fs";
import {
  readState,
  writeState,
  clearState,
  ensureDirs,
  dirHash,
  stateFileForDir,
  PILOT_DIR,
  SESSIONS_DIR,
  FLOWS_DIR,
} from "../state.js";

const mockState: WorkflowState = {
  active_flow: "bugfix",
  current_stage: "diagnose",
  loop_count: 0,
  checklist: {},
  history: [],
  started_at: "2026-01-01T00:00:00.000Z",
  project_dir: "/mock/project",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("state constants", () => {
  it("should define PILOT_DIR under home directory", () => {
    expect(PILOT_DIR).toContain(".workflow-pilot");
  });

  it("should define SESSIONS_DIR inside PILOT_DIR", () => {
    expect(SESSIONS_DIR).toContain(".workflow-pilot");
    expect(SESSIONS_DIR).toContain("sessions");
  });

  it("should define FLOWS_DIR inside PILOT_DIR", () => {
    expect(FLOWS_DIR).toContain(".workflow-pilot");
    expect(FLOWS_DIR).toContain("flows");
  });
});

describe("dirHash", () => {
  it("should return a 16-char hex string", () => {
    const hash = dirHash("/some/project");
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("should be deterministic", () => {
    expect(dirHash("/some/project")).toBe(dirHash("/some/project"));
  });

  it("should differ for different directories", () => {
    expect(dirHash("/project-a")).not.toBe(dirHash("/project-b"));
  });

  it("should match raw SHA-256 first 16 chars", () => {
    const dir = "/test/dir";
    const expected = crypto.createHash("sha256").update(dir).digest("hex").slice(0, 16);
    expect(dirHash(dir)).toBe(expected);
  });
});

describe("stateFileForDir", () => {
  it("should return a path under SESSIONS_DIR", () => {
    const file = stateFileForDir("/some/project");
    expect(file).toContain("sessions");
    expect(file.endsWith(".json")).toBe(true);
  });

  it("should use dirHash as the filename", () => {
    const dir = "/some/project";
    const hash = dirHash(dir);
    const file = stateFileForDir(dir);
    expect(path.basename(file)).toBe(`${hash}.json`);
  });
});

describe("ensureDirs", () => {
  it("should create PILOT_DIR, SESSIONS_DIR, and FLOWS_DIR recursively", () => {
    ensureDirs();
    expect(fs.mkdirSync).toHaveBeenCalledWith(PILOT_DIR, { recursive: true });
    expect(fs.mkdirSync).toHaveBeenCalledWith(SESSIONS_DIR, { recursive: true });
    expect(fs.mkdirSync).toHaveBeenCalledWith(FLOWS_DIR, { recursive: true });
    expect(fs.mkdirSync).toHaveBeenCalledTimes(3);
  });
});

describe("readState", () => {
  it("should return parsed state when session file exists for exact dir", () => {
    const dir = "/mock/project";
    const expectedFile = stateFileForDir(dir);
    vi.mocked(fs.readFileSync).mockImplementation((filePath: any) => {
      if (filePath === expectedFile) return JSON.stringify(mockState);
      throw new Error("ENOENT");
    });
    const result = readState(dir);
    expect(result).toEqual(mockState);
  });

  it("should walk up and find state in parent directory", () => {
    const parentDir = "/mock/project";
    const childDir = "/mock/project/src/components";
    const parentFile = stateFileForDir(parentDir);
    vi.mocked(fs.readFileSync).mockImplementation((filePath: any) => {
      if (filePath === parentFile) return JSON.stringify(mockState);
      throw new Error("ENOENT");
    });
    const result = readState(childDir);
    expect(result).toEqual(mockState);
  });

  it("should return null when no state found anywhere", () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });
    const result = readState("/some/random/dir");
    expect(result).toBeNull();
  });

  it("should return null when file contains invalid JSON", () => {
    const dir = "/mock/project";
    const expectedFile = stateFileForDir(dir);
    vi.mocked(fs.readFileSync).mockImplementation((filePath: any) => {
      if (filePath === expectedFile) return "not-json{{{";
      throw new Error("ENOENT");
    });
    // Invalid JSON causes a catch, walks up, eventually returns null
    const result = readState(dir);
    expect(result).toBeNull();
  });
});

describe("writeState", () => {
  it("should ensure directories and write JSON state to session file", () => {
    writeState(mockState);
    expect(fs.mkdirSync).toHaveBeenCalledTimes(3);
    const expectedFile = stateFileForDir(mockState.project_dir);
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expectedFile,
      JSON.stringify(mockState, null, 2)
    );
  });

  it("should write to different files for different project_dirs", () => {
    const state1 = { ...mockState, project_dir: "/project-a" };
    const state2 = { ...mockState, project_dir: "/project-b" };
    writeState(state1);
    writeState(state2);
    const file1 = vi.mocked(fs.writeFileSync).mock.calls[0][0];
    const file2 = vi.mocked(fs.writeFileSync).mock.calls[1][0];
    expect(file1).not.toBe(file2);
  });
});

describe("clearState", () => {
  it("should find and delete the state file by walking up", () => {
    const parentDir = "/mock/project";
    const childDir = "/mock/project/src";
    const parentFile = stateFileForDir(parentDir);

    // unlinkSync succeeds only for the parent's session file
    vi.mocked(fs.unlinkSync).mockImplementation((filePath: any) => {
      if (filePath === parentFile) return;
      throw new Error("ENOENT");
    });

    clearState(childDir);
    expect(fs.unlinkSync).toHaveBeenCalledWith(parentFile);
  });

  it("should not throw when no state file found", () => {
    vi.mocked(fs.unlinkSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });
    expect(() => clearState("/some/random/dir")).not.toThrow();
  });
});
