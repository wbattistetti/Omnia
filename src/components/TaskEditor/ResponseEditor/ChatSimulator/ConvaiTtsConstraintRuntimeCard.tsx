import React from 'react';
import { AlertTriangle, Wrench } from 'lucide-react';
import type { OrchestratorSseErrorPayload } from '@components/DialogueEngine/orchestratorAdapter';
import {
  CONVAI_TTS_FIX_MODEL_ID,
  isConvaiNonEnglishTtsConstraintError,
} from '@utils/convai/convaiTtsConstraintError';

type Props = {
  detail: OrchestratorSseErrorPayload;
  /** Task corrente in debug (override IA) — se assente si applica solo ai default globali aperti in Studio. */
  taskInstanceIdHint?: string | null;
};

/**
 * Runtime: errore ElevenLabs ConvAI su `tts.model_id` per agenti non inglesi.
 * Separata da IaProvisionProviderError e dalle card compilazione/motore/contenuto.
 */
export function ConvaiTtsConstraintRuntimeCard(props: Props) {
  const { detail, taskInstanceIdHint } = props;
  if (!isConvaiNonEnglishTtsConstraintError(detail)) return null;

  const applyFix = () => {
    document.dispatchEvent(
      new CustomEvent('omnia:convai-apply-tts-model', {
        bubbles: true,
        detail: {
          ttsModel: CONVAI_TTS_FIX_MODEL_ID,
          taskInstanceId: taskInstanceIdHint?.trim() || undefined,
        },
      }),
    );
  };

  return (
    <div
      className="mt-2 rounded-md border border-sky-700/55 bg-sky-950/45 px-3 py-2 text-xs text-sky-50 shadow-sm min-w-0"
      role="alert"
    >
      <div className="flex items-start gap-2 font-semibold text-sky-100">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-sky-400" aria-hidden />
        <span className="min-w-0 break-words">
          ConvAI richiede un modello voce Flash v2.5 o Turbo v2.5 per lingue non inglesi (non è il modello LLM
          «gpt-4-turbo»).
        </span>
      </div>
      {detail.error ? (
        <p className="mt-2 text-[11px] leading-snug text-sky-100/90 break-words">{detail.error}</p>
      ) : null}
      <button
        type="button"
        onClick={applyFix}
        className="mt-2 inline-flex items-center gap-1.5 rounded border border-sky-500/70 bg-sky-900/50 px-2 py-1 text-[11px] font-medium text-sky-50 hover:bg-sky-800/60"
      >
        <Wrench size={14} aria-hidden />
        Applica modello consigliato ({CONVAI_TTS_FIX_MODEL_ID})
      </button>
      <p className="mt-1.5 text-[10px] leading-snug text-sky-200/80">
        Aggiorna il campo «Modello TTS» nel setup agente e salva l&apos;override sul task se richiesto.
      </p>
    </div>
  );
}
