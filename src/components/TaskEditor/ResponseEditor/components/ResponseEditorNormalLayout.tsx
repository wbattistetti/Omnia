/**
 * ResponseEditorNormalLayout
 *
 * Component that renders the normal editor layout with Sidebar, Content, and RightPanels.
 * Extracted from index.tsx to improve maintainability and separation of concerns.
 */

import React from 'react';
import Sidebar from '@responseEditor/Sidebar';
import { RightPanelMode } from '@responseEditor/RightPanel';
import IntentListEditorWrapper from '@responseEditor/components/IntentListEditorWrapper';
import { MainContentArea } from '@responseEditor/components/MainContentArea';
import { PanelContainer } from '@responseEditor/components/PanelContainer';
import { MainViewMode } from '@responseEditor/types/mainViewMode';
import { useResponseEditorContext } from '@responseEditor/context/ResponseEditorContext';
import type { Task, TaskTree } from '@types/taskTypes';
import type { PipelineStep } from '../../../../../TaskBuilderAIWizard/store/wizardStore';
import type { WizardTaskTreeNode, WizardStep, WizardModuleTemplate } from '../../../../../TaskBuilderAIWizard/types';

export interface ResponseEditorNormalLayoutProps {
  // Data
  mainList: any[];
  taskTree: TaskTree | null | undefined;
  task: Task | null | undefined;
  currentProjectId: string | null;
  localTranslations: Record<string, string>;
  escalationTasks: any[];

  // Node selection
  selectedMainIndex: number;
  selectedSubIndex: number | null | undefined;
  selectedRoot: boolean;
  selectedNode: any;
  handleSelectMain: (idx: number) => void;
  handleSelectSub: (idx: number | undefined, mainIdx?: number) => void;
  handleSelectAggregator: () => void;
  sidebarRef: React.RefObject<HTMLDivElement>;

  // Sidebar handlers
  onChangeSubRequired: (mIdx: number, sIdx: number, required: boolean) => void;
  onReorderSub: (mIdx: number, fromIdx: number, toIdx: number) => void;
  onAddMain: (label: string) => void;
  onRenameMain: (mIdx: number, label: string) => void;
  onDeleteMain: (mIdx: number) => void;
  onAddSub: (mIdx: number, label: string) => void;
  onRenameSub: (mIdx: number, sIdx: number, label: string) => void;
  onDeleteSub: (mIdx: number, sIdx: number) => void;
  handleParserCreate: (nodeId: string, node: any) => void;
  handleParserModify: (nodeId: string, node: any) => void;
  handleEngineChipClick: (nodeId: string, node: any, editorType: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings') => void;
  handleGenerateAll: () => void;

  // Sidebar state
  isAggregatedAtomic: boolean;
  sidebarManualWidth: number | null;
  isDraggingSidebar: boolean;
  handleSidebarResizeStart: (e: React.MouseEvent) => void; // ✅ FASE 2.1: Now comes from sidebar composito hook

  // Content state
  // ❌ RIMOSSO: showMessageReview e showSynonyms (ora usiamo mainViewMode in MainContentArea)
  selectedIntentIdForTraining: string | null;
  setSelectedIntentIdForTraining: React.Dispatch<React.SetStateAction<string | null>>;
  pendingEditorOpen: { editorType: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings'; nodeId: string } | null;
  contractChangeRef: React.MutableRefObject<{
    hasUnsavedChanges: boolean;
    modifiedContract: any;
    originalContract: any;
    nodeTemplateId: string | undefined;
    nodeLabel: string | undefined;
  }>;
  taskType: number;
  handleProfileUpdate: (partialProfile: any) => void;
  updateSelectedNode: (updater: (node: any) => any, options?: { skipAutoSave?: boolean }) => void;

  // Panel state
  leftPanelMode: RightPanelMode;
  testPanelMode: RightPanelMode;
  tasksPanelMode: RightPanelMode;
  rightWidth: number;
  testPanelWidth: number;
  tasksPanelWidth: number;
  draggingPanel: 'left' | 'test' | 'tasks' | 'shared' | null;
  setDraggingPanel: React.Dispatch<React.SetStateAction<'left' | 'test' | 'tasks' | 'shared' | null>>;
  setRightWidth: (width: number) => void;
  setTestPanelWidth: (width: number) => void;
  setTasksPanelWidth: (width: number) => void;
  tasksStartWidthRef: React.MutableRefObject<number>;
  tasksStartXRef: React.MutableRefObject<number>;

  // Tree operations
  replaceSelectedTaskTree: (taskTree: TaskTree) => void;

  // ✅ NEW: Optional flag to render only sidebar (for STATO 2 - adaptation mode)
  sidebarOnly?: boolean;

  // ✅ NEW: Wizard mode to conditionally render overlay
  taskWizardMode?: TaskWizardMode;

  // ✅ NEW: Main view mode enum
  mainViewMode?: MainViewMode;

  // ✅ NEW: Props per Wizard (quando mainViewMode === 'wizard')
  wizardProps?: {
    showStructureConfirmation?: boolean;
    onStructureConfirm?: () => void;
    onStructureReject?: () => void;
    structureConfirmed?: boolean;
    currentStep?: WizardStep;
    pipelineSteps?: PipelineStep[];
    userInput?: string;
    dataSchema?: WizardTaskTreeNode[];
    generalizedLabel?: string | null; // ✅ NEW: Generalized label from AI
    onProceedFromEuristica?: () => void;
    onShowModuleList?: () => void;
    onSelectModule?: (moduleId: string) => void;
    onPreviewModule?: (moduleId: string | null) => void;
    availableModules?: WizardModuleTemplate[];
    foundModuleId?: string;
    showCorrectionMode?: boolean;
    correctionInput?: string;
    onCorrectionInputChange?: (value: string) => void;
  };
}

/**
 * Component that renders the normal editor layout
 */
export function ResponseEditorNormalLayout({
  mainList,
  // ✅ REMOVED: taskTree, task, currentProjectId - now from Context
  localTranslations,
  escalationTasks,
  selectedMainIndex,
  selectedSubIndex,
  selectedRoot,
  selectedNode,
  handleSelectMain,
  handleSelectSub,
  handleSelectAggregator,
  sidebarRef,
  onChangeSubRequired,
  onReorderSub,
  onAddMain,
  onRenameMain,
  onDeleteMain,
  onAddSub,
  onRenameSub,
  onDeleteSub,
  handleParserCreate,
  handleParserModify,
  handleEngineChipClick,
  handleGenerateAll,
  isAggregatedAtomic,
  sidebarManualWidth,
  isDraggingSidebar,
  handleSidebarResizeStart,
  // ❌ RIMOSSO: showMessageReview e showSynonyms (ora usiamo mainViewMode)
  // showMessageReview,
  // showSynonyms,
  selectedIntentIdForTraining,
  setSelectedIntentIdForTraining,
  pendingEditorOpen,
  contractChangeRef,
  taskType,
  handleProfileUpdate,
  updateSelectedNode,
  leftPanelMode,
  testPanelMode,
  tasksPanelMode,
  rightWidth,
  testPanelWidth,
  tasksPanelWidth,
  draggingPanel,
  setDraggingPanel,
  setRightWidth,
  setTestPanelWidth,
  setTasksPanelWidth,
  tasksStartWidthRef,
  tasksStartXRef,
  replaceSelectedTaskTree,
  sidebarOnly = false,
  taskWizardMode,
  mainViewMode = MainViewMode.BEHAVIOUR,
  wizardProps,
}: ResponseEditorNormalLayoutProps) {
  // ✅ NEW: Get data from Context
  const { taskTree, taskMeta: task, currentProjectId } = useResponseEditorContext();
  // ❌ RIMOSSO: Early return quando taskWizardMode === 'full'
  // Ora il wizard viene gestito tramite mainViewMode nel MainContentArea

  // ✅ FIX: Use generalizedLabel for rootLabel when wizard structure is proposed
  const effectiveRootLabel = React.useMemo(() => {
    // If wizard is active and structure is proposed, use generalizedLabel
    if (taskWizardMode === 'full' && wizardProps) {
      const generalizedLabel = wizardProps.generalizedLabel;
      if (generalizedLabel) {
        return generalizedLabel;
      }
      // Fallback to dataSchema[0].label (should already be generalized)
      const dataSchemaLabel = wizardProps.dataSchema?.[0]?.label;
      if (dataSchemaLabel) {
        return dataSchemaLabel;
      }
    }
    return taskTree?.label ?? 'Data';
  }, [taskWizardMode, wizardProps?.generalizedLabel, wizardProps?.dataSchema, taskTree?.label]);

  // ✅ Determina la struttura del grid in base alle condizioni
  const hasIntentEditor = mainList[0]?.kind === 'intent' && task;
  const hasSidebar = mainList[0]?.kind !== 'intent';

  // ✅ Se sidebarOnly è true, renderizza solo la sidebar (per STATO 2 - adaptation mode)
  if (sidebarOnly && hasSidebar) {
    return (
      <Sidebar
        ref={sidebarRef}
        mainList={mainList}
        selectedMainIndex={selectedMainIndex}
        onSelectMain={handleSelectMain}
        selectedSubIndex={selectedSubIndex}
        onSelectSub={handleSelectSub}
        aggregated={isAggregatedAtomic}
        rootLabel={effectiveRootLabel}
        style={sidebarManualWidth ? { width: sidebarManualWidth, flexShrink: 0 } : { flexShrink: 0 }}
        onChangeSubRequired={onChangeSubRequired}
        onReorderSub={onReorderSub}
        onAddMain={onAddMain}
        onRenameMain={onRenameMain}
        onDeleteMain={onDeleteMain}
        onAddSub={onAddSub}
        onRenameSub={onRenameSub}
        onDeleteSub={onDeleteSub}
        onSelectAggregator={handleSelectAggregator}
        onParserCreate={handleParserCreate}
        onParserModify={handleParserModify}
        onEngineChipClick={handleEngineChipClick}
        onGenerateAll={handleGenerateAll}
        taskWizardMode={taskWizardMode}
        // ✅ NEW: Props per pulsanti Sì/No quando wizardMode === DATA_STRUCTURE_PROPOSED
        showStructureConfirmation={wizardProps?.showStructureConfirmation}
        onStructureConfirm={wizardProps?.onStructureConfirm}
        onStructureReject={wizardProps?.onStructureReject}
        structureConfirmed={wizardProps?.structureConfirmed}
      />
    );
  }

  // ✅ Calcola gridTemplateColumns in base alle condizioni
  const gridTemplateColumns = hasSidebar
    ? 'auto 8px 1fr'  // Sidebar + Resizer + Content
    : hasIntentEditor
      ? 'auto 1fr'     // IntentEditor + Content
      : '1fr';         // Solo Content

  // ✅ Container principale con CSS Grid
  const gridContainerStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns,
    gridTemplateRows: '1fr',
    height: '100%',
    minHeight: 0,
    overflow: 'hidden',
    flex: 1,
  };

  // ✅ Stile per l'area del contenuto centrale (MainContentArea + PanelContainer)
  const contentAreaStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    minHeight: 0,
    height: '100%',
    overflow: 'hidden',
    gridColumn: hasSidebar ? '3' : hasIntentEditor ? '2' : '1',
  };

  return (
    <div style={gridContainerStyle}>
      {/* Left navigation - IntentListEditor quando kind === "intent" */}
      {hasIntentEditor && (
        <IntentListEditorWrapper
          act={task as any}
          onIntentSelect={(intentId) => {
            setSelectedIntentIdForTraining(intentId);
          }}
        />
      )}

      {/* Sidebar quando kind !== "intent" */}
      {hasSidebar && (
        <>
          <Sidebar
            ref={sidebarRef}
            mainList={mainList}
            selectedMainIndex={selectedMainIndex}
            onSelectMain={handleSelectMain}
            selectedSubIndex={selectedSubIndex}
            onSelectSub={handleSelectSub}
            aggregated={isAggregatedAtomic}
            rootLabel={effectiveRootLabel}
            style={sidebarManualWidth ? { width: sidebarManualWidth, flexShrink: 0 } : { flexShrink: 0 }}
            onChangeSubRequired={onChangeSubRequired}
            onReorderSub={onReorderSub}
            onAddMain={onAddMain}
            onRenameMain={onRenameMain}
            onDeleteMain={onDeleteMain}
            onAddSub={onAddSub}
            onRenameSub={onRenameSub}
            onDeleteSub={onDeleteSub}
            onSelectAggregator={handleSelectAggregator}
            onParserCreate={handleParserCreate}
            onParserModify={handleParserModify}
            onEngineChipClick={handleEngineChipClick}
            onGenerateAll={handleGenerateAll}
            taskWizardMode={taskWizardMode}
            // ✅ NEW: Props per pulsanti Sì/No (Wizard)
            showStructureConfirmation={wizardProps?.showStructureConfirmation}
            onStructureConfirm={wizardProps?.onStructureConfirm}
            onStructureReject={wizardProps?.onStructureReject}
            structureConfirmed={wizardProps?.structureConfirmed}
          />
          {/* Resizer verticale tra Sidebar e contenuto principale */}
          <div
            onMouseDown={handleSidebarResizeStart}
            style={{
              width: 8,
              cursor: 'col-resize',
              background: isDraggingSidebar ? '#fb923c' : '#fb923c22',
              transition: 'background 0.15s ease',
              flexShrink: 0,
              position: 'relative',
              zIndex: isDraggingSidebar ? 100 : 10,
              userSelect: 'none',
              WebkitUserSelect: 'none',
              touchAction: 'none',
            }}
            aria-label="Resize sidebar"
            role="separator"
          />
        </>
      )}

      {/* Content Area: MainContentArea + PanelContainer */}
      <div style={contentAreaStyle}>
        <MainContentArea
          // ✅ NEW: Usa mainViewMode invece di showMessageReview/showSynonyms
          mainViewMode={mainViewMode}
          selectedNode={selectedNode}
          selectedRoot={selectedRoot}
          selectedSubIndex={selectedSubIndex}
          localTranslations={localTranslations}
          task={task}
          taskType={taskType}
          mainList={mainList}
          selectedIntentIdForTraining={selectedIntentIdForTraining}
          updateSelectedNode={updateSelectedNode}
          handleProfileUpdate={handleProfileUpdate}
          contractChangeRef={contractChangeRef}
          pendingEditorOpen={pendingEditorOpen}
          // ✅ NEW: Passa wizardProps quando mainViewMode === 'wizard'
          wizardProps={mainViewMode === MainViewMode.WIZARD ? wizardProps : undefined}
        />
        <PanelContainer
          leftPanelMode={leftPanelMode}
          testPanelMode={testPanelMode}
          tasksPanelMode={tasksPanelMode}
          rightWidth={rightWidth}
          testPanelWidth={testPanelWidth}
          tasksPanelWidth={tasksPanelWidth}
          draggingPanel={draggingPanel}
          setDraggingPanel={setDraggingPanel}
          setRightWidth={setRightWidth}
          setTestPanelWidth={setTestPanelWidth}
          setTasksPanelWidth={setTasksPanelWidth}
          tasksStartWidthRef={tasksStartWidthRef}
          tasksStartXRef={tasksStartXRef}
          // ✅ Converti mainViewMode in showSynonyms/showMessageReview per PanelContainer
          showSynonyms={mainViewMode === MainViewMode.DATA_CONTRACTS}
          showMessageReview={mainViewMode === MainViewMode.MESSAGE_REVIEW}
          taskTree={taskTree}
          task={task}
          currentProjectId={currentProjectId}
          translations={localTranslations}
          selectedNode={selectedNode}
          escalationTasks={escalationTasks}
          replaceSelectedTaskTree={replaceSelectedTaskTree}
        />
      </div>
    </div>
  );
}
