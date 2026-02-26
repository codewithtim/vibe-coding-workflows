import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import type { WorkflowState } from "./types.js";

export const PILOT_DIR = path.join(os.homedir(), ".workflow-pilot");
export const SESSIONS_DIR = path.join(PILOT_DIR, "sessions");
export const FLOWS_DIR = path.join(PILOT_DIR, "flows");

export function dirHash(dir: string): string {
  return crypto.createHash("sha256").update(dir).digest("hex").slice(0, 16);
}

export function stateFileForDir(dir: string): string {
  return path.join(SESSIONS_DIR, `${dirHash(dir)}.json`);
}

export function ensureDirs(): void {
  fs.mkdirSync(PILOT_DIR, { recursive: true });
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  fs.mkdirSync(FLOWS_DIR, { recursive: true });
}

export function readState(startDir?: string): WorkflowState | null {
  let dir = startDir ?? process.cwd();
  const root = path.parse(dir).root;

  while (true) {
    const file = stateFileForDir(dir);
    try {
      const raw = fs.readFileSync(file, "utf8");
      return JSON.parse(raw) as WorkflowState;
    } catch {
      // not found at this level, walk up
    }
    const parent = path.dirname(dir);
    if (parent === dir || dir === root) break;
    dir = parent;
  }

  return null;
}

export function writeState(state: WorkflowState): void {
  ensureDirs();
  const file = stateFileForDir(state.project_dir);
  fs.writeFileSync(file, JSON.stringify(state, null, 2));
}

export function clearState(startDir?: string): void {
  let dir = startDir ?? process.cwd();
  const root = path.parse(dir).root;

  while (true) {
    const file = stateFileForDir(dir);
    try {
      fs.unlinkSync(file);
      return;
    } catch {
      // not found at this level, walk up
    }
    const parent = path.dirname(dir);
    if (parent === dir || dir === root) break;
    dir = parent;
  }
}
