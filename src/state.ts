import fs from "fs";
import path from "path";
import os from "os";
import type { WorkflowState } from "./types.js";

export const PILOT_DIR = path.join(os.homedir(), ".workflow-pilot");
export const STATE_FILE = path.join(PILOT_DIR, "state.json");
export const FLOWS_DIR = path.join(PILOT_DIR, "flows");

export function ensureDirs(): void {
  fs.mkdirSync(PILOT_DIR, { recursive: true });
  fs.mkdirSync(FLOWS_DIR, { recursive: true });
}

export function readState(): WorkflowState | null {
  try {
    const raw = fs.readFileSync(STATE_FILE, "utf8");
    return JSON.parse(raw) as WorkflowState;
  } catch {
    return null;
  }
}

export function writeState(state: WorkflowState): void {
  ensureDirs();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function clearState(): void {
  try {
    fs.unlinkSync(STATE_FILE);
  } catch {
    // already gone
  }
}
