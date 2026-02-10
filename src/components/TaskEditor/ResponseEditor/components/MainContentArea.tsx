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
import type { Task } from '@types/taskTypes';
import { TabContentContainer } from '@responseEditor/components/TabContentContainer';
import type { PipelineStep } from '../../../../../TaskBuilderAIWizard/hooks/useWizardState';
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

  // Task data
  task: Task | null | undefined;
  taskType: number;
  mainList: any[];
  selectedIntentIdForTraining: string | null;

  // Handlers
  updateSelectedNode: (updater: (node: any) => any, notifyProvider?: boolean) => void;
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

  // ✅ NEW: Props per CenterPanel (quando mainViewMode === 'wizard')
      wizardProps?: {
        wizardMode?: any; // WizardMode enum
        currentStep: WizardStep; // DEPRECATED
        pipelineSteps: PipelineStep[];
        dataSchema: WizardTaskTreeNode[];
        showStructureConfirmation?: boolean;
        onStructureConfirm?: () => void;
        onProceedFromEuristica?: () => void;
        onShowModuleList?: () => void;
        onSelectModule?: (moduleId: string) => void;
        onPreviewModule?: (moduleId: string | null) => void;
        availableModules?: WizardModuleTemplate[];
        foundModuleId?: string;
        showCorrectionMode?: boolean;
        correctionInput?: string;
        onCorrectionInputChange?: (value: string) => void;
        // ✅ NEW: Sotto-stati per parte variabile dinamica
        currentParserSubstep?: string | null;
        currentMessageSubstep?: string | null;
      };
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
  task,
  taskType,
  mainList,
  selectedIntentIdForTraining,
  updateSelectedNode,
  handleProfileUpdate,
  contractChangeRef,
  pendingEditorOpen,
  wizardProps,
}: MainContentAreaProps) {
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
      if (!wizardProps) {
        return (
          <div style={DEFAULT_CONTAINER_STYLE}>
            <div style={{ padding: 16, color: '#ef4444' }}>Wizard configuration error</div>
          </div>
        );
      }

      return (
        <div style={DEFAULT_CONTAINER_STYLE}>
          <CenterPanel
              currentStep={wizardProps.currentStep}
              pipelineSteps={wizardProps.pipelineSteps}
              userInput={''} // ✅ Rimosso - non serve più
              dataSchema={wizardProps.dataSchema}
              showStructureConfirmation={wizardProps.showStructureConfirmation}
              onStructureConfirm={wizardProps.onStructureConfirm}
              onProceedFromEuristica={wizardProps.onProceedFromEuristica}
              onShowModuleList={wizardProps.onShowModuleList}
              onSelectModule={wizardProps.onSelectModule}
              onPreviewModule={wizardProps.onPreviewModule}
              availableModules={wizardProps.availableModules}
              foundModuleId={wizardProps.foundModuleId}
              showCorrectionMode={wizardProps.showCorrectionMode}
              correctionInput={wizardProps.correctionInput}
              onCorrectionInputChange={wizardProps.onCorrectionInputChange}
              currentParserSubstep={wizardProps.currentParserSubstep}
              currentMessageSubstep={wizardProps.currentMessageSubstep}
            />
        </div>
      );

    case MainViewMode.BEHAVIOUR:
    default:
      // ✅ Default: BehaviourEditor (StepsStrip + StepEditor)
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
