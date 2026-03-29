/**
 * MainContentArea
 *
 * Component that renders the main content area of the ResponseEditor:
 * - MessageReview (Personality tab)
 * - DataExtractionEditor (Recognition tab)
 * - BehaviourContainer (Behaviour tab - default)
 * - CenterPanel (Wizard - when taskWizardMode === 'full')
 *
 * Extracted from ResponseEditorNormalLayout to reduce nesting and improve maintainability.
 * ✅ REFACTORED: Usa enum MainViewMode invece di booleani multipli.
 */

import React, { useEffect } from 'react';
import BehaviourContainer from '@responseEditor/components/BehaviourContainer';
import MessageReviewView from '@responseEditor/MessageReview/MessageReviewView';
import DataExtractionEditor from '@responseEditor/DataExtractionEditor';
import { CenterPanel } from '../../../../../TaskBuilderAIWizard/components/CenterPanel';
import { MainViewMode } from '@responseEditor/types/mainViewMode';
import { getIsTesting } from '@responseEditor/testingState';
import { useResponseEditorContext } from '@responseEditor/context/ResponseEditorContext';
import { useWizardContext } from '@responseEditor/context/WizardContext';
import type { Task } from '@types/taskTypes';
import { TabContentContainer } from '@responseEditor/components/TabContentContainer';
import type { PipelineStep } from '../../../../../TaskBuilderAIWizard/store/wizardStore';
import type { WizardTaskTreeNode, WizardStep, WizardModuleTemplate } from '../../../../../TaskBuilderAIWizard/types';
import { RightPanelMode } from '@responseEditor/RightPanel';
import type { TaskTree } from '@types/taskTypes';
import { logBehaviourSteps, summarizeStepsShape } from '@responseEditor/behaviour/behaviourStepsDebug';

// ✅ Container styles estratti in costanti esterne (per pulizia)
const BASE_CONTAINER_STYLE: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  minHeight: 0,
  overflow: 'hidden', // ✅ Changed from 'auto' - children scroll internally (StepEditor has overflowY: auto)
};

const MESSAGE_REVIEW_CONTAINER_STYLE: React.CSSProperties = {
  ...BASE_CONTAINER_STYLE,
  padding: '8px',
};

const DEFAULT_CONTAINER_STYLE: React.CSSProperties = {
  ...BASE_CONTAINER_STYLE,
  padding: '8px 8px 0 8px',
};

export interface MainContentAreaProps {
  // ✅ NEW: Enum invece di booleani multipli
  mainViewMode: MainViewMode;

  // Node data
  selectedNode: any;
  selectedRoot: boolean;
  selectedSubIndex: number | null | undefined;
  /** Path to selected node; depth > 1 drives Behaviour step UI like sub selection. */
  selectedPath?: number[];

  // Translations
  localTranslations: Record<string, string>;

  // ✅ REMOVED: Task data - now from ResponseEditorContext
  // task: Task | null | undefined;
  // taskType: number;
  mainList: any[];
  selectedIntentIdForTraining: string | null;

  // Handlers
  updateSelectedNode: (updater: (node: any) => any, options?: { skipAutoSave?: boolean }) => void;
  handleProfileUpdate: (partialProfile: any) => void;

  // Contract change tracking
  contractChangeRef: React.MutableRefObject<{
    hasUnsavedChanges: boolean;
    modifiedContract: any;
    originalContract: any;
    nodeTemplateId: string | undefined;
    nodeLabel: string | undefined;
  }>;

  // Pending editor open
  pendingEditorOpen: { editorType: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings'; nodeId: string } | null;

  // ✅ NEW: TaskPanel props (solo per Behaviour)
  tasksPanelMode?: RightPanelMode;
  tasksPanelWidth?: number;
  setTasksPanelWidth?: (width: number) => void;
  taskTree?: TaskTree | null | undefined;
  projectId?: string | null;
  onUpdateDDT?: (updater: (tree: TaskTree) => TaskTree) => void;
  escalationTasks?: any[]; // ✅ Tasks da mostrare nel TaskPanel

  // ✅ NEW: View mode for Behaviour (tabs or tree)
  viewMode?: 'tabs' | 'tree';
  onViewModeChange?: (mode: 'tabs' | 'tree') => void;

  // ✅ REMOVED: wizardProps - now from WizardContext
  // wizardProps?: { ... };
}

/**
 * Component that renders the main content area based on mainViewMode.
 * ✅ REFACTORED: Usa enum invece di booleani multipli.
 */
export function MainContentArea({
  mainViewMode,
  selectedNode,
  selectedRoot,
  selectedSubIndex,
  selectedPath,
  localTranslations,
  // ✅ REMOVED: task, taskType - now from Context
  mainList,
  selectedIntentIdForTraining,
  updateSelectedNode,
  handleProfileUpdate,
  contractChangeRef,
  pendingEditorOpen,
  // ✅ NEW: TaskPanel props
  tasksPanelMode,
  tasksPanelWidth,
  setTasksPanelWidth,
  taskTree: taskTreeProp,
  projectId,
  onUpdateDDT,
  escalationTasks = [],
  // ✅ NEW: View mode for Behaviour
  viewMode,
  onViewModeChange,
  // ✅ REMOVED: wizardProps - now from Context
}: MainContentAreaProps) {
  // ✅ NEW: Get data from Context
  const { taskMeta: task, taskType, taskTree: taskTreeFromContext, taskWizardMode } = useResponseEditorContext();
  // ✅ Usa taskTree da props se disponibile, altrimenti da context
  const taskTree = taskTreeProp ?? taskTreeFromContext;

  useEffect(() => {
    if (mainViewMode !== MainViewMode.BEHAVIOUR) {
      return;
    }
    const hasNodes = !!(taskTree?.nodes && taskTree.nodes.length > 0);
    const hasStepDictionary =
      !!(
        taskTree?.steps &&
        typeof taskTree.steps === 'object' &&
        !Array.isArray(taskTree.steps) &&
        Object.keys(taskTree.steps).length > 0
      );
    const isManualLike =
      taskWizardMode == null || taskWizardMode === 'none';
    const isDDTReady = !!(
      taskTree &&
      (isManualLike ? hasNodes : hasStepDictionary || hasNodes)
    );
    logBehaviourSteps('MainContentArea:structureGate', {
      mainViewMode,
      hasSelectedNode: !!selectedNode,
      isDDTReady,
      taskTreeStepTemplateKeys:
        taskTree?.steps && typeof taskTree.steps === 'object' && !Array.isArray(taskTree.steps)
          ? Object.keys(taskTree.steps as Record<string, unknown>)
          : [],
      selectedNodeSteps: summarizeStepsShape(selectedNode?.steps),
    });
  }, [mainViewMode, selectedNode, taskTree, taskWizardMode]);

  // ✅ NEW: Get wizard context (may be null if wizard not active)
  let wizardContext: ReturnType<typeof useWizardContext> | null = null;
  try {
    wizardContext = useWizardContext();
  } catch {
    // WizardContext not available (wizard not active) - this is expected
    wizardContext = null;
  }

  // ✅ Switch su enum invece di booleani multipli
  switch (mainViewMode) {
    case MainViewMode.MESSAGE_REVIEW:
      return (
        <div style={MESSAGE_REVIEW_CONTAINER_STYLE}>
          <div style={{ flex: 1, minHeight: 0, background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px #e0d7f7', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <MessageReviewView
                node={selectedNode}
                translations={localTranslations}
                updateSelectedNode={updateSelectedNode}
              />
            </div>
          </div>
        </div>
      );

    case MainViewMode.DATA_CONTRACTS:
      return (
        <div style={DEFAULT_CONTAINER_STYLE}>
          <TabContentContainer padding={6}>
            <DataExtractionEditor
              node={selectedNode}
              taskType={taskType}
              locale={'it-IT'}
              intentSelected={mainList[0]?.kind === 'intent' ? selectedIntentIdForTraining || undefined : undefined}
              task={task}
              updateSelectedNode={updateSelectedNode}
              contractChangeRef={contractChangeRef}
              initialEditor={
                pendingEditorOpen &&
                selectedNode &&
                (selectedNode.id === pendingEditorOpen.nodeId ||
                 selectedNode.templateId === pendingEditorOpen.nodeId)
                  ? pendingEditorOpen.editorType
                  : undefined
              }
              onChange={(profile) => {
                if (getIsTesting()) {
                  return;
                }
                handleProfileUpdate({
                  ...profile,
                  ...(profile.kind && profile.kind !== 'auto' ? { _kindManual: profile.kind } : {}),
                });
              }}
            />
          </TabContentContainer>
        </div>
      );

    case MainViewMode.WIZARD:
      // ✅ NEW: CenterPanel al posto di BehaviourEditor
      // ✅ NEW: Get wizard data from Context
      if (!wizardContext) {
        return (
          <div style={DEFAULT_CONTAINER_STYLE}>
            <div style={{ padding: 16, color: '#ef4444' }}>Wizard configuration error</div>
          </div>
        );
      }

      return (
        <div style={DEFAULT_CONTAINER_STYLE}>
          <CenterPanel
              currentStep={wizardContext.currentStep as any} // DEPRECATED
              pipelineSteps={wizardContext.pipelineSteps}
              userInput={''} // ✅ Rimosso - non serve più
              dataSchema={wizardContext.dataSchema}
              showStructureConfirmation={wizardContext.showStructureConfirmation}
              onStructureConfirm={wizardContext.handleStructureConfirm}
              onProceedFromEuristica={wizardContext.onProceedFromEuristica}
              onShowModuleList={wizardContext.onShowModuleList}
              onSelectModule={wizardContext.onSelectModule}
              onPreviewModule={wizardContext.onPreviewModule}
              availableModules={wizardContext.availableModules}
              foundModuleId={wizardContext.foundModuleId}
              showCorrectionMode={wizardContext.showCorrectionMode}
              correctionInput={wizardContext.correctionInput}
              onCorrectionInputChange={wizardContext.setCorrectionInput}
              onCorrectionSubmit={wizardContext.handleCorrectionSubmit}
              currentParserSubstep={wizardContext.currentParserSubstep}
              currentMessageSubstep={wizardContext.currentMessageSubstep}
              phaseCounters={wizardContext.phaseCounters} // ✅ NEW: Phase counters (source of truth)
            />
        </div>
      );

    case MainViewMode.BEHAVIOUR:
    default:
      // ✅ Default: BehaviourEditor (StepsStrip + StepEditor)
      // Manual mode: require at least one tree node from the sidebar — not taskTree.steps alone
      // (e.g. escalation tasks attached before any field exists must not unlock Behaviour).
      const hasStructureNodes = !!(taskTree?.nodes && taskTree.nodes.length > 0);
      const hasStepDictionary =
        !!(
          taskTree?.steps &&
          typeof taskTree.steps === 'object' &&
          !Array.isArray(taskTree.steps) &&
          Object.keys(taskTree.steps).length > 0
        );
      const isManualLike =
        taskWizardMode == null || taskWizardMode === 'none';
      const isDDTReady =
        !!taskTree &&
        (isManualLike
          ? hasStructureNodes
          : hasStepDictionary || hasStructureNodes);

      const isManualEmptyStructure =
        isManualLike && (!taskTree || !hasStructureNodes);

      if (!selectedNode || !isDDTReady) {
        if (isManualEmptyStructure) {
          return (
            <div style={DEFAULT_CONTAINER_STYLE}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: '#94a3b8',
                  fontSize: '14px',
                  textAlign: 'center',
                  padding: 24,
                  maxWidth: 420,
                  margin: '0 auto',
                }}
              >
                <p style={{ marginBottom: 12 }}>Nessuna struttura ancora disponibile.</p>
                <p style={{ fontSize: 13, lineHeight: 1.5 }}>
                  In <strong>Manuale</strong>, usa <strong>Aggiungi dato radice</strong> nella barra a sinistra per creare il primo campo.
                  In alternativa, <strong>Wizard</strong> nella barra in alto genera il task con l&apos;AI.
                </p>
              </div>
            </div>
          );
        }
        return (
          <div style={DEFAULT_CONTAINER_STYLE}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#64748b',
              fontSize: '14px'
            }}>
              <span>Loading task structure...</span>
            </div>
          </div>
        );
      }

      // ✅ Usa BehaviourContainer con split container per TaskPanel
      return (
        <div style={DEFAULT_CONTAINER_STYLE}>
          <BehaviourContainer
            node={selectedNode}
            translations={localTranslations}
            updateSelectedNode={updateSelectedNode}
            selectedRoot={selectedRoot}
            selectedSubIndex={selectedSubIndex}
            selectedPath={selectedPath}
            tasksPanelMode={tasksPanelMode ?? 'none'}
            tasksPanelWidth={tasksPanelWidth ?? 360}
            setTasksPanelWidth={setTasksPanelWidth ?? (() => {})}
            taskTree={taskTree}
            task={task}
            projectId={projectId ?? null}
            selectedNode={selectedNode}
            onUpdateDDT={onUpdateDDT}
            escalationTasks={escalationTasks} // ✅ Passa escalationTasks al TaskPanel
            viewMode={viewMode}
            onViewModeChange={onViewModeChange}
          />
        </div>
      );
  }
}
