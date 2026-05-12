/**
 * Pannello destro on-demand: nastro di compilazione conversazionale dello use case selezionato
 * (master/detail: la lista a SX è il master, questo pannello è il detail).
 *
 * Visibile quando il designer attiva il toggle «Mostra JSON» nella toolbar (Riga 2 lista use
 * case). Sostituisce — solo per la durata del toggle — il contenuto standard del pannello
 * destro del wizard. Lo scopo è permettere al designer di ispezionare la forma 1:1 con cui
 * ogni use case verrà passato al motore esterno.
 *
 * Sezioni del nastro (read-only):
 *  1. Testo tokenizzato in linguaggio naturale — canonico con valori literal tra `[ ]` arancio.
 *  2. Testo tokenizzato con token runtime — placeholder ambra (`[data]`, `[ora1]`, ...).
 *  3. JSON — proiezione finale in Monaco con coloritura semantica per chiave.
 *
 * Mini-header con counter `[N di M] · label` e frecce ◀ ▶ per navigare gli use case
 * proiettabili senza tornare alla lista.
 *
 * Decisioni:
 *  - Read-only puro per output compilati: la fonte di verità è il messaggio canonico nello use
 *    case, non la proiezione renderizzata. Edit qui sarebbero ambigui e creerebbero divergenza.
 *  - Non persistito: il toggle è UI-state in memoria; chiudendo il wizard si torna alla view
 *    standard. Coerente con la decisione «memory-only» concordata.
 *  - Singolo use case alla volta: mostrare TUTTI in un unico stream sarebbe rumoroso e fuorvia
 *    il designer sulla forma effettiva trasmessa per ciascuno.
 *  - Auto-select primo proiettabile se la selezione corrente è null o non proiettabile, così
 *    il pannello non resta mai vuoto se almeno un use case è disponibile.
 */

import React from 'react';
import MonacoEditor from 'react-monaco-editor';
import * as monaco from 'monaco-editor';
import { AlertTriangle, ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import {
  compileUseCaseConversationalText,
  isUseCaseProjectable,
  projectUseCaseToConversationalJson,
  type UseCaseConversationalJson,
} from '@domain/useCaseGeneratorWizard/useCaseJsonProjection';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { TokenizedHighlightedText } from './TokenizedHighlightedText';
import {
  computeSemanticJsonDecorations,
  ensureConversationalJsonTheme,
  getConversationalJsonThemeId,
} from './conversationalMonaco';
import './conversationalMonaco.css';

export interface ConversationalJsonPanelProps {
  /** Use case selezionato dal designer nella lista (master). `null` = nessuna selezione. */
  selectedUseCase: AIAgentUseCase | null;
  /**
   * Catalogo completo (ordine catalogo, già normalizzato dal parent). Usato per:
   *  - filtrare gli use case proiettabili da navigare con le frecce;
   *  - calcolare il counter `[N di M]`;
   *  - auto-select del primo proiettabile quando `selectedUseCase` è null/non proiettabile.
   * Se non passato, le frecce e il counter restano nascosti (compat con call-site legacy).
   */
  useCases?: readonly AIAgentUseCase[];
  /**
   * Callback per richiedere la selezione di un altro use case (frecce ◀ ▶ del mini-header).
   * Se non passato, le frecce restano nascoste. Il parent deve aggiornare la selezione master
   * (es. lista SX) così il pannello rimane sincronizzato.
   */
  onSelectUseCase?: (useCaseId: string) => void;
}

const MONACO_OPTIONS = {
  readOnly: true,
  domReadOnly: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  wordWrap: 'on',
  automaticLayout: true,
  fontSize: 12,
  tabSize: 2,
  lineNumbers: 'on',
  folding: true,
  renderLineHighlight: 'line',
} as const;

export function ConversationalJsonPanel({
  selectedUseCase,
  useCases,
  onSelectUseCase,
}: ConversationalJsonPanelProps): React.ReactElement {
  React.useEffect(() => {
    ensureConversationalJsonTheme(monaco);
  }, []);

  /**
   * Lista dei proiettabili per le frecce. Memo per stabilità: `useCases` viene rigenerata
   * dal parent ad ogni cambio (riferimento), ma il sotto-set proiettabile cambia solo se
   * cambiano le frasi canoniche o gli id.
   */
  const projectableUseCases = React.useMemo(
    () => (useCases ? useCases.filter((u) => isUseCaseProjectable(u)) : []),
    [useCases]
  );

  /**
   * Se la selezione master è null o non proiettabile (es. use case appena creato senza
   * assistente), promuoviamo il primo proiettabile. La promozione passa per il parent (via
   * `onSelectUseCase`) — non manteniamo selezione locale per non desincronizzare la lista SX.
   *
   * Effect riservato al lift-up: senza `onSelectUseCase` (call-site legacy) il pannello si
   * limita a non-mostrare nulla, coerentemente con il behaviour pre-refactor.
   */
  React.useEffect(() => {
    if (!onSelectUseCase) return;
    if (projectableUseCases.length === 0) return;
    const isCurrentValid =
      selectedUseCase != null &&
      projectableUseCases.some((u) => u.id === selectedUseCase.id);
    if (isCurrentValid) return;
    const first = projectableUseCases[0];
    if (first) onSelectUseCase(first.id);
  }, [onSelectUseCase, projectableUseCases, selectedUseCase]);

  const projected: UseCaseConversationalJson | null = React.useMemo(
    () => (selectedUseCase ? projectUseCaseToConversationalJson(selectedUseCase) : null),
    [selectedUseCase]
  );
  const compiled = React.useMemo(
    () => (selectedUseCase ? compileUseCaseConversationalText(selectedUseCase) : null),
    [selectedUseCase]
  );

  const jsonStr = React.useMemo(
    () => (projected ? JSON.stringify(projected, null, 2) : ''),
    [projected]
  );

  const [copyFlash, setCopyFlash] = React.useState(false);
  const handleCopy = React.useCallback(async () => {
    if (!jsonStr) return;
    /**
     * Fallisce esplicitamente se la clipboard non è disponibile: non vogliamo dare l'illusione
     * che la copia sia avvenuta. Il consumer (toolbar/log) si aspetta una eccezione propagata.
     */
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      throw new Error('Clipboard non disponibile in questo contesto.');
    }
    await navigator.clipboard.writeText(jsonStr);
    setCopyFlash(true);
    window.setTimeout(() => setCopyFlash(false), 1600);
  }, [jsonStr]);

  /**
   * Indice corrente nella lista dei proiettabili — `null` se nessun match (es. lo use case
   * selezionato non è proiettabile o non appartiene al catalogo passato).
   */
  const currentIndex = React.useMemo(() => {
    if (!selectedUseCase || projectableUseCases.length === 0) return -1;
    return projectableUseCases.findIndex((u) => u.id === selectedUseCase.id);
  }, [selectedUseCase, projectableUseCases]);

  const canShowNavigation =
    typeof onSelectUseCase === 'function' && projectableUseCases.length > 0;

  const goPrev = React.useCallback(() => {
    if (!onSelectUseCase || projectableUseCases.length === 0) return;
    if (currentIndex <= 0) return;
    const target = projectableUseCases[currentIndex - 1];
    if (target) onSelectUseCase(target.id);
  }, [onSelectUseCase, projectableUseCases, currentIndex]);

  const goNext = React.useCallback(() => {
    if (!onSelectUseCase || projectableUseCases.length === 0) return;
    if (currentIndex < 0 || currentIndex >= projectableUseCases.length - 1) return;
    const target = projectableUseCases[currentIndex + 1];
    if (target) onSelectUseCase(target.id);
  }, [onSelectUseCase, projectableUseCases, currentIndex]);

  const labelForHeader = projected?.label || selectedUseCase?.label || '';
  const counterLabel =
    canShowNavigation && currentIndex >= 0
      ? `${currentIndex + 1} di ${projectableUseCases.length}`
      : '';

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-700/60 pb-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {canShowNavigation ? (
            <NavArrow
              direction="prev"
              disabled={currentIndex <= 0}
              onClick={goPrev}
              ariaLabel="Use case precedente"
            />
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-2">
              {counterLabel ? (
                <span className="rounded border border-violet-500/40 bg-violet-950/40 px-1.5 py-[1px] text-[10px] font-mono font-semibold text-violet-200">
                  {counterLabel}
                </span>
              ) : null}
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-200">
                Compilazione conversazionale
              </span>
            </div>
            {labelForHeader ? (
              <span className="truncate text-[11px] text-slate-400" title={labelForHeader}>
                {labelForHeader}
              </span>
            ) : (
              <span className="text-[11px] italic text-slate-500">
                Nessuno use case selezionato
              </span>
            )}
          </div>
          {canShowNavigation ? (
            <NavArrow
              direction="next"
              disabled={currentIndex < 0 || currentIndex >= projectableUseCases.length - 1}
              onClick={goNext}
              ariaLabel="Use case successivo"
            />
          ) : null}
        </div>
        <button
          type="button"
          disabled={!jsonStr}
          onClick={() => void handleCopy()}
          className="inline-flex shrink-0 items-center gap-1 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-200 transition-colors hover:bg-slate-700 disabled:opacity-40"
          title="Copia JSON negli appunti"
        >
          <Copy size={12} aria-hidden />
          {copyFlash ? 'Copiato' : 'Copia'}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-slate-700/60 bg-[#0c0c0f]">
        {projected ? (
          <div className="flex min-h-full flex-col gap-3 p-3">
            <RibbonSection title="Testo tokenizzato in linguaggio naturale">
              {compiled ? (
                <TokenizedHighlightedText
                  text={compiled.naturalText}
                  mode="literal"
                  className="whitespace-pre-wrap text-xs leading-relaxed text-slate-200"
                />
              ) : (
                <p className="text-xs italic text-slate-500">Nessun testo canonico.</p>
              )}
            </RibbonSection>

            <RibbonSection title="Testo tokenizzato con token runtime">
              {compiled ? (
                <TokenizedHighlightedText
                  text={compiled.tokenizedText}
                  mode="runtime"
                  className="whitespace-pre-wrap text-xs leading-relaxed text-slate-100"
                />
              ) : (
                <p className="text-xs italic text-slate-500">Nessun testo compilabile.</p>
              )}
              {compiled?.brackets.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {compiled.brackets.map((b, idx) => (
                    <span
                      key={`${b.source}-${idx}`}
                      className={[
                        'rounded border px-1.5 py-0.5 text-[10px] font-mono',
                        b.confidence === 'fallback'
                          ? 'border-amber-400/45 bg-amber-950/30 text-amber-200'
                          : 'border-emerald-400/30 bg-emerald-950/20 text-emerald-200',
                      ].join(' ')}
                      title={`Literal: ${b.source}`}
                    >
                      {b.source || '(vuoto)'} → [{b.finalName}]
                    </span>
                  ))}
                </div>
              ) : null}
            </RibbonSection>

            {compiled?.warnings.length ? (
              <div className="rounded-md border border-amber-500/35 bg-amber-950/25 p-2">
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-200">
                  <AlertTriangle size={13} aria-hidden />
                  Verifica richiesta
                </div>
                <ul className="space-y-1 text-[11px] leading-relaxed text-amber-100">
                  {compiled.warnings.map((w) => (
                    <li key={w}>• {w}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <RibbonSection title="JSON">
              <div className="h-[320px] min-h-[240px] overflow-hidden rounded border border-slate-700/60">
                <SemanticJsonEditor value={jsonStr} />
              </div>
            </RibbonSection>
          </div>
        ) : (
          <ConversationalJsonPanelEmptyState hasSelection={Boolean(selectedUseCase)} />
        )}
      </div>
    </div>
  );
}

/**
 * Wrapper sottile sull'editor Monaco JSON che applica le decorations semantiche per chiave
 * (`useCaseId`, `label`, `scenario`, `tokenizedExample`, `tokens`) al mount e ad ogni cambio
 * di valore. Le decorations sono full-replace via `deltaDecorations(prev, next)`.
 */
function SemanticJsonEditor({ value }: { value: string }): React.ReactElement {
  const editorRef = React.useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = React.useRef<string[]>([]);

  const applyDecorations = React.useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;
    const next = computeSemanticJsonDecorations(model);
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, next);
  }, []);

  const handleEditorDidMount = React.useCallback(
    (editor: monaco.editor.IStandaloneCodeEditor) => {
      editorRef.current = editor;
      applyDecorations();
    },
    [applyDecorations]
  );

  React.useEffect(() => {
    applyDecorations();
  }, [applyDecorations, value]);

  return (
    <MonacoEditor
      width="100%"
      height="100%"
      language="json"
      theme={getConversationalJsonThemeId()}
      value={value}
      options={MONACO_OPTIONS}
      editorDidMount={handleEditorDidMount}
    />
  );
}

function NavArrow({
  direction,
  disabled,
  onClick,
  ariaLabel,
}: {
  direction: 'prev' | 'next';
  disabled: boolean;
  onClick: () => void;
  ariaLabel: string;
}): React.ReactElement {
  const Icon = direction === 'prev' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={ariaLabel}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-slate-700/70 bg-slate-900/70 text-slate-300 transition-colors hover:border-violet-400/55 hover:text-violet-200 disabled:cursor-not-allowed disabled:border-slate-800/70 disabled:bg-slate-900/40 disabled:text-slate-600"
    >
      <Icon size={14} aria-hidden />
    </button>
  );
}

function RibbonSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section className="rounded-md border border-slate-700/65 bg-slate-950/75 p-2.5">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * Stato vuoto: distingue tra «nessuno use case selezionato» e «use case selezionato ma non
 * compilabile» (frase canonica vuota). Messaggio asciutto, niente call-to-action competitive
 * con il pannello standard.
 */
function ConversationalJsonPanelEmptyState({
  hasSelection,
}: {
  hasSelection: boolean;
}): React.ReactElement {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#0c0c0f] px-4 text-center">
      <p className="max-w-sm text-xs leading-relaxed text-slate-400">
        {hasSelection
          ? 'Lo use case selezionato non ha un messaggio agente canonico compilabile.'
          : 'Seleziona uno use case dalla lista a sinistra per vederne il JSON.'}
      </p>
    </div>
  );
}
