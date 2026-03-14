/**
 * ResponseEditorContent
 *
 * Component that handles conditional rendering of different content states:
 * - ContractWizard (for NLP contracts)
 * - Intent messages builder
 * - Normal editor layout
 *
 * Extracted from index.tsx to improve maintainability and separation of concerns.
 *
 * NOTE: TaskWizard is now external (TaskTreeWizardModal) and no longer rendered here.
 */

import React from 'react';
import ContractWizard from '@responseEditor/ContractWizard/ContractWizard';
import IntentMessagesBuilder from '@responseEditor/components/IntentMessagesBuilder';
import { TaskContextualizationPanel } from './TaskContextualizationPanel';
// ❌ RIMOSSO: TaskBuilderWizardPanel non più usato (wizard integrato in MainContentArea)
// import { TaskBuilderWizardPanel } from './TaskBuilderWizardPanel';
import { useTaskTreeFromStore } from '@responseEditor/core/state';
import { useResponseEditorContext } from '@responseEditor/context/ResponseEditorContext';
import type { Task, TaskTree } from '@types/taskTypes';
import type { TaskWizardMode } from '@taskEditor/EditorHost/types';

export interface ResponseEditorContentProps {
  // State flags
  showContractWizard: boolean;
  needsIntentMessages: boolean;

  // ✅ REMOVED: Data props - now from ResponseEditorContext
  // task: Task | null | undefined;
  // taskTree: TaskTree | null | undefined;

  // ContractWizard handlers
  handleContractWizardClose: () => void;
  handleContractWizardNodeUpdate: (nodeId: string) => void;
  handleContractWizardComplete: (results: any) => void;

  // Intent messages handler
  onIntentMessagesComplete: (messages: any) => void;

  // ✅ NEW: Wizard mode (primary)
  taskWizardMode?: TaskWizardMode;
  // ✅ DEPRECATED: Backward compatibility wizard props
  needsTaskContextualization?: boolean;
  needsTaskBuilder?: boolean;
  taskLabel?: string;
  templateId?: string;
  onTaskContextualizationComplete?: (taskTree: TaskTree) => void;
  onTaskBuilderComplete?: (taskTree: TaskTree, messages?: any) => void;
  onTaskBuilderCancel?: () => void;

  // ✅ NEW: Sidebar component (for STATO 2 - adaptation mode)
  sidebar?: React.ReactNode;

  // Normal editor layout (rendered ONLY when taskWizardMode === 'none' - STATO 1)
  normalEditorLayout?: React.ReactNode;
}

/**
 * Component that conditionally renders different content states
 */
export function ResponseEditorContent({
  showContractWizard,
  needsIntentMessages,
  // ✅ REMOVED: task, taskTree - now from Context
  handleContractWizardClose,
  handleContractWizardNodeUpdate,
  handleContractWizardComplete,
  onIntentMessagesComplete,
  normalEditorLayout,
  // ✅ NEW: Wizard mode (primary)
  taskWizardMode,
  // ✅ DEPRECATED: Backward compatibility wizard props
  needsTaskContextualization,
  needsTaskBuilder,
  // ✅ REMOVED: taskLabel - now from Context
  templateId,
  onTaskContextualizationComplete,
  onTaskBuilderComplete,
  onTaskBuilderCancel,
  sidebar,
}: ResponseEditorContentProps) {
  // ✅ ARCHITECTURE: Get data from Context - SINGLE SOURCE OF TRUTH
  // No derives, no fallbacks - Context is the only source
  const { taskTree, taskMeta, taskLabel, taskWizardMode: taskWizardModeFromContext, contextualizationTemplateId: contextualizationTemplateIdFromContext } = useResponseEditorContext();

  // ✅ FASE 2.3: Use store as SINGLE source of truth
  const taskTreeFromStore = useTaskTreeFromStore();

  // ✅ ARCHITECTURE: Extract only primitive values from taskTreeFromStore to prevent reference changes
  const taskTreeId = React.useMemo(() => taskTreeFromStore?.id, [taskTreeFromStore?.id]);
  const taskTreeNodesCount = React.useMemo(() => taskTreeFromStore?.nodes?.length, [taskTreeFromStore?.nodes?.length]);

  // ✅ ARCHITECTURE: Use Context directly - NO DERIVES, NO FALLBACKS
  // Context is SINGLE SOURCE OF TRUTH for taskWizardMode
  const effectiveWizardMode = taskWizardModeFromContext; // ✅ Direct from Context, no derives
  const effectiveTemplateId = contextualizationTemplateIdFromContext; // ✅ Direct from Context, no fallbacks

  // ✅ REMOVED: Log rumorosi di debug - verranno ripristinati se necessario durante refactoring

  // ❌ RIMOSSO: Early return per full wizard mode
  // Ora il wizard viene gestito tramite mainViewMode nel MainContentArea
  // Il normalEditorLayout viene sempre passato, anche quando taskWizardMode === 'full'

  // ✅ PRIORITY 2: Wizard modes (checked AFTER full mode)
  // ✅ STATO 2: taskWizardMode = 'adaptation' (template found, no instance)
  // Sidebar visible + wizard adattamento (genera solo messaggi)
  // ✅ FIX: Rimuovere dipendenza da taskTreeFromStore - può essere null inizialmente e verrà caricato asincronamente

  // ✅ DEBUG: Log solo quando cambiano i valori critici (evita loop infinito)
  React.useEffect(() => {
    if (effectiveWizardMode === 'adaptation') {
      console.log('[ResponseEditorContent] 📊 DEBUG: Verifica wizard mode', {
        effectiveWizardMode,
        templateId: effectiveTemplateId,
        hasTaskTreeFromStore: !!taskTreeFromStore,
        taskTreeFromStoreKeys: taskTreeFromStore ? Object.keys(taskTreeFromStore) : [],
        willShowAdaptationWizard: effectiveWizardMode === 'adaptation' && !!effectiveTemplateId
      });
    }
  }, [effectiveWizardMode, effectiveTemplateId, taskTreeFromStore]);

  // ✅ REMOVED: TaskContextualizationPanel - now wizard handles adaptation mode
  // The wizard will be shown via MainViewMode.WIZARD in MainContentArea
  // This allows showing template structure and asking for confirmation before adaptation

  // ✅ STATO 1: taskWizardMode = 'none' (task exists)
  // Layout classico: sidebar + editor + preview (handled by normalEditorLayout)

  // ✅ EXISTING: Contract Wizard (unchanged)
  // ✅ IMPORTANTE: Solo se NON siamo in wizard mode
  if (showContractWizard && effectiveWizardMode === 'none') {
    const currentTaskTree = taskTreeFromStore;
    return (
      <ContractWizard
        taskTree={currentTaskTree}
        integrated={true}
        onClose={handleContractWizardClose}
        onNodeUpdate={handleContractWizardNodeUpdate}
        onComplete={handleContractWizardComplete}
      />
    );
  }

  // Intent Messages Builder
  // ✅ IMPORTANTE: Solo se NON siamo in wizard mode
  if (needsIntentMessages && effectiveWizardMode === 'none') {
    return (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', padding: '16px 20px' }}>
        <IntentMessagesBuilder
          intentLabel={taskMeta?.label || taskTree?.label || taskLabel || 'chiedi il problema'}
          onComplete={onIntentMessagesComplete}
        />
      </div>
    );
  }

  // ✅ STATO 1: Normal editor layout (sempre, anche quando taskWizardMode === 'full')
  // Il wizard viene gestito tramite mainViewMode nel MainContentArea
  if (normalEditorLayout) {
    return <>{normalEditorLayout}</>;
  }

  // ✅ Fallback: Se normalEditorLayout non è passato, c'è un problema
  return (
    <div style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
      <div>No layout available</div>
    </div>
  );

  // ✅ Fallback: Se per qualche motivo effectiveWizardMode non è 'none' ma non è neanche 'full' o 'adaptation'
  return (
    <div style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
      <div>Unexpected wizard mode: {effectiveWizardMode}</div>
    </div>
  );
}
