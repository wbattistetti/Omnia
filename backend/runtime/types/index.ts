// Shared types for runtime engine
// These types are used across compiler, orchestrator, and DDT engine

// Flow types (equivalent to reactflow types, but without React dependency)
export interface FlowNode {
  id: string;
  data: NodeData;
  position?: { x: number; y: number };
  type?: string;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  data?: EdgeData;
  label?: string;
}

export interface NodeData {
  rows?: RowData[];
  label?: string;
  title?: string;
  [key: string]: any;
}

export interface RowData {
  id: string;
  taskId?: string;
  text?: string;
  [key: string]: any;
}

export interface EdgeData {
  condition?: any;
  conditionId?: string;
  isElse?: boolean;
  [key: string]: any;
}

// Task types
export interface Task {
  id: string;
  action: string;
  value?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

// DDT types
export interface AssembledDDT {
  id: string;
  label?: string;
  introduction?: any;
  mainData?: any;
  [key: string]: any;
}

