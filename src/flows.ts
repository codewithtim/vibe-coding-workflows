import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { FLOWS_DIR } from "./state.js";
import type { Flow, Stage } from "./types.js";

export function loadFlow(flowId: string): Flow | null {
  const filePath = path.join(FLOWS_DIR, `${flowId}.yaml`);
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return yaml.load(raw) as Flow;
  } catch {
    return null;
  }
}

export function listFlows(): Array<{ id: string; name: string; description: string }> {
  try {
    const files = fs.readdirSync(FLOWS_DIR).filter((f) => f.endsWith(".yaml"));
    return files.flatMap((file) => {
      const filePath = path.join(FLOWS_DIR, file);
      try {
        const raw = fs.readFileSync(filePath, "utf8");
        const flow = yaml.load(raw) as Flow;
        return [{ id: flow.id, name: flow.name, description: flow.description }];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

export function getStage(flow: Flow, stageId: string): Stage | null {
  return flow.stages.find((s) => s.id === stageId) ?? null;
}
