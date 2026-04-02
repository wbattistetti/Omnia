// ResponseEditorNavigationContext
// Provides programmatic navigation primitives for Response Editor
// Allows external code to navigate to specific steps, escalations, and open panels

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';

export interface ResponseEditorNavigationContextValue {
  // Step navigation
  navigateToStep: (stepKey: string) => void;
  currentStepKey: string | null;
  setCurrentStepKey: (stepKey: string | null) => void;

  // Escalation navigation
  navigateToEscalation: (stepKey: string, escalationIndex: number) => void;

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
  } | null;
  clearPendingNavigation: () => void;
}

const ResponseEditorNavigationContext = createContext<ResponseEditorNavigationContextValue | undefined>(undefined);

export function ResponseEditorNavigationProvider({
  children,
  setLeftPanelMode,
  setTasksPanelMode,
}: {
  children: React.ReactNode;
  setLeftPanelMode?: (mode: any) => void;
  setTasksPanelMode?: (mode: any) => void;
}) {
  const [currentStepKey, setCurrentStepKey] = useState<string | null>(null);
  const [autoEditTarget, setAutoEditTargetState] = useState<{ escIdx: number; taskIdx: number } | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<ResponseEditorNavigationContextValue['pendingNavigation']>(null);

  const navigateToStep = useCallback((stepKey: string) => {
    setCurrentStepKey(stepKey);
    // Scroll to step tab if available — use a short outline flash (no errorPulse) to avoid flicker on text
    setTimeout(() => {
      const stepElement = document.querySelector(`[data-step-key="${stepKey}"]`);
      if (stepElement) {
        stepElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        stepElement.classList.add('navigation-step-flash');
        setTimeout(() => {
          stepElement.classList.remove('navigation-step-flash');
        }, 450);
      }
    }, 100);
  }, []);

  const navigateToEscalation = useCallback((stepKey: string, escalationIndex: number) => {
    /** One update + one scroll — do not call navigateToStep (avoids double scroll / tab fight with BehaviourUi). */
    setCurrentStepKey(stepKey);
    setTimeout(() => {
      const escalationElement = document.querySelector(`[data-escalation-index="${escalationIndex}"]`);
      if (escalationElement) {
        escalationElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        escalationElement.classList.add('navigation-step-flash');
        setTimeout(() => {
          escalationElement.classList.remove('navigation-step-flash');
        }, 450);
      }
    }, 120);
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
              'autoEditTarget' in raw
            ? (raw as ResponseEditorNavigationContextValue['pendingNavigation'])
            : null;
      if (!navigation) return;

      // Store pending navigation
      setPendingNavigation(navigation);

      // Apply navigation (escalation path sets the step once; do not also call navigateToStep)
      if (navigation.escalationIndex !== undefined && navigation.stepKey) {
        navigateToEscalation(navigation.stepKey, navigation.escalationIndex);
      } else if (navigation.stepKey) {
        navigateToStep(navigation.stepKey);
      }

      if (navigation.autoEditTarget) {
        setAutoEditTarget(navigation.autoEditTarget);
      }

      if (navigation.openBehaviorPanel) {
        openBehaviorPanel();
      }

      if (navigation.openTasksPanel) {
        openTasksPanel();
      }
    };

    document.addEventListener('taskEditor:navigate', handleNavigationEvent as EventListener);
    return () => {
      document.removeEventListener('taskEditor:navigate', handleNavigationEvent as EventListener);
    };
  }, [navigateToStep, navigateToEscalation, setAutoEditTarget, openBehaviorPanel, openTasksPanel]);

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
