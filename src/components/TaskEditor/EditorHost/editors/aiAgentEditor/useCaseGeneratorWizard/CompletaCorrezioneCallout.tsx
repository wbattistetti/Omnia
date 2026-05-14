/**
 * CompletaCorrezioneCallout — Callout esplicativo del passo «Casi d'uso».
 *
 * Sostituisce, dal mag 2026, il pulsante «Completa correzione» nella toolbar.
 * Razionale UX: il pulsante era poco visibile e non chiariva cosa avrebbe fatto la
 * propagazione AI. Il callout sta nel **pannello destro**: quando è attivo
 * ({@link isCompletaCorrezioneCalloutSurfaceActive}) **sostituisce** la review card
 * «guida rapida»; al dismiss o a fine lavoro torna la card (vedi `ViewSkaGenerator`).
 * Non consuma altezza sotto lo stepper; il lampeggio richiama l'attenzione anche se
 * l'utente lavora sulla lista a sinistra. Non è mostrato quando il DX è dedicato
 * all'anteprima JSON a tutta colonna.
 *
 * Due CTA esplicite:
 *
 *   - «Procedo io manualmente» → nasconde il callout (dismiss "soft", riarma
 *     automaticamente al prossimo ciclo soglia — vedi `correctionsDismissed`
 *     nel context).
 *   - «Correggi» → lancia il servizio AI di propagazione stile
 *     (`triggerConsolidateCorrections`). Durante l'esecuzione il pulsante diventa
 *     uno spinner non interrompibile («Sto correggendo i messaggi rimanenti…»).
 *
 * Animazione: lampeggio lento di richiamo (2 iterazioni × 0.8s, vedi
 * `omnia-callout-attention-blink` in `index.css`) **solo al transition false→true**
 * della visibilità — una `key` locale forza il remount al passaggio "appare" così
 * l'animazione CSS riparte. `prefers-reduced-motion` disattiva il blink mantenendo
 * la border evidenziata (statica).
 *
 * Visibilità: {@link isCompletaCorrezioneCalloutSurfaceActive} (soglia + dismiss + busy).
 *
 * Errori dell'API restano in carico al controller
 * (`useAIAgentEditorController.handleCompleteCorrection` → toast di errore).
 */

import React from 'react';
import { Loader2, Sparkles, X as XIcon } from 'lucide-react';
import {
  useUseCaseWizardListToolbarOptional,
  type UseCaseWizardListToolbarContextValue,
} from './UseCaseWizardListToolbarContext';
import {
  COMPLETE_CORRECTION_VISIBILITY_THRESHOLD,
  isCompletaCorrezioneCalloutSurfaceActive,
} from '../useCaseSubstantialEdits';

/** Testo mostrato nella textarea mentre l’IA prepara l’anteprima (stesso stato `loading: true`). */
export const CORRECTION_PREVIEW_SYNTHESIS_WAITING_MESSAGE =
  'Sto analizzando le tue modifiche per capire come poterle applicare agli altri messaggi. Abbi un momento di pazienza.\n\nIntanto puoi procedere con le modifiche…';

/**
 * Render solo se il context è disponibile (provider montato) e le condizioni di
 * visibilità sono verificate. Wrap esterno per evitare di pagare il costo di
 * `useEffect`/`useState` quando il callout non vive: gli hook sono dentro un
 * sub-component renderizzato condizionalmente.
 */
export function CompletaCorrezioneCallout(): React.ReactElement | null {
  const ctx = useUseCaseWizardListToolbarOptional();
  if (!ctx) return null;
  if (
    !isCompletaCorrezioneCalloutSurfaceActive({
      pendingCorrectionsCount: ctx.pendingCorrectionsCount,
      correctionsDismissed: ctx.correctionsDismissed,
      correctionsBusy: ctx.correctionsBusy,
    })
  ) {
    return null;
  }
  return <CalloutBody ctx={ctx} />;
}

function CalloutBody({
  ctx,
}: {
  ctx: UseCaseWizardListToolbarContextValue;
}): React.ReactElement {
  /**
   * Animation key: incrementata SOLO al passaggio false→true della visibilità.
   * Forza il remount del wrapper così la `@keyframes omnia-callout-attention-blink`
   * riparte da capo. Variazioni del count restando ≥ soglia non riavviano l'effetto
   * (sarebbe rumore visivo).
   */
  const visibleStable =
    ctx.pendingCorrectionsCount >= COMPLETE_CORRECTION_VISIBILITY_THRESHOLD &&
    !ctx.correctionsDismissed;
  const [animationKey, setAnimationKey] = React.useState<number>(0);
  const wasVisibleRef = React.useRef<boolean>(false);
  React.useEffect(() => {
    if (visibleStable && !wasVisibleRef.current) {
      setAnimationKey((k) => k + 1);
    }
    wasVisibleRef.current = visibleStable;
  }, [visibleStable]);

  const busy = ctx.correctionsBusy;

  /**
   * Click su «Correggi»: lancia il trigger async del context. Il context wrappa
   * la chiamata in try/finally su `correctionsBusy`. L'errore non viene catturato
   * qui (lo gestisce il controller a monte → toast).
   */
  const onClickCorreggi = React.useCallback((): void => {
    void ctx.triggerConsolidateCorrections();
  }, [ctx]);

  const onClickDismiss = React.useCallback((): void => {
    if (busy) return;
    ctx.dismissCorrections();
  }, [busy, ctx]);

  const preview = ctx.correctionPreviewState;

  const onSynthesisChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
      ctx.setCorrectionPreviewState((prev) =>
        prev
          ? {
              ...prev,
              synthesis: e.target.value,
            }
          : null
      );
    },
    [ctx]
  );

  const prevPreviewLoadingRef = React.useRef<boolean | undefined>(undefined);
  const [previewResultAnimKey, setPreviewResultAnimKey] = React.useState(0);
  React.useEffect(() => {
    if (!preview) {
      prevPreviewLoadingRef.current = undefined;
      return;
    }
    const was = prevPreviewLoadingRef.current;
    const now = preview.loading;
    if (was === true && now === false && !preview.error) {
      setPreviewResultAnimKey((k) => k + 1);
    }
    prevPreviewLoadingRef.current = now;
  }, [preview]);

  return (
    <div
      key={animationKey}
      role="region"
      aria-label="Suggerimento di correzione automatica"
      className="animate-omnia-callout-attention mb-3 rounded-md border border-amber-500/55 bg-amber-950/35 px-3 py-2.5 text-amber-100 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.18)]"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        <Sparkles
          size={16}
          aria-hidden
          className="mt-0.5 shrink-0 text-amber-300"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold leading-snug text-amber-100">
            Hai modificato {ctx.pendingCorrectionsCount}{' '}
            {ctx.pendingCorrectionsCount === 1 ? 'messaggio' : 'messaggi'} in modo
            sostanziale.
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-amber-200/90">
            Posso usare le tue correzioni come esempio di stile e riscrivere
            automaticamente gli altri messaggi che non hai ancora rivisto, in modo
            che adottino la stessa forma. Le tue modifiche restano invariate.
          </p>
        </div>
        {/*
          Gruppo CTA: a destra su layout largo (sm:), sotto su layout stretto.
          Su mobile/strettissimo entrambi i pulsanti restano full-width per
          essere comodamente tappabili.
        */}
        <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onClickDismiss}
            disabled={busy}
            className={[
              'inline-flex h-7 items-center justify-center gap-1 rounded-md border px-2 text-[11px] font-medium transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-400/80',
              busy
                ? 'cursor-not-allowed border-slate-700/60 bg-slate-900/40 text-slate-500'
                : 'border-slate-600/70 bg-slate-900/60 text-slate-200 hover:bg-slate-800/70',
            ].join(' ')}
            title="Nascondi il suggerimento e procedi con le correzioni a mano"
          >
            <XIcon size={12} aria-hidden />
            <span>Procedo io manualmente</span>
          </button>
          <button
            type="button"
            onClick={onClickCorreggi}
            disabled={busy}
            className={[
              'inline-flex h-7 items-center justify-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400/80',
              busy
                ? 'cursor-wait border-amber-500/40 bg-amber-500/10 text-amber-200/80'
                : 'border-amber-500/65 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30',
            ].join(' ')}
            aria-busy={busy}
            title={
              busy
                ? 'Sto propagando lo stile delle tue correzioni ai messaggi non ancora rivisti…'
                : 'Riscrivi gli altri messaggi imitando lo stile delle tue correzioni'
            }
          >
            {busy ? (
              <>
                <Loader2 size={13} aria-hidden className="animate-spin" />
                <span>Sto correggendo i messaggi rimanenti…</span>
              </>
            ) : (
              <>
                <Sparkles size={13} aria-hidden />
                <span>Correggi</span>
              </>
            )}
          </button>
        </div>
      </div>
      {preview !== null ? (
        <div className="mt-3 border-t border-amber-500/35 pt-2.5">
          {preview.error ? (
            <p className="mb-2 text-[11px] leading-snug text-red-300">{preview.error}</p>
          ) : null}
          <div
            key={previewResultAnimKey}
            className={
              previewResultAnimKey > 0
                ? 'rounded-md animate-omnia-callout-attention'
                : 'rounded-md'
            }
          >
            <label htmlFor="omnia-correzione-anteprima-sintesi" className="sr-only">
              Sintesi stile suggerito
            </label>
            <textarea
              id="omnia-correzione-anteprima-sintesi"
              value={preview.synthesis}
              onChange={onSynthesisChange}
              readOnly={preview.loading}
              rows={4}
              aria-busy={preview.loading}
              className="min-h-[72px] w-full resize-y rounded-md border border-slate-600/60 bg-slate-950/65 px-2 py-1.5 text-[11px] leading-relaxed text-slate-100 placeholder:text-slate-500 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400/70 read-only:cursor-default read-only:border-slate-600/45"
            />
            <p className="mt-1.5 text-[10px] leading-snug text-slate-400/95">
              Qui sopra puoi aggiungere altri dettagli o modificare la mia sintesi se non la trovi corretta
            </p>
            <div className="mt-2 space-y-1.5">
              {[0, 1, 2].map((idx) => {
                const slot = preview.rows[idx];
                const summaryCurrent = slot?.current?.trim() ? slot.current : '—';
                const bodyProposed = slot?.proposed?.trim() ? slot.proposed : '—';
                const title = slot?.useCaseLabel?.trim()
                  ? ` (${slot.useCaseLabel})`
                  : '';
                return (
                  <details
                    key={idx}
                    className="rounded border border-slate-600/35 bg-slate-950/20 px-2 py-1 text-slate-200"
                    defaultOpen={idx < 2}
                  >
                    <summary className="cursor-pointer whitespace-pre-wrap text-[11px] font-medium text-slate-100 [&::-webkit-details-marker]:hidden">
                      <span className="font-semibold text-amber-200/95">Frase attuale{title}</span>
                      <span className="block pl-0 text-[11px] font-normal text-slate-200/90">{summaryCurrent}</span>
                    </summary>
                    <div className="mt-2 border-t border-dashed border-slate-700/55 pt-2">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-200/85">
                        Come diventerebbe se corretta
                      </p>
                      <div className="rounded border border-emerald-200/40 bg-emerald-50/50 px-2 py-1.5 text-sm text-emerald-950 whitespace-pre-wrap dark:border-emerald-800/30 dark:bg-emerald-950/25 dark:text-emerald-100">
                        {bodyProposed}
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
