import React from 'react';
import { Undo2, Redo2, MessageSquare, Rocket, BookOpen, List, CheckSquare, Wand2, Star, LayoutGrid, TreePine } from 'lucide-react';
import { RightPanelMode } from './RightPanel';
import { useWizardContext } from '@responseEditor/context/WizardContext';
import { useGlobalTestPanel } from '@context/GlobalTestPanelContext';
import { useResponseEditorContextSafe } from '@hooks/useResponseEditorContextSafe';
import { useProjectTranslations } from '@context/ProjectTranslationsContext';
import { openLateralChatPanel } from '@components/AppContent/infrastructure/docking/DockingHelpers';
import { scheduleDockLayoutRefresh } from '@utils/scheduleDockLayoutRefresh';
import type { DockTabChat } from '@dock/types';

interface ResponseEditorToolbarProps {
  rightMode: RightPanelMode; // Per compatibilità
  leftPanelMode: RightPanelMode; // Nuovo: stato separato per pannello sinistro
  testPanelMode: RightPanelMode; // Nuovo: stato separato per pannello Test
  tasksPanelMode: RightPanelMode; // Nuovo: stato separato per pannello Tasks
  showSynonyms: boolean;
  showMessageReview: boolean;
  onRightModeChange: (mode: RightPanelMode) => void;
  onLeftPanelModeChange: (mode: RightPanelMode) => void; // Nuovo handler
  onTestPanelModeChange: (mode: RightPanelMode) => void; // Nuovo handler
  onTasksPanelModeChange: (mode: RightPanelMode) => void; // Nuovo handler
  onToggleSynonyms: () => void;
  onToggleMessageReview: () => void;
  rightWidth?: number;
  onRightWidthChange?: (width: number) => void;
  testPanelWidth?: number;
  onTestPanelWidthChange?: (width: number) => void;
  tasksPanelWidth?: number;
  onTasksPanelWidthChange?: (width: number) => void;
  // ✅ NEW: Wizard handlers
  onChooseFromLibrary?: () => void;
  onGenerateNewTask?: () => void;
  onOpenSaveDialog?: () => void;
  /** Anchor for the Factory save-location popover. */
  saveToLibraryButtonRef?: React.RefObject<HTMLButtonElement>;
  // ✅ NEW: Task data for test panel (optional - can come from context or props)
  taskTree?: any;
  taskMeta?: any;
  currentProjectId?: string | null;
  // ✅ NEW: Dock tree setter for opening chat panel as dockable tab
  setDockTree?: (updater: (prev: any) => any) => void;
  // ✅ NEW: View mode for Behaviour (tabs or tree)
  viewMode?: 'tabs' | 'tree';
  onViewModeChange?: (mode: 'tabs' | 'tree') => void;
}

/**
 * Hook that returns toolbar buttons configuration for ResponseEditor.
 * Provides buttons for editor actions and panel toggles.
 */
export function useResponseEditorToolbar({
  rightMode, // Per compatibilità
  leftPanelMode, // Nuovo
  testPanelMode, // Nuovo
  tasksPanelMode, // Nuovo
  showSynonyms,
  showMessageReview,
  onRightModeChange,
  onLeftPanelModeChange, // Nuovo
  onTestPanelModeChange, // Nuovo
  onTasksPanelModeChange, // Nuovo
  onToggleSynonyms,
  onToggleMessageReview,
  rightWidth = 360,
  onRightWidthChange,
  testPanelWidth = 360,
  onTestPanelWidthChange,
  tasksPanelWidth = 360,
  onTasksPanelWidthChange,
  // ✅ NEW: Wizard handlers
  onChooseFromLibrary,
  onGenerateNewTask,
  onOpenSaveDialog,
  saveToLibraryButtonRef,
  // ✅ NEW: Task data for test panel (optional - can come from context or props)
  taskTree: taskTreeProp,
  taskMeta: taskMetaProp,
  currentProjectId: currentProjectIdProp,
  // ✅ NEW: Dock tree setter for opening chat panel as dockable tab
  setDockTree,
  // ✅ NEW: View mode for Behaviour
  viewMode: externalViewMode,
  onViewModeChange,
}: ResponseEditorToolbarProps) {
  // ✅ View mode: usa esterno se fornito, altrimenti stato interno
  const [internalViewMode, setInternalViewMode] = React.useState<'tabs' | 'tree'>('tabs');
  const viewMode = externalViewMode ?? internalViewMode;
  const setViewMode = onViewModeChange ?? setInternalViewMode;

  // ✅ CRITICAL: Hooks devono essere chiamati PRIMA di qualsiasi return condizionale
  // ✅ NEW: Get global test panel and context data (MUST be at the top - hooks rule)
  const { isOpen: isGlobalTestPanelOpen, openWithTask, close: closeGlobalTestPanel } = useGlobalTestPanel();
  const editorContext = useResponseEditorContextSafe(); // ✅ Safe hook that returns null if not available
  const { translations: globalTranslations, isReady: translationsReady, isLoading: translationsLoading, loadAllTranslations } = useProjectTranslations();

  // ✅ Get task data from props (preferred) or context (fallback)
  const taskTree = taskTreeProp || editorContext?.taskTree;
  const taskMeta = taskMetaProp || editorContext?.taskMeta;
  const currentProjectId = currentProjectIdProp || editorContext?.currentProjectId;

  const projectLocale = React.useMemo(() => {
    // Extract locale from project or default to 'it-IT'
    // TODO: Get from project context if available
    return 'it-IT';
  }, []);


  // ✅ Guard to prevent double-opening of chat panel (React StrictMode in dev)
  // ✅ REMOVED: openingChatRef - no longer needed, openLateralChatPanel is idempotent

  // ✅ Test è un toggle indipendente per mostrare/nascondere il pannello debugger
  // Salva la larghezza precedente per ripristinarla quando riapri
  const previousTestWidthRef = React.useRef<number>(testPanelWidth);
  const COLLAPSED_WIDTH = 1; // Larghezza minima per collassare (quasi invisibile)

  // ✅ Aggiorna previousTestWidthRef quando testPanelWidth cambia (ma solo se non è il collasso)
  React.useEffect(() => {
    if (testPanelWidth > COLLAPSED_WIDTH) {
      previousTestWidthRef.current = testPanelWidth;
    }
  }, [testPanelWidth]);

  // ✅ Tasks è un toggle indipendente per mostrare/nascondere il pannello dei task
  const previousTasksWidthRef = React.useRef<number>(tasksPanelWidth);
  const COLLAPSED_WIDTH_TASKS = 1;

  React.useEffect(() => {
    if (tasksPanelWidth > COLLAPSED_WIDTH_TASKS) {
      previousTasksWidthRef.current = tasksPanelWidth;
    }
  }, [tasksPanelWidth]);

  // NOTE: TaskWizard is now external, so no need to hide toolbar during wizard

  const handleRightModeChange = (mode: RightPanelMode) => {
    // Close both panels when changing right mode
    if (showSynonyms) onToggleSynonyms();
    if (showMessageReview) onToggleMessageReview();
    onRightModeChange(mode);
  };

  // ✅ Handler mutualmente esclusivi per i primi 3 pulsanti (Behaviour, Personality, Recognition)
  // ✅ Usano leftPanelMode invece di rightMode per non interferire con Test
  const handleBehaviourClick = () => {
    // Open-only behavior: clicking "Dialogue Steps" must always open Behaviour
    // and preserve the current view mode (tabs/tree) already chosen by the user.
    if (showSynonyms) onToggleSynonyms();
    if (showMessageReview) onToggleMessageReview();
    if (leftPanelMode !== 'actions') {
      onLeftPanelModeChange('actions'); // Usa leftPanelMode invece di rightMode
    }
  };

  const handlePersonalityClick = () => {
    // Se già attivo, deseleziona chiudendo tutto
    if (showMessageReview) {
      onToggleMessageReview();
      if (leftPanelMode === 'actions') onLeftPanelModeChange('none');
    } else {
      // Altrimenti seleziona Personality e chiudi gli altri due (ma non Test)
      if (showSynonyms) onToggleSynonyms();
      if (leftPanelMode === 'actions') onLeftPanelModeChange('none');
      onToggleMessageReview();
    }
  };

  const handleRecognitionClick = () => {
    // Se già attivo, deseleziona chiudendo tutto
    if (showSynonyms) {
      onToggleSynonyms();
      if (leftPanelMode === 'actions') onLeftPanelModeChange('none');
    } else {
      // Altrimenti seleziona Recognition e chiudi gli altri due (ma non Test)
      if (showMessageReview) onToggleMessageReview();
      if (leftPanelMode === 'actions') onLeftPanelModeChange('none');
      onToggleSynonyms();
    }
  };

  const handleTestClick = () => {
    // ✅ Log rimosso: troppo verboso

    // ✅ NEW: Use dockable chat panel if setDockTree is available, otherwise fallback to global test panel
    if (setDockTree) {
      // Close global test panel if open (to avoid confusion)
      if (isGlobalTestPanelOpen) {
        closeGlobalTestPanel();
      }

      // Open as dockable tab
      if (!taskTree || !taskMeta || !currentProjectId) {
        console.error('[Toolbar] ❌ Cannot open chat panel: missing task data', {
          hasTaskTree: !!taskTree,
          hasTaskMeta: !!taskMeta,
          hasProjectId: !!currentProjectId,
        });
        return;
      }

      // ✅ CRITICAL: Ensure translations are loaded before opening chat panel
      // If translations are not ready, wait for them or trigger loading
      if (!translationsReady && !translationsLoading && loadAllTranslations) {
        console.log('[Toolbar] ⏳ Translations not ready, loading...', {
          translationsCount: Object.keys(globalTranslations || {}).length,
          isReady: translationsReady,
          isLoading: translationsLoading
        });
        // Trigger loading and wait for it to complete
        loadAllTranslations().then(() => {
          // Retry opening chat panel after translations are loaded
          console.log('[Toolbar] ✅ Translations loaded, retrying chat panel open');
          // Recursively call handleTestClick to retry
          handleTestClick();
        }).catch((err) => {
          console.error('[Toolbar] ❌ Failed to load translations', err);
        });
        return;
      }

      // If translations are still loading, wait a bit and retry
      if (translationsLoading) {
        console.log('[Toolbar] ⏳ Translations are loading, waiting...');
        setTimeout(() => {
          handleTestClick();
        }, 500);
        return;
      }

      // ✅ CRITICAL: Get translations from context (must be ready by now)
      let allTranslations = globalTranslations || {};

      // ✅ NO FALLBACK: Translations must be loaded by design
      // If translations are still empty after loading, this is a structural error
      if (!allTranslations || Object.keys(allTranslations).length === 0) {
        console.error('[Toolbar] ❌ ERROR: Translations are empty after loading - this is a structural error', {
          translationsReady,
          translationsLoading,
          translationsCount: Object.keys(globalTranslations || {}).length
        });
        alert('Translations are not available. Please ensure the project has translations loaded.');
        return;
      }

      // ✅ CRITICAL: Filter runtime translations BEFORE passing to chat tab (must work by design)
      // Extract GUIDs from TaskTree.steps
      const runtimeGuids = new Set<string>();
      if (taskTree?.steps && typeof taskTree.steps === 'object') {
        // ✅ Log rimosso: troppo verboso

        // Import extractGuidsFromSteps function (same logic as DDEBubbleChat)
        const extractGuidsFromSteps = (steps: Record<string, any>, guids: Set<string>) => {
          const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          let extractedCount = 0;
          let debugInfo: any[] = [];

          for (const [templateId, stepDict] of Object.entries(steps)) {
            if (!stepDict || typeof stepDict !== 'object') {
              debugInfo.push({ templateId, reason: 'stepDict is null or not object', stepDict });
              continue;
            }

            if (Array.isArray(stepDict)) {
              for (const step of stepDict) {
                if (step?.escalations && Array.isArray(step.escalations)) {
                  for (const escalation of step.escalations) {
                    if (escalation.tasks && Array.isArray(escalation.tasks)) {
                      for (const taskItem of escalation.tasks) {
                        if (taskItem.parameters && Array.isArray(taskItem.parameters)) {
                          const textParam = taskItem.parameters.find((p: any) =>
                            p?.parameterId === 'text' || p?.key === 'text'
                          );
                          if (textParam?.value && guidPattern.test(textParam.value)) {
                            guids.add(textParam.value);
                            extractedCount++;
                            debugInfo.push({ templateId, source: 'array-step-parameter', guid: textParam.value });
                          } else if (textParam?.value) {
                            debugInfo.push({ templateId, source: 'array-step-parameter', value: textParam.value, isGuid: false });
                          }
                        }
                        if (taskItem.id && guidPattern.test(taskItem.id)) {
                          guids.add(taskItem.id);
                          extractedCount++;
                          debugInfo.push({ templateId, source: 'array-step-taskId', guid: taskItem.id });
                        }
                      }
                    }
                  }
                }
              }
              continue;
            }

            for (const [stepType, step] of Object.entries(stepDict)) {
              if (!step || typeof step !== 'object') {
                debugInfo.push({ templateId, stepType, reason: 'step is null or not object' });
                continue;
              }

              if (step.escalations && Array.isArray(step.escalations)) {
                for (const escalation of step.escalations) {
                  if (escalation.tasks && Array.isArray(escalation.tasks)) {
                    for (const taskItem of escalation.tasks) {
                      if (taskItem.parameters && Array.isArray(taskItem.parameters)) {
                        const textParam = taskItem.parameters.find((p: any) =>
                          p?.parameterId === 'text' || p?.key === 'text'
                        );
                        if (textParam?.value && guidPattern.test(textParam.value)) {
                          guids.add(textParam.value);
                          extractedCount++;
                          debugInfo.push({ templateId, stepType, source: 'step-parameter', guid: textParam.value });
                        } else if (textParam?.value) {
                          debugInfo.push({ templateId, stepType, source: 'step-parameter', value: textParam.value, isGuid: false });
                        } else if (textParam) {
                          debugInfo.push({ templateId, stepType, source: 'step-parameter', textParam, hasValue: !!textParam.value });
                        }
                      } else {
                        debugInfo.push({ templateId, stepType, source: 'taskItem', hasParameters: !!taskItem.parameters, parametersType: Array.isArray(taskItem.parameters) ? 'array' : typeof taskItem.parameters });
                      }
                      if (taskItem.id && guidPattern.test(taskItem.id)) {
                        guids.add(taskItem.id);
                        extractedCount++;
                        debugInfo.push({ templateId, stepType, source: 'taskId', guid: taskItem.id });
                      }
                    }
                  } else {
                    debugInfo.push({ templateId, stepType, source: 'escalation', hasTasks: !!escalation.tasks, tasksType: Array.isArray(escalation.tasks) ? 'array' : typeof escalation.tasks });
                  }
                }
              } else {
                debugInfo.push({ templateId, stepType, source: 'step', hasEscalations: !!step.escalations, escalationsType: Array.isArray(step.escalations) ? 'array' : typeof step.escalations });
              }
            }
          }

          // ✅ Log rimosso: troppo verboso
        };

        extractGuidsFromSteps(taskTree.steps, runtimeGuids);
      } else {
        console.warn('[Toolbar] ⚠️ taskTree.steps is missing or invalid:', {
          hasTaskTree: !!taskTree,
          hasSteps: !!(taskTree?.steps),
          stepsType: taskTree?.steps ? (Array.isArray(taskTree.steps) ? 'array' : typeof taskTree.steps) : 'undefined'
        });
      }

      // ✅ DEBUG: Also check if GUIDs from translations match extracted GUIDs
      const allTranslationGuids = Object.keys(allTranslations).filter(guid =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(guid)
      );
      const matchingGuids = allTranslationGuids.filter(guid => runtimeGuids.has(guid));
      const missingGuids = allTranslationGuids.filter(guid => !runtimeGuids.has(guid));

      // ✅ Log rimosso: troppo verboso

      // Filter translations: only GUIDs referenced in steps + runtime.* keys
      const runtimeTranslations: Record<string, string> = {};
      for (const [guid, text] of Object.entries(allTranslations)) {
        if (guid.startsWith('runtime.')) {
          runtimeTranslations[guid] = text;
        } else if (runtimeGuids.has(guid)) {
          runtimeTranslations[guid] = text;
        }
      }

      // ✅ Log rimosso: troppo verboso

      // Convert taskMeta to Task format
      const task = {
        id: taskMeta.id || taskMeta._id,
        templateId: taskMeta.templateId || taskMeta.id || taskMeta._id,
        type: taskMeta.type || 1,
        label: taskMeta.label || editorContext?.taskLabel || '',
        ...taskMeta
      };

      // Create chat tab with stable ID (so clicking again activates existing tab)
      const chatTabId = `chat_${task.id}`;
      const chatTab: DockTabChat = {
        id: chatTabId,
        title: `Chat: ${task.label || 'Test'}`,
        type: 'chat',
        task: task as any,
        projectId: currentProjectId,
        translations: runtimeTranslations, // ✅ Pass filtered runtime translations (must work by design)
        taskTree,
        mode: 'interactive',
      };

      // ✅ Log rimosso: troppo verboso

      // ✅ IDEMPOTENT: openLateralChatPanel is idempotent, so multiple calls are safe
      // No guard needed - the function itself handles duplicate calls gracefully
      setDockTree(prev => openLateralChatPanel(prev, {
        tabId: chatTabId,
        newTab: chatTab,
        position: 'right',
      }));
      scheduleDockLayoutRefresh();
    } else {
      // Fallback to global test panel (for backward compatibility)
      if (isGlobalTestPanelOpen) {
        console.log('[Toolbar] 🧪 Closing global test panel');
        closeGlobalTestPanel();
      } else {
        // Open global test panel with task context
        console.log('[Toolbar] 🧪 Task data:', {
          hasTaskTree: !!taskTree,
          hasTaskMeta: !!taskMeta,
          hasProjectId: !!currentProjectId,
          source: taskTreeProp ? 'props' : (editorContext ? 'context' : 'none'),
        });

        if (!taskTree || !taskMeta || !currentProjectId) {
          console.error('[Toolbar] ❌ Cannot open test panel: missing task data');
          return;
        }

        // ✅ CRITICAL: Ensure translations are loaded before opening test panel
        // If translations are not ready, wait for them or trigger loading
        if (!translationsReady && !translationsLoading && loadAllTranslations) {
          console.log('[Toolbar] ⏳ Translations not ready, loading...', {
            translationsCount: Object.keys(globalTranslations || {}).length,
            isReady: translationsReady,
            isLoading: translationsLoading
          });
          // Trigger loading and wait for it to complete
          loadAllTranslations().then(() => {
            // Retry opening test panel after translations are loaded
            // ✅ Log rimosso: troppo verboso
            handleTestClick();
          }).catch((err) => {
            console.error('[Toolbar] ❌ Failed to load translations', err);
          });
          return;
        }

        // If translations are still loading, wait a bit and retry
        if (translationsLoading) {
          console.log('[Toolbar] ⏳ Translations are loading, waiting...');
          setTimeout(() => {
            handleTestClick();
          }, 500);
          return;
        }

        // ✅ CRITICAL: Get translations from context (must be ready by now)
        const translations = globalTranslations || {};

        // ✅ NO FALLBACK: Translations must be loaded by design
        // If translations are still empty after loading, this is a structural error
        if (!translations || Object.keys(translations).length === 0) {
          console.error('[Toolbar] ❌ ERROR: Translations are empty after loading - this is a structural error', {
            translationsReady,
            translationsLoading,
            translationsCount: Object.keys(globalTranslations || {}).length
          });
          alert('Translations are not available. Please ensure the project has translations loaded.');
          return;
        }

        // Convert taskMeta to Task format
        const task = {
          id: taskMeta.id || taskMeta._id,
          templateId: taskMeta.templateId || taskMeta.id || taskMeta._id,
          type: taskMeta.type || 1,
          label: taskMeta.label || editorContext?.taskLabel || '',
          ...taskMeta
        };

        console.log('[Toolbar] 🧪 Opening global test panel with task context');
        openWithTask(task as any, taskTree, currentProjectId, translations);
      }
    }
  };


  const handleTasksClick = () => {
    // Toggle: se è aperto, chiudi e collassa; se è chiuso, apri e espandi
    if (tasksPanelMode === 'actions') {
      // Chiudi Tasks e collassa il pannello
      previousTasksWidthRef.current = tasksPanelWidth;

      if (onTasksPanelWidthChange) {
        onTasksPanelWidthChange(COLLAPSED_WIDTH_TASKS);
      }

      setTimeout(() => {
        onTasksPanelModeChange('none');
      }, 0);
    } else {
      // Apri Tasks e espandi il pannello
      onTasksPanelModeChange('actions');

      if (onTasksPanelWidthChange) {
        const widthToRestore = previousTasksWidthRef.current > COLLAPSED_WIDTH_TASKS ? previousTasksWidthRef.current : 360;
        onTasksPanelWidthChange(widthToRestore);
      }
    }
  };


  // ✅ Handler per toggle view mode
  const handleTreeViewClick = () => {
    if (leftPanelMode !== 'actions') {
      handleBehaviourClick(); // Apri Behaviour se non è già aperto
    }
    setViewMode('tree');
  };

  const handleTabViewClick = () => {
    if (leftPanelMode !== 'actions') {
      handleBehaviourClick(); // Apri Behaviour se non è già aperto
    }
    setViewMode('tabs');
  };

  // ✅ Componente per pulsante composto
  const DialogueStepsCompoundButtonContent = React.useMemo(() => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        height: '100%'
      }}
    >
      <span
        style={{ fontSize: '13px', fontWeight: 500 }}
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          handleBehaviourClick();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            handleBehaviourClick();
          }
        }}
      >
        Dialogue Steps
      </span>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem',
        paddingLeft: '0.5rem',
        borderLeft: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        {/* div+role="button": Dock tab toolbar wraps the row in <button>; nested <button> is invalid HTML */}
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            handleTreeViewClick();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              handleTreeViewClick();
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            border: 'none',
            background: viewMode === 'tree' ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
            borderRadius: '4px',
            cursor: 'pointer',
            color: 'inherit'
          }}
          title="Tree view"
        >
          <TreePine size={14} />
        </div>
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            handleTabViewClick();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              handleTabViewClick();
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            border: 'none',
            background: viewMode === 'tabs' ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
            borderRadius: '4px',
            cursor: 'pointer',
            color: 'inherit'
          }}
          title="Tab view"
        >
          <LayoutGrid size={14} />
        </div>
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        paddingLeft: '0.5rem',
        borderLeft: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            handleTasksClick();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              handleTasksClick();
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0 0.5rem',
            border: 'none',
            background: tasksPanelMode === 'actions' ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
            borderRadius: '4px',
            cursor: 'pointer',
            color: 'inherit',
            fontSize: '13px',
            fontWeight: 500
          }}
          title="View and manage available tasks for the dialogue flow."
        >
          <CheckSquare size={14} />
          <span>Tasks</span>
        </div>
      </div>
    </div>
  ), [viewMode, leftPanelMode, tasksPanelMode, handleTreeViewClick, handleTabViewClick, handleTasksClick]);

  // ✅ Pulsante composto: Dialogue Steps | 🌳 | 📋 | Tasks
  const DialogueStepsCompoundButton: ToolbarButton = {
    icon: DialogueStepsCompoundButtonContent,
    label: undefined, // Icon contiene tutto
    onClick: handleBehaviourClick, // Click principale apre Behaviour
    title: "Define the agent's response flow: prompts, confirmations, error handling, and escalation logic.",
    // Keep highlight exclusive: if another top-level tab is active, Dialogue Steps
    // must visually lose focus even if Behaviour state is still mounted.
    active:
      leftPanelMode === 'actions' &&
      !showSynonyms &&
      !showMessageReview &&
      testPanelMode !== 'chat'
  };

  return [
    { icon: <Undo2 size={16} />, onClick: () => { }, title: "Undo" },
    { icon: <Redo2 size={16} />, onClick: () => { }, title: "Redo" },
    // ✅ Pulsante composto: Dialogue Steps | 🌳 | 📋 | Tasks
    DialogueStepsCompoundButton,
    {
      icon: <BookOpen size={16} />,
      label: "Recognition",
      onClick: handleRecognitionClick,
      title: "Configure rules and models to identify and extract relevant data from user input.",
      active: showSynonyms
    },
    {
      icon: <List size={16} />,
      label: "Personality",
      onClick: handlePersonalityClick,
      title: "Customize the agent's tone, empathy level, and linguistic style to match your target audience.",
      active: showMessageReview
    },
    {
      icon: <MessageSquare size={16} />,
      label: "Test",
      onClick: handleTestClick,
      title: "Simulate and validate the dialogue flow to ensure correct behavior and data recognition. (Frontend materialization)",
      active: testPanelMode === 'chat'
    },
    // ✅ FIX: Pulsante statico sempre presente (come gli altri)
    {
      icon: <Star size={16} />,
      label: "Pubblica in Factory",
      onClick: () => {
        if (onOpenSaveDialog) {
          onOpenSaveDialog();
        }
      },
      title: "Salva il template nella libreria globale (Factory), condivisa tra i progetti",
      primary: true,
      active: false,
      buttonId: "save-to-library",
      buttonRef: saveToLibraryButtonRef,
    },
    // ✅ NEW: Magic wand button with dropdown (always visible, at the end before X)
    {
      icon: <Wand2 size={16} />,
      label: undefined, // Icon only
      onClick: () => {}, // Handled by dropdown
      title: "Task creation options",
      active: false,
      buttonId: "magic-wand",
      dropdownItems: [
        {
          label: "Scegli dalla libreria",
          onClick: onChooseFromLibrary || (() => {
            console.warn('[Toolbar] onChooseFromLibrary handler not provided');
          }),
          icon: <BookOpen size={16} />
        },
        {
          label: "Rigenera task",
          onClick: onGenerateNewTask || (() => {
            console.warn('[Toolbar] onGenerateNewTask handler not provided');
          }),
          icon: <Wand2 size={16} />
        }
      ]
    },
  ];
}

