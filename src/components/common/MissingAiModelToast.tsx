/**
 * Toast inline mostrato sotto un CTA AI quando il modello globale non e impostato.
 * Il pulsante "Scegli il modello" apre Impostazioni Omnia sullo step `omniaTutor`
 * tramite l'helper {@link openOmniaTutorForMissingModel}, che setta anche un flag
 * di sessione cosi la pagina mostra un banner "Devi scegliere il modello LLM".
 *
 * Use case (single source of truth): il modello vive in `useAIProvider` (chiave localStorage
 * `omnia.aiModel`); se vuoto, ogni CTA AI mostra questo toast invece di partire con una
 * richiesta che fallirebbe in modo silenzioso.
 */

import React from 'react';
import { AlertCircle, Settings as SettingsIcon, X } from 'lucide-react';
import { openOmniaTutorForMissingModel } from '@utils/aiModelGuard';

export interface MissingAiModelToastProps {
  onDismiss: () => void;
}

export function MissingAiModelToast({ onDismiss }: MissingAiModelToastProps): React.ReactElement {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/45 bg-amber-950/55 px-3 py-2 text-xs leading-snug text-amber-50 shadow-lg"
    >
      <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-300" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="font-semibold">Nessun modello IA definito</div>
        <button
          type="button"
          onClick={() => {
            openOmniaTutorForMissingModel();
            onDismiss();
          }}
          className="mt-1.5 inline-flex items-center gap-1.5 rounded border border-amber-400/60 bg-amber-900/60 px-2 py-1 text-[11px] font-semibold text-amber-50 hover:border-amber-300 hover:bg-amber-800/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
        >
          <SettingsIcon size={12} aria-hidden />
          Scegli il modello
        </button>
      </div>
      <button
        type="button"
        aria-label="Chiudi avviso"
        onClick={onDismiss}
        className="shrink-0 rounded p-0.5 text-amber-200/80 hover:bg-amber-900/55 hover:text-amber-50"
      >
        <X size={13} aria-hidden />
      </button>
    </div>
  );
}
