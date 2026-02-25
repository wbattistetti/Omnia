import React from 'react';
import { Undo2, Redo2, MessageSquare, Rocket, BookOpen, List, CheckSquare, Wand2, Star, Upload } from 'lucide-react';
import { RightPanelMode } from './RightPanel';
import { useWizardContext } from '@responseEditor/context/WizardContext';
import { useGlobalTestPanel } from '@context/GlobalTestPanelContext';
import { useResponseEditorContextSafe } from '@hooks/useResponseEditorContextSafe';
import { useProjectTranslations } from '@context/ProjectTranslationsContext';
import { useEngineType } from '@context/EngineTypeContext';
import { openLateralChatPanel } from '@components/AppContent/infrastructure/docking/DockingHelpers';
import type { DockTabChat } from '@dock/types';
import DeploymentDialog, { type DeploymentConfig } from './Deployment/DeploymentDialog';

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
  // ✅ REMOVED: shouldBeGeneral - now from WizardContext
  saveDecisionMade?: boolean;
  onOpenSaveDialog?: () => void;
  // ✅ NEW: Ref per il pulsante save-to-library (sempre presente, visibilità controllata)
  saveToLibraryButtonRef?: React.RefObject<HTMLButtonElement>;
  // ✅ NEW: Task data for test panel (optional - can come from context or props)
  taskTree?: any;
  taskMeta?: any;
  currentProjectId?: string | null;
  // ✅ NEW: Dock tree setter for opening chat panel as dockable tab
  setDockTree?: (updater: (prev: any) => any) => void;
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
  // ✅ REMOVED: shouldBeGeneral - now from WizardContext
  saveDecisionMade = false,
  onOpenSaveDialog,
  // ✅ NEW: Ref per il pulsante save-to-library
  saveToLibraryButtonRef,
  // ✅ NEW: Task data for test panel (optional - can come from context or props)
  taskTree: taskTreeProp,
  taskMeta: taskMetaProp,
  currentProjectId: currentProjectIdProp,
  // ✅ NEW: Dock tree setter for opening chat panel as dockable tab
  setDockTree,
}: ResponseEditorToolbarProps) {

  // ✅ CRITICAL: Hooks devono essere chiamati PRIMA di qualsiasi return condizionale
  // ✅ NEW: Get global test panel and context data (MUST be at the top - hooks rule)
  const { isOpen: isGlobalTestPanelOpen, openWithTask, close: closeGlobalTestPanel } = useGlobalTestPanel();
  const editorContext = useResponseEditorContextSafe(); // ✅ Safe hook that returns null if not available
  const { translations: globalTranslations, isReady: translationsReady, isLoading: translationsLoading, loadAllTranslations } = useProjectTranslations();
  const { engineType } = useEngineType(); // ✅ Get engine type from global context

  // ✅ Get task data from props (preferred) or context (fallback)
  const taskTree = taskTreeProp || editorContext?.taskTree;
  const taskMeta = taskMetaProp || editorContext?.taskMeta;
  const currentProjectId = currentProjectIdProp || editorContext?.currentProjectId;

  // ✅ Deployment dialog state
  const [isDeploymentDialogOpen, setIsDeploymentDialogOpen] = React.useState(false);
  const projectLocale = React.useMemo(() => {
    // Extract locale from project or default to 'it-IT'
    // TODO: Get from project context if available
    return 'it-IT';
  }, []);


  // ✅ Guard to prevent double-opening of chat panel (React StrictMode in dev)
  const openingChatRef = React.useRef(false);

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
    // Se già attivo, deseleziona chiudendo tutto
    if (leftPanelMode === 'actions') {
      onLeftPanelModeChange('none'); // Chiudi Behaviour
      if (showSynonyms) onToggleSynonyms();
      if (showMessageReview) onToggleMessageReview();
    } else {
      // Altrimenti seleziona Behaviour e chiudi gli altri due (ma non Test)
      if (showSynonyms) onToggleSynonyms();
      if (showMessageReview) onToggleMessageReview();
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
    console.log('[Toolbar] 🧪 handleTestClick', {
      isGlobalTestPanelOpen,
      hasEditorContext: !!editorContext,
      editorContextKeys: editorContext ? Object.keys(editorContext) : [],
      hasSetDockTree: !!setDockTree,
      setDockTreeType: typeof setDockTree,
      hasTaskTree: !!taskTree,
      hasTaskMeta: !!taskMeta,
      hasCurrentProjectId: !!currentProjectId,
      isOpening: openingChatRef.current,
    });

    // ✅ NEW: Use dockable chat panel if setDockTree is available, otherwise fallback to global test panel
    if (setDockTree) {
      // Guard against double-opening (React StrictMode in dev)
      if (openingChatRef.current) {
        console.log('[Toolbar] 🧪 Already opening chat panel, skipping...');
        return;
      }

      // Close global test panel if open (to avoid confusion)
      if (isGlobalTestPanelOpen) {
        console.log('[Toolbar] 🧪 Closing global test panel before opening dockable tab');
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
          // Reset guard to allow retry
          openingChatRef.current = false;
          // Recursively call handleTestClick to retry
          handleTestClick();
        }).catch((err) => {
          console.error('[Toolbar] ❌ Failed to load translations', err);
          openingChatRef.current = false;
        });
        return;
      }

      // If translations are still loading, wait a bit and retry
      if (translationsLoading) {
        console.log('[Toolbar] ⏳ Translations are loading, waiting...');
        setTimeout(() => {
          openingChatRef.current = false;
          handleTestClick();
        }, 500);
        return;
      }

      // Set guard
      openingChatRef.current = true;

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
        openingChatRef.current = false;
        alert('Translations are not available. Please ensure the project has translations loaded.');
        return;
      }

      // ✅ CRITICAL: Filter runtime translations BEFORE passing to chat tab (must work by design)
      // Extract GUIDs from TaskTree.steps
      const runtimeGuids = new Set<string>();
      if (taskTree?.steps && typeof taskTree.steps === 'object') {
        // Import extractGuidsFromSteps function (same logic as DDEBubbleChat)
        const extractGuidsFromSteps = (steps: Record<string, any>, guids: Set<string>) => {
          const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          for (const [templateId, stepDict] of Object.entries(steps)) {
            if (!stepDict || typeof stepDict !== 'object') continue;
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
                          }
                        }
                        if (taskItem.id && guidPattern.test(taskItem.id)) {
                          guids.add(taskItem.id);
                        }
                      }
                    }
                  }
                }
              }
              continue;
            }
            for (const [stepType, step] of Object.entries(stepDict)) {
              if (!step || typeof step !== 'object') continue;
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
                        }
                      }
                      if (taskItem.id && guidPattern.test(taskItem.id)) {
                        guids.add(taskItem.id);
                      }
                    }
                  }
                }
              }
            }
          }
        };
        extractGuidsFromSteps(taskTree.steps, runtimeGuids);
      }

      // Filter translations: only GUIDs referenced in steps + runtime.* keys
      const runtimeTranslations: Record<string, string> = {};
      for (const [guid, text] of Object.entries(allTranslations)) {
        if (guid.startsWith('runtime.')) {
          runtimeTranslations[guid] = text;
        } else if (runtimeGuids.has(guid)) {
          runtimeTranslations[guid] = text;
        }
      }

      console.log('[Toolbar] 🔍 Filtered runtime translations:', {
        allTranslationsCount: Object.keys(allTranslations).length,
        runtimeGuidsCount: runtimeGuids.size,
        runtimeTranslationsCount: Object.keys(runtimeTranslations).length
      });

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
        engineType: engineType, // ✅ Pass engine type from global context
      };

      console.log('[Toolbar] 🧪 Opening chat panel as dockable tab', {
        tabId: chatTabId,
        taskId: task.id,
        projectId: currentProjectId,
      });

      setDockTree(prev => {
        const result = openLateralChatPanel(prev, {
          tabId: chatTabId,
          newTab: chatTab,
          position: 'right',
        });
        // Reset guard after state update
        setTimeout(() => {
          openingChatRef.current = false;
        }, 100);
        return result;
      });
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
            console.log('[Toolbar] ✅ Translations loaded, retrying test panel open');
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
        openWithTask(task as any, taskTree, currentProjectId, translations, engineType);
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

  const handleDeploymentClick = () => {
    setIsDeploymentDialogOpen(true);
  };

  const handleDeploy = async (config: DeploymentConfig) => {
    const response = await fetch(`http://localhost:3100/api/deploy/sync-translations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Deployment failed: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log('[Deployment] ✅ Completed:', result);

    if (config.verifyAfterDeploy) {
      const verifyResponse = await fetch(`http://localhost:3100/api/deploy/verify-redis?projectId=${config.projectId}&locale=${config.locale}`);
      if (verifyResponse.ok) {
        const verifyResult = await verifyResponse.json();
        if (!verifyResult.consistent) {
          throw new Error(`Verification failed: ${verifyResult.missingCount} translations missing`);
        }
      }
    }
  };

  return [
    { icon: <Undo2 size={16} />, onClick: () => { }, title: "Undo" },
    { icon: <Redo2 size={16} />, onClick: () => { }, title: "Redo" },
    // ✅ REORDERED: Central buttons in the specified order
    {
      icon: <Rocket size={16} />,
      label: "Behaviour",
      onClick: handleBehaviourClick,
      title: "Define the agent's response flow: prompts, confirmations, error handling, and escalation logic.",
      active: leftPanelMode === 'actions'
    },
    {
      icon: <CheckSquare size={16} />,
      label: "Tasks",
      onClick: handleTasksClick,
      title: "View and manage available tasks for the dialogue flow.",
      active: tasksPanelMode === 'actions'
    },
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
      title: "Simulate and validate the dialogue flow to ensure correct behavior and data recognition.",
      active: testPanelMode === 'chat'
    },
    {
      icon: <Upload size={16} />,
      label: "Deployment",
      onClick: handleDeploymentClick,
      title: "Deploy translations to Redis for runtime execution",
      active: false
    },
    // ✅ FIX: Pulsante statico sempre presente (come gli altri)
    {
      icon: <Star size={16} />,
      label: "Vuoi salvare in libreria?",
      onClick: () => {
        if (onOpenSaveDialog) {
          onOpenSaveDialog();
        }
      },
      title: "Salva il template nella libreria generale",
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

// ✅ Export DeploymentDialog state and handlers separately
export function useDeploymentDialog(currentProjectId: string | null, locale: string) {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleDeploy = async (config: DeploymentConfig) => {
    const response = await fetch(`http://localhost:3100/api/deploy/sync-translations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Deployment failed: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log('[Deployment] ✅ Completed:', result);

    if (config.verifyAfterDeploy) {
      const verifyResponse = await fetch(`http://localhost:3100/api/deploy/verify-redis?projectId=${config.projectId}&locale=${config.locale}`);
      if (verifyResponse.ok) {
        const verifyResult = await verifyResponse.json();
        if (!verifyResult.consistent) {
          throw new Error(`Verification failed: ${verifyResult.missingCount} translations missing`);
        }
      }
    }
  };

  const dialogElement = (
    <DeploymentDialog
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      projectId={currentProjectId}
      locale={locale}
      onDeploy={handleDeploy}
    />
  );

  return {
    openDialog: () => setIsOpen(true),
    dialogElement
  };
}
