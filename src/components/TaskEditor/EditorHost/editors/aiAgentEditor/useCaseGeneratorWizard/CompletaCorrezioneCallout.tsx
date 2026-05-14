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
import { ChevronDown, Loader2, Sparkles, X as XIcon } from 'lucide-react';
import {
  useUseCaseWizardListToolbarOptional,
  type UseCaseWizardListToolbarContextValue,
  type CorrectionPreviewRow,
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

function CorrectionPreviewAccordion({
  rows,
  openId,
  setOpenId,
}: {
  rows: readonly CorrectionPreviewRow[];
  openId: string | null;
  setOpenId: React.Dispatch<React.SetStateAction<string | null>>;
}): React.ReactElement {
  return (
    <div className="space-y-1.5">
      {rows.map((row) => {
        const open = openId === row.useCaseId;
        const summaryCurrent = row.current?.trim() ? row.current : '—';
        const bodyProposed = row.proposed?.trim() ? row.proposed : '—';
        const title = row.useCaseLabel?.trim() || 'Caso d’uso';
        return (
          <div
            key={row.useCaseId}
            className="overflow-hidden rounded-md border border-slate-600/40 bg-slate-950/35"
          >
            <button
              type="button"
              onClick={() => setOpenId((prev) => (prev === row.useCaseId ? null : row.useCaseId))}
              className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-[11px] font-semibold text-slate-100 transition-colors hover:bg-slate-800/40 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400/70"
              aria-expanded={open}
            >
              <span className="min-w-0 flex-1 truncate" title={title}>
                {title}
              </span>
              <ChevronDown
                size={16}
                aria-hidden
                className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
              />
            </button>
            {open ? (
              <div className="space-y-3 border-t border-slate-700/50 px-2.5 pb-2.5 pt-2.5">
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Ora è così:
                  </p>
                  <div className="max-h-48 overflow-y-auto rounded border border-slate-600/45 bg-slate-950/50 px-2 py-1.5 text-[11px] leading-relaxed text-slate-200 whitespace-pre-wrap">
                    {summaryCurrent}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-200/90">
                    La modificherei così:
                  </p>
                  <div className="max-h-48 overflow-y-auto rounded border border-emerald-700/35 bg-emerald-950/20 px-2 py-1.5 text-[11px] leading-relaxed text-emerald-50 whitespace-pre-wrap">
                    {bodyProposed}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function CalloutBody({
  ctx,
}: {
  ctx: UseCaseWizardListToolbarContextValue;
}): React.ReactElement {
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

  const [openAccordionId, setOpenAccordionId] = React.useState<string | null>(null);
  const stablePreviewRowIds = React.useMemo(() => {
    if (!preview || preview.loading || preview.rows.length === 0) return '';
    return preview.rows.map((r) => r.useCaseId).join('\x1e');
  }, [preview, preview?.loading, preview?.rows]);

  React.useEffect(() => {
    if (!preview || preview.loading) {
      setOpenAccordionId(null);
      return;
    }
    if (!stablePreviewRowIds) {
      setOpenAccordionId(null);
      return;
    }
    const ids = preview.rows.map((r) => r.useCaseId);
    setOpenAccordionId((prev) => (prev && ids.includes(prev) ? prev : ids[0]!));
  }, [preview, preview?.loading, stablePreviewRowIds]);

  const count = ctx.pendingCorrectionsCount;
  const headline =
    count === 1
      ? 'Hai modificato 1 messaggio.'
      : `Hai modificato ${count} messaggi.`;

  const actionButtons = (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center">
      <button
        type="button"
        onClick={onClickDismiss}
        disabled={busy}
        className={[
          'inline-flex h-8 items-center justify-center gap-1 rounded-md border px-2.5 text-[11px] font-medium transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-400/80',
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
          'inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400/80',
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
  );

  return (
    <div
      key={animationKey}
      role="region"
      aria-label="Suggerimento di correzione automatica"
      className="animate-omnia-callout-attention mb-3 rounded-md border border-amber-500/55 bg-amber-950/35 px-3 py-2.5 text-amber-100 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.18)]"
    >
      <div className="flex gap-2.5">
        <Sparkles
          size={16}
          aria-hidden
          className="mt-0.5 shrink-0 text-amber-300"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-[12px] font-semibold leading-snug text-amber-100">{headline}</p>

          {preview !== null ? (
            <>
              <div
                key={previewResultAnimKey}
                className={
                  previewResultAnimKey > 0
                    ? 'rounded-lg border border-slate-500/50 bg-slate-950/55 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] animate-omnia-callout-attention'
                    : 'rounded-lg border border-slate-500/50 bg-slate-950/55 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
                }
              >
                {preview.error ? (
                  <p className="mb-2 text-[11px] leading-snug text-red-300">{preview.error}</p>
                ) : null}
                <label htmlFor="omnia-correzione-anteprima-sintesi" className="sr-only">
                  Sintesi modifiche di stile (IA)
                </label>
                <textarea
                  id="omnia-correzione-anteprima-sintesi"
                  value={preview.synthesis}
                  onChange={onSynthesisChange}
                  readOnly={preview.loading}
                  rows={5}
                  aria-busy={preview.loading}
                  className="min-h-[88px] w-full resize-y rounded-md border border-slate-500/60 bg-slate-900/80 px-2 py-1.5 text-[11px] leading-relaxed text-slate-100 placeholder:text-slate-500 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400/70 read-only:cursor-default read-only:border-slate-600/50"
                />
                <div className="mt-2.5">{actionButtons}</div>
              </div>

              {!preview.loading && preview.rows.length > 0 ? (
                <>
                  <p className="pt-1 text-[11px] font-medium leading-snug text-amber-100/95">
                    Seguendo lo stile, correggerei così:
                  </p>
                  <CorrectionPreviewAccordion
                    rows={preview.rows}
                    openId={openAccordionId}
                    setOpenId={setOpenAccordionId}
                  />
                </>
              ) : null}
            </>
          ) : (
            <div className="pt-0.5">{actionButtons}</div>
          )}
        </div>
      </div>
    </div>
  );
}
