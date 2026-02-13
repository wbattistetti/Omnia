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
  const generalizationReasonEffective = wizardIntegrationProp?.generalizationReason ?? null;

  // ✅ NEW: ResponseEditorContext value (calculated from props received from ResponseEditorInner)
  // taskLabel comes ONLY from useResponseEditorCore (single source of truth)
  // If empty, it means useResponseEditorCore hasn't processed taskMeta yet (first render)
  // Components should handle this by showing loading UI, NOT by using fallbacks
  const responseEditorContextValue = React.useMemo(() => ({
    taskTree,
    taskMeta,
    taskLabel: taskLabel || '', // ✅ SINGLE SOURCE: from useResponseEditorCore - empty string if not available yet
    taskId: taskMeta?.id,
    currentProjectId,
    headerTitle,
    taskType,
  }), [taskTree, taskMeta, taskLabel, currentProjectId, headerTitle, taskType]);

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

  // ✅ FIX: Handler to save to Factory with loading state and dematerialization filter
  const handleSaveToFactory = React.useCallback(async () => {
    if (!shouldBeGeneral || !wizardIntegrationProp) {
      return;
    }

    setIsSaving(true);

    try {
      // Get all templates from DialogueTaskService cache
      const templates = DialogueTaskService.getAllTemplates();

      // ✅ FIX: Raccogli TUTTI i nodi (root + sub-nodi) ricorsivamente
      // Ogni nodo corrisponde a un task con: steps, contract, constraints, subTasksIds
      const collectAllNodeIds = (nodes: typeof wizardIntegrationProp.dataSchema): string[] => {
        const ids: string[] = [];
        if (!nodes) return ids;
        for (const node of nodes) {
          const nodeId = node.templateId || node.id;
          ids.push(nodeId);
          console.log('[handleSaveToFactory] 🔍 Collecting node ID', {
            nodeLabel: node.label,
            nodeId,
            templateId: node.templateId,
            id: node.id,
            hasSubNodes: !!node.subNodes,
            subNodesCount: node.subNodes?.length,
          });
          if (node.subNodes && node.subNodes.length > 0) {
            ids.push(...collectAllNodeIds(node.subNodes));
          }
        }
        return ids;
      };

      const allWizardNodeIds = new Set(collectAllNodeIds(wizardIntegrationProp.dataSchema));

      console.log('[handleSaveToFactory] 📊 Collected node IDs', {
        totalNodes: allWizardNodeIds.size,
        nodeIds: Array.from(allWizardNodeIds),
        dataSchemaLength: wizardIntegrationProp.dataSchema?.length,
        rootNode: wizardIntegrationProp.dataSchema?.[0] ? {
          label: wizardIntegrationProp.dataSchema[0].label,
          id: wizardIntegrationProp.dataSchema[0].id,
          templateId: wizardIntegrationProp.dataSchema[0].templateId,
        } : null,
      });

      console.log('[handleSaveToFactory] 📊 Templates in cache', {
        totalTemplates: templates.length,
        templateIds: templates.map(t => t.id || t._id),
        templateLabels: templates.map(t => t.label),
      });

      // ✅ FIX: Filtra template che corrispondono a QUALSIASI nodo (root o sub-nodo)
      // Ogni nodo = un task separato con i suoi step, contract, constraints, subTasksIds
      const wizardTemplates = templates.filter(t => {
        const templateId = t.id || t._id;
        const matches = allWizardNodeIds.has(templateId);
        if (matches) {
          console.log('[handleSaveToFactory] ✅ Template matches', {
            templateId,
            label: t.label,
            hasSubTasksIds: !!t.subTasksIds,
            subTasksIds: t.subTasksIds,
          });
        }
        return matches;
      });

      console.log('[handleSaveToFactory] 📊 Filtered wizard templates', {
        count: wizardTemplates.length,
        templates: wizardTemplates.map(t => ({
          id: t.id || t._id,
          label: t.label,
          hasSubTasksIds: !!t.subTasksIds,
          subTasksIds: t.subTasksIds,
        })),
      });

      if (wizardTemplates.length === 0) {
        console.warn('[ResponseEditorLayout] ⚠️ No templates found to save to Factory');
        setIsSaving(false);
        return;
      }

      // ✅ FIX: Create a map of original ID -> saved template ID for sub-tasks
      // This ensures subTasksIds contains the actual IDs of saved templates (GUIDs), not simple names
      const templateIdMap = new Map<string, string>();
      wizardTemplates.forEach(t => {
        const originalId = t.id || t._id;
        // The saved template will have the same ID (or _id if MongoDB generates one)
        // For now, we use the original ID, but we'll update subTasksIds after saving
        templateIdMap.set(originalId, originalId);
      });

      // ✅ FIX: Dematerialize templates - remove any materialized fields (nodes, subNodes, data)
      // Templates should only contain references (subTasksIds), not materialized children
      // ✅ NEW: Remove 'name' field - templates are identified by 'id' only
      const templatesToSave = wizardTemplates.map(t => {
        // ✅ FIX: Rimuovi _id, nodes, subNodes, data, createdAt, name (campi che non devono essere salvati)
        const { _id, nodes, subNodes, data, createdAt, name, ...templateFields } = t;

        const isRoot = generalizedLabel && wizardIntegrationProp.dataSchema?.[0]?.id === (t.id || t._id);

        if (isRoot) {
          // Root template: use generalizedLabel for label
          // ✅ FIX: Map subTasksIds to actual template IDs (GUIDs, not simple names)
          const originalSubTasksIds = templateFields.subTasksIds || [];
          const mappedSubTasksIds = originalSubTasksIds.map((subId: string) => {
            // Find the corresponding template
            const subTemplate = wizardTemplates.find(st => (st.id || st._id) === subId);
            if (subTemplate) {
              // Use the template's ID (which should be a GUID or the actual ID)
              const mappedId = subTemplate.id || subTemplate._id;
              const isGuid = mappedId.startsWith('node-') || mappedId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
              console.log('[handleSaveToFactory] 🔄 Mapping subTaskId', {
                originalId: subId,
                mappedId,
                isGuid,
                subTemplateLabel: subTemplate.label,
              });
              if (!isGuid) {
                console.warn('[handleSaveToFactory] ⚠️ Sub-task ID is not a GUID', {
                  subId,
                  mappedId,
                  subTemplateLabel: subTemplate.label,
                  message: 'Sub-task should have GUID ID, not simple name. This may cause issues when loading templates.',
                });
              }
              return mappedId;
            }
            // If not found, keep original (should not happen)
            console.warn('[handleSaveToFactory] ⚠️ Sub-task template not found for ID', { subId });
            return subId;
          });

          const rootTemplate = {
            ...templateFields,
            // ✅ REMOVED: name field - templates are identified by id only
            label: generalizedLabel,  // Keep full generalized label for display
            subTasksIds: mappedSubTasksIds.length > 0 ? mappedSubTasksIds : undefined,
          };
          console.log('[handleSaveToFactory] ✅ Root template prepared for save', {
            originalId: t.id || t._id,
            originalLabel: t.label,
            generalizedLabel,
            newLabel: rootTemplate.label,  // ✅ Uses full generalized label for display
            originalSubTasksIds,
            mappedSubTasksIds,
            hasSubTasksIds: !!rootTemplate.subTasksIds,
            subTasksIds: rootTemplate.subTasksIds,
          });
          return rootTemplate;
        }

        console.log('[handleSaveToFactory] ✅ Sub-task template prepared for save', {
          id: t.id || t._id,
          label: t.label,
          hasSubTasksIds: !!t.subTasksIds,
          subTasksIds: t.subTasksIds,
          // ✅ REMOVED: name field - templates are identified by id only
        });
        return templateFields;
      });

      console.log('[handleSaveToFactory] 📦 Final templates to save', {
        count: templatesToSave.length,
        templates: templatesToSave.map(t => ({
          id: t.id,
          label: t.label,
          hasSubTasksIds: !!t.subTasksIds,
          subTasksIds: t.subTasksIds,
          isRoot: generalizedLabel && wizardIntegrationProp.dataSchema?.[0]?.id === (t.id || t._id),
          // ✅ REMOVED: name field - templates are identified by id only
        })),
        rootTemplate: templatesToSave.find(t =>
          generalizedLabel && wizardIntegrationProp.dataSchema?.[0]?.id === (t.id || t._id)
        ) ? {
          id: templatesToSave.find(t =>
            generalizedLabel && wizardIntegrationProp.dataSchema?.[0]?.id === (t.id || t._id)
          )?.id,
          name: templatesToSave.find(t =>
            generalizedLabel && wizardIntegrationProp.dataSchema?.[0]?.id === (t.id || t._id)
          )?.name,
          label: templatesToSave.find(t =>
            generalizedLabel && wizardIntegrationProp.dataSchema?.[0]?.id === (t.id || t._id)
          )?.label,
        } : null,
      });

      // ✅ Save templates to Factory DB in bulk (faster)
      console.log('[handleSaveToFactory] 📤 Sending templates to backend', {
        count: templatesToSave.length,
        payload: templatesToSave.map(t => ({
          id: t.id,
          label: t.label,
        })),
      });

      const response = await fetch('/api/factory/dialogue-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templatesToSave)
      });

      if (response.ok) {
        console.log('[ResponseEditorLayout] ✅ Templates saved to Factory', {
          templatesCount: templatesToSave.length,
          generalizedLabel,
          templatesStructure: templatesToSave.map(t => ({
            id: t.id,
            label: t.label,
            hasSubTasksIds: !!t.subTasksIds,
            subTasksIdsCount: t.subTasksIds?.length || 0,
            hasSteps: !!t.steps,
            hasConstraints: !!t.constraints,
            hasNodes: 'nodes' in t,
            hasSubNodes: 'subNodes' in t,
            hasData: 'data' in t
          }))
        });

        // ✅ NEW: Save translations for all templates (type: LABEL, projectId: null)
        // Get current IDE language
        const currentLanguage = (() => {
          try {
            return (localStorage.getItem('project.lang') || 'it') as 'it' | 'en' | 'pt';
          } catch {
            return 'it';
          }
        })();

        // Prepare translations array: one translation per template
        const translationsToSave = templatesToSave
          .filter(t => t.id && t.label) // Only templates with id and label
          .map(t => ({
            guid: t.id!,
            language: currentLanguage,
            text: t.label || '',
            type: TranslationType.LABEL,
            projectId: null, // ✅ CRITICAL: IDE translations have projectId: null
          }));

        if (translationsToSave.length > 0) {
          console.log('[handleSaveToFactory] 📝 Saving translations', {
            count: translationsToSave.length,
            language: currentLanguage,
            translations: translationsToSave.map(t => ({
              guid: t.guid,
              text: t.text,
            })),
          });

          const translationResponse = await fetch('/api/factory/template-label-translations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ translations: translationsToSave }),
          });

          if (translationResponse.ok) {
            console.log('[handleSaveToFactory] ✅ Translations saved to Factory');
          } else {
            const errorText = await translationResponse.text();
            console.error('[handleSaveToFactory] ⚠️ Failed to save translations:', errorText);
            // Don't throw - template save succeeded, translation save is secondary
          }
        }

        // ✅ Reload Factory templates cache immediately
        await DialogueTaskService.reloadFactoryTemplates();
        console.log('[ResponseEditorLayout] ✅ Factory templates cache reloaded');

        setSaveDecision('factory');
        setSaveDecisionMade(true);
        // ✅ FIX: Close dialog only after saving is complete (in finally block)
        // Don't close here - let finally block handle it
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to save to Factory: ${response.status} ${errorText}`);
      }
    } catch (error) {
      console.error('[ResponseEditorLayout] ❌ Error saving to Factory:', error);
      alert(`Error saving to Factory: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      // ✅ FIX: Close dialog and reset saving state in finally block
      // This ensures spinner is visible during the entire save operation
      setIsSaving(false);
      setShowSaveDialog(false);
    }
  }, [wizardIntegrationProp, shouldBeGeneral, generalizedLabel]);

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

  // ✅ NEW: State for saving operation
  const [isSaving, setIsSaving] = React.useState(false);

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
        onSaveToProject={handleSaveToProject}
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
    </ResponseEditorContext.Provider>
  );
}
