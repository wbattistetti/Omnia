/**
 * Modale «LLM manual handoff» del wizard use case.
 *
 * Flusso:
 * 1. All'apertura, chiede al backend un prompt preview (system + user) per il target indicato,
 *    senza chiamare l'LLM. È la stessa stringa che verrebbe inviata al provider, quindi il
 *    motore esterno riceve esattamente l'input atteso.
 * 2. L'utente copia il prompt (concatenazione `SYSTEM:\n…\n\nUSER:\n…`) con un click.
 * 3. L'utente incolla la risposta JSON nella textarea (o tramite pulsante «Incolla risposta»
 *    che usa `navigator.clipboard.readText`).
 * 4. Smart guard: se il testo incollato coincide (string match o prefix) con il prompt copiato,
 *    appare un warning inline («Hai incollato il prompt, non la risposta…»).
 * 5. Validazione live: il JSON viene parsato e schemizzato tramite i parser interni esposti
 *    da {@link aiAgentDesignApi}. Il pulsante «Genera» è abilitato solo quando il parse
 *    restituisce un risultato valido.
 * 6. Click su «Genera» → chiama `onApply(parsedResult)` con il risultato tipizzato e chiude.
 *
 * Drafting: nessuna persistenza. Chiudere il modale azzera la textarea.
 */
import React from 'react';
import {
  Clipboard,
  ClipboardCheck,
  AlertTriangle,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import {
  buildAIAgentPromptPreviewApi,
  type BuildAIAgentPromptPreviewParams,
  type BuildAIAgentPromptPreviewResult,
} from '@services/aiAgentDesignApi';

export interface ExternalLLMHandoffDialogProps<TResult> {
  open: boolean;
  /** Titolo dell'header (es. «Genera use case con motore esterno»). */
  title: string;
  /** Etichetta del pulsante di conferma in footer (es. «Genera» / «Crea conversazione»). */
  applyButtonLabel: string;
  /** Parametri passati al backend per produrre il prompt preview (no chiamata LLM). */
  promptPreviewRequest: BuildAIAgentPromptPreviewParams;
  /** Parser interno della risposta esterna (`parseExternalGenerateUseCasesJson`, …). */
  onParseResponse: (rawJson: string) => TResult;
  onApply: (parsedResult: TResult) => void | Promise<void>;
  onClose: () => void;
}

function concatSystemUser(system: string, user: string): string {
  return `SYSTEM:\n${system}\n\nUSER:\n${user}`;
}

/**
 * Smart guard: l'utente ha incollato il prompt invece della risposta del motore esterno?
 *
 * Confronta il testo incollato contro DUE riferimenti:
 *   1. `lastCopied`: prompt copiato esplicitamente via «Copia prompt» (clipboard).
 *   2. `promptShown`: prompt visibile nel riquadro Sezione 1 (sempre disponibile dopo che
 *      la preview è stata caricata). Questo copre lo scenario in cui l'utente seleziona
 *      manualmente il testo del riquadro col mouse, Ctrl+C, Ctrl+V — senza mai cliccare
 *      «Copia prompt» — e poi si dimentica di sostituirlo con la risposta.
 *
 * Match: stringa intera oppure prefix dei primi 200 chars (robusto contro whitespace).
 */
function looksLikePromptEcho(
  pasted: string,
  lastCopied: string | null,
  promptShown: string | null
): boolean {
  const a = pasted.trim();
  if (!a) return false;
  const candidates: string[] = [];
  if (lastCopied) candidates.push(lastCopied.trim());
  if (promptShown) candidates.push(promptShown.trim());
  for (const b of candidates) {
    if (!b) continue;
    if (a === b) return true;
    const window = 200;
    if (a.length >= 32 && b.length >= 32 && a.slice(0, window) === b.slice(0, window)) {
      return true;
    }
  }
  return false;
}

export function ExternalLLMHandoffDialog<TResult>(
  props: ExternalLLMHandoffDialogProps<TResult>
): React.ReactElement | null {
  const { open, title, applyButtonLabel, promptPreviewRequest, onParseResponse, onApply, onClose } =
    props;

  const [previewLoading, setPreviewLoading] = React.useState<boolean>(false);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<BuildAIAgentPromptPreviewResult | null>(null);

  const [pasted, setPasted] = React.useState<string>('');
  const [copyJustSucceeded, setCopyJustSucceeded] = React.useState<boolean>(false);
  const [lastCopiedPrompt, setLastCopiedPrompt] = React.useState<string | null>(null);

  const [applyBusy, setApplyBusy] = React.useState<boolean>(false);
  const [applyError, setApplyError] = React.useState<string | null>(null);

  /** Reset completo all'apertura / chiusura del modale (no draft persistente). */
  React.useEffect(() => {
    if (!open) {
      setPasted('');
      setPreview(null);
      setPreviewError(null);
      setLastCopiedPrompt(null);
      setCopyJustSucceeded(false);
      setApplyBusy(false);
      setApplyError(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(null);
    setPreview(null);
    buildAIAgentPromptPreviewApi(promptPreviewRequest)
      .then((res) => {
        if (cancelled) return;
        setPreview(res);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPreviewError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (cancelled) return;
        setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
    /**
     * Eseguito solo all'apertura: la richiesta è stabile per la singola sessione del modale.
     * Per evitare loop, NON includiamo `promptPreviewRequest` nelle deps (è un oggetto nuovo
     * a ogni render). Se cambia il target o i parametri, il caller deve chiudere e riaprire.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const promptCombined = React.useMemo(() => {
    if (!preview) return '';
    return concatSystemUser(preview.system, preview.user);
  }, [preview]);

  /** Validazione live: parse e schema check tramite parser esterno fornito via prop. */
  const parsedResult = React.useMemo<{ value: TResult | null; error: string | null }>(() => {
    const text = pasted.trim();
    if (!text) return { value: null, error: null };
    try {
      return { value: onParseResponse(text), error: null };
    } catch (err) {
      return { value: null, error: err instanceof Error ? err.message : String(err) };
    }
    /**
     * `onParseResponse` è una closure stabile dal caller — è responsabilità del caller
     * mantenerla referenzialmente stabile (useCallback) se necessario.
     */
  }, [pasted, onParseResponse]);

  const promptEcho = React.useMemo(
    () => looksLikePromptEcho(pasted, lastCopiedPrompt, promptCombined || null),
    [pasted, lastCopiedPrompt, promptCombined]
  );

  const handleCopyPrompt = React.useCallback(async () => {
    if (!promptCombined) return;
    try {
      await navigator.clipboard.writeText(promptCombined);
      setLastCopiedPrompt(promptCombined);
      setCopyJustSucceeded(true);
      window.setTimeout(() => setCopyJustSucceeded(false), 1600);
    } catch (err) {
      setApplyError(
        `Impossibile copiare automaticamente: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }, [promptCombined]);

  const handlePasteResponse = React.useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setPasted(text);
    } catch (err) {
      setApplyError(
        `Impossibile leggere la clipboard: ${err instanceof Error ? err.message : String(err)}. Usa il copia/incolla manuale.`
      );
    }
  }, []);

  const handleApply = React.useCallback(async () => {
    if (!parsedResult.value) return;
    setApplyBusy(true);
    setApplyError(null);
    try {
      await onApply(parsedResult.value);
      onClose();
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : String(err));
    } finally {
      setApplyBusy(false);
    }
  }, [parsedResult, onApply, onClose]);

  if (!open) return null;

  const canApply = Boolean(parsedResult.value) && !applyBusy && !promptEcho;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="external-llm-handoff-title"
      /**
       * Layout «pannello pieno»: il dialog occupa l'INTERO container del wizard use case
       * (il caller lo monta in un parent `relative`, vedi `ViewSkaGenerator`). Niente
       * centering, niente max-width, niente backdrop semi-trasparente: copre lo spazio in
       * modo opaco e prende tutta l'area disponibile.
       */
      className="absolute inset-0 z-[60] flex flex-col bg-slate-900"
    >
      <div className="flex h-full w-full flex-col">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-violet-500/30 px-5 py-3">
          <div className="flex items-center gap-2 text-violet-100">
            <Sparkles size={18} aria-hidden />
            <h2 id="external-llm-handoff-title" className="text-sm font-semibold tracking-wide">
              {title}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Chiudi"
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            onClick={onClose}
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-300/90">
                1. Copia il prompt
              </h3>
              <button
                type="button"
                disabled={previewLoading || !promptCombined}
                onClick={() => void handleCopyPrompt()}
                className="inline-flex items-center gap-1.5 rounded-md border border-violet-500/55 bg-violet-600/85 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {copyJustSucceeded ? (
                  <ClipboardCheck size={14} aria-hidden />
                ) : (
                  <Clipboard size={14} aria-hidden />
                )}
                {copyJustSucceeded ? 'Prompt copiato' : 'Copia prompt'}
              </button>
            </div>
            <p className="text-xs leading-relaxed text-slate-400">
              Incolla questo testo nella chat del tuo motore esterno (ChatGPT, Claude, …). Il motore
              deve rispondere in formato JSON come richiesto dal prompt.
            </p>
            {/**
             * Warning «hai incollato il prompt»: visibile nel riquadro del prompt (Sezione 1)
             * perché è proprio QUESTO testo che l'utente ha incollato al posto della risposta —
             * mostrarlo qui rende immediato il riconoscimento.
             */}
            {promptEcho ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-amber-400/60 bg-amber-950/40 px-2.5 py-2 text-xs text-amber-100"
              >
                <AlertTriangle size={14} aria-hidden className="mt-0.5 shrink-0" />
                <span>
                  Hai incollato <strong>questo</strong> prompt nella textarea sotto, non la risposta
                  del motore esterno. Vai sul tuo motore (ChatGPT, Claude, …), copia il JSON che ti
                  ha restituito e incolla quello al punto 2.
                </span>
              </div>
            ) : null}
            <div
              className={`rounded-md border ${promptEcho ? 'border-amber-400/60 ring-1 ring-amber-400/40' : 'border-slate-700/80'} bg-slate-950/70`}
            >
              {previewLoading ? (
                <div className="flex items-center gap-2 px-3 py-4 text-xs text-slate-400">
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                  Preparazione prompt…
                </div>
              ) : previewError ? (
                <div className="flex items-start gap-2 px-3 py-3 text-xs text-rose-300">
                  <AlertTriangle size={14} aria-hidden className="mt-0.5 shrink-0" />
                  <span>Errore preparazione prompt: {previewError}</span>
                </div>
              ) : preview ? (
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words px-3 py-2 font-mono text-[11px] leading-snug text-slate-200">
                  {promptCombined}
                </pre>
              ) : (
                <div className="px-3 py-3 text-xs text-slate-500">Prompt non disponibile.</div>
              )}
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-300/90">
                2. Incolla la risposta JSON
              </h3>
              <button
                type="button"
                onClick={() => void handlePasteResponse()}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-600/80 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-700/80"
              >
                <Clipboard size={14} aria-hidden />
                Incolla risposta
              </button>
            </div>
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder='{ "use_cases": [...], "logical_steps": [...] }'
              spellCheck={false}
              aria-invalid={promptEcho || Boolean(parsedResult.error) ? true : undefined}
              className={`block h-44 w-full resize-y rounded-md border bg-slate-950/70 px-3 py-2 font-mono text-[11px] leading-snug text-slate-100 focus:outline-none ${
                promptEcho
                  ? 'border-amber-400/60 ring-1 ring-amber-400/40 focus:border-amber-300/80'
                  : 'border-slate-700/80 focus:border-violet-500/70'
              }`}
            />
            {promptEcho ? (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-950/35 px-2.5 py-1.5 text-xs text-amber-100">
                <AlertTriangle size={14} aria-hidden className="mt-0.5 shrink-0" />
                <span>
                  Hai incollato il prompt, non la risposta. Vai sul tuo motore esterno, ottieni il
                  JSON di risposta e incolla quello.
                </span>
              </div>
            ) : parsedResult.error ? (
              <div className="flex items-start gap-2 rounded-md border border-rose-500/40 bg-rose-950/30 px-2.5 py-1.5 text-xs text-rose-200">
                <AlertTriangle size={14} aria-hidden className="mt-0.5 shrink-0" />
                <span>{parsedResult.error}</span>
              </div>
            ) : parsedResult.value ? (
              <div className="rounded-md border border-emerald-500/40 bg-emerald-950/30 px-2.5 py-1.5 text-xs text-emerald-200">
                JSON valido. Premi «{applyButtonLabel}» per applicare.
              </div>
            ) : null}
            {applyError ? (
              <div className="flex items-start gap-2 rounded-md border border-rose-500/40 bg-rose-950/30 px-2.5 py-1.5 text-xs text-rose-200">
                <AlertTriangle size={14} aria-hidden className="mt-0.5 shrink-0" />
                <span>{applyError}</span>
              </div>
            ) : null}
          </section>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-700/70 bg-slate-900/80 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={applyBusy}
            className="rounded-md border border-slate-600/80 bg-slate-800/80 px-3 py-1.5 text-sm font-medium text-slate-100 hover:bg-slate-700/80 disabled:opacity-50"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={() => void handleApply()}
            disabled={!canApply}
            className="inline-flex items-center gap-1.5 rounded-md border border-violet-500/55 bg-violet-600/85 px-3 py-1.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {applyBusy ? (
              <Loader2 size={14} className="animate-spin" aria-hidden />
            ) : (
              <Sparkles size={14} aria-hidden />
            )}
            {applyButtonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
