/**
 * Dialog «Crea prompt conversazionale» / «Copy system prompt»: use case, backend, KB + Copia tutto.
 */

import React from 'react';
import MonacoEditor from 'react-monaco-editor';
import type { editor as monacoEditorNs } from 'monaco-editor';
import { Bot, Clipboard, ClipboardCheck, Sparkles, X } from 'lucide-react';
import Modal from '@components/Modal';
import { useProjectData, useProjectDataUpdate } from '@context/ProjectDataContext';
import { SyncElevenLabsAgentDialog } from '../SyncElevenLabsAgentDialog';
import { buildConvaiAgentSyncParams } from '@domain/convai/buildConvaiAgentSyncParams';
import type { ConvaiAgentSyncResult } from '@domain/convai/convaiAgentSyncTypes';
import { persistConvaiAgentSyncLinkOnTask } from '@domain/convai/persistConvaiAgentSyncLinkOnTask';
import type { ProjectBackendCatalogBlob } from '@domain/backendCatalog/catalogTypes';
import {
  buildExternalAgentPromptSections,
  emptyExternalPromptPlaceholder,
  externalAgentPromptSectionForTab,
  mergeExternalAgentPromptSections,
  type ExternalAgentPromptTabId,
} from '@domain/agentDesign/buildMergedExternalAgentPrompt';
import { buildConversationalPromptFormatSizes } from '@domain/useCaseGeneratorWizard/buildConversationalPromptFormatSizes';
import type { ConversationalCatalogFormat } from '@domain/useCaseGeneratorWizard/catalogFormat';
import type { AgentBehaviorMode } from '@domain/useCaseGeneratorWizard/buildConversationalPrompt';
import {
  ConversationalPromptFormatPills,
  ConversationalPromptVerbositySummary,
} from './ConversationalPromptFormatPills';
import type { ConversationalRule } from '@domain/conversationalRules/types';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import type { AgentStartPromptConfig } from '@domain/useCaseGeneratorWizard/agentStartPrompt';
import type { StagedKbDocument } from '@domain/knowledgeBase/kbDocumentTypes';
import {
  ensureConversationalPromptLanguage,
  getConversationalPromptLanguageId,
  getConversationalPromptThemeId,
} from './conversationalMonaco';
import { applyMonacoEmbeddedEditorUi } from '@utils/monacoEmbeddedSetup';
import { OPENAPI_CONTRACT_MISSING_PREFIX } from '@domain/openApi/buildOpenApiParamContractLines';
import { useOpenApiCompileErrorLineHighlight } from '../backendAnalysis/useOpenApiCompileErrorLineHighlight';
import '../backendAnalysis/openapiCompileErrorHighlight.css';
import {
  formatCompactCount,
  measurePromptText,
} from '@domain/useCaseGeneratorWizard/promptTextMetrics';
import { buildConvaiWebhookUrlPreviewRows } from '@utils/iaAgentRuntime/prepareConvaiWebhookToolForElevenLabsApi';
import { BackendWebhookUrlPreviewPanel } from './BackendWebhookUrlPreviewPanel';

export interface ConversationalPromptDialogProps {
  open: boolean;
  useCases: readonly AIAgentUseCase[];
  startPrompt?: AgentStartPromptConfig;
  startUseCaseId?: string;
  conversationalRules?: readonly ConversationalRule[];
  includeLog?: boolean;
  includeBackendLog?: boolean;
  agentBehavior?: AgentBehaviorMode;
  catalogFormat: ConversationalCatalogFormat;
  onCatalogFormatChange: (format: ConversationalCatalogFormat) => void;
  agentTaskId?: string;
  backendCatalog?: ProjectBackendCatalogBlob;
  manualCatalogBackendTaskIds?: readonly string[];
  knowledgeBaseDocuments?: readonly StagedKbDocument[];
  projectSlotLexicon?: import('@domain/useCaseBundle/projectSlotLexicon').ProjectSlotLexicon;
  backendOutputSlotBindings?: import('@domain/backendOutputSlotBinding/types').AgentBackendOutputSlotBindings;
  onClose: () => void;
}

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
  mouseWheelZoom: true,
  scrollbar: {
    vertical: 'visible',
    verticalScrollbarSize: 12,
    useShadows: true,
  },
  overviewRulerLanes: 0,
} as const;

const CONTENT_TABS: ReadonlyArray<{ id: ExternalAgentPromptTabId; label: string }> = [
  { id: 'use-cases', label: 'Use cases' },
  { id: 'backends', label: 'Backend' },
  { id: 'knowledge-base', label: 'Knowledge base' },
];

export function ConversationalPromptDialog({
  open,
  useCases,
  startPrompt,
  startUseCaseId,
  conversationalRules = [],
  includeLog = false,
  includeBackendLog = false,
  agentBehavior = 'B',
  catalogFormat,
  onCatalogFormatChange,
  agentTaskId,
  backendCatalog,
  manualCatalogBackendTaskIds,
  knowledgeBaseDocuments = [],
  projectSlotLexicon,
  backendOutputSlotBindings,
  onClose,
}: ConversationalPromptDialogProps): React.ReactElement | null {
  const editorRef = React.useRef<monacoEditorNs.IStandaloneCodeEditor | null>(null);
  const monacoRef = React.useRef<typeof import('monaco-editor') | null>(null);
  const [activeTab, setActiveTab] = React.useState<ExternalAgentPromptTabId>('use-cases');
  const { data: projectData } = useProjectData();
  const pdUpdate = useProjectDataUpdate();
  const [syncAgentOpen, setSyncAgentOpen] = React.useState(false);
  const [syncActionError, setSyncActionError] = React.useState<string | null>(null);

  const persistElevenLabsSyncResult = React.useCallback(
    async (result: ConvaiAgentSyncResult) => {
      const tid = String(agentTaskId ?? '').trim();
      const pid = String(pdUpdate?.getCurrentProjectId() ?? projectData?.projectId ?? '').trim();
      if (tid && result.link) {
        await persistConvaiAgentSyncLinkOnTask(tid, result, pid || undefined);
      }

      if (!projectData || !pdUpdate?.updateDataDirectly) return;
      const catalog = projectData.backendCatalog;
      const prev = catalog?.manualEntries ?? [];
      if (prev.length === 0) return;
      const toolByBackend = new Map(result.tools.map((t) => [t.backendTaskId, t.toolId]));
      const next = prev.map((e) => {
        const toolId = toolByBackend.get(e.id);
        return {
          ...e,
          elevenLabsConvaiAgentId: result.agentId,
          ...(toolId ? { elevenLabsConvaiToolId: toolId } : {}),
        };
      });
      pdUpdate.updateDataDirectly({
        ...projectData,
        backendCatalog: {
          schemaVersion: 1,
          manualEntries: next,
          auditLog: catalog?.auditLog ?? [],
          catalogVersion: (catalog?.catalogVersion ?? 0) + 1,
        },
      });
    },
    [agentTaskId, pdUpdate, projectData]
  );

  const convaiSyncParams = React.useMemo(
    () =>
      agentTaskId
        ? buildConvaiAgentSyncParams({
            agentTaskId,
            projectId: pdUpdate?.getCurrentProjectId() ?? projectData?.projectId ?? undefined,
            useCases,
            conversationalRules,
            includeLog,
            agentBehavior,
            catalogFormat,
            backendCatalog,
            manualCatalogBackendTaskIds,
            knowledgeBaseDocuments,
          })
        : null,
    [
      agentTaskId,
      agentBehavior,
      backendCatalog,
      catalogFormat,
      conversationalRules,
      includeLog,
      knowledgeBaseDocuments,
      manualCatalogBackendTaskIds,
      useCases,
      pdUpdate,
      projectData?.projectId,
    ]
  );

  const catalogLabelsByBackendId = React.useMemo(() => {
    const out: Record<string, string> = {};
    for (const e of backendCatalog?.manualEntries ?? []) {
      const id = String(e.id ?? '').trim();
      const label = String(e.label ?? '').trim();
      if (id && label) out[id] = label;
    }
    return out;
  }, [backendCatalog?.manualEntries]);

  const backendWebhookUrlPreviews = React.useMemo(() => {
    if (!open || !convaiSyncParams) return [];
    return buildConvaiWebhookUrlPreviewRows({
      agentTask: convaiSyncParams.agentTask,
      projectId: convaiSyncParams.projectId,
      manualCatalogBackendTaskIds: convaiSyncParams.manualCatalogBackendTaskIds,
      catalogLabelsByBackendId,
    });
  }, [catalogLabelsByBackendId, convaiSyncParams, open]);

  const sectionsResult = React.useMemo(() => {
    if (!open) return { sections: null as ReturnType<typeof buildExternalAgentPromptSections> | null, error: null as string | null };
    try {
      return {
        sections: buildExternalAgentPromptSections({
          useCases,
          startPrompt,
          startUseCaseId: String(startUseCaseId ?? '').trim() || undefined,
          includeLog,
          includeBackendLog,
          agentBehavior,
          conversationalRules,
          catalogFormat,
          agentTaskId,
          backendCatalog,
          manualCatalogBackendTaskIds,
          knowledgeBaseDocuments,
          lexicon: projectSlotLexicon,
          backendOutputSlotBindings,
        }),
        error: null,
      };
    } catch (err) {
      return {
        sections: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }, [
    open,
    useCases,
    conversationalRules,
    includeLog,
    includeBackendLog,
    agentBehavior,
    catalogFormat,
    agentTaskId,
    backendCatalog,
    manualCatalogBackendTaskIds,
    knowledgeBaseDocuments,
    startPrompt,
    startUseCaseId,
    projectSlotLexicon,
    backendOutputSlotBindings,
  ]);

  const mergedPrompt = React.useMemo(() => {
    if (!sectionsResult.sections) return '';
    return mergeExternalAgentPromptSections(sectionsResult.sections);
  }, [sectionsResult.sections]);

  const handleAggiornaAgente = React.useCallback(() => {
    setSyncActionError(null);
    if (!agentTaskId?.trim()) {
      setSyncActionError('Task agente non disponibile.');
      return;
    }
    if (!mergedPrompt.trim()) {
      setSyncActionError(
        'Prompt completo vuoto. Compila use case, backend o knowledge base prima di aggiornare l’agente.'
      );
      return;
    }
    setSyncAgentOpen(true);
  }, [agentTaskId, mergedPrompt]);

  const activeEditorText = React.useMemo(() => {
    if (!sectionsResult.sections) return '';
    const raw = externalAgentPromptSectionForTab(sectionsResult.sections, activeTab).trim();
    return raw || emptyExternalPromptPlaceholder(activeTab);
  }, [sectionsResult.sections, activeTab]);

  const formatSizes = React.useMemo(() => {
    if (!open) return null;
    try {
      return buildConversationalPromptFormatSizes(useCases, {
        includeLog,
        includeBackendLog,
        agentBehavior,
        conversationalRules,
        startPrompt,
        startUseCaseId: String(startUseCaseId ?? '').trim() || undefined,
        lexicon: projectSlotLexicon,
        backendOutputSlotBindings,
      });
    } catch {
      return null;
    }
  }, [
    open,
    useCases,
    conversationalRules,
    includeLog,
    includeBackendLog,
    agentBehavior,
    startPrompt,
    startUseCaseId,
    projectSlotLexicon,
    backendOutputSlotBindings,
  ]);

  const mergedMetrics = React.useMemo(
    () => (mergedPrompt ? measurePromptText(mergedPrompt) : null),
    [mergedPrompt]
  );

  const [copyJustSucceeded, setCopyJustSucceeded] = React.useState(false);
  const [copyError, setCopyError] = React.useState<string | null>(null);
  const monacoHostRef = React.useRef<HTMLDivElement>(null);
  const [editorHeightPx, setEditorHeightPx] = React.useState(320);

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
    const text = mergedPrompt;
    if (!text) return;
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
  }, [mergedPrompt]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleEditorWillMount = React.useCallback((monacoInstance: typeof import('monaco-editor')) => {
    ensureConversationalPromptLanguage(monacoInstance);
  }, []);

  const highlightMissingInPrompt = activeEditorText.includes(OPENAPI_CONTRACT_MISSING_PREFIX);

  const { applyDecorations: applyMissingDecorations } = useOpenApiCompileErrorLineHighlight({
    editorRef,
    value: activeEditorText,
    enabled: highlightMissingInPrompt,
    lineMatches: (line) => line.includes(OPENAPI_CONTRACT_MISSING_PREFIX),
  });

  const handleEditorDidMount = React.useCallback(
    (
      editor: monacoEditorNs.IStandaloneCodeEditor,
      monacoInstance: typeof import('monaco-editor')
    ) => {
      editorRef.current = editor;
      monacoRef.current = monacoInstance;
      applyMonacoEmbeddedEditorUi(editor);
      ensureConversationalPromptLanguage(monacoInstance);
      monacoInstance.editor.setTheme(
        getConversationalPromptThemeId(activeTab === 'use-cases' ? catalogFormat : 'json-pretty')
      );
      applyMissingDecorations();
    },
    [activeTab, applyMissingDecorations, catalogFormat]
  );

  React.useEffect(() => {
    applyMissingDecorations();
  }, [applyMissingDecorations, activeEditorText, activeTab]);

  React.useEffect(() => {
    monacoRef.current?.editor.setTheme(getConversationalPromptThemeId(catalogFormat));
  }, [catalogFormat]);

  if (!open) return null;

  const tabBtnClass = (active: boolean) =>
    [
      'rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors',
      active
        ? 'border-violet-400 bg-violet-600 text-white'
        : 'border-slate-600 bg-slate-800/90 text-slate-300 hover:border-slate-500',
    ].join(' ');

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
              Prompt completo (motore esterno)
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeTab === 'use-cases' ? (
              <ConversationalPromptFormatPills
                value={catalogFormat}
                onChange={onCatalogFormatChange}
                formatSizes={formatSizes}
              />
            ) : null}
            <button
              type="button"
              disabled={!mergedPrompt}
              onClick={() => void handleCopyAll()}
              className="inline-flex items-center gap-1.5 rounded-md border border-violet-500/55 bg-violet-600/85 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              title="Copia use case + backend + knowledge base"
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
          <div
            role="tablist"
            aria-label="Sezioni prompt"
            className="flex shrink-0 flex-wrap items-center gap-2"
          >
            {CONTENT_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={tabBtnClass(activeTab === tab.id)}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-violet-500/55 bg-violet-950/50 px-2.5 py-1 text-[11px] font-semibold text-violet-100 transition-colors hover:border-violet-400 hover:bg-violet-900/55"
              title="Sincronizza prompt completo, webhook catalogo e documenti KB su ElevenLabs"
              onClick={() => handleAggiornaAgente()}
            >
              <Bot size={13} aria-hidden className="shrink-0 opacity-90" />
              Aggiorna agente
            </button>
          </div>

          {syncActionError ? (
            <p className="shrink-0 rounded-md border border-amber-700/50 bg-amber-950/35 px-3 py-2 text-xs text-amber-100">
              {syncActionError}
            </p>
          ) : null}

          {activeTab === 'use-cases' ? (
            <ConversationalPromptVerbositySummary
              formatSizes={formatSizes}
              activeFormat={catalogFormat}
            />
          ) : null}

          {mergedMetrics ? (
            <p className="shrink-0 text-[11px] text-slate-500">
              Prompt completo (tutte le sezioni): ~
              {formatCompactCount(mergedMetrics.estimatedTokens)} tok ·{' '}
              {formatCompactCount(mergedMetrics.wordCount)} parole
            </p>
          ) : null}

          <p className="shrink-0 text-xs leading-relaxed text-slate-400">
            {activeTab === 'use-cases'
              ? 'Catalogo use case e regole conversazionali. Le pillole modificano solo questa sezione.'
              : activeTab === 'backends'
                ? 'BACKEND RECEIVE: campi risposta OpenAPI (fillFrom) e note d’uso; parametri SEND sono negli schema webhook tool.'
                : 'Sintesi documenti knowledge base con analisi completata.'}{' '}
            <span className="text-violet-200/90">Copia tutto</span> unisce le tre sezioni nell’ordine:
            use case → backend → knowledge base.
          </p>

          {sectionsResult.error ? (
            <div className="shrink-0 rounded-md border border-rose-500/55 bg-rose-950/45 px-3 py-2 text-xs text-rose-100">
              Errore costruzione prompt: {sectionsResult.error}
            </div>
          ) : null}
          {copyError ? (
            <div className="shrink-0 rounded-md border border-amber-500/55 bg-amber-950/45 px-3 py-2 text-xs text-amber-100">
              Impossibile copiare: {copyError}. Puoi selezionare manualmente il testo e usare Ctrl+C.
            </div>
          ) : null}
          {activeTab === 'backends' ? (
            <BackendWebhookUrlPreviewPanel rows={backendWebhookUrlPreviews} />
          ) : null}
          <div
            ref={monacoHostRef}
            className="min-h-0 flex-1 overflow-hidden rounded-md border border-slate-700/80"
            aria-label={`Prompt — ${CONTENT_TABS.find((t) => t.id === activeTab)?.label ?? activeTab}`}
          >
            <MonacoEditor
              key={activeTab}
              width="100%"
              height={editorHeightPx}
              language={getConversationalPromptLanguageId(
                activeTab === 'use-cases' ? catalogFormat : 'json-pretty'
              )}
              theme={getConversationalPromptThemeId(
                activeTab === 'use-cases' ? catalogFormat : 'json-pretty'
              )}
              value={activeEditorText}
              options={MONACO_PROMPT_OPTIONS}
              editorWillMount={handleEditorWillMount}
              editorDidMount={handleEditorDidMount}
            />
          </div>
        </div>
      </div>

      <SyncElevenLabsAgentDialog
        open={syncAgentOpen}
        onClose={() => setSyncAgentOpen(false)}
        syncParams={convaiSyncParams}
        elevatedOverlay
        onSynced={persistElevenLabsSyncResult}
      />
    </div>
  );
}
