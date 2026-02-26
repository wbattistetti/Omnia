/**
 * MainContentArea
 *
 * Component that renders the main content area of the ResponseEditor:
 * - MessageReview (Personality tab)
 * - DataExtractionEditor (Recognition tab)
 * - BehaviourEditor (Behaviour tab - default)
 * - CenterPanel (Wizard - when taskWizardMode === 'full')
 *
 * Extracted from ResponseEditorNormalLayout to reduce nesting and improve maintainability.
 * ✅ REFACTORED: Usa enum MainViewMode invece di booleani multipli.
 */

import React from 'react';
import BehaviourEditor from '@responseEditor/BehaviourEditor';
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

// ✅ Container styles estratti in costanti esterne (per pulizia)
const BASE_CONTAINER_STYLE: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  height: '100%',
  overflow: 'hidden',
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
  localTranslations,
  // ✅ REMOVED: task, taskType - now from Context
  mainList,
  selectedIntentIdForTraining,
  updateSelectedNode,
  handleProfileUpdate,
  contractChangeRef,
  pendingEditorOpen,
  // ✅ REMOVED: wizardProps - now from Context
}: MainContentAreaProps) {
  // ✅ NEW: Get data from Context
  const { taskMeta: task, taskType, taskTree } = useResponseEditorContext();

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
              currentParserSubstep={wizardContext.currentParserSubstep}
              currentMessageSubstep={wizardContext.currentMessageSubstep}
              phaseCounters={wizardContext.phaseCounters} // ✅ NEW: Phase counters (source of truth)
            />
        </div>
      );

    case MainViewMode.BEHAVIOUR:
    default:
      // ✅ Default: BehaviourEditor (StepsStrip + StepEditor)
      // ✅ FIX: Don't render if DDT is not ready (during wizard or loading)
      // Check if taskTree exists and has structure
      const isDDTReady = taskTree && (
        (taskTree.steps && Object.keys(taskTree.steps).length > 0) ||
        (taskTree.nodes && taskTree.nodes.length > 0)
      );

      if (!selectedNode || !isDDTReady) {
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

      return (
        <div style={DEFAULT_CONTAINER_STYLE}>
          <BehaviourEditor
            node={selectedNode}
            translations={localTranslations}
            updateSelectedNode={updateSelectedNode}
            selectedRoot={selectedRoot}
            selectedSubIndex={selectedSubIndex}
          />
        </div>
      );
  }
}
