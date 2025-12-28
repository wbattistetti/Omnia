// Executive summary: TypeScript interfaces and types for the Response Editor components.
export interface TreeNodeParameter {
  key: string;
  value: string;
}

export interface TreeNodeProps {
  id: string;
  text: string;
  type: string;
  level?: number;
  parentId?: string;
  icon?: string;
  color?: string;
  label?: string;
  primaryValue?: string;
  parameters?: TreeNodeParameter[];
  included?: boolean; // Per recovery/escalation: se incluso nel dialogo
  onDrop?: (id: string, position: 'before' | 'after' | 'child' | 'parent-sibling', draggedData: TreeNodeProps) => void;
  onCancelNewNode?: (id: string) => void;
  onToggleInclude?: (id: string, included: boolean) => void;
  stepType?: string;
}

export const ICON_KEYS = [
  'MessageCircle', 'HelpCircle', 'Headphones', 'Shield', 'PhoneOff', 'Database', 'Mail', 'MessageSquare',
  'Function', 'Music', 'Eraser', 'ArrowRight', 'Tag', 'Clock', 'ServerCog', 'User', 'MapPin', 'Calendar',
  'Type', 'Phone', 'Hash', 'Globe', 'Home', 'Building', 'FileText'
] as const;

export type IconKey = typeof ICON_KEYS[number] | string;

// Import unified Task type
import type { Task } from '../../../types/taskTypes';

// Legacy type alias for backward compatibility
// @deprecated Use Task from taskTypes.ts instead
export type TaskReference = Task;

export interface Constraint {
  id: string;
  title: string;
  explanation: string;
  [key: string]: any;
}

export interface Parameter {
  id: string;
  name: string;
  value?: any;
  [key: string]: any;
}

/**
 * Escalation: Contains tasks to execute in sequence
 *
 * Model:
 * - Each escalation has its own dedicated Tasks (not shared references)
 * - Tasks are complete Task objects (not lightweight references)
 * - Steps are always copied (disconnected from template)
 * - Contracts are inherited from template (unless overridden)
 */
export interface Escalation {
  tasks: Task[];  // Complete Task objects (each escalation has its own tasks)
}

export interface TranslationsContextType {
  translationsByDDT: { [ddtKey: string]: any };
  setTranslationsForDDT: (ddtKey: string, translations: any) => void;
  getTranslationsForDDT: (ddtKey: string) => any;
}