/**
 * AI Agent Construction Wizard — Schermata di benvenuto (Tutor).
 *
 * Mostrata UNA volta sola alla prima apertura di un task AI Agent vuoto. La sua presenza è
 * controllata dal flag persistito `agentWizardTutorAcknowledged` (vedi
 * `useAIAgentEditorController`): al primo click di «Cominciamo» il flag passa a `true` e la
 * Tutor non riapparirà più per quel task.
 *
 * Layout (decisione design):
 *   3 colonne side-by-side quando il pannello è abbastanza largo, **tutte centrate sullo
 *   stesso asse orizzontale** (`items-center`) per evitare l'effetto «icona galleggiante»:
 *     [icona hero] [titolo + descrizione] [lista 5 passi + bottone «Cominciamo»]
 *   - icona: Sparkles 58px in cerchio 108px, glow viola; centrata col row.
 *   - colonna centrale: titolo + paragrafo, allineati a sinistra, larghezza fissa
 *     `max-w-md` (448px) per evitare wrap del titolo.
 *   - colonna destra: lista verticale dei 5 passi + bottone «Cominciamo» allineato a destra.
 *   - container outer: `max-w-4xl` + `gap-6` per una composizione compatta (3 blocchi
 *     percepiti come unico blocco centrato).
 *
 * Fallback responsivo:
 *   Se il PANNELLO scende sotto `NARROW_BREAKPOINT_PX` (non la viewport — l'editor vive
 *   dentro Dockview), il layout torna allo stack verticale (icona, titolo, lista, bottone)
 *   per non comprimere troppo le colonne. La misura usa un `ResizeObserver` sul container.
 *
 * Animazione di uscita:
 *   Quando il parent setta `isExiting === true`, l'intero contenitore + ogni voce della
 *   lista applicano una transizione CSS (~400ms) di shrink + translateY-up + fade-out, in
 *   cascata (delay incrementale 50ms per ogni riga). NESSUNA libreria esterna.
 */

import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { AGENT_WIZARD_STEPS_META } from './agentWizardStepsMeta';

/**
 * Larghezza minima (px) del pannello sotto cui il layout 3-colonne torna a stack verticale.
 * Calibrata su: icona ~120px + gap + colonna centro ~280px + gap + colonna destra ~340px
 * + padding ~ 880px. Valore intenzionalmente esposto come costante per facilitare tweak.
 */
const NARROW_BREAKPOINT_PX = 880;

export interface AIAgentWelcomeTutorProps {
  /** Callback invocata al click di «Cominciamo». Il parent gestisce ack + transizione. */
  readonly onStart: () => void;
  /**
   * True dopo che `onStart` è stato chiamato e il parent sta per smontare la Tutor.
   * Attiva l'animazione di uscita (shrink + slide-up + fade-out) su contenitore e righe.
   */
  readonly isExiting?: boolean;
}

/**
 * Hook locale: misura la larghezza del nodo passato e ritorna `true` quando è sotto la
 * soglia narrow. Usa `ResizeObserver` (supportato da tutti i browser target). Il valore
 * iniziale è `false` (assume layout largo) per evitare flash del fallback al primo paint.
 */
function useIsNarrow(ref: React.RefObject<HTMLElement | null>, breakpointPx: number): boolean {
  const [isNarrow, setIsNarrow] = React.useState(false);
  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = (width: number): void => {
      setIsNarrow((prev) => {
        const next = width < breakpointPx;
        return prev === next ? prev : next;
      });
    };
    update(node.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        update(e.contentRect.width);
      }
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, [ref, breakpointPx]);
  return isNarrow;
}

export function AIAgentWelcomeTutor({
  onStart,
  isExiting = false,
}: AIAgentWelcomeTutorProps): React.ReactElement {
  const outerRef = React.useRef<HTMLDivElement | null>(null);
  const isNarrow = useIsNarrow(outerRef, NARROW_BREAKPOINT_PX);

  return (
    <div
      ref={outerRef}
      className="relative flex h-full w-full items-center justify-center overflow-y-auto px-6 py-8 text-slate-100"
      style={{
        background:
          'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(124, 58, 237, 0.18) 0%, rgba(15, 23, 42, 0) 65%), linear-gradient(180deg, rgb(15, 23, 42) 0%, rgb(2, 6, 23) 100%)',
      }}
    >
      <div
        className={`flex w-full ${
          isNarrow
            ? 'max-w-lg flex-col items-center gap-5'
            : 'max-w-4xl flex-row items-center justify-center gap-6'
        } transition-all duration-[400ms] ease-out ${
          isExiting ? 'opacity-0 -translate-y-4 scale-95' : 'opacity-100 translate-y-0 scale-100'
        }`}
        aria-hidden={isExiting}
      >
        <HeroIcon isNarrow={isNarrow} />

        <CentralBlock isNarrow={isNarrow} />

        <RightBlock isNarrow={isNarrow} isExiting={isExiting} onStart={onStart} />
      </div>
    </div>
  );
}

/**
 * Colonna 1 — icona hero. In layout largo è `self-center` (centrata verticalmente rispetto
 * alle altre due colonne). In layout stretto torna in cima allo stack centrato.
 */
function HeroIcon({ isNarrow }: { readonly isNarrow: boolean }): React.ReactElement {
  return (
    <div className={`relative flex shrink-0 items-center justify-center ${isNarrow ? '' : 'self-center'}`}>
      <div className="absolute inset-0 rounded-full bg-violet-500/14 blur-xl" aria-hidden />
      <div className="relative flex h-[108px] w-[108px] items-center justify-center rounded-full bg-violet-700/18 shadow-[0_0_26px_rgba(167,139,250,0.28)]">
        <Sparkles size={58} className="text-violet-200/90 drop-shadow" aria-hidden />
      </div>
    </div>
  );
}

/**
 * Colonna 2 — titolo + descrizione. Top-aligned in layout largo (quindi `self-start` non
 * serve perché il container è `items-stretch`). Larghezza limitata per garantire una buona
 * lunghezza di riga del paragrafo (~70 char).
 */
function CentralBlock({ isNarrow }: { readonly isNarrow: boolean }): React.ReactElement {
  return (
    <div
      className={`flex flex-col gap-1.5 ${
        isNarrow ? 'items-center text-center' : 'max-w-md items-start text-left'
      }`}
    >
      <h1 className="text-xl font-semibold tracking-tight">
        Benvenuto! Costruiamo il tuo agente IA
      </h1>
      <p className="text-xs leading-relaxed text-slate-300">
        Qui puoi creare un agente IA per qualsiasi piattaforma. È una procedura passo-passo
        molto semplice e lineare. Ogni fase si attiverà solo quando avrai completato la
        precedente.
      </p>
    </div>
  );
}

/**
 * Colonna 3 — lista 5 passi + bottone «Cominciamo». Top-aligned. In layout largo il
 * bottone è allineato a destra (fine della colonna). In layout stretto è centrato sotto la
 * lista. Le voci della lista hanno animazione di uscita in cascata (delay 50ms × indice).
 */
function RightBlock({
  isNarrow,
  isExiting,
  onStart,
}: {
  readonly isNarrow: boolean;
  readonly isExiting: boolean;
  readonly onStart: () => void;
}): React.ReactElement {
  return (
    <div
      className={`flex flex-col gap-3 ${
        isNarrow ? 'w-full items-center' : 'w-[340px] shrink-0 items-stretch'
      }`}
    >
      <ul className="flex w-full flex-col gap-1.5" aria-label="I 5 passi del wizard">
        {AGENT_WIZARD_STEPS_META.map((meta, idx) => {
          const Icon = meta.icon;
          return (
            <li
              key={meta.index}
              style={{ transitionDelay: isExiting ? `${idx * 50}ms` : '0ms' }}
              className={`flex items-center gap-2.5 rounded-lg bg-slate-900/35 px-3.5 py-2.5 backdrop-blur-sm transition-all duration-[350ms] ease-out ${
                isExiting
                  ? 'opacity-0 -translate-y-3 scale-90'
                  : 'opacity-100 translate-y-0 scale-100'
              }`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-700/35 text-[11px] font-semibold text-violet-100">
                {meta.displayNumber}
              </span>
              <Icon
                size={22}
                className="shrink-0 text-violet-300/90"
                aria-hidden
                strokeWidth={1.75}
              />
              <span className="text-xs font-medium text-slate-100">{meta.title}</span>
            </li>
          );
        })}
      </ul>

      <div className={`flex ${isNarrow ? 'justify-center' : 'justify-end'}`}>
        <button
          type="button"
          onClick={onStart}
          disabled={isExiting}
          className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-violet-900/35 transition-colors hover:bg-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cominciamo
          <ArrowRight size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}
