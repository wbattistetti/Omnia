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
// ✅ REMOVED: useWizardIntegration - ora viene chiamato in ResponseEditorInner
// ✅ REMOVED: Star import - non più necessario
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

  // ✅ NEW: Toolbar update callback (for hideHeader === true mode)
  onToolbarUpdate?: (toolbar: any[], color: string) => void;

  // ✅ NEW: Wizard generalization props (calculated in ResponseEditorInner)
  shouldBeGeneral?: boolean;
  generalizedLabel?: string | null;
  generalizedMessages?: string[] | null;
  generalizationReason?: string | null;
  saveDecisionMade?: boolean;
  onOpenSaveDialog?: () => void;
  showSaveDialog?: boolean;
  setShowSaveDialog?: (show: boolean) => void;
  setSaveDecisionMade?: (made: boolean) => void;
  wizardIntegration?: any; // For wizardProps
  originalLabel?: string;
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
    onToolbarUpdate,
    // ✅ NEW: Wizard generalization props
    shouldBeGeneral: shouldBeGeneralProp,
    generalizedLabel: generalizedLabelProp,
    generalizedMessages: generalizedMessagesProp,
    generalizationReason: generalizationReasonProp,
    saveDecisionMade: saveDecisionMadeProp,
    onOpenSaveDialog: onOpenSaveDialogProp,
    showSaveDialog: showSaveDialogProp,
    setShowSaveDialog: setShowSaveDialogProp,
    setSaveDecisionMade: setSaveDecisionMadeProp,
    wizardIntegration: wizardIntegrationProp,
    originalLabel: originalLabelProp,
  } = props;

  // ✅ REMOVED: useWizardIntegration - ora viene chiamato in ResponseEditorInner
  // ✅ Usa i valori ricevuti come props invece di calcolarli
  const wizardIntegration = wizardIntegrationProp;
  const shouldBeGeneral = shouldBeGeneralProp ?? false;
  const generalizedLabel = generalizedLabelProp ?? null;
  const generalizedMessages = generalizedMessagesProp ?? null;
  const generalizationReasonEffective = generalizationReasonProp ?? generalizationReason ?? null;
  const originalLabel = originalLabelProp ?? (taskLabel || 'Task');

  // ✅ State for save location dialog (usa props se disponibili, altrimenti state locale)
  const [localShowSaveDialog, setLocalShowSaveDialog] = React.useState(false);
  const [localSaveDecisionMade, setLocalSaveDecisionMade] = React.useState(false);
  const [saveDecision, setSaveDecision] = React.useState<'factory' | 'project' | null>(null);

  const showSaveDialog = showSaveDialogProp !== undefined ? showSaveDialogProp : localShowSaveDialog;
  const setShowSaveDialog = setShowSaveDialogProp || setLocalShowSaveDialog;
  const saveDecisionMade = saveDecisionMadeProp !== undefined ? saveDecisionMadeProp : localSaveDecisionMade;
  const setSaveDecisionMade = setSaveDecisionMadeProp || setLocalSaveDecisionMade;

  // ✅ Wrapper per onOpenSaveDialog che apre il dialog
  const handleOpenSaveDialog = React.useCallback(() => {
    // Apri il dialog
    setShowSaveDialog(true);

    // Chiama anche il prop se presente
    if (onOpenSaveDialogProp) {
      onOpenSaveDialogProp();
    }
  }, [onOpenSaveDialogProp, setShowSaveDialog]);

  // ✅ DEBUG: Log per verificare stato del dialog (solo quando showSaveDialog cambia)
  React.useEffect(() => {
    if (showSaveDialog) {
      console.log('[ResponseEditorLayout] 📊 SaveLocationDialog OPENED:', {
        hasAnchorRef: !!saveToLibraryButtonRef,
        anchorRefCurrent: saveToLibraryButtonRef?.current,
        anchorRefTagName: saveToLibraryButtonRef?.current?.tagName,
        anchorRefDataId: saveToLibraryButtonRef?.current?.getAttribute('data-button-id'),
        anchorRefRect: saveToLibraryButtonRef?.current?.getBoundingClientRect()
      });
    }
  }, [showSaveDialog]); // ✅ Solo quando showSaveDialog cambia

  // ✅ REMOVED: Auto-open dialog - dialog opens only when user clicks button or tries to close

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

      // ✅ Use generalizedLabel for template name and label if available
      const templatesToSave = wizardTemplates.map(t => {
        if (generalizedLabel && wizardIntegration.dataSchema?.[0]?.id === (t.id || t._id)) {
          // Root template: use generalizedLabel
          return {
            ...t,
            name: generalizedLabel.toLowerCase().replace(/\s+/g, '_'),
            label: generalizedLabel
          };
        }
        return t;
      });

      // Save templates to Factory DB
      const response = await fetch('/api/factory/dialogue-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templatesToSave)
      });

      if (response.ok) {
        console.log('[ResponseEditorLayout] ✅ Templates saved to Factory', {
          templatesCount: templatesToSave.length,
          generalizedLabel
        });

        // ✅ Reload Factory templates cache immediately
        await DialogueTaskService.reloadFactoryTemplates();
        console.log('[ResponseEditorLayout] ✅ Factory templates cache reloaded');

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
  }, [wizardIntegration, generalizedLabel]);

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
    console.log('[ResponseEditorLayout] 🚪 handleEditorCloseWithTutor called', {
      shouldBeGeneral,
      saveDecisionMade,
      condition1: shouldBeGeneral,
      condition2: !saveDecisionMade,
      shouldBlock: shouldBeGeneral && !saveDecisionMade,
      wizardIntegrationExists: !!wizardIntegration,
      wizardIntegrationShouldBeGeneral: wizardIntegration?.shouldBeGeneral,
      wizardMode: wizardIntegration?.wizardMode,
      taskWizardMode
    });

    // ✅ Tutor alla chiusura - verifica se deve essere scelto dove salvare
    if (shouldBeGeneral && !saveDecisionMade) {
      console.log('[ResponseEditorLayout] ⚠️ Template generalizable but decision not made, blocking close');
      console.log('[ResponseEditorLayout] 🔔 Opening save dialog automatically');
      // ✅ Auto-open dialog instead of alert
      setShowSaveDialog(true);
      return false;  // ✅ Blocca chiusura - obbligatorio
    }

    console.log('[ResponseEditorLayout] ✅ Allowing close - proceeding with normal close', {
      reason: shouldBeGeneral ? 'saveDecisionMade is true' : 'shouldBeGeneral is false'
    });
    // ✅ Se tutto ok, procedi con chiusura normale
    return handleEditorClose();
  }, [shouldBeGeneral, saveDecisionMade, handleEditorClose, wizardIntegration, taskWizardMode]);

  // ✅ NEW: Calcola mainViewMode in base a taskWizardMode, wizardMode e showMessageReview/showSynonyms
  // ✅ IMPORTANTE: Questo useMemo deve venire DOPO la dichiarazione di wizardIntegration
  const mainViewMode = React.useMemo<MainViewMode>(() => {
    // ✅ NEW: Se wizard è completato, passa a BEHAVIOUR (auto-chiusura)
    if (taskWizardMode === 'full' && wizardIntegration?.wizardMode === 'completed') {
      return MainViewMode.BEHAVIOUR;
    }

    if (taskWizardMode === 'full') {
      return MainViewMode.WIZARD;
    }
    if (showMessageReview) {
      return MainViewMode.MESSAGE_REVIEW;
    }
    if (showSynonyms) {
      return MainViewMode.DATA_CONTRACTS;
    }
    return MainViewMode.BEHAVIOUR;
  }, [taskWizardMode, wizardIntegration?.wizardMode, showMessageReview, showSynonyms]);

  // ✅ NEW: Prepara wizardProps per CenterPanel e Sidebar (con useMemo per evitare ricostruzioni)
  const wizardProps = React.useMemo(() => {
    if (!wizardIntegration) {
      return undefined;
    }

    return {
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
  }, [
    // ✅ USA solo primitive values e funzioni stabili - evita dipendere dall'intero oggetto wizardIntegration
    wizardIntegration?.wizardMode,
    wizardIntegration?.showStructureConfirmation,
    wizardIntegration?.structureConfirmed,
    wizardIntegration?.currentStep,
    wizardIntegration?.pipelineSteps,
    wizardIntegration?.dataSchema,
    wizardIntegration?.availableModules,
    wizardIntegration?.foundModuleId,
    wizardIntegration?.showCorrectionMode,
    wizardIntegration?.correctionInput,
    wizardIntegration?.currentParserSubstep,
    wizardIntegration?.currentMessageSubstep,
    wizardIntegration?.handleStructureConfirm,
    wizardIntegration?.handleStructureReject,
    wizardIntegration?.onProceedFromEuristica,
    wizardIntegration?.onShowModuleList,
    wizardIntegration?.onSelectModule,
    wizardIntegration?.onPreviewModule,
    wizardIntegration?.setCorrectionInput,
  ]);

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

  // ✅ REMOVED: enhancedToolbarButtons - ora il pulsante viene aggiunto direttamente in useResponseEditorToolbar
  // ✅ Il pulsante "Vuoi salvare in libreria?" viene aggiunto automaticamente quando shouldBeGeneral === true

  // ✅ NEW: Ref per il pulsante "Vuoi salvare in libreria?" per posizionare il popover
  const saveToLibraryButtonRef = React.useRef<HTMLButtonElement>(null);

  // ✅ NEW: Trova il pulsante nella toolbarButtons array e assegna il ref direttamente
  const toolbarButtonsWithRef = React.useMemo(() => {
    return toolbarButtons.map(btn => {
      if (btn.buttonId === 'save-to-library') {
        return {
          ...btn,
          buttonRef: saveToLibraryButtonRef, // ✅ Passa il ref direttamente
        };
      }
      return btn;
    });
  }, [toolbarButtons]);

  // ✅ NEW: Sync toolbarButtons to onToolbarUpdate when hideHeader is true
  // Questo assicura che il pulsante "Vuoi salvare in libreria?" appaia anche quando hideHeader === true
  React.useEffect(() => {
    if (hideHeader && onToolbarUpdate && taskWizardMode === 'none') {
      // Usa toolbarButtonsWithRef che è già memoizzato
      onToolbarUpdate(toolbarButtonsWithRef, 'orange'); // ✅ FIX: Passa toolbarButtonsWithRef con ref
    }
  }, [hideHeader, onToolbarUpdate, taskWizardMode, shouldBeGeneral, saveDecisionMade, toolbarButtonsWithRef]); // ✅ toolbarButtonsWithRef è memoizzato, quindi non causa loop

  // ✅ LOG: Verification log for debugging (moved to useEffect to keep render pure)
  // ✅ FIX: Use only primitive dependencies to prevent loop
  const hasNormalEditorLayoutElement = normalEditorLayoutElement !== null;
  const hasSidebarElement = sidebarElement != null; // ✅ FIX: Use != to check both null and undefined
  const toolbarButtonsCount = toolbarButtons.length;
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
          toolbarButtons={toolbarButtonsWithRef} // ✅ Usa toolbarButtonsWithRef con ref
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

      {/* ✅ NEW: Save Location Popover for generalizable templates */}
      <SaveLocationDialog
        isOpen={showSaveDialog}
        onClose={() => {
          // Don't allow closing without decision if shouldBeGeneral
          if (shouldBeGeneral && !saveDecisionMade) {
            return; // Block close
          }
          setShowSaveDialog(false);
        }}
        onSaveToFactory={handleSaveToFactory}
        onSaveToProject={handleSaveToProject}
        onCancel={handleCancelSaveDialog}
        originalLabel={originalLabel}
        generalizedLabel={generalizedLabel}
        generalizationReason={generalizationReasonEffective}
        generalizedMessages={generalizedMessages}
        anchorRef={saveToLibraryButtonRef}
      />
    </div>
  );
}
