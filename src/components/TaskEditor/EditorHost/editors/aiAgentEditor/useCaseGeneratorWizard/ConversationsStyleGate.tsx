/**
 * `ConversationsStyleGate` — gate UX del passo «Conversazione» del wizard use case.
 *
 * Quando NON esistono ancora conversazioni il pannello SX **non** mostra l'usuale lista
 * vuota: deve invece costringere il designer a definire uno stile di dialogo prima di
 * generare. La definizione è disgiuntiva (il gate si "apre" se *almeno una* è valorizzata):
 *  - **Esempio testuale** in textarea: dialogo di stile da imitare (anche poche battute).
 *  - **Checkbox auto**: «Lascia che Omnia scelga uno stile» — delega allo LLM.
 *
 * Quando le conversazioni esistono, lo stesso file espone {@link ConversationsStyleBand}:
 * una banda compatta sopra le bubble che riassume lo stile attivo (esempio o auto) e
 * permette di modificarlo / collassarlo.
 *
 * **Flash + payoff** ({@link useStyleGateFlash}): se l'utente clicca un pulsante di
 * generazione conversazione senza aver definito lo stile, il padre invoca `triggerFlash()`
 * e il pannello lampeggia in ambra per ~800ms (2 cicli) accompagnato da un payoff inline
 * sotto il pulsante. La logica di "stile valido" è {@link isStyleDefined}.
 *
 * Fail-loud: i setter sono obbligatori. Niente fallback silenziosi se mancano —
 * un'invocazione senza setter indica un wiring rotto del context.
 */

import React from 'react';
import { Sparkles } from 'lucide-react';

/**
 * Lo stile è "definito" se la textarea ha almeno un carattere non-whitespace OPPURE
 * la checkbox auto è attiva. Disgiunzione esplicita — la checkbox è scorciatoia, non
 * conferma dell'esempio.
 */
export function isStyleDefined(example: string, auto: boolean): boolean {
  return auto || example.trim().length > 0;
}

export interface ConversationsStyleGateProps {
  /** Esempio testuale (multilinea). Stringa vuota = nessun esempio. */
  readonly styleExample: string;
  /** Setter user-driven; il padre marcherà dirty. */
  readonly onStyleExampleChange: (next: string) => void;
  /** Checkbox auto (delega LLM). */
  readonly styleAuto: boolean;
  readonly onStyleAutoChange: (next: boolean) => void;
  /**
   * Se true, attiva l'animazione di lampeggio ambra (2 cicli ~800ms). Il padre la
   * resetta a false dopo che l'animazione è completata (vedi {@link useStyleGateFlash}).
   */
  readonly flashing?: boolean;
}

/**
 * Empty-state del passo «Conversazione»: card con header esplicativo, textarea per
 * l'esempio di stile, e checkbox per delega automatica.
 *
 * NB: lo stato persistito è gestito dal padre (Task editor controller). Qui il componente
 * è puro: legge `styleExample`/`styleAuto` e propaga le modifiche via callback.
 */
export function ConversationsStyleGate({
  styleExample,
  onStyleExampleChange,
  styleAuto,
  onStyleAutoChange,
  flashing = false,
}: ConversationsStyleGateProps): React.ReactElement {
  return (
    <div
      className={[
        'flex h-full min-h-0 flex-1 flex-col overflow-y-auto p-4',
        flashing ? 'animate-omnia-style-flash' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-testid="conversations-style-gate"
    >
      <div className="mx-auto w-full max-w-2xl rounded-xl border border-sky-500/35 bg-slate-900/55 p-4 shadow-[0_0_18px_rgba(14,165,233,0.15)]">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles size={16} className="text-sky-300" aria-hidden />
          <h3 className="text-sm font-semibold text-sky-100">Imita questo stile:</h3>
        </div>
        <p className="mb-3 text-[12px] leading-snug text-slate-400">
          Scrivi qui un esempio di dialogo nello stile che vorresti, bastano pochi turni.
          Io poi creerò le conversazioni imitando il tuo stile.
        </p>
        <textarea
          value={styleExample}
          onChange={(e) => onStyleExampleChange(e.target.value)}
          placeholder={'Esempio:\nUtente: Ciao, vorrei prenotare per due\nAgente: Volentieri, per quale data?'}
          rows={8}
          className="w-full resize-y rounded-md border border-slate-700/80 bg-slate-950/80 p-3 font-mono text-[12px] leading-relaxed text-slate-100 placeholder:text-slate-600 focus:border-sky-400/70 focus:outline-none focus:ring-1 focus:ring-sky-400/40"
          aria-label="Esempio di stile per le conversazioni"
          spellCheck
        />
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-[12px] text-slate-300">
          <input
            type="checkbox"
            checked={styleAuto}
            onChange={(e) => onStyleAutoChange(e.target.checked)}
            className="h-3.5 w-3.5 cursor-pointer accent-sky-500"
            aria-label="Lascia che Omnia scelga uno stile"
          />
          <span>Lascia che Omnia scelga uno stile</span>
        </label>
      </div>
    </div>
  );
}

export interface ConversationsStyleBandProps extends ConversationsStyleGateProps {
  /** Espansione iniziale della banda. La banda è collassabile dopo la prima generazione. */
  readonly defaultExpanded?: boolean;
}

/**
 * Banda compatta (collassabile) mostrata sopra le bubble dopo che almeno una
 * conversazione è stata creata. Riassume lo stile attivo:
 *  - Se `auto` true → mostra «Stile: scelto da Omnia» + checkbox per disattivarlo.
 *  - Altrimenti → mostra le prime 80 char dell'esempio + click per espandere e modificare.
 */
export function ConversationsStyleBand({
  styleExample,
  onStyleExampleChange,
  styleAuto,
  onStyleAutoChange,
  defaultExpanded = false,
}: ConversationsStyleBandProps): React.ReactElement {
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const trimmed = styleExample.trim();
  const previewSummary = styleAuto
    ? 'Stile: scelto da Omnia'
    : trimmed
      ? `Stile: «${trimmed.slice(0, 80)}${trimmed.length > 80 ? '…' : ''}»`
      : 'Stile: non definito';

  return (
    <div className="shrink-0 border-b border-sky-500/25 bg-sky-950/20">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-[11px] font-medium text-sky-100 hover:bg-sky-900/20"
        aria-expanded={expanded}
        aria-controls="conversations-style-band-body"
      >
        <span className="truncate">{previewSummary}</span>
        <span className="shrink-0 text-[10px] text-sky-300/70">{expanded ? 'comprimi' : 'modifica'}</span>
      </button>
      {expanded ? (
        <div id="conversations-style-band-body" className="space-y-2 px-3 pb-2">
          <textarea
            value={styleExample}
            onChange={(e) => onStyleExampleChange(e.target.value)}
            placeholder="Esempio di dialogo nello stile desiderato…"
            rows={4}
            className="w-full resize-y rounded-md border border-slate-700/80 bg-slate-950/80 p-2 font-mono text-[11px] leading-relaxed text-slate-100 placeholder:text-slate-600 focus:border-sky-400/70 focus:outline-none focus:ring-1 focus:ring-sky-400/40"
            aria-label="Esempio di stile per le conversazioni"
            spellCheck
          />
          <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-slate-300">
            <input
              type="checkbox"
              checked={styleAuto}
              onChange={(e) => onStyleAutoChange(e.target.checked)}
              className="h-3 w-3 cursor-pointer accent-sky-500"
            />
            <span>Lascia che Omnia scelga uno stile</span>
          </label>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Hook utility per gestire il flash temporaneo del gate di stile e il payoff inline
 * sotto i pulsanti di generazione conversazione.
 *
 * Supporta DUE modalità (mutuamente esclusive in pratica, ma esposte insieme per non
 * forzare due hook separati al chiamante):
 *
 * 1. **Flash globale** (legacy v1): `flashing: boolean` + `payoffMessage: string | null`.
 *    Il pannello SX intero lampeggia. Usato dal vecchio `ConversationsStyleGate`.
 *
 * 2. **Flash per-pill** (v2): `flashingStyleId: string | null` + `payoffByStyleId`.
 *    Solo la pill colpevole lampeggia, con un payoff localizzato sotto il suo editor.
 *    Usato da `ConversationStyleEditor`. Più stili in errore → la chiamata può passare
 *    una mappa di payoff per styleId; il `flashingStyleId` è il PRIMO problema (per
 *    convenzione: l'ordine di registry è deterministico).
 *
 * `triggerFlash(...)` accetta un opzionale `targetStyleId` e/o un override del messaggio
 * payoff. Se omesso, attiva la modalità globale con il messaggio default.
 *
 * Garanzie:
 *  - Idempotente: trigger ripetuti durante un flash attivo resettano il timer (animazione
 *    riparte) — utile se l'utente clicca più pulsanti in sequenza.
 *  - Cleanup su unmount: nessun timer pendente lascia setState dopo unmount.
 *  - `clearFlash()` rimuove sia stato globale sia per-pill.
 */
export interface StyleGateFlashApi {
  /** Modalità globale (legacy v1). */
  readonly flashing: boolean;
  readonly payoffMessage: string | null;
  /** Modalità per-pill (v2). */
  readonly flashingStyleId: string | null;
  readonly payoffByStyleId: Readonly<Record<string, string | null>>;
  /**
   * Avvia il flash. Senza argomenti: modalità globale, payoff default.
   * Con `targetStyleId`: modalità per-pill, payoff per quella pill.
   * Con `payoffByStyleId`: imposta più payoff in una sola chiamata (il primo del map è
   * usato per `flashingStyleId` se `targetStyleId` non è passato — utile in batch invalidi).
   */
  triggerFlash: (params?: {
    targetStyleId?: string | null;
    message?: string;
    payoffByStyleId?: Record<string, string>;
  }) => void;
  clearFlash: () => void;
}

const DEFAULT_PAYOFF = 'Devi prima scegliere uno stile a sinistra';

export function useStyleGateFlash(): StyleGateFlashApi {
  const [flashing, setFlashing] = React.useState(false);
  const [payoffMessage, setPayoffMessage] = React.useState<string | null>(null);
  const [flashingStyleId, setFlashingStyleId] = React.useState<string | null>(null);
  const [payoffByStyleId, setPayoffByStyleId] = React.useState<Record<string, string | null>>(
    {}
  );
  const flashTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const payoffTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFlash = React.useCallback(() => {
    if (flashTimerRef.current) {
      clearTimeout(flashTimerRef.current);
      flashTimerRef.current = null;
    }
    if (payoffTimerRef.current) {
      clearTimeout(payoffTimerRef.current);
      payoffTimerRef.current = null;
    }
    setFlashing(false);
    setPayoffMessage(null);
    setFlashingStyleId(null);
    setPayoffByStyleId({});
  }, []);

  const triggerFlash = React.useCallback(
    (params?: {
      targetStyleId?: string | null;
      message?: string;
      payoffByStyleId?: Record<string, string>;
    }) => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (payoffTimerRef.current) clearTimeout(payoffTimerRef.current);

      const targetStyleId = params?.targetStyleId ?? null;
      const explicitMap = params?.payoffByStyleId ?? null;
      const messageOverride = params?.message ?? null;

      if (targetStyleId || explicitMap) {
        // Modalità per-pill (v2).
        setFlashing(false);
        setPayoffMessage(null);
        const nextMap: Record<string, string | null> = explicitMap ? { ...explicitMap } : {};
        if (targetStyleId && messageOverride && !(targetStyleId in nextMap)) {
          nextMap[targetStyleId] = messageOverride;
        }
        setPayoffByStyleId(nextMap);
        // `flashingStyleId` è il target esplicito o, in mancanza, la prima chiave del map.
        const firstKey = Object.keys(nextMap)[0] ?? null;
        setFlashingStyleId(targetStyleId ?? firstKey);
      } else {
        // Modalità globale (v1).
        setFlashingStyleId(null);
        setPayoffByStyleId({});
        setFlashing(true);
        setPayoffMessage(messageOverride ?? DEFAULT_PAYOFF);
      }

      flashTimerRef.current = setTimeout(() => {
        setFlashing(false);
        setFlashingStyleId(null);
        flashTimerRef.current = null;
      }, 800);
      payoffTimerRef.current = setTimeout(() => {
        setPayoffMessage(null);
        setPayoffByStyleId({});
        payoffTimerRef.current = null;
      }, 3500);
    },
    []
  );

  React.useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (payoffTimerRef.current) clearTimeout(payoffTimerRef.current);
    };
  }, []);

  return {
    flashing,
    payoffMessage,
    flashingStyleId,
    payoffByStyleId,
    triggerFlash,
    clearFlash,
  };
}
