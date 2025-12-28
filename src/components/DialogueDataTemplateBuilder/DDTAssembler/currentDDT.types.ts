// Centralized As-Is DDT schema typings used by the current builder/editor pipeline.
// Keep in sync with existing shapes; do not change runtime behavior.

import type { ActionParameter, Escalation, StepGroup } from './types';
import type { Task } from '../../../types/taskTypes';

// Export types
export type { ActionParameter, Escalation, StepGroup };
export type { Task };

// Legacy type aliases for backward compatibility
// @deprecated Use Task from taskTypes.ts instead
export type TaskReference = Task;
export type Action = Task;

// Explicit step type union for current UI/editor expectations
export type StepType = 'start' | 'noMatch' | 'noInput' | 'confirmation' | 'success' | 'introduction';

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
  synonyms?: string[]; // embedded synonyms per node (main/sub)
  constraints?: any[]; // kept as any to avoid behavior changes
}

// Top-level assembled DDT shape used by the Response Editor
export interface AssembledDDT {
  id: string;
  label: string;
  mainData: MainDataNode;
  translations: Record<string, string>;
  introduction?: StepGroup; // Optional introduction step at root level (aggregate)
}


