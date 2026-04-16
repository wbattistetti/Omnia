/**
 * Corpo espanso sotto la card utente: albero NLU compatto, nota locale, replay highlight.
 */
import { Sparkles } from 'lucide-react';
import type { DebuggerStep } from '../core/DebuggerStep';
import { NluSummaryInline } from './NluSummaryInline';

function formatEngineLine(step: DebuggerStep): string {
  const t = String(step.grammar?.type || 'orchestrator').trim();
  if (t === 'orchestrator') return 'Grammar Flow';
  if (t) return t.replace(/-/g, ' ');
  return '—';
}

function slotRowLabel(step: DebuggerStep): string {
  const s = String(step.slotLabel || '').trim();
  if (s) return s;
  const nid = String(step.activeNodeId || '').trim();
  return nid || '—';
}

export function DebuggerStepDetailContent(props: {
  step: DebuggerStep;
  onStepNoteChange: (stepId: string, note: string) => void;
  onReplayHighlight: (step: DebuggerStep) => void;
}) {
  const { step, onStepNoteChange, onReplayHighlight } = props;

  const engineLine = formatEngineLine(step);
  const slotLabel = slotRowLabel(step);
  const elapsedMs = step.grammar?.elapsedMs;
  const utterFallback = String(step.utterance || '').trim();
  const semRaw = String(step.semanticValue || '').trim() || utterFallback;
  const lingRaw = String(step.linguisticValue || '').trim() || utterFallback;
  const matched = Boolean(semRaw || lingRaw);
  const showNoMatch = !matched;
  const sem = semRaw || '—';
  const ling = lingRaw || '—';

  return (
    <div className="px-2 pb-2 pt-1.5 space-y-3 text-xs text-slate-800 border-t border-purple-100/50 bg-purple-50/20 rounded-b-md">
      <NluSummaryInline
        engineLine={engineLine}
        slotLabel={slotLabel}
        elapsedMs={elapsedMs}
        showNoMatch={showNoMatch}
        semantic={sem}
        linguistic={ling}
      />

      <label className="block">
        <span className="text-[11px] font-semibold text-slate-600">Nota sul turno</span>
        <textarea
          className="mt-0.5 w-full min-h-[52px] text-xs border border-slate-200 rounded px-1.5 py-1 text-slate-900"
          value={step.note ?? ''}
          placeholder="Annotazioni locali (projectId + flowId)…"
          onChange={(e) => onStepNoteChange(step.id, e.target.value)}
        />
      </label>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded bg-slate-900 text-lime-300 hover:bg-slate-800"
        onClick={() => onReplayHighlight(step)}
      >
        <Sparkles size={12} />
        Evidenzia di nuovo sul canvas
      </button>
    </div>
  );
}
