import { TaskType } from '../../../types/taskTypes'; // ✅ Import TaskType enum

export type EditorKind = 'message' | 'ddt' | 'intent' | 'backend' | 'problem' | 'simple' | 'aiagent' | 'summarizer' | 'negotiation';

/**
 * TaskWizardMode: Enum che definisce lo stato del wizard nel ResponseEditor
 *
 * - 'none': Task esiste già → layout classico (STATO 1)
 * - 'adaptation': Template trovato, nessuna istanza → wizard adattamento messaggi (STATO 2)
 * - 'full': Nessun template, nessuna istanza → wizard completo (STATO 3)
 */
export type TaskWizardMode = 'none' | 'adaptation' | 'full';

// ✅ RINOMINATO: ActMeta → TaskMeta
// ✅ CAMBIATO: type: string → type: TaskType (enum)
export type TaskMeta = {
  id: string;
  type: TaskType; // ✅ TaskType enum invece di stringa semantica
  label?: string;
  instanceId?: string;
  // ✅ NEW: Wizard mode (replaces needsTaskContextualization and needsTaskBuilder)
  taskWizardMode?: TaskWizardMode;
  // ✅ DEPRECATED: Mantenuti per backward compatibility durante migrazione
  needsTaskContextualization?: boolean;
  needsTaskBuilder?: boolean;
  contextualizationTemplateId?: string;
  taskLabel?: string;
};

export type EditorProps = {
  task: TaskMeta; // ✅ RINOMINATO: act → task
  onClose?: () => void;
  onToolbarUpdate?: (toolbar: ToolbarButton[], color: string) => void;
  hideHeader?: boolean;
  registerOnClose?: (fn: () => Promise<boolean>) => void; // ✅ Per gestire chiusura con controllo contracts
  setDockTree?: (updater: (prev: any) => any) => void; // ✅ Per aprire chat panel come tab dockabile
};

import type { ToolbarButton } from '../../../dock/types';


