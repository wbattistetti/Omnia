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
import { WizardMode } from '../../../../../TaskBuilderAIWizard/types/WizardMode';
import type { TaskTree, TaskMeta } from '@types/taskTypes';
import type { TaskWizardMode } from '@taskEditor/EditorHost/types';
import type { useResponseEditorCore } from '@responseEditor/hooks/useResponseEditorCore';
import type { useResponseEditorHandlers } from '@responseEditor/hooks/useResponseEditorHandlers';
import { DialogueTaskService } from '@services/DialogueTaskService';
import { ResponseEditorContext, useResponseEditorContext } from '@responseEditor/context/ResponseEditorContext';
import { generalizeLabel } from '../../../../../TaskBuilderAIWizard/services/TemplateCreationService';
import { TranslationType } from '@types/translationTypes';
import { TaskType, TemplateSource } from '@types/taskTypes';
import { useDeploymentDialog } from '@responseEditor/ResponseEditorToolbar';

// ✅ ARCHITECTURE: Props interface with only necessary values (no monolithic editor object)
export interface ResponseEditorLayoutProps {
  // Layout props
  combinedClass: string;
  hideHeader?: boolean;
  // ✅ NOTE: taskTree, currentProjectId, taskMeta, taskLabel are still required
  // for Context initialization (ResponseEditorLayout PROVIDES the Context)
  taskTree: TaskTree | null | undefined;
  currentProjectId: string | null;
  taskMeta: TaskMeta | null;
  taskLabel: string;

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
  // ✅ NOTE: taskMeta is still required for Context initialization
  // taskMeta: TaskMeta | null; (moved to top level)
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
  setTaskWizardMode: (mode: TaskWizardMode) => void; // ✅ ARCHITECTURE: For Context single source of truth
  needsTaskContextualization: boolean;
  needsTaskBuilder: boolean;
  contextualizationTemplateId: string | null;
  // ✅ NOTE: taskLabel is still required for Context initialization
  // taskLabel: string; (moved to top level)

  // Wizard callbacks (stable)
  onTaskContextualizationComplete?: (taskTree: TaskTree) => void;
  onTaskBuilderComplete?: (taskTree: TaskTree, messages?: any) => void;
  onTaskBuilderCancel?: () => void;

  // ✅ NEW: Toolbar update callback (for hideHeader === true mode)
  onToolbarUpdate?: (toolbar: any[], color: string) => void;

  // ✅ REMOVED: shouldBeGeneral, generalizedLabel, generalizedMessages, generalizationReason - now from WizardContext
  saveDecisionMade?: boolean;
  onOpenSaveDialog?: () => void;
  showSaveDialog?: boolean;
  setShowSaveDialog?: (show: boolean) => void;
  setSaveDecisionMade?: (made: boolean) => void;
  // ✅ REMOVED: wizardIntegration - now from WizardContext
  originalLabel?: string;
  // ✅ FIX: Ref per il pulsante save-to-library (passato da ResponseEditorInner)
  saveToLibraryButtonRef?: React.RefObject<HTMLButtonElement>;
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
    taskMeta,
    taskLabel,
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
    // ✅ NOTE: taskMeta is still required for Context initialization
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
    setTaskWizardMode, // ✅ ARCHITECTURE: For Context single source of truth
    needsTaskContextualization,
    needsTaskBuilder,
    contextualizationTemplateId,
    // ✅ NOTE: taskLabel is still required for Context initialization
    onTaskContextualizationComplete,
    onTaskBuilderComplete,
    onTaskBuilderCancel,
    onToolbarUpdate,
    // ✅ REMOVED: shouldBeGeneral, generalizedLabel, generalizedMessages, generalizationReason - now from wizardIntegration
    saveDecisionMade: saveDecisionMadeProp,
    onOpenSaveDialog: onOpenSaveDialogProp,
    showSaveDialog: showSaveDialogProp,
    setShowSaveDialog: setShowSaveDialogProp,
    setSaveDecisionMade: setSaveDecisionMadeProp,
    // ✅ NOTE: wizardIntegration viene passato come prop per popolare WizardContext
    wizardIntegration: wizardIntegrationProp,
    originalLabel: originalLabelProp,
    // ✅ FIX: Ref per il pulsante save-to-library (passato da ResponseEditorInner)
    saveToLibraryButtonRef: saveToLibraryButtonRefProp,
  } = props;

  // ✅ ARCHITECTURE: Extract generalization values from wizardIntegration to populate WizardContext
  // These values come from useWizardIntegration in ResponseEditorInner
  const shouldBeGeneral = wizardIntegrationProp?.shouldBeGeneral ?? false;
  const generalizedLabel = wizardIntegrationProp?.generalizedLabel ?? null;
  const generalizedMessages = wizardIntegrationProp?.generalizedMessages ?? null;

  // ✅ Deployment dialog
  const projectLocale = 'it-IT'; // TODO: Get from project context
  const { openDialog: openDeploymentDialog, dialogElement: deploymentDialogElement } = useDeploymentDialog(currentProjectId, projectLocale);
  const generalizationReasonEffective = wizardIntegrationProp?.generalizationReason ?? null;

  // ✅ DEBUG: Log per verificare perché contextualizationTemplateId potrebbe essere undefined
  React.useEffect(() => {
    if (taskWizardMode === 'adaptation' || contextualizationTemplateId) {
      console.log('[ResponseEditorLayout] 📊 DEBUG: Parametri per ResponseEditorContent', {
        taskWizardMode,
        contextualizationTemplateId,
        taskMetaId: taskMeta?.id,
        taskMetaKeys: taskMeta ? Object.keys(taskMeta) : [],
        taskMetaContextualizationTemplateId: (taskMeta as any)?.contextualizationTemplateId,
        taskMetaTaskWizardMode: (taskMeta as any)?.taskWizardMode
      });
    }
  }, [taskWizardMode, contextualizationTemplateId, taskMeta]);

  // ✅ ARCHITECTURE: Context is SINGLE SOURCE OF TRUTH for taskWizardMode
  // No derives from taskMeta - use prop directly (which comes from state in useResponseEditorCore)
  // taskMeta.contextualizationTemplateId is still used as fallback for backward compatibility
  const contextualizationTemplateIdFromMeta = taskMeta?.contextualizationTemplateId;

  // ✅ ARCHITECTURE: Context is SINGLE SOURCE OF TRUTH for taskWizardMode
  // No more derives, no more fallbacks - just use the value from props (which comes from state)
  const responseEditorContextValue = React.useMemo(() => ({
    taskTree,
    taskMeta,
    taskLabel: taskLabel || '', // ✅ SINGLE SOURCE: from useResponseEditorCore - empty string if not available yet
    taskId: taskMeta?.id,
    currentProjectId,
    headerTitle,
    taskType: typeof taskType === 'string' ? Number(taskType) || 0 : taskType, // ✅ Convert to number for Context
    // ✅ ARCHITECTURE: taskWizardMode is SINGLE SOURCE OF TRUTH - no derives, no fallbacks
    taskWizardMode: taskWizardMode, // ✅ Use prop directly (comes from state in useResponseEditorCore)
    setTaskWizardMode, // ✅ ARCHITECTURE: Setter for updating wizard mode (updates state in useResponseEditorCore)
    contextualizationTemplateId: contextualizationTemplateIdFromMeta || contextualizationTemplateId || undefined,
    // ✅ NEW: Deployment handler
    onDeploymentClick: openDeploymentDialog,
  }), [taskTree, taskMeta, taskLabel, currentProjectId, headerTitle, taskType, taskWizardMode, setTaskWizardMode, contextualizationTemplateIdFromMeta, contextualizationTemplateId, openDeploymentDialog]);

  // ✅ B1: WizardContext.Provider moved to ResponseEditorInner to avoid race condition

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

  // ✅ State for saving operation (must be declared before handleSaveToFactory)
  const [isSaving, setIsSaving] = React.useState(false);

  // ✅ FIX: Handler to save to Factory with loading state and dematerialization filter
  const handleSaveToFactory = React.useCallback(async () => {
    // ✅ FLOW TRACE: START
    console.log('[handleSaveToFactory] 🚀 FLOW TRACE - START', {
      hasWizardIntegrationProp: !!wizardIntegrationProp,
      hasDataSchema: !!wizardIntegrationProp?.dataSchema,
      dataSchemaIsArray: Array.isArray(wizardIntegrationProp?.dataSchema),
      dataSchemaLength: wizardIntegrationProp?.dataSchema?.length || 0,
      wizardMode: wizardIntegrationProp?.wizardMode,
      taskWizardMode,
      timestamp: new Date().toISOString(),
    });

    // ✅ Set spinner immediately
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 0));

    // ✅ TWO VALID SOURCES:
    //   1. wizardIntegrationProp.dataSchema — when arriving from the wizard flow
    //   2. taskTree.nodes                   — when editing an existing template directly
    // Both are valid.  Neither is a "fallback"; they represent two distinct entry paths.
    const effectiveDataSchema: any[] | null =
      (wizardIntegrationProp?.dataSchema && Array.isArray(wizardIntegrationProp.dataSchema))
        ? wizardIntegrationProp.dataSchema
        : (taskTree?.nodes && Array.isArray(taskTree.nodes) && taskTree.nodes.length > 0)
          ? taskTree.nodes
          : null;

    if (!effectiveDataSchema) {
      console.error('[handleSaveToFactory] ❌ No data source available', {
        hasWizardDataSchema: !!wizardIntegrationProp?.dataSchema,
        hasTaskTreeNodes: !!taskTree?.nodes,
        taskTreeNodesLength: taskTree?.nodes?.length ?? 0,
        taskWizardMode,
      });
      alert('Cannot save to Factory: no template data found. Open the template from the sidebar and try again.');
      setIsSaving(false);
      return;
    }

    console.log('[handleSaveToFactory] 📊 Using data source', {
      source: wizardIntegrationProp?.dataSchema ? 'wizardIntegration.dataSchema' : 'taskTree.nodes',
      nodeCount: effectiveDataSchema.length,
    });

    // ✅ Count ALL nodes recursively (root + sub-nodes) - this is the TRUTH
    const collectAllNodeIds = (nodes: any[]): string[] => {
      const ids: string[] = [];
      for (const node of nodes) {
        const nodeId = node.id || node.templateId;
        if (nodeId) ids.push(nodeId);
        if (node.subNodes?.length > 0) {
          ids.push(...collectAllNodeIds(node.subNodes));
        }
      }
      return ids;
    };

    const expectedNodeIds = new Set(collectAllNodeIds(effectiveDataSchema));
    const expectedCount = expectedNodeIds.size;

    console.log('[handleSaveToFactory] 📊 Expected templates from dataSchema', {
      expectedCount,
      nodeIds: Array.from(expectedNodeIds)
    });

    try {
      // Load cache
      if (!DialogueTaskService.isCacheLoaded()) {
        await DialogueTaskService.loadTemplates();
      }

      const allTemplates = DialogueTaskService.getAllTemplates();

      // ✅ Filter templates that match expected node IDs
      const templatesToSave = allTemplates.filter(t => {
        const templateId = t.id || t._id;
        return templateId && expectedNodeIds.has(templateId);
      });

      // ✅ CRITICAL CHECK: If dataSchema has N nodes, there MUST be N templates
      // ❌ NO FALLBACK: If templates are missing, fail immediately
      if (templatesToSave.length !== expectedCount) {
        const missingIds = Array.from(expectedNodeIds).filter(id =>
          !templatesToSave.some(t => (t.id || t._id) === id)
        );
        const errorMsg = `Cannot save to Factory: missing templates.\n\nExpected: ${expectedCount} templates\nFound: ${templatesToSave.length} templates\n\nMissing template IDs: ${missingIds.join(', ')}\n\nThis should not happen - all templates should be in cache after wizard completion.`;
        console.error('[handleSaveToFactory] ❌ Template count mismatch', {
          expectedCount,
          foundCount: templatesToSave.length,
          missingIds
        });
        alert(errorMsg);
        setIsSaving(false);
        return;
      }

      // ✅ Dematerialize templates (remove nodes, subNodes, data, _id, name, createdAt)
      // Note: generalizeLabel is async, so we need to use Promise.all() instead of .map()
      const dematerializedTemplates = await Promise.all(
        templatesToSave.map(async t => {
          const { _id, nodes, subNodes, data, createdAt, name, ...template } = t;

          // Root template: use generalized label if available
          const isRoot = effectiveDataSchema[0]?.id === template.id;
          if (isRoot && generalizedLabel) {
            template.label = generalizedLabel;
          } else if (typeof template.type === 'number' && template.type === TaskType.UtteranceInterpretation) {
            // ✅ CRITICAL: For UtteranceInterpretation tasks (type: 3), always generalize the label
            // The task type already implies "asking", so remove verbs like "Chiedi"
            template.label = await generalizeLabel(template.label);
          }

          return template;
        })
      );

      // ✅ CRITICAL: Validate translations BEFORE saving template
      // Extract GUIDs and verify all translations exist in context
      // If validation fails, DO NOT save template to avoid incomplete data
      // ✅ CRITICAL: Templates in cache might have been modified with instance GUIDs
      // We need to find translations using ALL GUIDs in context, not just those extracted from templates
      // Solution: Extract GUIDs from templates, but if translations are not found, search in all context GUIDs
      const allGuids = new Set<string>();
      const currentLanguage = localStorage.getItem('project.lang') || 'it';

      // Helper to extract ONLY translation GUIDs recursively from any object structure
      // ✅ CRITICAL: We only extract GUIDs that are translation keys, not system GUIDs (like task.id)
      const extractGuidsRecursive = (obj: any, path: string = ''): void => {
        if (!obj || typeof obj !== 'object') return;

        // If it's an array, process each element
        if (Array.isArray(obj)) {
          obj.forEach((item, idx) => extractGuidsRecursive(item, `${path}[${idx}]`));
          return;
        }

        // Process object properties
        for (const [key, value] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${key}` : key;

          // ✅ ONLY extract translation GUIDs:
          // 1. textKey or guid fields (these are translation keys)
          // 2. parameters[].value where parameterId === 'text' (these are translation keys)
          // ❌ DO NOT extract: task.id, escalationId, etc. (these are system GUIDs, not translation keys)

          if (key === 'textKey' || key === 'guid') {
            // ✅ These are translation keys
            if (typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
              allGuids.add(value);
            }
          }

          // ✅ Special handling for parameters array (look for parameterId === 'text')
          // This is the PRIMARY source of translation GUIDs
          if (key === 'parameters' && Array.isArray(value)) {
            value.forEach((param: any) => {
              if (param?.parameterId === 'text' && param?.value) {
                if (typeof param.value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param.value)) {
                  allGuids.add(param.value);
                }
              }
            });
          }

          // ❌ Skip 'id' field - it's a system GUID (task.id, escalationId, etc.), not a translation key
          // Only process nested objects (but skip 'id' fields)
          if (value && typeof value === 'object' && key !== 'id') {
            extractGuidsRecursive(value, currentPath);
          }
        }
      };

      // Extract GUIDs from templates (these might be instance GUIDs, not original template GUIDs)
      templatesToSave.forEach(t => {
        // Add template.id (label GUID)
        if (t.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t.id)) {
          allGuids.add(t.id);
        }
        // Extract all GUIDs recursively from template structure
        extractGuidsRecursive(t);

        // ✅ DEBUG: Log template structure to verify if it has been modified
        console.log('[handleSaveToFactory] 🔍 Template structure check', {
          templateId: t.id,
          templateLabel: t.label,
          hasSteps: !!t.steps,
          stepsKeys: t.steps ? Object.keys(t.steps) : [],
          sampleStepGuid: t.steps ? (() => {
            const firstStepKey = Object.keys(t.steps)[0];
            if (firstStepKey && t.steps[firstStepKey]) {
              const firstStep = t.steps[firstStepKey];
              const firstEscalation = firstStep.start?.escalations?.[0];
              if (firstEscalation?.tasks?.[0]?.parameters) {
                const textParam = firstEscalation.tasks[0].parameters.find((p: any) => p.parameterId === 'text');
                return textParam?.value;
              }
            }
            return null;
          })() : null
        });
      });

      console.log('[handleSaveToFactory] 📋 Extracted GUIDs from templates', {
        totalGuids: allGuids.size,
        sampleGuids: Array.from(allGuids).slice(0, 10),
        allGuids: Array.from(allGuids) // ✅ DEBUG: Log all GUIDs for comparison
      });

      // ✅ Load translations from ProjectTranslationsContext (ONLY source of truth)
      // ❌ NO FALLBACK: If context is not available, fail immediately
      if (typeof window === 'undefined' || !(window as any).__projectTranslationsContext) {
        const errorMsg = 'Cannot save to Factory: ProjectTranslationsContext not available.';
        console.error('[handleSaveToFactory] ❌', errorMsg);
        alert(errorMsg);
        setIsSaving(false);
        return;
      }

      const context = (window as any).__projectTranslationsContext;
      const translations = context.translations || {};

      // ✅ DEBUG: Log context state
      const contextGuids = Object.keys(translations);
      const requestedGuids = Array.from(allGuids);
      const matchingGuids = requestedGuids.filter(g => g in translations);
      const missingGuids = requestedGuids.filter(g => !(g in translations));

      console.log('[handleSaveToFactory] 🔍 Context state check', {
        hasContext: !!context,
        translationsCount: contextGuids.length,
        requestedGuidsCount: requestedGuids.length,
        matchingGuidsCount: matchingGuids.length,
        missingGuidsCount: missingGuids.length,
        sampleRequestedGuids: requestedGuids.slice(0, 10),
        sampleContextGuids: contextGuids.slice(0, 10),
        sampleMatchingGuids: matchingGuids.slice(0, 10),
        sampleMissingGuids: missingGuids.slice(0, 10)
      });

      const contextTranslations: Record<string, string> = {};

      for (const guid of allGuids) {
        const trans = translations[guid];
        if (trans) {
          const text = typeof trans === 'object'
            ? (trans[currentLanguage] || trans.en || trans.it || trans.pt || '')
            : String(trans);
          if (text) {
            contextTranslations[guid] = text;
          }
        }
      }

      console.log('[handleSaveToFactory] 📋 Loaded translations from context', {
        requestedGuids: allGuids.size,
        foundTranslations: Object.keys(contextTranslations).length,
        missingGuids: Array.from(allGuids).filter(g => !contextTranslations[g]).length,
        totalContextTranslations: Object.keys(translations).length
      });

      // ✅ CRITICAL: If translations are not found for extracted GUIDs, they might be instance GUIDs
      // Try to find translations by searching all context GUIDs that match template structure
      const missingTranslations = Array.from(allGuids).filter(g => !contextTranslations[g]);
      if (missingTranslations.length > 0) {
        console.warn('[handleSaveToFactory] ⚠️ Some GUIDs not found in context - might be instance GUIDs', {
          missingCount: missingTranslations.length,
          totalExtracted: allGuids.size,
          foundCount: Object.keys(contextTranslations).length
        });

        // ✅ FALLBACK: If we have template structure, try to find translations by matching template structure
        // This is a workaround for when templates have been modified with instance GUIDs
        // We'll use the translations we found, even if some GUIDs are missing
        // The missing GUIDs are likely instance GUIDs that don't have translations in the context
        if (Object.keys(contextTranslations).length === 0) {
          const errorMsg = `Cannot save to Factory: no translations found.\n\nExpected: ${allGuids.size} translations\nFound: 0 translations\n\nThis might happen if templates have been modified with instance GUIDs. Please recreate the templates.`;
          console.error('[handleSaveToFactory] ❌ No translations found', {
            expectedCount: allGuids.size,
            foundCount: 0
          });
          alert(errorMsg);
          setIsSaving(false);
          return;
        }

        // ✅ Continue with partial translations (some GUIDs might be instance GUIDs without translations)
        console.warn('[handleSaveToFactory] ⚠️ Continuing with partial translations', {
          found: Object.keys(contextTranslations).length,
          missing: missingTranslations.length
        });
      }

      // ✅ Build translations array: label translations + prompt translations
      // This is done BEFORE saving template to ensure we have all data ready
      const translationsToSave: Array<{
        guid: string;
        language: string;
        text: string;
        type: string;
        projectId: null;
      }> = [];

      // Add label translations (template IDs)
      dematerializedTemplates.forEach(t => {
        if (t.id && t.label) {
          translationsToSave.push({
            guid: t.id,
            language: currentLanguage,
            text: t.label,
            type: TranslationType.LABEL,
            projectId: null,
          });
        }
      });

      // Add prompt translations (GUIDs from steps) - use INSTANCE type
      for (const guid of allGuids) {
        // Skip if already added as label
        if (dematerializedTemplates.some(t => t.id === guid)) {
          continue;
        }

        const text = contextTranslations[guid];
        // ✅ Skip GUIDs without translations (they might be instance GUIDs without translations)
        // This is consistent with the validation above that allows partial translations
        if (!text) {
          console.warn('[handleSaveToFactory] ⚠️ Skipping GUID without translation', {
            guid,
            reason: 'Translation not found in context (might be instance GUID without translation)'
          });
          continue;
        }

        translationsToSave.push({
          guid,
          language: currentLanguage,
          text,
          type: TranslationType.INSTANCE, // ✅ Use INSTANCE for prompt translations
          projectId: null,
        });
      }

      console.log('[handleSaveToFactory] 📦 Prepared translations to save', {
        totalTranslations: translationsToSave.length,
        labelTranslations: dematerializedTemplates.filter(t => t.id && t.label).length,
        promptTranslations: translationsToSave.length - dematerializedTemplates.filter(t => t.id && t.label).length
      });

      // ✅ FLOW TRACE: Saving template to Factory
      console.log('[handleSaveToFactory] 🚀 FLOW TRACE - Saving template to Factory', {
        templatesCount: dematerializedTemplates.length,
        templateIds: dematerializedTemplates.map(t => t.id),
        translationsCount: translationsToSave.length,
      });

      // ✅ CRITICAL: Set source to 'Factory' before saving
      const templatesWithFactorySource = dematerializedTemplates.map(t => ({
        ...t,
        source: TemplateSource.Factory
      }));

      // ✅ CRITICAL: All validations passed - NOW save template
      // This happens AFTER all checks to avoid saving incomplete data
      const response = await fetch('/api/factory/dialogue-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templatesWithFactorySource)
      });

      if (!response.ok) {
        throw new Error(`Failed to save: ${response.status}`);
      }

      // ✅ FLOW TRACE: Template saved to Factory
      console.log('[handleSaveToFactory] ✅ FLOW TRACE - Template saved to Factory', {
        templatesCount: dematerializedTemplates.length,
        templateIds: dematerializedTemplates.map(t => t.id),
      });

      // ✅ Save translations (only after template is saved successfully)
      if (translationsToSave.length > 0) {
        await fetch('/api/factory/template-label-translations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ translations: translationsToSave }),
        });
        console.log('[handleSaveToFactory] ✅ FLOW TRACE - Translations saved to Factory', {
          translationsCount: translationsToSave.length,
        });
      }

      // ✅ FLOW TRACE: Reloading cache
      console.log('[handleSaveToFactory] 🔄 FLOW TRACE - Reloading Factory templates cache', {
        cacheSizeBefore: DialogueTaskService.getTemplateCount(),
      });

      // ✅ Reload cache and close
      await DialogueTaskService.reloadFactoryTemplates();

      // ✅ FLOW TRACE: Cache reloaded
      console.log('[handleSaveToFactory] ✅ FLOW TRACE - Factory templates cache reloaded', {
        cacheSizeAfter: DialogueTaskService.getTemplateCount(),
        templateIds: dematerializedTemplates.map(t => t.id),
        allTemplatesInCache: DialogueTaskService.getAllTemplates().map(t => t.id).slice(0, 10),
      });

      // ✅ FLOW TRACE: Final summary - Everything saved successfully
      const allTemplatesAfterReload = DialogueTaskService.getAllTemplates();
      const savedTemplatesInCache = allTemplatesAfterReload.filter(t =>
        dematerializedTemplates.some(dt => dt.id === t.id)
      );
      console.log('[handleSaveToFactory] 🎉 FLOW TRACE - FINAL SUMMARY - Everything saved successfully', {
        templatesSaved: {
          count: dematerializedTemplates.length,
          templateIds: dematerializedTemplates.map(t => t.id),
          allInCache: savedTemplatesInCache.length === dematerializedTemplates.length,
          missingInCache: dematerializedTemplates
            .filter(dt => !allTemplatesAfterReload.some(t => t.id === dt.id))
            .map(t => t.id),
        },
        translationsSaved: {
          count: translationsToSave.length,
          labelTranslations: dematerializedTemplates.filter(t => t.id && t.label).length,
          promptTranslations: translationsToSave.length - dematerializedTemplates.filter(t => t.id && t.label).length,
        },
        cacheReloaded: {
          success: true,
          cacheSizeBefore: DialogueTaskService.getTemplateCount(),
          cacheSizeAfter: allTemplatesAfterReload.length,
        },
        overallStatus: '✅ SUCCESS - All templates and translations saved to Factory',
        timestamp: new Date().toISOString(),
      });

      // ✅ CRITICAL: Save task instance to project database with templateId
      // After saving to Factory, the task instance must be persisted to project database
      // This ensures that when reopening, TaskTreeOpener finds the templateId in the database
      if (dematerializedTemplates.length > 0 && taskMeta?.id && currentProjectId) {
        const rootTemplateId = dematerializedTemplates[0].id; // First template is the root

        try {
          const taskRepository = (await import('@services/TaskRepository')).taskRepository;
          const existingTask = taskRepository.getTask(taskMeta.id);

          if (existingTask) {
            // Update task instance with templateId
            taskRepository.updateTask(taskMeta.id, {
              templateId: rootTemplateId,
            }, currentProjectId);

            // ✅ CRITICAL: Save to database immediately (not just in memory)
            await taskRepository.saveAllTasksToDatabase(currentProjectId, [existingTask]);

            console.log('[handleSaveToFactory] ✅ FLOW TRACE - Saved task instance to project database', {
              taskId: taskMeta.id,
              templateId: rootTemplateId,
              projectId: currentProjectId,
            });
          } else {
            console.warn('[handleSaveToFactory] ⚠️ Task instance not found in repository', {
              taskId: taskMeta.id,
              projectId: currentProjectId,
            });
          }
        } catch (error) {
          console.error('[handleSaveToFactory] ❌ Error saving task instance to database', {
            taskId: taskMeta.id,
            templateId: rootTemplateId,
            error: error instanceof Error ? error.message : String(error),
          });
          // Don't block the save flow - template is already saved to Factory
        }
      }

      setSaveDecision('factory');
      setSaveDecisionMade(true);
      setIsSaving(false);
      setShowSaveDialog(false);

    } catch (error) {
      console.error('[handleSaveToFactory] ❌ Error:', error);
      alert(`Error saving to Factory: ${error instanceof Error ? error.message : String(error)}`);
      setIsSaving(false);
    }
  }, [wizardIntegrationProp, taskTree, generalizedLabel, taskMeta, currentProjectId, setSaveDecision, setSaveDecisionMade, setIsSaving, setShowSaveDialog]);


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
      wizardIntegrationExists: !!wizardIntegrationProp,
      wizardIntegrationShouldBeGeneral: wizardIntegrationProp?.shouldBeGeneral,
      wizardMode: wizardIntegrationProp?.wizardMode,
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
  }, [shouldBeGeneral, saveDecisionMade, handleEditorClose, wizardIntegrationProp, taskWizardMode]);

  // ✅ NEW: Calcola mainViewMode in base a taskWizardMode, wizardMode e showMessageReview/showSynonyms
  // ✅ IMPORTANTE: Questo useMemo deve venire DOPO la dichiarazione di wizardIntegrationProp
  const mainViewMode = React.useMemo<MainViewMode>(() => {
    // ✅ NEW: Se wizard è completato, passa a BEHAVIOUR (auto-chiusura)
    if (taskWizardMode === 'full' && wizardIntegrationProp?.wizardMode === 'completed') {
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
  }, [taskWizardMode, wizardIntegrationProp?.wizardMode, showMessageReview, showSynonyms]);

  // ✅ NEW: Prepara wizardProps per CenterPanel e Sidebar (con useMemo per evitare ricostruzioni)
  const wizardProps = React.useMemo(() => {
    if (!wizardIntegrationProp) {
      return undefined;
    }

    return {
      wizardMode: wizardIntegrationProp.wizardMode,
      showStructureConfirmation: wizardIntegrationProp.showStructureConfirmation,
      onStructureConfirm: wizardIntegrationProp.handleStructureConfirm,
      onStructureReject: wizardIntegrationProp.handleStructureReject,
      structureConfirmed: wizardIntegrationProp.structureConfirmed,
      currentStep: wizardIntegrationProp.currentStep, // DEPRECATED
      pipelineSteps: wizardIntegrationProp.pipelineSteps,
      dataSchema: wizardIntegrationProp.dataSchema,
      // ✅ NEW: Add generalizedLabel to wizardProps
      generalizedLabel: wizardIntegrationProp.generalizedLabel,
      onProceedFromEuristica: wizardIntegrationProp.onProceedFromEuristica,
      onShowModuleList: wizardIntegrationProp.onShowModuleList,
      onSelectModule: wizardIntegrationProp.onSelectModule,
      onPreviewModule: wizardIntegrationProp.onPreviewModule,
      availableModules: wizardIntegrationProp.availableModules,
      foundModuleId: wizardIntegrationProp.foundModuleId,
      showCorrectionMode: wizardIntegrationProp.showCorrectionMode,
      correctionInput: wizardIntegrationProp.correctionInput,
      onCorrectionInputChange: wizardIntegrationProp.setCorrectionInput,
      onCorrectionSubmit: wizardIntegrationProp.handleCorrectionSubmit,
      // ✅ NEW: Sotto-stati per parte variabile dinamica
      currentParserSubstep: wizardIntegrationProp.currentParserSubstep,
      currentMessageSubstep: wizardIntegrationProp.currentMessageSubstep,
    };
  }, [
    // ✅ USA solo primitive values e funzioni stabili - evita dipendere dall'intero oggetto wizardIntegrationProp
    wizardIntegrationProp?.wizardMode,
    wizardIntegrationProp?.showStructureConfirmation,
    wizardIntegrationProp?.structureConfirmed,
    wizardIntegrationProp?.currentStep,
    wizardIntegrationProp?.pipelineSteps,
    wizardIntegrationProp?.dataSchema,
    wizardIntegrationProp?.availableModules,
    wizardIntegrationProp?.foundModuleId,
    wizardIntegrationProp?.showCorrectionMode,
    wizardIntegrationProp?.correctionInput,
    wizardIntegrationProp?.currentParserSubstep,
    wizardIntegrationProp?.currentMessageSubstep,
    wizardIntegrationProp?.generalizedLabel,
    wizardIntegrationProp?.handleStructureConfirm,
    wizardIntegrationProp?.handleStructureReject,
    wizardIntegrationProp?.onProceedFromEuristica,
    wizardIntegrationProp?.onShowModuleList,
    wizardIntegrationProp?.onSelectModule,
    wizardIntegrationProp?.onPreviewModule,
    wizardIntegrationProp?.setCorrectionInput,
    wizardIntegrationProp?.handleCorrectionSubmit,
  ]);

  // ✅ NEW: Usa direttamente dataSchema quando taskWizardMode === 'full'
  // La Sidebar può usare direttamente WizardTaskTreeNode[] senza conversione
  const effectiveMainList = React.useMemo(() => {
    if (taskWizardMode === 'full' && wizardIntegrationProp?.dataSchema) {
      return wizardIntegrationProp.dataSchema;
    }
    return mainList;
  }, [taskWizardMode, wizardIntegrationProp?.dataSchema, mainList]);

  // ✅ ARCHITECTURE: Memoize sidebar to prevent reference changes
  const sidebarElement = React.useMemo(() => {
    // ✅ NEW: Mostra sidebar quando wizardMode === DATA_STRUCTURE_PROPOSED o successivi
    if (taskWizardMode === 'full') {
      // ✅ Sidebar visibile solo quando la struttura è stata proposta o confermata
      const shouldShowSidebar = wizardIntegrationProp?.wizardMode === WizardMode.DATA_STRUCTURE_PROPOSED ||
        wizardIntegrationProp?.wizardMode === WizardMode.DATA_STRUCTURE_CONFIRMED ||
        wizardIntegrationProp?.wizardMode === WizardMode.GENERATING ||
        wizardIntegrationProp?.wizardMode === WizardMode.COMPLETED;

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
        // ✅ REMOVED: taskTree, task, currentProjectId - now from Context
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
      // ✅ REMOVED: wizardProps - now from WizardContext
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
        // ✅ REMOVED: taskTree, task, currentProjectId - now from Context
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

  // ✅ FIX: Usa il ref passato come prop (creato in ResponseEditorInner)
  const saveToLibraryButtonRef = saveToLibraryButtonRefProp || React.useRef<HTMLButtonElement>(null);

  // ✅ FIX: Sync toolbarButtons to onToolbarUpdate when hideHeader is true
  // Il pulsante è sempre presente nella toolbar, quindi non serve più toolbarButtonsWithRef
  React.useEffect(() => {
    if (hideHeader && onToolbarUpdate && taskWizardMode === 'none') {
      // ✅ FIX: Passa direttamente toolbarButtons (il pulsante è sempre presente con ref)
      onToolbarUpdate(toolbarButtons, 'orange');
    }
  }, [hideHeader, onToolbarUpdate, taskWizardMode, toolbarButtons]);

  // ✅ LOG: Verification log for debugging (moved to useEffect to keep render pure)
  // ✅ FIX: Use only primitive dependencies to prevent loop
  const hasNormalEditorLayoutElement = normalEditorLayoutElement !== null;
  const hasSidebarElement = sidebarElement != null; // ✅ FIX: Use != to check both null and undefined
  const toolbarButtonsCount = toolbarButtons.length;
  const shouldShowHeader = !hideHeader && taskWizardMode === 'none';
  const shouldShowBanner = isGeneralizable && taskWizardMode === 'none';
  React.useEffect(() => {
    if (taskWizardMode === 'full') {
      // Layout check (silent)
    }
  }, [taskWizardMode, hasNormalEditorLayoutElement, hasSidebarElement, toolbarButtonsCount, shouldShowHeader, shouldShowBanner]);

  // ✅ NEW: Wrap content in Context Providers
  const content = (
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
          toolbarButtons={toolbarButtons} // ✅ FIX: Il pulsante è sempre presente con ref nella toolbar
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
          // ✅ REMOVED: task, taskTree - now from Context
          handleContractWizardClose={handleContractWizardClose}
          handleContractWizardNodeUpdate={handleContractWizardNodeUpdate}
          handleContractWizardComplete={handleContractWizardComplete}
          onIntentMessagesComplete={handleIntentMessagesComplete}
          // ✅ NEW: Wizard mode (primary)
          taskWizardMode={taskWizardMode}
          // ✅ DEPRECATED: Backward compatibility wizard props
          needsTaskContextualization={needsTaskContextualization}
          needsTaskBuilder={needsTaskBuilder}
          // ✅ REMOVED: taskLabel - now from Context
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
        onCancel={handleCancelSaveDialog}
        // ✅ REMOVED: originalLabel, generalizedLabel, generalizationReason, generalizedMessages - now from contexts
        anchorRef={saveToLibraryButtonRef}
        isSaving={isSaving} // ✅ NEW: Pass saving state to dialog
        responseEditorRef={rootRef} // ✅ NEW: Pass ResponseEditor container ref for positioning
      />
    </div>
  );

  // ✅ B1: WizardContext.Provider moved to ResponseEditorInner
  // ✅ Only ResponseEditorContext.Provider remains here
  return (
    <ResponseEditorContext.Provider value={responseEditorContextValue}>
      {content}
      {/* ✅ Deployment Dialog */}
      {deploymentDialogElement}
    </ResponseEditorContext.Provider>
  );
}
