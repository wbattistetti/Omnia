import { TaskType } from '../../../types/taskTypes'; // ✅ Import TaskType enum

export type EditorKind = 'message' | 'ddt' | 'intent' | 'backend';

// ✅ RINOMINATO: ActMeta → TaskMeta
// ✅ CAMBIATO: type: string → type: TaskType (enum)
export type TaskMeta = {
  id: string;
  type: TaskType; // ✅ TaskType enum invece di stringa semantica
  label?: string;
  instanceId?: string;
};

export type EditorProps = {
  task: TaskMeta; // ✅ RINOMINATO: act → task
  onClose?: () => void;
  onToolbarUpdate?: (toolbar: ToolbarButton[], color: string) => void;
  hideHeader?: boolean;
};

import type { ToolbarButton } from '../../../dock/types';


