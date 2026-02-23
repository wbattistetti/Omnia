// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * PhaseCardContainer - Granular Zustand Selector
 *
 * Each PhaseCard reads ONLY its own step from the store, preventing unnecessary re-renders.
 * This is the final optimization: granular selectors instead of prop drilling.
 */

import React, { useMemo } from 'react';
import { useWizardStore } from '../store/wizardStore';
import { PhaseCard } from './PhaseCard';
import { calculatePhaseProgress, getPhaseState, extractDynamicMessage } from '../utils/wizardHelpers';
import { LucideIcon } from 'lucide-react';

type PhaseCardContainerProps = {
  stepId: 'structure' | 'constraints' | 'parsers' | 'messages';
  icon: LucideIcon;
  title: string;
  showCorrectionMode?: boolean;
  correctionInput?: string;
  onCorrectionInputChange?: (value: string) => void;
};

/**
 * PhaseCardContainer - Uses granular Zustand selector to read only its own step
 *
 * This component subscribes ONLY to the specific step it needs, preventing
 * re-renders when other steps change.
 */
export const PhaseCardContainer = React.memo(function PhaseCardContainer({
  stepId,
  icon,
  title,
  showCorrectionMode = false,
  correctionInput = '',
  onCorrectionInputChange,
}: PhaseCardContainerProps) {
  // ✅ GRANULAR SELECTOR: Read ONLY this step from store
  const step = useWizardStore(state =>
    state.pipelineSteps.find(s => s.id === stepId)
  );

  // ✅ GRANULAR SELECTOR: Read ONLY phase counters (needed for progress)
  const phaseCounters = useWizardStore(state => state.phaseCounters);

  // ✅ GRANULAR SELECTOR: Read ONLY showStructureConfirmation (needed for structure phase)
  const showStructureConfirmation = useWizardStore(state =>
    stepId === 'structure' ? state.showStructureConfirmation() : false
  );

  // Early return if step not found
  if (!step) {
    return null;
  }

  // Calculate phase state
  const phaseState = getPhaseState(step);

  // Calculate progress (only for non-structure phases)
  const calculatedProgress = stepId !== 'structure'
    ? calculatePhaseProgress(
        stepId === 'constraints' ? 'constraints' : stepId === 'parsers' ? 'parser' : 'messages',
        [step], // Pass single step array for fallback (won't be used if counters available)
        phaseCounters
      )
    : undefined;

  // Calculate dynamic message
  const dynamicMessage = useMemo(() => {
    if (stepId === 'structure') {
      if (step.status === 'running') {
        return showStructureConfirmation
          ? 'Confermami la struttura che vedi sulla sinistra...'
          : 'sto pensando a qual è la migliore struttura dati per questo task...';
      }
      if (step.status === 'completed') {
        return step.payload; // "Confermata!"
      }
      return undefined;
    }
    return extractDynamicMessage(step);
  }, [stepId, step.status, step.payload, showStructureConfirmation]);

  const isStructurePhase = stepId === 'structure';

  return (
    <PhaseCard
      icon={icon}
      title={title}
      state={phaseState}
      progress={calculatedProgress}
      isExpanded={isStructurePhase && showCorrectionMode}
      showCorrectionForm={isStructurePhase && showCorrectionMode}
      correctionInput={correctionInput}
      onCorrectionInputChange={onCorrectionInputChange}
      dynamicMessage={dynamicMessage}
    />
  );
}, (prevProps, nextProps) => {
  // ✅ Custom comparison: only re-render if props actually change
  return (
    prevProps.stepId === nextProps.stepId &&
    prevProps.icon === nextProps.icon &&
    prevProps.title === nextProps.title &&
    prevProps.showCorrectionMode === nextProps.showCorrectionMode &&
    prevProps.correctionInput === nextProps.correctionInput &&
    prevProps.onCorrectionInputChange === nextProps.onCorrectionInputChange
  );
});
