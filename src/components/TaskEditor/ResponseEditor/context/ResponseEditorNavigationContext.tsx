// ResponseEditorNavigationContext
// Provides programmatic navigation primitives for Response Editor
// Allows external code to navigate to specific steps, escalations, and open panels

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';

export interface ResponseEditorNavigationContextValue {
  // Step navigation (optional callback after tab scroll lands)
  navigateToStep: (stepKey: string, onComplete?: () => void) => void;
  currentStepKey: string | null;
  setCurrentStepKey: (stepKey: string | null) => void;

  // Escalation navigation (optional callback runs after scroll lands — e.g. open Tasks palette)
  navigateToEscalation: (stepKey: string, escalationIndex: number, onComplete?: () => void) => void;

  // Auto-edit prompt
  setAutoEditTarget: (target: { escIdx: number; taskIdx: number } | null) => void;
  autoEditTarget: { escIdx: number; taskIdx: number } | null;

  // Panel management
  openTasksPanel: () => void;
  openBehaviorPanel: () => void;
  closeTasksPanel: () => void;
  closeBehaviorPanel: () => void;

  // Navigation state
  pendingNavigation: {
    stepKey?: string;
    escalationIndex?: number;
    autoEditTarget?: { escIdx: number; taskIdx: number };
    openTasksPanel?: boolean;
    openBehaviorPanel?: boolean;
    openRecognition?: boolean;
  } | null;
  clearPendingNavigation: () => void;
}

const ResponseEditorNavigationContext = createContext<ResponseEditorNavigationContextValue | undefined>(undefined);

const NAV_SCROLL_MAX_ATTEMPTS = 45;
const NAV_SCROLL_INTERVAL_MS = 50;

export function ResponseEditorNavigationProvider({
  children,
  setLeftPanelMode,
  setTasksPanelMode,
  onOpenRecognition,
}: {
  children: React.ReactNode;
  setLeftPanelMode?: (mode: any) => void;
  setTasksPanelMode?: (mode: any) => void;
  /** Same UX as toolbar “Recognition” — contract / parsers (compile FIX ParserMissing). */
  onOpenRecognition?: () => void;
}) {
  const [currentStepKey, setCurrentStepKey] = useState<string | null>(null);
  const [autoEditTarget, setAutoEditTargetState] = useState<{ escIdx: number; taskIdx: number } | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<ResponseEditorNavigationContextValue['pendingNavigation']>(null);

  const navigateToStep = useCallback((stepKey: string, onComplete?: () => void) => {
    setCurrentStepKey(stepKey);
    let attempt = 0;
    const tryScroll = () => {
      attempt += 1;
      const stepElement = document.querySelector(`[data-step-key="${stepKey}"]`);
      if (stepElement) {
        stepElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        stepElement.classList.add('navigation-step-flash');
        window.setTimeout(() => {
          stepElement.classList.remove('navigation-step-flash');
        }, 450);
        onComplete?.();
        return;
      }
      if (attempt < NAV_SCROLL_MAX_ATTEMPTS) {
        window.setTimeout(tryScroll, NAV_SCROLL_INTERVAL_MS);
      } else {
        onComplete?.();
      }
    };
    window.setTimeout(tryScroll, 0);
  }, []);

  const navigateToEscalation = useCallback((stepKey: string, escalationIndex: number, onComplete?: () => void) => {
    /** After BehaviourUi switches tab, escalation nodes mount async — retry scroll until present. */
    setCurrentStepKey(stepKey);
    let attempt = 0;
    const tryScroll = () => {
      attempt += 1;
      const escalationElement = document.querySelector(`[data-escalation-index="${escalationIndex}"]`);
      if (escalationElement) {
        escalationElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        escalationElement.classList.add('navigation-step-flash');
        window.setTimeout(() => {
          escalationElement.classList.remove('navigation-step-flash');
        }, 450);
        onComplete?.();
        return;
      }
      if (attempt < NAV_SCROLL_MAX_ATTEMPTS) {
        window.setTimeout(tryScroll, NAV_SCROLL_INTERVAL_MS);
      } else {
        onComplete?.();
      }
    };
    window.setTimeout(tryScroll, 0);
  }, []);

  const setAutoEditTarget = useCallback((target: { escIdx: number; taskIdx: number } | null) => {
    setAutoEditTargetState(target);
    // Scroll to task if target is set
    if (target) {
      setTimeout(() => {
        const taskElement = document.querySelector(
          `[data-escalation-index="${target.escIdx}"][data-task-index="${target.taskIdx}"]`
        );
        if (taskElement) {
          taskElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          taskElement.classList.add('navigation-step-flash');
          setTimeout(() => {
            taskElement.classList.remove('navigation-step-flash');
          }, 450);
        }
      }, 300);
    }
  }, []);

  const openTasksPanel = useCallback(() => {
    if (setTasksPanelMode) {
      setTasksPanelMode('actions');
    }
  }, [setTasksPanelMode]);

  const openBehaviorPanel = useCallback(() => {
    if (setLeftPanelMode) {
      setLeftPanelMode('actions');
    }
  }, [setLeftPanelMode]);

  const closeTasksPanel = useCallback(() => {
    if (setTasksPanelMode) {
      setTasksPanelMode('none');
    }
  }, [setTasksPanelMode]);

  const closeBehaviorPanel = useCallback(() => {
    if (setLeftPanelMode) {
      setLeftPanelMode('none');
    }
  }, [setLeftPanelMode]);

  const clearPendingNavigation = useCallback(() => {
    setPendingNavigation(null);
  }, []);

  // Listen for navigation events from taskEditor:open
  useEffect(() => {
    const handleNavigationEvent = (event: CustomEvent) => {
      const raw = event.detail as
        | { navigation?: ResponseEditorNavigationContextValue['pendingNavigation'] }
        | ResponseEditorNavigationContextValue['pendingNavigation']
        | undefined;
      if (!raw || typeof raw !== 'object') return;
      const navigation =
        'navigation' in raw && raw.navigation && typeof raw.navigation === 'object'
          ? raw.navigation
          : 'stepKey' in raw ||
              'openTasksPanel' in raw ||
              'escalationIndex' in raw ||
              'openBehaviorPanel' in raw ||
              'autoEditTarget' in raw ||
              'openRecognition' in raw
            ? (raw as ResponseEditorNavigationContextValue['pendingNavigation'])
            : null;
      if (!navigation) return;

      // Store pending navigation
      setPendingNavigation(navigation);

      if (navigation.openRecognition && onOpenRecognition) {
        onOpenRecognition();
      }

      let deferOpenTasks =
        navigation.openTasksPanel === true &&
        !(navigation.escalationIndex !== undefined && navigation.stepKey) &&
        !navigation.stepKey;

      const openTasksAfterScroll = navigation.openTasksPanel === true ? () => openTasksPanel() : undefined;

      // Apply navigation (escalation path sets the step once; do not also call navigateToStep)
      if (navigation.escalationIndex !== undefined && navigation.stepKey) {
        navigateToEscalation(navigation.stepKey, navigation.escalationIndex, openTasksAfterScroll);
      } else if (navigation.stepKey) {
        navigateToStep(navigation.stepKey, openTasksAfterScroll);
      }

      if (navigation.autoEditTarget) {
        setAutoEditTarget(navigation.autoEditTarget);
      }

      if (navigation.openBehaviorPanel) {
        openBehaviorPanel();
      }

      if (deferOpenTasks) {
        openTasksPanel();
      }
    };

    document.addEventListener('taskEditor:navigate', handleNavigationEvent as EventListener);
    return () => {
      document.removeEventListener('taskEditor:navigate', handleNavigationEvent as EventListener);
    };
  }, [
    navigateToStep,
    navigateToEscalation,
    setAutoEditTarget,
    openBehaviorPanel,
    openTasksPanel,
    onOpenRecognition,
  ]);

  const value = useMemo<ResponseEditorNavigationContextValue>(
    () => ({
      navigateToStep,
      currentStepKey,
      setCurrentStepKey,
      navigateToEscalation,
      setAutoEditTarget,
      autoEditTarget,
      openTasksPanel,
      openBehaviorPanel,
      closeTasksPanel,
      closeBehaviorPanel,
      pendingNavigation,
      clearPendingNavigation,
    }),
    [
      navigateToStep,
      currentStepKey,
      navigateToEscalation,
      setAutoEditTarget,
      autoEditTarget,
      openTasksPanel,
      openBehaviorPanel,
      closeTasksPanel,
      closeBehaviorPanel,
      pendingNavigation,
      clearPendingNavigation,
    ]
  );

  return (
    <ResponseEditorNavigationContext.Provider value={value}>
      {children}
    </ResponseEditorNavigationContext.Provider>
  );
}

export function useResponseEditorNavigation(): ResponseEditorNavigationContextValue {
  const context = useContext(ResponseEditorNavigationContext);
  if (!context) {
    // Return no-op functions if context not available
    return {
      navigateToStep: () => {},
      currentStepKey: null,
      setCurrentStepKey: () => {},
      navigateToEscalation: () => {},
      setAutoEditTarget: () => {},
      autoEditTarget: null,
      openTasksPanel: () => {},
      openBehaviorPanel: () => {},
      closeTasksPanel: () => {},
      closeBehaviorPanel: () => {},
      pendingNavigation: null,
      clearPendingNavigation: () => {},
    };
  }
  return context;
}
