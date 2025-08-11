// Centralized As-Is DDT schema typings used by the current builder/editor pipeline.
// Keep in sync with existing shapes; do not change runtime behavior.

import type { ActionParameter, Action, Escalation, StepGroup } from './types';

export type { ActionParameter, Action, Escalation, StepGroup };

// Explicit step type union for current UI/editor expectations
export type StepType = 'start' | 'noMatch' | 'noInput' | 'confirmation' | 'success';

// Main data node produced by the assembler today
export interface MainDataNode {
  id: string;
  name?: string;
  label?: string;
  type?: string; // e.g., 'date', 'email', etc.
  required?: boolean;
  condition?: string;
  steps: StepGroup[];
  subData?: MainDataNode[];
  constraints?: any[]; // kept as any to avoid behavior changes
}

// Top-level assembled DDT shape used by the Response Editor
export interface AssembledDDT {
  id: string;
  label: string;
  mainData: MainDataNode;
  translations: Record<string, string>;
}


