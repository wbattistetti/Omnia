/**
 * UI state for Behaviour: step tabs + transient focus for opening a parameter editor.
 * Scoped under BehaviourContainer only.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { computeUiStepKeys } from './computeUiStepKeys';
import { logBehaviourSteps, summarizeStepsShape } from './behaviourStepsDebug';
import { useResponseEditorNavigation } from '@responseEditor/context/ResponseEditorNavigationContext';

export type BehaviourFocusTarget = {
  kind: 'parameter';
  escalationIdx: number;
  taskIdx: number;
  parameterId: string;
};

export type BehaviourUiContextValue = {
  uiStepKeys: string[];
  selectedStepKey: string;
  setSelectedStepKey: (key: string) => void;
  focusedParameter: BehaviourFocusTarget | null;
  requestFocusParameter: (target: BehaviourFocusTarget) => void;
  consumeFocusParameter: (target: BehaviourFocusTarget) => void;
};

const BehaviourUiContext = createContext<BehaviourUiContextValue | null>(null);

type ProviderProps = {
  children: React.ReactNode;
  node: unknown;
  selectedRoot?: boolean;
  selectedSubIndex?: number | null;
  selectedPath?: number[];
};

export function BehaviourUiProvider({
  children,
  node,
  selectedRoot,
  selectedSubIndex,
  selectedPath,
}: ProviderProps) {
  const navigation = useResponseEditorNavigation();

  const uiStepKeys = useMemo(
    () =>
      computeUiStepKeys({
        node,
        selectedRoot,
        selectedPath,
        selectedSubIndex,
      }),
    [node, selectedRoot, selectedPath, selectedSubIndex]
  );

  useEffect(() => {
    const n = node as { id?: string; steps?: unknown } | null | undefined;
    logBehaviourSteps('BehaviourUiProvider:uiStepKeys', {
      uiStepKeys,
      uiStepKeysCount: uiStepKeys.length,
      selectedRoot,
      selectedPath,
      selectedSubIndex,
      nodeId: n?.id,
      nodeSteps: summarizeStepsShape(n?.steps),
    });
  }, [uiStepKeys, node, selectedRoot, selectedPath, selectedSubIndex]);

  const [selectedStepKey, setSelectedStepKeyState] = useState<string>(() => {
    if (uiStepKeys.length > 0) return uiStepKeys[0];
    return 'start';
  });

  const [focusedParameter, setFocusedParameter] = useState<BehaviourFocusTarget | null>(null);

  useEffect(() => {
    if (uiStepKeys.length > 0 && !uiStepKeys.includes(selectedStepKey)) {
      setSelectedStepKeyState(uiStepKeys[0]);
    }
  }, [uiStepKeys, selectedStepKey]);

  useEffect(() => {
    if (
      navigation.currentStepKey &&
      navigation.currentStepKey !== selectedStepKey &&
      uiStepKeys.includes(navigation.currentStepKey)
    ) {
      setSelectedStepKeyState(navigation.currentStepKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync only when navigation or keys change
  }, [navigation.currentStepKey, uiStepKeys]);

  const setSelectedStepKey = useCallback((key: string) => {
    setSelectedStepKeyState(key);
  }, []);

  useEffect(() => {
    navigation.setCurrentStepKey(selectedStepKey);
  }, [selectedStepKey, navigation.setCurrentStepKey]);

  const requestFocusParameter = useCallback((target: BehaviourFocusTarget) => {
    setFocusedParameter(target);
  }, []);

  const consumeFocusParameter = useCallback((target: BehaviourFocusTarget) => {
    setFocusedParameter((prev) => {
      if (
        prev &&
        prev.escalationIdx === target.escalationIdx &&
        prev.taskIdx === target.taskIdx &&
        prev.parameterId === target.parameterId
      ) {
        return null;
      }
      return prev;
    });
  }, []);

  const value = useMemo<BehaviourUiContextValue>(
    () => ({
      uiStepKeys,
      selectedStepKey,
      setSelectedStepKey,
      focusedParameter,
      requestFocusParameter,
      consumeFocusParameter,
    }),
    [
      uiStepKeys,
      selectedStepKey,
      setSelectedStepKey,
      focusedParameter,
      requestFocusParameter,
      consumeFocusParameter,
    ]
  );

  return (
    <BehaviourUiContext.Provider value={value}>{children}</BehaviourUiContext.Provider>
  );
}

export function useBehaviourUi(): BehaviourUiContextValue {
  const ctx = useContext(BehaviourUiContext);
  if (!ctx) {
    throw new Error('useBehaviourUi must be used within BehaviourUiProvider');
  }
  return ctx;
}

/** For optional use outside Behaviour (should not happen for escalation UI). */
export function useBehaviourUiOptional(): BehaviourUiContextValue | null {
  return useContext(BehaviourUiContext);
}
