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
import { SaveLocationDialog } from '@responseEditor/components/SaveLocationDialog';
import { MainViewMode } from '@responseEditor/types/mainViewMode';
// ✅ REMOVED: useWizardIntegration - ora viene chiamato in ResponseEditorInner
// ✅ REMOVED: Star import - non più necessario
import { WizardMode } from '../../../../../TaskBuilderAIWizard/types/WizardMode';
import type { TaskTree, TaskMeta } from '@types/taskTypes';
import type { TaskWizardMode } from '@taskEditor/EditorHost/types';
import type { useResponseEditorCore } from '@responseEditor/hooks/useResponseEditorCore';
import { DialogueTaskService } from '@services/DialogueTaskService';
import { ResponseEditorContext, useResponseEditorContext } from '@responseEditor/context/ResponseEditorContext';
import { ResponseEditorNavigationProvider } from '@responseEditor/context/ResponseEditorNavigationContext';
import { HeaderToolbarProvider, useHeaderToolbarContext } from '@responseEditor/context/HeaderToolbarContext';
import { useTaskTreeFromStore, useTaskTreeStore } from '@responseEditor/core/state';
import { generalizeLabel } from '../../../../../TaskBuilderAIWizard/services/TemplateCreationService';
import { TranslationType } from '@types/translationTypes';
import { TaskType, TemplateSource } from '@types/taskTypes';
import type { SelectPathHandler } from '@responseEditor/features/node-editing/selectPathTypes';
import { TaskKindBadge } from '@responseEditor/components/TaskKindBadge';
import { PromoteStandaloneToTemplateButton } from '@responseEditor/components/PromoteStandaloneToTemplateButton';
import { taskRepository } from '@services/TaskRepository';
import { inferTaskKind, taskKindLabel } from '@utils/taskKind';
import {
  canPromoteStandaloneToProjectTemplateMvp,
  promoteStandaloneToProjectTemplate,
} from '@utils/promoteStandaloneToProjectTemplate';
import type { ToolbarButton } from '@dock/types';
import { isUuidString, makeTranslationKey, translationKeyFromStoredValue } from '@utils/translationKeys';

/**
 * Internal component that wraps EditorHeader with dynamic injection support
 * ✅ ARCHITECTURE: Uses injected icon/title/toolbar from task editors, with fallback to props
 */
function HeaderWithDynamicToolbar({
  icon: defaultIcon,
  title: defaultTitle,
  toolbarButtons,
  titleBadge,
  titleActions,
  onClose,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  toolbarButtons: any[];
  titleBadge?: React.ReactNode;
  titleActions?: React.ReactNode;
  onClose: () => void;
  color: 'slate' | 'orange' | 'purple';
}) {
  const toolbarContext = useHeaderToolbarContext();

  // ✅ ARCHITECTURE: Use injected values if available, otherwise fallback to props
  const icon = toolbarContext?.icon ?? defaultIcon;
  const title = toolbarContext?.title ?? defaultTitle;
  const dynamicToolbar = toolbarContext?.toolbar || null;

  return (
    <EditorHeader
      icon={icon}
      title={title}
      titleBadge={titleBadge}
      titleActions={titleActions}
      toolbarButtons={toolbarButtons}
      dynamicToolbarSlot={dynamicToolbar}
      onClose={onClose}
      color={color}
    />
  );
}

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
  selectedPath: number[];
  handleSelectByPath: SelectPathHandler;
  selectedRoot: boolean;
  selectedNode: any;
  selectedNodePath: { path: number[] } | null;
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
  setLeftPanelMode?: (mode: any) => void; // ✅ NEW: Setter for navigation context
  testPanelMode: any;
  tasksPanelMode: any;
  setTasksPanelMode?: (mode: any) => void; // ✅ NEW: Setter for navigation context

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

  // Toolbar wizard-mode toggle actions
  onStartWizard?: () => void;
  onSwitchToManual?: () => void;

  // ✅ NEW: Toolbar update callback (for hideHeader === true mode)
  onToolbarUpdate?: (toolbar: any[], color: string) => void;

  showSaveDialog?: boolean;
  setShowSaveDialog?: (show: boolean) => void;
  setSaveDecisionMade?: (made: boolean) => void;
  // ✅ REMOVED: wizardIntegration - now from WizardContext
  originalLabel?: string;
  // ✅ FIX: Ref per il pulsante save-to-library (passato da ResponseEditorInner)
  saveToLibraryButtonRef?: React.RefObject<HTMLButtonElement>;
  // ✅ NEW: View mode for Behaviour (tabs or tree)
  viewMode?: 'tabs' | 'tree';
  onViewModeChange?: (mode: 'tabs' | 'tree') => void;
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
    selectedPath,
    handleSelectByPath,
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
    setLeftPanelMode, // ✅ NEW: Destructure setter for navigation context
    testPanelMode,
    tasksPanelMode,
    setTasksPanelMode, // ✅ NEW: Destructure setter for navigation context
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
    onStartWizard,
    onSwitchToManual,
    showSaveDialog: showSaveDialogProp,
    setShowSaveDialog: setShowSaveDialogProp,
    setSaveDecisionMade: setSaveDecisionMadeProp,
    // ✅ NOTE: wizardIntegration viene passato come prop per popolare WizardContext
    wizardIntegration: wizardIntegrationProp,
    originalLabel: originalLabelProp,
    // ✅ FIX: Ref per il pulsante save-to-library (passato da ResponseEditorInner)
    saveToLibraryButtonRef: saveToLibraryButtonRefProp,
    // ✅ NEW: View mode for Behaviour
    viewMode: viewModeProp,
    onViewModeChange: onViewModeChangeProp,
  } = props;

  // Wizard copy for labels/messages (WizardContext): used when publishing template data to Factory.
  const generalizedLabel = wizardIntegrationProp?.generalizedLabel ?? null;
  const generalizedMessages = wizardIntegrationProp?.generalizedMessages ?? null;

  // ✅ Project locale (for other uses)
  const projectLocale = 'it-IT'; // TODO: Get from project context

  // ✅ ARCHITECTURE: Context is SINGLE SOURCE OF TRUTH for taskWizardMode
  // No derives from taskMeta - use prop directly (which comes from state in useResponseEditorCore)
  // taskMeta.contextualizationTemplateId is still used as fallback for backward compatibility
  const contextualizationTemplateIdFromMeta = taskMeta?.contextualizationTemplateId;

  // ✅ FIX RACE CONDITION: Use Zustand store as primary source for taskTree
  // The store is updated immediately when wizard completes, while props take longer to propagate
  // This ensures the context has the taskTree immediately when mainViewMode transitions to BEHAVIOUR
  const taskTreeFromStore = useTaskTreeFromStore();

  // ✅ ARCHITECTURE: Context is SINGLE SOURCE OF TRUTH for taskWizardMode
  // No more derives, no more fallbacks - just use the value from props (which comes from state)
  const responseEditorContextValue = React.useMemo(() => ({
    taskTree: taskTreeFromStore ?? taskTree,  // ✅ Store as primary, prop as fallback
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
      }), [taskTreeFromStore, taskTree, taskMeta, taskLabel, currentProjectId, headerTitle, taskType, taskWizardMode, setTaskWizardMode, contextualizationTemplateIdFromMeta, contextualizationTemplateId]);

  // ✅ B1: WizardContext.Provider moved to ResponseEditorInner to avoid race condition

  // ✅ State for save location dialog (usa props se disponibili, altrimenti state locale)
  const [localShowSaveDialog, setLocalShowSaveDialog] = React.useState(false);
  const [localSaveDecisionMade, setLocalSaveDecisionMade] = React.useState(false);

  const showSaveDialog = showSaveDialogProp !== undefined ? showSaveDialogProp : localShowSaveDialog;
  const setShowSaveDialog = setShowSaveDialogProp || setLocalShowSaveDialog;
  const setSaveDecisionMade = setSaveDecisionMadeProp || setLocalSaveDecisionMade;

  // Toolbar opens the dialog via useResponseEditor → onOpenSaveDialog (ResponseEditorInner); no second wrapper here.

  // ✅ State for saving operation (must be declared before handleSaveToFactory)
  const [isSaving, setIsSaving] = React.useState(false);

  // ✅ FIX: Handler to save to Factory with loading state and dematerialization filter
  const handleSaveToFactory = React.useCallback(async () => {
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
      console.error('[handleSaveToFactory] No data source available for save-to-factory');
      alert('Cannot save to Factory: no template data found. Open the template from the sidebar and try again.');
      setIsSaving(false);
      return;
    }

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
            if (typeof value === 'string') {
              const tk = translationKeyFromStoredValue(value);
              if (tk) allGuids.add(tk);
            }
          }

          // ✅ Special handling for parameters array (look for parameterId === 'text')
          // This is the PRIMARY source of translation GUIDs
          if (key === 'parameters' && Array.isArray(value)) {
            value.forEach((param: any) => {
              if (param?.parameterId === 'text' && param?.value && typeof param.value === 'string') {
                const tk = translationKeyFromStoredValue(String(param.value));
                if (tk) allGuids.add(tk);
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
        // Add template.id as task-scoped label translation key
        if (t.id && isUuidString(String(t.id))) {
          allGuids.add(makeTranslationKey('task', String(t.id)));
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
            guid: makeTranslationKey('task', String(t.id)),
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
        if (dematerializedTemplates.some(t => t.id && makeTranslationKey('task', String(t.id)) === guid)) {
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

      setSaveDecisionMade(true);
      setIsSaving(false);
      setShowSaveDialog(false);

    } catch (error) {
      console.error('[handleSaveToFactory] ❌ Error:', error);
      alert(`Error saving to Factory: ${error instanceof Error ? error.message : String(error)}`);
      setIsSaving(false);
    }
  }, [wizardIntegrationProp, taskTree, generalizedLabel, taskMeta, currentProjectId, setSaveDecisionMade, setIsSaving, setShowSaveDialog]);


  // ✅ NEW: Handler to cancel save dialog
  const handleCancelSaveDialog = React.useCallback(() => {
    setShowSaveDialog(false);
  }, []);

  // Close always proceeds to core persistence/tab logic; save-location choice is not a hard gate.
  const handleEditorCloseWithTutor = React.useCallback(async (): Promise<boolean> => {
    return handleEditorClose();
  }, [handleEditorClose]);

  // ✅ NEW: Calcola mainViewMode in base a taskWizardMode, wizardMode e showMessageReview/showSynonyms
  // ✅ IMPORTANTE: Questo useMemo deve venire DOPO la dichiarazione di wizardIntegrationProp
  const mainViewMode = React.useMemo<MainViewMode>(() => {
    // ✅ NEW: Se wizard è completato, passa a BEHAVIOUR (auto-chiusura)
    if ((taskWizardMode === 'full' || taskWizardMode === 'adaptation') && wizardIntegrationProp?.wizardMode === 'completed') {
      return MainViewMode.BEHAVIOUR;
    }

    // ✅ NEW: Show wizard for both 'full' and 'adaptation' modes
    if (taskWizardMode === 'full' || taskWizardMode === 'adaptation') {
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

  const [dockPromoteBusy, setDockPromoteBusy] = React.useState(false);

  const handlePromoteAfterStandalone = React.useCallback(async () => {
    const id = taskMeta?.id;
    if (!id || !currentProjectId) {
      return;
    }
    const { materializeTaskFromRepository } = await import('@utils/MaterializationOrchestrator');
    const built = await materializeTaskFromRepository(id, currentProjectId);
    if (built?.taskTree) {
      useTaskTreeStore.getState().setTaskTree(built.taskTree);
    } else {
      useTaskTreeStore.getState().incrementVersion();
    }
    window.alert('Promoted to project template. This row is now an instance.');
  }, [taskMeta?.id, currentProjectId]);

  const taskKindTitleBadge = React.useMemo(
    () => (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <TaskKindBadge taskId={taskMeta?.id} refreshToken={taskTreeFromStore} />
        {taskWizardMode === 'none' ? (
          <PromoteStandaloneToTemplateButton
            taskId={taskMeta?.id}
            projectId={currentProjectId}
            refreshToken={taskTreeFromStore}
            onPromoted={handlePromoteAfterStandalone}
          />
        ) : null}
      </span>
    ),
    [taskMeta?.id, taskTreeFromStore, taskWizardMode, currentProjectId, handlePromoteAfterStandalone]
  );

  /** Dock tab strip: show task kind next to tab title when hideHeader (no inner EditorHeader). */
  const taskKindDockToolbarItem = React.useMemo((): ToolbarButton | null => {
    const id = taskMeta?.id;
    if (!id) return null;
    const task = taskRepository.getTask(id);
    return {
      label: taskKindLabel(inferTaskKind(task)),
      disabled: true,
      position: 'title-suffix',
      title:
        'Task row role (inferred for legacy rows). See docs/task-model-migration-step1-spec.md',
    };
  }, [taskMeta?.id, taskTreeFromStore]);

  /** Dock tab strip: Promote to template when header is hidden (same rules as PromoteStandaloneToTemplateButton). */
  const promoteDockToolbarItem = React.useMemo((): ToolbarButton | null => {
    if (!hideHeader) {
      return null;
    }
    if (taskWizardMode !== 'none') {
      return null;
    }
    const id = taskMeta?.id;
    if (!id || !currentProjectId) {
      return null;
    }
    if (!canPromoteStandaloneToProjectTemplateMvp(taskRepository.getTask(id))) {
      return null;
    }
    return {
      label: dockPromoteBusy ? '…' : 'Promote',
      title:
        'Save structure as project template; this row becomes an instance. Requires GUID ids on every node.',
      position: 'title-suffix',
      disabled: dockPromoteBusy,
      onClick: () => {
        void (async () => {
          if (!id || !currentProjectId || dockPromoteBusy) {
            return;
          }
          setDockPromoteBusy(true);
          try {
            await promoteStandaloneToProjectTemplate(id, currentProjectId);
            await handlePromoteAfterStandalone();
          } catch (e) {
            window.alert(e instanceof Error ? e.message : String(e));
          } finally {
            setDockPromoteBusy(false);
          }
        })();
      },
    };
  }, [
    hideHeader,
    taskWizardMode,
    taskMeta?.id,
    currentProjectId,
    taskTreeFromStore,
    handlePromoteAfterStandalone,
    dockPromoteBusy,
  ]);

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

  // PR1: sidebar usa sempre la pipeline manuale (TaskTree Zustand).
  // wizardDataSchema non contiene più struttura.

  // ✅ ARCHITECTURE: sidebarElement — deprecated, always undefined
  // The full layout (including wizard) is now rendered via normalEditorLayoutElement for ALL modes.
  // mainViewMode=WIZARD handles the CenterPanel rendering when taskWizardMode === 'adaptation' or 'full'.
  const sidebarElement = undefined;

  // ✅ ARCHITECTURE: Memoize normalEditorLayout to prevent reference changes
  // ✅ REFACTORED: Render per TUTTI i modi (none, full, adaptation)
  // Il wizard viene gestito tramite mainViewMode nel MainContentArea
  // In adaptation mode: mainViewMode=WIZARD → MainContentArea renderizza CenterPanel con WizardContext
  const normalEditorLayoutElement = React.useMemo(() => {
    // ✅ FIX: NON ritornare null per adaptation mode
    // Il `sidebarElement` era dead code (passato come `sidebar` ma mai renderizzato da ResponseEditorContent)
    // La corretta architettura è: normalEditorLayout sempre presente, mainViewMode controlla cosa viene mostrato

    return (
      <ResponseEditorNormalLayout
        mainList={mainList}
        // ✅ REMOVED: taskTree, task, currentProjectId - now from Context
        localTranslations={localTranslations}
        escalationTasks={escalationTasks}
        selectedMainIndex={selectedMainIndex}
        selectedSubIndex={selectedSubIndex}
        selectedPath={selectedPath}
        handleSelectByPath={handleSelectByPath}
        selectedRoot={selectedRoot}
        selectedNode={selectedNode}
        selectedNodePath={selectedNodePath}
        handleSelectMain={handleSelectMain}
        handleSelectSub={handleSelectSub}
        handleSelectAggregator={handleSelectAggregator}
        sidebarRef={sidebarRef}
        onChangeSubRequired={sidebar.onChangeSubRequired}
        onReorderSub={sidebar.onReorderSub}
        onReorderMain={sidebar.onReorderMain}
        onAddChildAtPath={sidebar.onAddChildAtPath}
        onReorderAtPath={sidebar.onReorderAtPath}
        onRenameAtPath={sidebar.onRenameAtPath}
        onDeleteAtPath={sidebar.onDeleteAtPath}
        onChangeRequiredAtPath={sidebar.onChangeRequiredAtPath}
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
        // ✅ NEW: Passa viewMode per Behaviour
        viewMode={viewModeProp}
        onViewModeChange={onViewModeChangeProp}
        onStartWizard={onStartWizard}
      />
    );
  }, [
    taskWizardMode,
    mainViewMode,
    wizardProps,
    onStartWizard,
    mainList,
    taskTree,
    taskMeta,
    currentProjectId,
    localTranslations,
    escalationTasks,
    selectedMainIndex,
    selectedSubIndex,
    selectedPath,
    handleSelectByPath,
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
    setLeftPanelMode, // ✅ NEW: Destructure setter for navigation context
    testPanelMode,
    tasksPanelMode,
    setTasksPanelMode, // ✅ NEW: Destructure setter for navigation context
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

  // Dock tab (hideHeader): task kind + promote, then main toolbar (Manuale/Wizard live in banner + center card).
  React.useEffect(() => {
    if (hideHeader && onToolbarUpdate) {
      const prefix = [taskKindDockToolbarItem, promoteDockToolbarItem].filter(
        (b): b is ToolbarButton => b != null
      );
      onToolbarUpdate([...prefix, ...toolbarButtons], 'orange');
    }
  }, [
    hideHeader,
    onToolbarUpdate,
    toolbarButtons,
    taskKindDockToolbarItem,
    promoteDockToolbarItem,
  ]);

  // ✅ LOG: Verification log for debugging (moved to useEffect to keep render pure)
  // ✅ FIX: Use only primitive dependencies to prevent loop
  const hasNormalEditorLayoutElement = normalEditorLayoutElement !== null;
  const hasSidebarElement = sidebarElement != null; // ✅ FIX: Use != to check both null and undefined
  const toolbarButtonsCount = toolbarButtons.length;
  const shouldShowHeader = !hideHeader && taskWizardMode === 'none';
  React.useEffect(() => {
    if (taskWizardMode === 'full') {
      // Layout check (silent)
    }
  }, [taskWizardMode, hasNormalEditorLayoutElement, hasSidebarElement, toolbarButtonsCount, shouldShowHeader]);

  // ✅ NEW: Wrap content in Context Providers
  const content = (
    <div
      ref={rootRef}
      className={combinedClass}
      data-response-editor="true" // ✅ Aggiungi attributo per identificare ResponseEditor
      style={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flex: 1,
        minHeight: 0,
        pointerEvents: 'auto', // ✅ Assicura che blocchi gli eventi mouse
      }}
      onMouseMove={(e) => {
        // Let mousemove reach `window` while dragging sidebar or right-panel splitters
        // (those hooks use window listeners; stopPropagation here blocks bubbling to window).
        if (!isDraggingSidebar && draggingPanel == null) {
          e.stopPropagation();
        }
      }}
      onMouseEnter={(e) => {
        // ✅ Blocca la propagazione quando il mouse entra nel ResponseEditor
        e.stopPropagation();
      }}
    >
      {!hideHeader && (
        <HeaderWithDynamicToolbar
          icon={<Icon size={18} style={{ color: iconColor }} />}
          title={headerTitle}
          titleBadge={taskKindTitleBadge}
          toolbarButtons={toolbarButtons}
          onClose={handleEditorCloseWithTutor}
          color="orange"
        />
      )}

      <ResponseEditorContent
        showContractWizard={showContractWizard}
        needsIntentMessages={needsIntentMessages}
        handleContractWizardClose={handleContractWizardClose}
        handleContractWizardNodeUpdate={handleContractWizardNodeUpdate}
        handleContractWizardComplete={handleContractWizardComplete}
        onIntentMessagesComplete={handleIntentMessagesComplete}
        taskWizardMode={taskWizardMode}
        needsTaskContextualization={needsTaskContextualization}
        needsTaskBuilder={needsTaskBuilder}
        templateId={contextualizationTemplateId || undefined}
        sidebar={taskWizardMode === 'adaptation' ? sidebarElement : undefined}
        onTaskContextualizationComplete={onTaskContextualizationComplete}
        onTaskBuilderComplete={onTaskBuilderComplete}
        onTaskBuilderCancel={onTaskBuilderCancel}
        normalEditorLayout={normalEditorLayoutElement}
      />

      {/* ✅ FIX: TaskDragLayer only rendered when taskWizardMode === 'none' */}
      {taskWizardMode === 'none' && <TaskDragLayer />}
      {serviceUnavailable && taskWizardMode !== 'full' && (
        <ServiceUnavailableModal
          serviceUnavailable={serviceUnavailable}
          onClose={() => setServiceUnavailable(null)}
        />
      )}

      <SaveLocationDialog
        isOpen={showSaveDialog}
        onClose={() => {
          setShowSaveDialog(false);
        }}
        onSaveToFactory={handleSaveToFactory}
        onCancel={handleCancelSaveDialog}
        anchorRef={saveToLibraryButtonRef}
        isSaving={isSaving} // ✅ NEW: Pass saving state to dialog
        responseEditorRef={rootRef} // ✅ NEW: Pass ResponseEditor container ref for positioning
      />
    </div>
  );

  // ✅ B1: WizardContext.Provider moved to ResponseEditorInner
  // ✅ Only ResponseEditorContext.Provider remains here
  // ✅ NEW: ResponseEditorNavigationProvider for programmatic navigation
  // ✅ NEW: HeaderToolbarProvider for dynamic toolbar injection from inline editors
  return (
    <ResponseEditorContext.Provider value={responseEditorContextValue}>
      <HeaderToolbarProvider>
        <ResponseEditorNavigationProvider
          setLeftPanelMode={setLeftPanelMode}
          setTasksPanelMode={setTasksPanelMode}
        >
          {content}
        </ResponseEditorNavigationProvider>
      </HeaderToolbarProvider>
    </ResponseEditorContext.Provider>
  );
}
