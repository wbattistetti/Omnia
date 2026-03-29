/**
 * ResponseEditorNormalLayout
 *
 * Component that renders the normal editor layout with Sidebar, Content, and RightPanels.
 * Extracted from index.tsx to improve maintainability and separation of concerns.
 */

import React from 'react';
import { generalizeLabel } from '@TaskBuilderAIWizard/services/TemplateCreationService';
import { getMainNodes } from '@responseEditor/core/domain';
import { resolveGeneralizeLabelLanguage } from '@responseEditor/core/taskTree/manualEmptyTaskTreeSeed';
import { useTaskTreeStore } from '@responseEditor/core/state';
import Sidebar from '@responseEditor/Sidebar';
import { RightPanelMode } from '@responseEditor/RightPanel';
import IntentListEditorWrapper from '@responseEditor/components/IntentListEditorWrapper';
import { MainContentArea } from '@responseEditor/components/MainContentArea';
import { PanelContainer } from '@responseEditor/components/PanelContainer';
import { MainViewMode } from '@responseEditor/types/mainViewMode';
import { useResponseEditorContext } from '@responseEditor/context/ResponseEditorContext';
import type { Task, TaskTree } from '@types/taskTypes';
import type { SelectPathHandler } from '@responseEditor/features/node-editing/selectPathTypes';
import { SIDEBAR_CONTENT_MIN_WIDTH_PX } from '@responseEditor/Sidebar/sidebarLayoutConstants';
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
  selectedPath: number[];
  handleSelectByPath: SelectPathHandler;
  selectedRoot: boolean;
  selectedNode: any;
  handleSelectMain: (idx: number) => void;
  handleSelectSub: (idx: number | undefined, mainIdx?: number) => void;
  handleSelectAggregator: () => void;
  sidebarRef: React.RefObject<HTMLDivElement>;

  // Sidebar handlers
  onChangeSubRequired: (mIdx: number, sIdx: number, required: boolean) => void;
  onReorderSub: (mIdx: number, fromIdx: number, toIdx: number) => void;
  onReorderMain: (fromIdx: number, toIdx: number) => void;
  onAddMain: (label: string) => void;
  onRenameMain: (mIdx: number, label: string) => void;
  onDeleteMain: (mIdx: number) => void;
  onAddSub: (mIdx: number, label: string) => void;
  onRenameSub: (mIdx: number, sIdx: number, label: string) => void;
  onDeleteSub: (mIdx: number, sIdx: number) => void;
  onAddChildAtPath: (parentPath: number[] | null, label: string) => void;
  onReorderAtPath?: (parentPath: number[] | null, fromIdx: number, toIdx: number) => void;
  onRenameAtPath?: (path: number[], label: string) => void;
  onDeleteAtPath?: (path: number[]) => void;
  onChangeRequiredAtPath?: (path: number[], required: boolean) => void;
  selectedRoot?: boolean;
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
  replaceSelectedTaskTree: (tree: TaskTree) => void;

  // ✅ NEW: Optional flag to render only sidebar (for STATO 2 - adaptation mode)
  sidebarOnly?: boolean;

  // ✅ NEW: Wizard mode to conditionally render overlay
  taskWizardMode?: TaskWizardMode;

  // ✅ NEW: Main view mode enum
  mainViewMode?: MainViewMode;

  // ✅ NEW: View mode for Behaviour (tabs or tree)
  viewMode?: 'tabs' | 'tree';
  onViewModeChange?: (mode: 'tabs' | 'tree') => void;

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
  selectedPath,
  handleSelectByPath,
  selectedRoot,
  selectedNode,
  handleSelectMain,
  handleSelectSub,
  handleSelectAggregator,
  sidebarRef,
  onChangeSubRequired,
  onReorderSub,
  onReorderMain,
  onAddMain,
  onRenameMain,
  onDeleteMain,
  onAddSub,
  onRenameSub,
  onDeleteSub,
  onAddChildAtPath,
  onReorderAtPath,
  onRenameAtPath,
  onDeleteAtPath,
  onChangeRequiredAtPath,
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
  // ✅ NEW: View mode for Behaviour
  viewMode,
  onViewModeChange,
}: ResponseEditorNormalLayoutProps) {
  // ✅ NEW: Get data from Context
  const { taskTree, taskMeta: task, currentProjectId } = useResponseEditorContext();
  // ❌ RIMOSSO: Early return quando taskWizardMode === 'full'
  // Ora il wizard viene gestito tramite mainViewMode nel MainContentArea

  // Aggregate row title: persisted aggregateLabel (rename / seed) wins over wizard copy, then tree label, then default.
  const effectiveRootLabel = React.useMemo(() => {
    const agg =
      typeof taskTree?.aggregateLabel === 'string' && taskTree.aggregateLabel.trim()
        ? taskTree.aggregateLabel.trim()
        : '';
    if (agg) {
      return agg;
    }
    if (taskWizardMode === 'full' && wizardProps) {
      const generalizedLabel = wizardProps.generalizedLabel;
      if (generalizedLabel) {
        return generalizedLabel;
      }
      const dataSchemaLabel = wizardProps.dataSchema?.[0]?.label;
      if (dataSchemaLabel) {
        return dataSchemaLabel;
      }
    }
    return taskTree?.label ?? 'Data';
  }, [taskWizardMode, wizardProps?.generalizedLabel, wizardProps?.dataSchema, taskTree?.aggregateLabel, taskTree?.label]);

  /** Row/task title used to seed aggregate group label via generalizeLabel (strip discursive part). */
  const rowTitleForAggregateGeneralize = React.useMemo(() => {
    const t = task as { taskLabel?: string; label?: string } | null | undefined;
    const fromMeta =
      typeof t?.taskLabel === 'string' && t.taskLabel.trim() ? t.taskLabel.trim() : '';
    const fromTask = typeof t?.label === 'string' && t.label.trim() ? t.label.trim() : '';
    const fromTree = typeof taskTree?.label === 'string' && taskTree.label.trim() ? taskTree.label.trim() : '';
    return fromMeta || fromTask || fromTree;
  }, [task, taskTree?.label]);

  /**
   * Zustand is the source of truth for ResponseEditorContext.taskTree; TaskTreeManager only
   * mirrors persistence. Updates must touch both or the UI (and seed) never see aggregateLabel.
   */
  const applyTaskTreeToStoreAndManager = React.useCallback(
    (next: TaskTree) => {
      useTaskTreeStore.getState().setTaskTree(next);
      const normalized = useTaskTreeStore.getState().taskTree;
      if (normalized) {
        replaceSelectedTaskTree(normalized);
      }
    },
    [replaceSelectedTaskTree]
  );

  React.useEffect(() => {
    if (!isAggregatedAtomic || !rowTitleForAggregateGeneralize) return;
    if (taskWizardMode === 'full' && wizardProps?.generalizedLabel) return;
    const snap = useTaskTreeStore.getState().taskTree;
    if (!snap || snap.aggregateLabel) return;
    if (getMainNodes(snap).length < 2) return;

    let cancelled = false;
    (async () => {
      try {
        const lang = resolveGeneralizeLabelLanguage();
        const generalized = await generalizeLabel(rowTitleForAggregateGeneralize, lang);
        if (cancelled) return;
        const trimmed = generalized?.trim();
        if (!trimmed) return;
        const latest = useTaskTreeStore.getState().taskTree;
        if (!latest || latest.aggregateLabel) return;
        if (getMainNodes(latest).length < 2) return;
        applyTaskTreeToStoreAndManager({ ...latest, aggregateLabel: trimmed });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isAggregatedAtomic,
    mainList.length,
    rowTitleForAggregateGeneralize,
    taskWizardMode,
    wizardProps?.generalizedLabel,
    applyTaskTreeToStoreAndManager,
  ]);

  const handleRenameAggregateLabel = React.useCallback(
    (newLabel: string) => {
      const latest = useTaskTreeStore.getState().taskTree;
      if (!latest) return;
      const v = newLabel.trim();
      applyTaskTreeToStoreAndManager({ ...latest, aggregateLabel: v || undefined });
    },
    [applyTaskTreeToStoreAndManager]
  );

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
        selectedPath={selectedPath}
        onSelectPath={handleSelectByPath}
        aggregated={isAggregatedAtomic}
        rootLabel={effectiveRootLabel}
        onRenameAggregateLabel={isAggregatedAtomic ? handleRenameAggregateLabel : undefined}
        style={{
          minWidth: 0,
          maxWidth: '100%',
          alignSelf: 'stretch',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
        onChangeSubRequired={onChangeSubRequired}
        onReorderSub={onReorderSub}
        onReorderMain={onReorderMain}
        onAddChildAtPath={onAddChildAtPath}
        onReorderAtPath={onReorderAtPath}
        onRenameAtPath={onRenameAtPath}
        onDeleteAtPath={onDeleteAtPath}
        onChangeRequiredAtPath={onChangeRequiredAtPath}
        selectedRoot={selectedRoot}
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

  /** Default column width: same as SIDEBAR_CONTENT_MIN_WIDTH_PX (no jump vs inner sidebar measure). */
  const defaultSidebarTrackPx = SIDEBAR_CONTENT_MIN_WIDTH_PX;
  const sidebarTrackPx = sidebarManualWidth ?? defaultSidebarTrackPx;
  const resizerWidthPx = 10;

  // ✅ Calcola gridTemplateColumns in base alle condizioni
  const gridTemplateColumns = hasSidebar
    ? `${sidebarTrackPx}px ${resizerWidthPx}px minmax(0, 1fr)` // Sidebar + Resizer + Content
    : hasIntentEditor
      ? 'auto 1fr'     // IntentEditor + Content
      : '1fr';         // Solo Content

  // ✅ Container principale con CSS Grid
  const gridContainerStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns,
    gridTemplateRows: '1fr',
    flex: 1,
    minHeight: 0,
    height: '100%', // ✅ Use 100% height to fill parent flex container
    overflow: 'hidden', // ✅ Changed from 'auto' - children scroll internally
  };

  // ✅ Stile per l'area del contenuto centrale (MainContentArea + PanelContainer)
  const contentAreaStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    minHeight: 0,
    height: '100%',
    overflow: 'hidden', // ✅ Changed to hidden - children scroll internally
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
            selectedPath={selectedPath}
            onSelectPath={handleSelectByPath}
            aggregated={isAggregatedAtomic}
            rootLabel={effectiveRootLabel}
            onRenameAggregateLabel={isAggregatedAtomic ? handleRenameAggregateLabel : undefined}
            style={{
          minWidth: 0,
          maxWidth: '100%',
          alignSelf: 'stretch',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
            onChangeSubRequired={onChangeSubRequired}
            onReorderSub={onReorderSub}
            onReorderMain={onReorderMain}
            onAddChildAtPath={onAddChildAtPath}
            onReorderAtPath={onReorderAtPath}
            onRenameAtPath={onRenameAtPath}
            onDeleteAtPath={onDeleteAtPath}
            onChangeRequiredAtPath={onChangeRequiredAtPath}
            selectedRoot={selectedRoot}
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
          {/* Resizer: wide hit-target + visible groove (not a 1px hairline on the button). */}
          <div
            onMouseDown={handleSidebarResizeStart}
            style={{
              width: resizerWidthPx,
              cursor: 'col-resize',
              flexShrink: 0,
              position: 'relative',
              zIndex: isDraggingSidebar ? 100 : 10,
              userSelect: 'none',
              WebkitUserSelect: 'none',
              touchAction: 'none',
              pointerEvents: 'auto',
              boxSizing: 'border-box',
              background: isDraggingSidebar
                ? 'linear-gradient(90deg, rgba(251,146,60,0.35) 0%, rgba(251,146,60,0.55) 50%, rgba(251,146,60,0.25) 100%)'
                : 'linear-gradient(90deg, rgba(37,42,62,0.95) 0%, rgba(251,146,60,0.14) 45%, rgba(251,146,60,0.14) 55%, rgba(37,42,62,0.5) 100%)',
              boxShadow: 'inset 0 0 0 1px rgba(251,146,60,0.35)',
              transition: 'background 0.15s ease',
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
          selectedPath={selectedPath}
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
          // ✅ NEW: TaskPanel props (solo per Behaviour)
          tasksPanelMode={mainViewMode === MainViewMode.BEHAVIOUR ? tasksPanelMode : 'none'}
          tasksPanelWidth={tasksPanelWidth}
          setTasksPanelWidth={setTasksPanelWidth}
          taskTree={taskTree}
          projectId={currentProjectId}
          onUpdateDDT={replaceSelectedTaskTree}
          escalationTasks={escalationTasks} // ✅ Passa escalationTasks per TaskPanel
          // ✅ NEW: Passa wizardProps quando mainViewMode === 'wizard'
          wizardProps={mainViewMode === MainViewMode.WIZARD ? wizardProps : undefined}
          // ✅ NEW: Passa viewMode per Behaviour
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
        />
        <PanelContainer
          leftPanelMode={leftPanelMode}
          testPanelMode={testPanelMode}
          // ✅ TaskPanel è SEMPRE gestito in BehaviourContainer, mai in PanelContainer
          tasksPanelMode="none"
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
