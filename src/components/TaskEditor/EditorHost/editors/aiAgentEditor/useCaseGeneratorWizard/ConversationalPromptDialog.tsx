/**
 * Dialog «Crea prompt conversazionale» del wizard use case.
 *
 * Apre un overlay confinato al pannello dell'editor che mostra in sola lettura il prompt
 * conversazionale composto da {@link buildConversationalPrompt}: istruzioni IT iniziali +
 * catalogo JSON compilato on-demand dagli use case.
 *
 * Workflow:
 *  1. Il designer clicca «Crea prompt conversazionale» nella toolbar.
 *  2. Il dialog calcola il prompt una sola volta al mount (memo) — niente backend, è una
 *     pura composizione di dati locali.
 *  3. Il designer clicca «Copia tutto» per portarlo negli appunti, lo incolla nella chat del
 *     motore esterno, e ottiene un agente che si comporta come configurato.
 *
 * Decisioni:
 *  - Read-only puro: il prompt è un output deterministico del modello use case → compilazione.
 *    Edit qui sarebbero ambigui (la fonte di verità è la lista use case, non questo testo).
 *  - Nessuna persistenza: il dialog è transitorio. Chiudendolo non si perde nulla, basta
 *    riaprirlo per rigenerare.
 *  - Confinato al pannello wizard: l'editor sottostante (TaskTree, debug, …) resta visibile
 *    ma inattivo dietro l'overlay. Non c'è motivo di bloccare l'intera applicazione.
 */

import React from 'react';
import MonacoEditor from 'react-monaco-editor';
import type { editor as monacoEditorNs } from 'monaco-editor';
import { Clipboard, ClipboardCheck, Sparkles, X } from 'lucide-react';
import { buildConversationalPromptFormatSizes } from '@domain/useCaseGeneratorWizard/buildConversationalPromptFormatSizes';
import type { ConversationalCatalogFormat } from '@domain/useCaseGeneratorWizard/catalogFormat';
import {
  buildConversationalPrompt,
  type AgentBehaviorMode,
} from '@domain/useCaseGeneratorWizard/buildConversationalPrompt';
import {
  ConversationalPromptFormatPills,
  ConversationalPromptVerbositySummary,
} from './ConversationalPromptFormatPills';
import type { ConversationalRule } from '@domain/conversationalRules/types';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import {
  ensureConversationalPromptLanguage,
  getConversationalPromptLanguageId,
  getConversationalPromptThemeId,
} from './conversationalMonaco';

export interface ConversationalPromptDialogProps {
  open: boolean;
  /** Lista use case sorgente — tutti devono avere un messaggio canonico compilabile. */
  useCases: readonly AIAgentUseCase[];
  conversationalRules?: readonly ConversationalRule[];
  /**
   * Quando true, riflette il toggle "Logga Use Case" del deploy menu: il prompt include
   * il campo `log` per ogni use case e l'istruzione testuale per il caso "non riconosciuto".
   * Default `false`: il dialog mostra il prompt classico, senza tracing.
   */
  includeLog?: boolean;
  agentBehavior?: AgentBehaviorMode;
  catalogFormat: ConversationalCatalogFormat;
  onCatalogFormatChange: (format: ConversationalCatalogFormat) => void;
  onClose: () => void;
}

/**
 * Opzioni Monaco per il preview del prompt: read-only stretto, wrap attivo, font monospace
 * leggermente più grande del default per non affaticare la lettura del catalogo JSON inline.
 */
const MONACO_PROMPT_OPTIONS = {
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
  contextmenu: false,
  scrollbar: {
    vertical: 'visible',
    verticalScrollbarSize: 12,
    useShadows: true,
  },
  overviewRulerLanes: 0,
} as const;

export function ConversationalPromptDialog({
  open,
  useCases,
  conversationalRules = [],
  includeLog = false,
  agentBehavior = 'B',
  catalogFormat,
  onCatalogFormatChange,
  onClose,
}: ConversationalPromptDialogProps): React.ReactElement | null {
  const editorRef = React.useRef<monacoEditorNs.IStandaloneCodeEditor | null>(null);
  const monacoRef = React.useRef<typeof import('monaco-editor') | null>(null);
  /**
   * Costruiamo il prompt solo quando `open === true` per evitare di pagare il `JSON.stringify`
   * di N use case ad ogni render della tree del wizard. La pre-condizione (tutti compilabili)
   * viene applicata dal pulsante di apertura, ma se per qualche ragione il builder solleva,
   * mostriamo l'errore inline invece di crashare l'editor.
   */
  const promptResult = React.useMemo<{ value: string; error: string | null }>(() => {
    if (!open) return { value: '', error: null };
    try {
      return {
        value: buildConversationalPrompt(useCases, {
          includeLog,
          agentBehavior,
          conversationalRules,
          catalogFormat,
        }),
        error: null,
      };
    } catch (err) {
      return {
        value: '',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }, [open, useCases, conversationalRules, includeLog, agentBehavior, catalogFormat]);

  const formatSizes = React.useMemo(() => {
    if (!open) return null;
    try {
      return buildConversationalPromptFormatSizes(useCases, {
        includeLog,
        agentBehavior,
        conversationalRules,
      });
    } catch {
      return null;
    }
  }, [open, useCases, conversationalRules, includeLog, agentBehavior]);

  const [copyJustSucceeded, setCopyJustSucceeded] = React.useState(false);
  const [copyError, setCopyError] = React.useState<string | null>(null);
  const monacoHostRef = React.useRef<HTMLDivElement>(null);
  const [editorHeightPx, setEditorHeightPx] = React.useState(320);

  /** Altezza esplicita in px: `height="100%"` su react-monaco-editor spesso non scrolla. */
  React.useLayoutEffect(() => {
    if (!open) return;
    const el = monacoHostRef.current;
    if (!el) return;
    const syncHeight = () => {
      const h = Math.floor(el.getBoundingClientRect().height);
      if (h > 0) setEditorHeightPx(h);
    };
    syncHeight();
    const observer = new ResizeObserver(syncHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open]);

  const handleCopyAll = React.useCallback(async () => {
    const text = promptResult.value;
    if (!text) return;
    /**
     * Fail-explicit sulla clipboard: se l'API non è disponibile (sandbox, http insecure,
     * permessi) lo segnaliamo nel dialog stesso anziché loggare in console. Il designer ha
     * bisogno di sapere che il prompt NON è negli appunti.
     */
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      setCopyError('Clipboard non disponibile in questo contesto.');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopyError(null);
      setCopyJustSucceeded(true);
      window.setTimeout(() => setCopyJustSucceeded(false), 1600);
    } catch (err) {
      setCopyError(err instanceof Error ? err.message : String(err));
    }
  }, [promptResult.value]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  /**
   * Registra lingua + tema *prima* dell'istanziazione di Monaco (callback `editorWillMount`).
   * Senza questo, il componente Monaco veniva creato col `language` e `theme` referenziati ma
   * non ancora dichiarati: l'editor cadeva sul fallback plain-text e il designer NON vedeva la
   * coloritura. `editorWillMount` riceve l'istanza globale `monaco` realmente usata
   * dall'editor (quella di `react-monaco-editor`), evitando il rischio di doppia copia con
   * `import * as monaco from 'monaco-editor'` in moduli paralleli.
   */
  const handleEditorWillMount = React.useCallback((monacoInstance: typeof import('monaco-editor')) => {
    ensureConversationalPromptLanguage(monacoInstance);
  }, []);

  /**
   * Forza l'applicazione del tema all'istanza dell'editor anche dopo che il valore cambia
   * (defensive: alcune versioni di react-monaco-editor non rieseguono setTheme su prop change).
   */
  const handleEditorDidMount = React.useCallback(
    (
      editor: monacoEditorNs.IStandaloneCodeEditor,
      monacoInstance: typeof import('monaco-editor')
    ) => {
      editorRef.current = editor;
      monacoRef.current = monacoInstance;
      ensureConversationalPromptLanguage(monacoInstance);
      monacoInstance.editor.setTheme(getConversationalPromptThemeId(catalogFormat));
    },
    [catalogFormat]
  );

  React.useEffect(() => {
    monacoRef.current?.editor.setTheme(getConversationalPromptThemeId(catalogFormat));
  }, [catalogFormat]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="conversational-prompt-dialog-title"
      className="absolute inset-0 z-[60] flex flex-col bg-slate-900"
    >
      <div className="flex h-full w-full flex-col">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-violet-500/30 px-5 py-3">
          <div className="flex items-center gap-2 text-violet-100">
            <Sparkles size={18} aria-hidden />
            <h2
              id="conversational-prompt-dialog-title"
              className="text-sm font-semibold tracking-wide"
            >
              Prompt conversazionale (uso con motore esterno)
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ConversationalPromptFormatPills
              value={catalogFormat}
              onChange={onCatalogFormatChange}
              formatSizes={formatSizes}
            />
            <button
              type="button"
              disabled={!promptResult.value}
              onClick={() => void handleCopyAll()}
              className="inline-flex items-center gap-1.5 rounded-md border border-violet-500/55 bg-violet-600/85 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {copyJustSucceeded ? (
                <ClipboardCheck size={14} aria-hidden />
              ) : (
                <Clipboard size={14} aria-hidden />
              )}
              {copyJustSucceeded ? 'Copiato' : 'Copia tutto'}
            </button>
            <button
              type="button"
              aria-label="Chiudi"
              className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              onClick={onClose}
            >
              <X size={16} aria-hidden />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-5 py-4">
          <ConversationalPromptVerbositySummary
            formatSizes={formatSizes}
            activeFormat={catalogFormat}
          />
          <p className="shrink-0 text-xs leading-relaxed text-slate-400">
            Seleziona uno schema con le pillole in alto, confronta token sul catalogo, poi
            copia tutto e incollalo nel motore esterno. JSON completo = baseline storica con
            tutti i campi; gli altri schemi riducono ridondanze nel catalogo.
          </p>
          {promptResult.error ? (
            <div className="shrink-0 rounded-md border border-rose-500/55 bg-rose-950/45 px-3 py-2 text-xs text-rose-100">
              Errore costruzione prompt: {promptResult.error}
            </div>
          ) : null}
          {copyError ? (
            <div className="shrink-0 rounded-md border border-amber-500/55 bg-amber-950/45 px-3 py-2 text-xs text-amber-100">
              Impossibile copiare: {copyError}. Puoi selezionare manualmente il testo e usare Ctrl+C.
            </div>
          ) : null}
          <div
            ref={monacoHostRef}
            className="min-h-0 flex-1 overflow-hidden rounded-md border border-slate-700/80"
            aria-label="Prompt conversazionale (sola lettura)"
          >
            <MonacoEditor
              width="100%"
              height={editorHeightPx}
              language={getConversationalPromptLanguageId(catalogFormat)}
              theme={getConversationalPromptThemeId(catalogFormat)}
              value={promptResult.value}
              options={MONACO_PROMPT_OPTIONS}
              editorWillMount={handleEditorWillMount}
              editorDidMount={handleEditorDidMount}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
