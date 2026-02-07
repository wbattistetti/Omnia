import React from 'react';
import { Undo2, Redo2, MessageSquare, Rocket, BookOpen, List, CheckSquare, Sparkles, Wand2 } from 'lucide-react';
import { RightPanelMode } from './RightPanel';

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
  onOpenContractWizard?: () => void; // Nuovo: handler per aprire wizard contract
  rightWidth?: number;
  onRightWidthChange?: (width: number) => void;
  testPanelWidth?: number;
  onTestPanelWidthChange?: (width: number) => void;
  tasksPanelWidth?: number;
  onTasksPanelWidthChange?: (width: number) => void;
  // ✅ NEW: Wizard handlers
  onChooseFromLibrary?: () => void;
  onGenerateNewTask?: () => void;
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
  onOpenContractWizard, // Nuovo
  rightWidth = 360,
  onRightWidthChange,
  testPanelWidth = 360,
  onTestPanelWidthChange,
  tasksPanelWidth = 360,
  onTasksPanelWidthChange,
  // ✅ NEW: Wizard handlers
  onChooseFromLibrary,
  onGenerateNewTask,
}: ResponseEditorToolbarProps) {
  // ✅ CRITICAL: Hooks devono essere chiamati PRIMA di qualsiasi return condizionale
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
    console.log('[Toolbar] 🧪 handleTestClick - testPanelMode:', testPanelMode, 'testPanelWidth:', testPanelWidth);

    // Toggle: se è aperto, chiudi e collassa; se è chiuso, apri e espandi
    // ✅ Usa testPanelMode invece di rightMode per non interferire con Behaviour
    if (testPanelMode === 'chat') {
      // Chiudi Test e collassa il pannello
      console.log('[Toolbar] 🧪 Chiudo Test - salvo larghezza:', testPanelWidth);
      previousTestWidthRef.current = testPanelWidth; // Salva la larghezza corrente

      // ✅ Prima collassa la larghezza, poi cambia il mode
      if (onTestPanelWidthChange) {
        console.log('[Toolbar] 🧪 Imposto larghezza a COLLAPSED_WIDTH:', COLLAPSED_WIDTH);
        onTestPanelWidthChange(COLLAPSED_WIDTH); // Collassa il pannello
      }

      // ✅ Poi cambia il mode a 'none' per nascondere completamente
      setTimeout(() => {
        console.log('[Toolbar] 🧪 Cambio testPanelMode a none');
        onTestPanelModeChange('none'); // Chiudi Test (usa testPanelMode invece di rightMode)
      }, 0);
    } else {
      // Apri Test e espandi il pannello
      console.log('[Toolbar] 🧪 Apro Test - previousWidth:', previousTestWidthRef.current);

      // ✅ Prima cambia il mode, poi espandi
      onTestPanelModeChange('chat'); // Apri Test (usa testPanelMode invece di rightMode)

      if (onTestPanelWidthChange) {
        // Ripristina la larghezza precedente o usa il default (360)
        const widthToRestore = previousTestWidthRef.current > COLLAPSED_WIDTH ? previousTestWidthRef.current : 360;
        console.log('[Toolbar] 🧪 Ripristino larghezza a:', widthToRestore);
        onTestPanelWidthChange(widthToRestore);
      }
    }
    // Non toccare gli altri pannelli (Behaviour, Personality, Recognition)
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

  return [
    { icon: <Undo2 size={16} />, onClick: () => { }, title: "Undo" },
    { icon: <Redo2 size={16} />, onClick: () => { }, title: "Redo" },
    {
      icon: <Sparkles size={16} />,
      label: "Generate Contracts",
      onClick: onOpenContractWizard || (() => {}),
      title: "Automatically generate semantic contracts and parser engines for all nodes in the task tree.",
      active: false
    },
    {
      icon: <Rocket size={16} />,
      label: "Behaviour",
      onClick: handleBehaviourClick,
      title: "Define the agent's response flow: prompts, confirmations, error handling, and escalation logic.",
      active: leftPanelMode === 'actions'
    },
    {
      icon: <List size={16} />,
      label: "Personality",
      onClick: handlePersonalityClick,
      title: "Customize the agent's tone, empathy level, and linguistic style to match your target audience.",
      active: showMessageReview
    },
    {
      icon: <BookOpen size={16} />,
      label: "Recognition",
      onClick: handleRecognitionClick,
      title: "Configure rules and models to identify and extract relevant data from user input.",
      active: showSynonyms
    },
    {
      icon: <MessageSquare size={16} />,
      label: "Test",
      onClick: handleTestClick,
      title: "Simulate and validate the dialogue flow to ensure correct behavior and data recognition.",
      active: testPanelMode === 'chat'
    },
    {
      icon: <CheckSquare size={16} />,
      label: "Tasks",
      onClick: handleTasksClick,
      title: "View and manage available tasks for the dialogue flow.",
      active: tasksPanelMode === 'actions'
    },
    // ✅ NEW: Wizard buttons (always visible)
    {
      icon: <BookOpen size={16} />,
      label: "Scegli dalla libreria",
      onClick: onChooseFromLibrary || (() => {
        console.warn('[Toolbar] onChooseFromLibrary handler not provided');
      }),
      title: "Scegli un task dalla libreria di template predefiniti",
      active: false
    },
    {
      icon: <Wand2 size={16} />,
      label: "Genera nuovo task",
      onClick: onGenerateNewTask || (() => {
        console.warn('[Toolbar] onGenerateNewTask handler not provided');
      }),
      title: "Genera un nuovo task usando AI",
      active: false
    },
  ];
}

