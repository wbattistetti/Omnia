/**
 * Dettaglio NLU sotto la card utente (inline): albero slot + figli; nota e replay in DebuggerStepDetailContent.
 */
import type { DebuggerStep } from '../core/DebuggerStep';
import { DebuggerStepDetailContent } from './DebuggerStepDetailContent';
import { NluSummaryInline } from './NluSummaryInline';

export function UserTurnDetail(props: {
  step: DebuggerStep | undefined;
  onStepNoteChange: (stepId: string, note: string) => void;
  onReplayHighlight: (step: DebuggerStep) => void;
}) {
  const { step, onStepNoteChange, onReplayHighlight } = props;

  if (!step) {
    return (
      <div className="px-2 pb-2 pt-1.5 border-t border-purple-100/50 bg-purple-50/20 rounded-b-md text-xs text-slate-700">
        <NluSummaryInline
          engineLine="—"
          slotLabel="—"
          elapsedMs={null}
          showNoMatch
          semantic="—"
          linguistic="—"
        />
      </div>
    );
  }

  return (
    <DebuggerStepDetailContent
      step={step}
      onStepNoteChange={onStepNoteChange}
      onReplayHighlight={onReplayHighlight}
    />
  );
}
