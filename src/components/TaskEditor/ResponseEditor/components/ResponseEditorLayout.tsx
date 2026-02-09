// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * ResponseEditorLayout
 *
 * Component that renders the main layout structure of ResponseEditor.
 * Extracted from index.tsx to reduce complexity.
 *
 * ✅ FASE 3.1: Extracted from index.tsx
 */

import React from 'react';
import EditorHeader from '@components/common/EditorHeader';
import TaskDragLayer from '@responseEditor/TaskDragLayer';
import { ResponseEditorContent } from '@responseEditor/components/ResponseEditorContent';
import { ResponseEditorNormalLayout } from '@responseEditor/components/ResponseEditorNormalLayout';
import { ServiceUnavailableModal } from '@responseEditor/components/ServiceUnavailableModal';
import { GeneralizabilityBanner } from '@responseEditor/components/GeneralizabilityBanner';
import { ContractUpdateDialog } from '@responseEditor/ContractUpdateDialog';
import { SaveLocationDialog } from '@responseEditor/components/SaveLocationDialog';
import { MainViewMode } from '@responseEditor/types/mainViewMode';
import { Star } from 'lucide-react';
import { useWizardIntegration } from '@responseEditor/hooks/useWizardIntegration';
import { convertWizardTaskTreeToMainList } from '@responseEditor/utils/convertWizardTaskTreeToMainList';
import { WizardMode } from '../../../../../TaskBuilderAIWizard/types/WizardMode';
import type { TaskTree, TaskMeta } from '@types/taskTypes';
import type { TaskWizardMode } from '@taskEditor/EditorHost/types';
import type { useResponseEditorCore } from '@responseEditor/hooks/useResponseEditorCore';
import type { useResponseEditorHandlers } from '@responseEditor/hooks/useResponseEditorHandlers';
import { DialogueTaskService } from '@services/DialogueTaskService';

// ✅ ARCHITECTURE: Props interface with only necessary values (no monolithic editor object)
export interface ResponseEditorLayoutProps {
  // Layout props
  combinedClass: string;
  hideHeader?: boolean;
  taskTree: TaskTree | null | undefined;
  currentProjectId: string | null;

  // Header props
  rootRef: React.RefObject<HTMLDivElement>;
  icon: React.ComponentType<any>;
  iconColor: string;
  headerTitle: string;
  toolbarButtons: any[];
  handleEditorClose: () => Promise<boolean>;

  // Generalizability
  isGeneralizable: boolean;
  generalizationReason: string | null;

  // Contract wizard
  showContractWizard: boolean;
  handleContractWizardClose: () => void;
  handleContractWizardNodeUpdate: (nodeId: string) => void;
  handleContractWizardComplete: (results: any) => void;

  // Intent messages
  needsIntentMessages: boolean;
  handleIntentMessagesComplete: (messages: any) => void;

  // Task data
  taskMeta: TaskMeta | null;
  mainList: any[];
  localTranslations: Record<string, string>;
  escalationTasks: any[];

  // Node selection
  selectedMainIndex: number;
  selectedSubIndex: number | null | undefined;
  selectedRoot: boolean;
  selectedNode: any;
  selectedNodePath: { mainIndex: number; subIndex?: number } | null;
  handleSelectMain: (idx: number) => void;
  handleSelectSub: (idx: number | undefined, mainIdx?: number) => void;
  handleSelectAggregator: () => void;
  sidebarRef: React.RefObject<HTMLDivElement>;

  // Sidebar
  sidebar: React.ReactNode;

  // Parser handlers
  handleParserCreate: (nodeId: string, node: any) => void;
  handleParserModify: (nodeId: string, node: any) => void;
  handleEngineChipClick: (nodeId: string, node: any, editorType: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings') => void;
  handleGenerateAll: () => void;

  // Sidebar state
  isAggregatedAtomic: boolean;
  sidebarManualWidth: number;
  isDraggingSidebar: boolean;

  // UI state
  showMessageReview: boolean;
  showSynonyms: boolean;
  selectedIntentIdForTraining: string | null;
  setSelectedIntentIdForTraining: (id: string | null) => void;
  pendingEditorOpen: boolean;

  // Refs
  contractChangeRef: React.MutableRefObject<any>;
  tasksStartWidthRef: React.MutableRefObject<number>;
  tasksStartXRef: React.MutableRefObject<number>;

  // Task type
  taskType: string;

  // Profile update
  handleProfileUpdate: ReturnType<typeof useResponseEditorCore>['handleProfileUpdate'];
  updateSelectedNode: ReturnType<typeof useResponseEditorCore>['updateSelectedNode'];

  // Panel modes
  leftPanelMode: any;
  testPanelMode: any;
  tasksPanelMode: any;

  // Panel widths
  rightWidth: number;
  testPanelWidth: number;
  tasksPanelWidth: number;
  draggingPanel: any;
  setDraggingPanel: (panel: any) => void;
  setRightWidth: (width: number) => void;
  setTestPanelWidth: (width: number) => void;
  setTasksPanelWidth: (width: number) => void;

  // Replace task tree
  replaceSelectedTaskTree: (taskTree: TaskTree) => void;

  // Service unavailable
  serviceUnavailable: { service: string; message: string; endpoint?: string; onRetry?: () => void } | null;
  setServiceUnavailable: (value: any) => void;

  // Contract dialog
  showContractDialog: boolean;
  pendingContractChange: { templateId: string; templateLabel: string; modifiedContract: any } | null;
  contractDialogHandlers: ReturnType<typeof useResponseEditorHandlers>['contractDialogHandlers'];

  // Wizard state
  taskWizardMode: TaskWizardMode;
  needsTaskContextualization: boolean;
  needsTaskBuilder: boolean;
  contextualizationTemplateId: string | null;
  taskLabel: string;

  // Wizard callbacks (stable)
  onTaskContextualizationComplete?: (taskTree: TaskTree) => void;
  onTaskBuilderComplete?: (taskTree: TaskTree, messages?: any) => void;
  onTaskBuilderCancel?: () => void;
}

/**
 * Main layout component for ResponseEditor.
 */
export function ResponseEditorLayout(props: ResponseEditorLayoutProps) {
  // ✅ ARCHITECTURE: Destructure only necessary props (no monolithic editor object)
  const {
    combinedClass,
    hideHeader,
    taskTree,
    currentProjectId,
    rootRef,
    icon: Icon,
    iconColor,
    headerTitle,
    toolbarButtons,
    handleEditorClose,
    isGeneralizable,
    generalizationReason,
    showContractWizard,
    handleContractWizardClose,
    handleContractWizardNodeUpdate,
    handleContractWizardComplete,
    needsIntentMessages,
    handleIntentMessagesComplete,
    taskMeta,
    mainList,
    localTranslations,
    escalationTasks,
    selectedMainIndex,
    selectedSubIndex,
    selectedRoot,
    selectedNode,
    selectedNodePath,
    handleSelectMain,
    handleSelectSub,
    handleSelectAggregator,
    sidebarRef,
    sidebar,
    handleParserCreate,
    handleParserModify,
    handleEngineChipClick,
    handleGenerateAll,
    isAggregatedAtomic,
    sidebarManualWidth,
    isDraggingSidebar,
    showMessageReview,
    showSynonyms,
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
    serviceUnavailable,
    setServiceUnavailable,
    showContractDialog,
    pendingContractChange,
    contractDialogHandlers,
    taskWizardMode,
    needsTaskContextualization,
    needsTaskBuilder,
    contextualizationTemplateId,
    taskLabel,
    onTaskContextualizationComplete,
    onTaskBuilderComplete,
    onTaskBuilderCancel,
  } = props;

  // ✅ NEW: Usa hook per integrazione wizard
  // ✅ IMPORTANTE: Hook deve essere sempre chiamato (regole React), ma usato solo quando taskWizardMode === 'full'
  // ✅ NEW: Passa taskLabel, taskId, rowId, projectId, locale per avvio automatico e sincronizzazione
  const taskLabelForWizard = taskWizardMode === 'full' ? taskLabel : undefined;
  const taskIdForWizard = taskWizardMode === 'full' && taskMeta ? taskMeta.id : undefined;
  const rowIdForWizard = taskWizardMode === 'full' && taskMeta ? taskMeta.id : undefined; // ✅ rowId = taskId (regola architetturale)
  const projectIdForWizard = taskWizardMode === 'full' ? currentProjectId || undefined : undefined;
  const localeForWizard = 'it'; // TODO: Get from project settings or context

  console.log('[ResponseEditorLayout] 🔍 useWizardIntegration chiamato', {
    taskWizardMode,
    taskLabel,
    taskLabelForWizard,
    taskId: taskIdForWizard,
    rowId: rowIdForWizard,
    projectId: projectIdForWizard,
    willCallHook: taskWizardMode === 'full',
  });
  const wizardIntegrationRaw = useWizardIntegration(
    taskLabelForWizard,
    taskIdForWizard,
    rowIdForWizard,
    projectIdForWizard,
    localeForWizard,
    onTaskBuilderComplete
  );
  const wizardIntegration = taskWizardMode === 'full' ? wizardIntegrationRaw : null;

  // ✅ NEW: State for save location dialog
  const [showSaveDialog, setShowSaveDialog] = React.useState(false);
  const [saveDecisionMade, setSaveDecisionMade] = React.useState(false);
  const [saveDecision, setSaveDecision] = React.useState<'factory' | 'project' | null>(null);

  // ✅ NEW: Get shouldBeGeneral from wizardIntegration
  const shouldBeGeneral = wizardIntegration?.shouldBeGeneral || false;

  // ✅ NEW: Auto-open dialog when wizard completes and shouldBeGeneral is true
  React.useEffect(() => {
    if (wizardIntegration?.wizardMode === WizardMode.COMPLETED && shouldBeGeneral && !saveDecisionMade) {
      console.log('[ResponseEditorLayout] ⭐ Wizard completed with shouldBeGeneral=true, opening save dialog');
      setShowSaveDialog(true);
    }
  }, [wizardIntegration?.wizardMode, shouldBeGeneral, saveDecisionMade]);

  // ✅ NEW: Handler to save to Factory
  const handleSaveToFactory = React.useCallback(async () => {
    if (!wizardIntegration?.shouldBeGeneral) return;

    try {
      // Get all templates from DialogueTaskService cache
      const templates = DialogueTaskService.getAllTemplates();
      const wizardTemplates = templates.filter(t =>
        wizardIntegration.dataSchema?.some(node =>
          (node.templateId || node.id) === (t.id || t._id)
        )
      );

      if (wizardTemplates.length === 0) {
        console.warn('[ResponseEditorLayout] ⚠️ No templates found to save to Factory');
        return;
      }

      // Save templates to Factory DB
      const response = await fetch('/api/factory/dialogue-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wizardTemplates)
      });

      if (response.ok) {
        console.log('[ResponseEditorLayout] ✅ Templates saved to Factory', {
          templatesCount: wizardTemplates.length
        });
        setSaveDecision('factory');
        setSaveDecisionMade(true);
        setShowSaveDialog(false);
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to save to Factory: ${response.status} ${errorText}`);
      }
    } catch (error) {
      console.error('[ResponseEditorLayout] ❌ Error saving to Factory:', error);
      alert(`Error saving to Factory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [wizardIntegration]);

  // ✅ NEW: Handler to save only to project
  const handleSaveToProject = React.useCallback(() => {
    setSaveDecision('project');
    setSaveDecisionMade(true);
    setShowSaveDialog(false);
    // Template stays in memory, will be saved with "Save project"
    console.log('[ResponseEditorLayout] ✅ Decision: save only to project (template stays in memory)');
  }, []);

  // ✅ NEW: Handler to cancel save dialog
  const handleCancelSaveDialog = React.useCallback(() => {
    setShowSaveDialog(false);
    // Don't set saveDecisionMade - user can open dialog again
  }, []);

  // ✅ NEW: Wrapper for handleEditorClose to add tutor on close
  const handleEditorCloseWithTutor = React.useCallback(async (): Promise<boolean> => {
    // ✅ Tutor alla chiusura - verifica se deve essere scelto dove salvare
    if (shouldBeGeneral && !saveDecisionMade) {
      console.log('[ResponseEditorLayout] ⚠️ Template generalizable but decision not made, blocking close');
      alert('Before closing, you must tell me where you want to save this task.');
      setShowSaveDialog(true);
      return false;  // ✅ Blocca chiusura
    }

    // ✅ Se tutto ok, procedi con chiusura normale
    return handleEditorClose();
  }, [shouldBeGeneral, saveDecisionMade, handleEditorClose]);

  // ✅ NEW: Calcola mainViewMode in base a taskWizardMode, wizardMode e showMessageReview/showSynonyms
  // ✅ IMPORTANTE: Questo useMemo deve venire DOPO la dichiarazione di wizardIntegration
  const mainViewMode = React.useMemo<MainViewMode>(() => {
    console.log('[ResponseEditorLayout] 🎯 Computing mainViewMode', {
      taskWizardMode,
      wizardMode: wizardIntegration?.wizardMode,
      showMessageReview,
      showSynonyms,
    });

    // ✅ NEW: Se wizard è completato, passa a BEHAVIOUR (auto-chiusura)
    if (taskWizardMode === 'full' && wizardIntegration?.wizardMode === 'completed') {
      console.log('[ResponseEditorLayout] ✅ Wizard completed, returning BEHAVIOUR');
      return MainViewMode.BEHAVIOUR;
    }

    if (taskWizardMode === 'full') {
      console.log('[ResponseEditorLayout] ✅ taskWizardMode is full, returning WIZARD');
      return MainViewMode.WIZARD;
    }
    if (showMessageReview) {
      console.log('[ResponseEditorLayout] ✅ showMessageReview is true, returning MESSAGE_REVIEW');
      return MainViewMode.MESSAGE_REVIEW;
    }
    if (showSynonyms) {
      console.log('[ResponseEditorLayout] ✅ showSynonyms is true, returning DATA_CONTRACTS');
      return MainViewMode.DATA_CONTRACTS;
    }
    console.log('[ResponseEditorLayout] ✅ Default, returning BEHAVIOUR');
    return MainViewMode.BEHAVIOUR;
  }, [taskWizardMode, wizardIntegration?.wizardMode, showMessageReview, showSynonyms]);

  console.log('[ResponseEditorLayout] 🔍 wizardIntegration stato', {
    taskWizardMode,
    hasWizardIntegration: !!wizardIntegration,
    wizardMode: wizardIntegration?.wizardMode,
    dataSchemaLength: wizardIntegration?.dataSchema?.length,
    showStructureConfirmation: wizardIntegration?.showStructureConfirmation,
    pipelineStepsLength: wizardIntegration?.pipelineSteps?.length,
    pipelineSteps: wizardIntegration?.pipelineSteps,
  });

  // ✅ NEW: Prepara wizardProps per CenterPanel e Sidebar (con useMemo per evitare ricostruzioni)
  const wizardProps = React.useMemo(() => {
    console.log('[ResponseEditorLayout] 🧙 Building wizardProps', {
      hasWizardIntegration: !!wizardIntegration,
      wizardMode: wizardIntegration?.wizardMode,
      pipelineStepsLength: wizardIntegration?.pipelineSteps?.length,
      dataSchemaLength: wizardIntegration?.dataSchema?.length,
    });

    if (!wizardIntegration) {
      console.warn('[ResponseEditorLayout] ⚠️ wizardIntegration is null/undefined, returning undefined wizardProps');
      return undefined;
    }

    const props = {
      wizardMode: wizardIntegration.wizardMode,
      showStructureConfirmation: wizardIntegration.showStructureConfirmation,
      onStructureConfirm: wizardIntegration.handleStructureConfirm,
      onStructureReject: wizardIntegration.handleStructureReject,
      structureConfirmed: wizardIntegration.structureConfirmed,
      currentStep: wizardIntegration.currentStep, // DEPRECATED
      pipelineSteps: wizardIntegration.pipelineSteps,
      dataSchema: wizardIntegration.dataSchema,
      onProceedFromEuristica: wizardIntegration.onProceedFromEuristica,
      onShowModuleList: wizardIntegration.onShowModuleList,
      onSelectModule: wizardIntegration.onSelectModule,
      onPreviewModule: wizardIntegration.onPreviewModule,
      availableModules: wizardIntegration.availableModules,
      foundModuleId: wizardIntegration.foundModuleId,
      showCorrectionMode: wizardIntegration.showCorrectionMode,
      correctionInput: wizardIntegration.correctionInput,
      onCorrectionInputChange: wizardIntegration.setCorrectionInput,
      // ✅ NEW: Sotto-stati per parte variabile dinamica
      currentParserSubstep: wizardIntegration.currentParserSubstep,
      currentMessageSubstep: wizardIntegration.currentMessageSubstep,
    };

    console.log('[ResponseEditorLayout] ✅ wizardProps built', {
      hasProps: !!props,
      pipelineStepsLength: props.pipelineSteps?.length,
      pipelineSteps: props.pipelineSteps,
      dataSchemaLength: props.dataSchema?.length,
      wizardMode: props.wizardMode,
    });

    return props;
  }, [wizardIntegration]);

  // ✅ NEW: Converti dataSchema in mainList quando taskWizardMode === 'full'
  // La Sidebar ha bisogno di mainList, non di WizardTaskTreeNode[]
  const effectiveMainList = React.useMemo(() => {
    console.log('[ResponseEditorLayout] 🔍 effectiveMainList calculation START', {
      taskWizardMode,
      hasWizardIntegration: !!wizardIntegration,
      dataSchemaLength: wizardIntegration?.dataSchema?.length,
      dataSchemaStructure: wizardIntegration?.dataSchema?.map(n => ({
        id: n.id,
        templateId: n.templateId,
        label: n.label,
        hasSubNodes: !!n.subNodes,
        subNodesCount: n.subNodes?.length,
      })),
      mainListLength: mainList.length,
      mainListStructure: mainList.map(m => ({
        id: m.id,
        templateId: m.templateId,
        label: m.label,
        hasSubNodes: !!m.subNodes,
        subNodesCount: m.subNodes?.length,
      })),
    });

    if (taskWizardMode === 'full' && wizardIntegration?.dataSchema) {
      console.log('[ResponseEditorLayout] 🔄 Converting dataSchema to mainList', {
        dataSchemaLength: wizardIntegration.dataSchema.length,
        dataSchemaFirstNode: wizardIntegration.dataSchema[0],
      });

      const converted = convertWizardTaskTreeToMainList(wizardIntegration.dataSchema);

      console.log('[ResponseEditorLayout] ✅ Converted dataSchema to mainList', {
        dataSchemaLength: wizardIntegration.dataSchema.length,
        convertedLength: converted.length,
        convertedStructure: converted.map(m => ({
          id: m.id,
          templateId: m.templateId,
          label: m.label,
          hasSubNodes: !!m.subNodes,
          subNodesCount: m.subNodes?.length,
        })),
      });

      return converted;
    }

    console.log('[ResponseEditorLayout] ⏸️ Using original mainList', {
      mainListLength: mainList.length,
      mainListStructure: mainList.map(m => ({
        id: m.id,
        templateId: m.templateId,
        label: m.label,
      })),
    });

    return mainList;
  }, [taskWizardMode, wizardIntegration?.dataSchema, mainList]);

  // ✅ ARCHITECTURE: Memoize sidebar to prevent reference changes
  const sidebarElement = React.useMemo(() => {
    // ✅ NEW: Mostra sidebar quando wizardMode === DATA_STRUCTURE_PROPOSED o successivi
    if (taskWizardMode === 'full') {
      // ✅ Sidebar visibile solo quando la struttura è stata proposta o confermata
      const shouldShowSidebar = wizardIntegration?.wizardMode === WizardMode.DATA_STRUCTURE_PROPOSED ||
                                 wizardIntegration?.wizardMode === WizardMode.DATA_STRUCTURE_CONFIRMED ||
                                 wizardIntegration?.wizardMode === WizardMode.GENERATING ||
                                 wizardIntegration?.wizardMode === WizardMode.COMPLETED;

      if (!shouldShowSidebar) {
        return undefined;
      }
    }

    if (taskWizardMode !== 'adaptation' && taskWizardMode !== 'full') {
      return undefined;
    }

    // ✅ Quando taskWizardMode === 'full', renderizza sidebar + MainContentArea (non solo sidebar)
    return (
      <ResponseEditorNormalLayout
        mainList={effectiveMainList}
        taskTree={taskTree}
        task={taskMeta}
        currentProjectId={currentProjectId}
        localTranslations={localTranslations}
        escalationTasks={escalationTasks}
        selectedMainIndex={selectedMainIndex}
        selectedSubIndex={selectedSubIndex}
        selectedRoot={selectedRoot}
        selectedNode={selectedNode}
        selectedNodePath={selectedNodePath}
        handleSelectMain={handleSelectMain}
        handleSelectSub={handleSelectSub}
        handleSelectAggregator={handleSelectAggregator}
        sidebarRef={sidebarRef}
        onChangeSubRequired={sidebar.onChangeSubRequired}
        onReorderSub={sidebar.onReorderSub}
        onAddMain={sidebar.onAddMain}
        onRenameMain={sidebar.onRenameMain}
        onDeleteMain={sidebar.onDeleteMain}
        onAddSub={sidebar.onAddSub}
        onRenameSub={sidebar.onRenameSub}
        onDeleteSub={sidebar.onDeleteSub}
        handleParserCreate={handleParserCreate}
        handleParserModify={handleParserModify}
        handleEngineChipClick={handleEngineChipClick}
        handleGenerateAll={handleGenerateAll}
        isAggregatedAtomic={isAggregatedAtomic}
        sidebarManualWidth={sidebarManualWidth}
        isDraggingSidebar={isDraggingSidebar}
        handleSidebarResizeStart={sidebar.handleSidebarResizeStart}
        selectedIntentIdForTraining={selectedIntentIdForTraining}
        setSelectedIntentIdForTraining={setSelectedIntentIdForTraining}
        pendingEditorOpen={pendingEditorOpen}
        contractChangeRef={contractChangeRef}
        taskType={taskType}
        handleProfileUpdate={handleProfileUpdate}
        updateSelectedNode={updateSelectedNode}
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
        replaceSelectedTaskTree={replaceSelectedTaskTree}
        sidebarOnly={false} // ✅ Quando taskWizardMode === 'full', mostra anche MainContentArea
        taskWizardMode={taskWizardMode}
        mainViewMode={mainViewMode}
        wizardProps={wizardProps} // ✅ Passa wizardProps per pulsanti Sì/No nella sidebar
      />
    );
  }, [
    taskWizardMode,
    mainViewMode,
    effectiveMainList,
    taskTree,
    taskMeta,
    currentProjectId,
    localTranslations,
    escalationTasks,
    selectedMainIndex,
    selectedSubIndex,
    selectedRoot,
    selectedNode,
    selectedNodePath,
    handleSelectMain,
    handleSelectSub,
    handleSelectAggregator,
    sidebarRef,
    sidebar,
    handleParserCreate,
    handleParserModify,
    handleEngineChipClick,
    handleGenerateAll,
    isAggregatedAtomic,
    sidebarManualWidth,
    isDraggingSidebar,
    showMessageReview,
    showSynonyms,
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
    effectiveMainList,
  ]);

  // ✅ ARCHITECTURE: Memoize normalEditorLayout to prevent reference changes
  // ✅ REFACTORED: Non ritorna più null quando taskWizardMode === 'full'
  // Il wizard viene gestito tramite mainViewMode nel MainContentArea
  const normalEditorLayoutElement = React.useMemo(() => {
    // ✅ Solo per 'adaptation' mode ritorna null (gestito separatamente)
    if (taskWizardMode !== 'none' && taskWizardMode !== 'full') {
      return null;
    }

    return (
      <ResponseEditorNormalLayout
        mainList={effectiveMainList}
        taskTree={taskTree}
        task={taskMeta}
        currentProjectId={currentProjectId}
        localTranslations={localTranslations}
        escalationTasks={escalationTasks}
        selectedMainIndex={selectedMainIndex}
        selectedSubIndex={selectedSubIndex}
        selectedRoot={selectedRoot}
        selectedNode={selectedNode}
        selectedNodePath={selectedNodePath}
        handleSelectMain={handleSelectMain}
        handleSelectSub={handleSelectSub}
        handleSelectAggregator={handleSelectAggregator}
        sidebarRef={sidebarRef}
        onChangeSubRequired={sidebar.onChangeSubRequired}
        onReorderSub={sidebar.onReorderSub}
        onAddMain={sidebar.onAddMain}
        onRenameMain={sidebar.onRenameMain}
        onDeleteMain={sidebar.onDeleteMain}
        onAddSub={sidebar.onAddSub}
        onRenameSub={sidebar.onRenameSub}
        onDeleteSub={sidebar.onDeleteSub}
        handleParserCreate={handleParserCreate}
        handleParserModify={handleParserModify}
        handleEngineChipClick={handleEngineChipClick}
        handleGenerateAll={handleGenerateAll}
        isAggregatedAtomic={isAggregatedAtomic}
        sidebarManualWidth={sidebarManualWidth}
        isDraggingSidebar={isDraggingSidebar}
        handleSidebarResizeStart={sidebar.handleSidebarResizeStart}
        // ❌ RIMOSSO: showMessageReview e showSynonyms (ora usiamo mainViewMode)
        selectedIntentIdForTraining={selectedIntentIdForTraining}
        setSelectedIntentIdForTraining={setSelectedIntentIdForTraining}
        pendingEditorOpen={pendingEditorOpen}
        contractChangeRef={contractChangeRef}
        taskType={taskType}
        handleProfileUpdate={handleProfileUpdate}
        updateSelectedNode={updateSelectedNode}
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
        replaceSelectedTaskTree={replaceSelectedTaskTree}
        taskWizardMode={taskWizardMode}
        // ✅ NEW: Passa mainViewMode e wizardProps
        mainViewMode={mainViewMode}
        wizardProps={wizardProps}
      />
    );
  }, [
    taskWizardMode,
    mainViewMode,
    wizardProps,
    effectiveMainList,
    taskTree,
    taskMeta,
    currentProjectId,
    localTranslations,
    escalationTasks,
    selectedMainIndex,
    selectedSubIndex,
    selectedRoot,
    selectedNode,
    selectedNodePath,
    handleSelectMain,
    handleSelectSub,
    handleSelectAggregator,
    sidebarRef,
    sidebar,
    handleParserCreate,
    handleParserModify,
    handleEngineChipClick,
    handleGenerateAll,
    isAggregatedAtomic,
    sidebarManualWidth,
    isDraggingSidebar,
    showMessageReview,
    showSynonyms,
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
  ]);

  // ✅ NEW: Add shouldBeGeneral button to toolbar if needed
  const enhancedToolbarButtons = React.useMemo(() => {
    if (shouldBeGeneral && !saveDecisionMade && taskWizardMode === 'none') {
      return [
        ...toolbarButtons,
        {
          icon: React.createElement(Star, { size: 16 }),
          label: "Where do you want to save this task?",
          onClick: () => setShowSaveDialog(true),
          title: "Template with general value - click to decide",
          primary: true,
          active: false
        }
      ];
    }
    return toolbarButtons;
  }, [toolbarButtons, shouldBeGeneral, saveDecisionMade, taskWizardMode]);

  // ✅ LOG: Verification log for debugging (moved to useEffect to keep render pure)
  // ✅ FIX: Use only primitive dependencies to prevent loop
  const hasNormalEditorLayoutElement = normalEditorLayoutElement !== null;
  const hasSidebarElement = sidebarElement != null; // ✅ FIX: Use != to check both null and undefined
  const toolbarButtonsCount = enhancedToolbarButtons.length;
  const shouldShowHeader = !hideHeader && taskWizardMode === 'none';
  const shouldShowBanner = isGeneralizable && taskWizardMode === 'none';
  React.useEffect(() => {
    if (taskWizardMode === 'full') {
      console.log('[ResponseEditorLayout] ✅ FULL WIZARD MODE - Layout check', {
        taskWizardMode,
        hasNormalEditorLayoutElement,
        hasSidebarElement,
        toolbarButtonsCount,
        shouldShowHeader,
        shouldShowBanner,
      });
    }
  }, [taskWizardMode, hasNormalEditorLayoutElement, hasSidebarElement, toolbarButtonsCount, shouldShowHeader, shouldShowBanner]);

  return (
    <div
      ref={rootRef}
      className={combinedClass}
      style={{
        background: '#0b0f17',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flex: 1,
        minHeight: 0,
        height: '100%',
      }}
    >
      {/* ✅ Header: visibile solo quando taskWizardMode === 'none' (STATO 1) */}
      {/* ✅ CRITICAL: Quando taskWizardMode === 'full', header e toolbar devono essere completamente nascosti */}
      {!hideHeader && taskWizardMode === 'none' && (
        <EditorHeader
          icon={<Icon size={18} style={{ color: iconColor }} />}
          title={headerTitle}
          toolbarButtons={enhancedToolbarButtons}
          onClose={handleEditorCloseWithTutor}
          color="orange"
        />
      )}

      {/* Generalizability Banner: visibile solo quando taskWizardMode === 'none' (STATO 1) */}
      {/* ✅ CRITICAL: Quando taskWizardMode === 'full', banner deve essere nascosto */}
      {isGeneralizable && taskWizardMode === 'none' && (
        <GeneralizabilityBanner
          isGeneralizable={isGeneralizable}
          generalizationReason={generalizationReason}
          onSaveToFactory={() => {
            // TODO: Implement save to factory logic
            // Log removed - keep render pure
          }}
          onIgnore={() => {
            // Banner will be dismissed automatically
            // Log removed - keep render pure
          }}
        />
      )}

      <div style={{
        display: 'flex',
        flex: 1,
        minHeight: 0,
        height: '100%',
        overflow: 'hidden',
      }}>
        <ResponseEditorContent
          showContractWizard={showContractWizard}
          needsIntentMessages={needsIntentMessages}
          task={taskMeta}
          taskTree={taskTree}
          handleContractWizardClose={handleContractWizardClose}
          handleContractWizardNodeUpdate={handleContractWizardNodeUpdate}
          handleContractWizardComplete={handleContractWizardComplete}
          onIntentMessagesComplete={handleIntentMessagesComplete}
          // ✅ NEW: Wizard mode (primary)
          taskWizardMode={taskWizardMode}
          // ✅ DEPRECATED: Backward compatibility wizard props
          needsTaskContextualization={needsTaskContextualization}
          needsTaskBuilder={needsTaskBuilder}
          taskLabel={taskLabel}
          templateId={contextualizationTemplateId || undefined}
          // ✅ ARCHITECTURE: Use memoized sidebar (stable reference)
          // ✅ CRITICAL: sidebar viene passato SOLO quando taskWizardMode === 'adaptation'
          sidebar={taskWizardMode === 'adaptation' ? sidebarElement : undefined}
          // ✅ ARCHITECTURE: Use stable callbacks from hook (no inline functions)
          onTaskContextualizationComplete={onTaskContextualizationComplete}
          onTaskBuilderComplete={onTaskBuilderComplete}
          onTaskBuilderCancel={onTaskBuilderCancel}
          // ✅ ARCHITECTURE: Use memoized normalEditorLayout (stable reference)
          // ✅ REFACTORED: normalEditorLayout viene passato anche quando taskWizardMode === 'full'
          // Il wizard viene gestito tramite mainViewMode nel MainContentArea
          normalEditorLayout={normalEditorLayoutElement}
        />
      </div>

      {/* ✅ FIX: TaskDragLayer only rendered when taskWizardMode === 'none' */}
      {taskWizardMode === 'none' && <TaskDragLayer />}
      {serviceUnavailable && taskWizardMode !== 'full' && (
        <ServiceUnavailableModal
          serviceUnavailable={serviceUnavailable}
          onClose={() => setServiceUnavailable(null)}
        />
      )}

      {showContractDialog && pendingContractChange && (
        <ContractUpdateDialog
          open={showContractDialog}
          templateLabel={pendingContractChange.templateLabel}
          onKeep={contractDialogHandlers.handleKeep}
          onDiscard={contractDialogHandlers.handleDiscard}
          onCancel={contractDialogHandlers.handleCancel}
        />
      )}

      {/* ✅ NEW: Save Location Dialog for generalizable templates */}
      <SaveLocationDialog
        isOpen={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        onSaveToFactory={handleSaveToFactory}
        onSaveToProject={handleSaveToProject}
        onCancel={handleCancelSaveDialog}
      />
    </div>
  );
}
