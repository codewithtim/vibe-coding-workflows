export interface Stage {
  id: string;
  name: string;
  icon: string;
  instructions: string;
  keywords?: string[];
  transitions: {
    next?: string;
    back?: string;
  };
  checklist: string[];
  can_loop: boolean;
}

export interface Flow {
  id: string;
  name: string;
  description: string;
  stages: Stage[];
}

export interface ChecklistState {
  [stageId: string]: boolean[];
}

export interface HistoryEntry {
  from: string;
  to: string;
  at: string;
}

export interface WorkflowState {
  active_flow: string;
  current_stage: string;
  loop_count: number;
  checklist: ChecklistState;
  history: HistoryEntry[];
  started_at: string;
}
