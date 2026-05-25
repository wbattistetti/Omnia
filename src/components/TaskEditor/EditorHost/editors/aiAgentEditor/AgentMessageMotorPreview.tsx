/**
 * Motor JSON panel: synced IA payload, Monaco preview, copy, and expand-within-use-case-shell overlay.
 */

import React from 'react';
import { createPortal } from 'react-dom';
import MonacoEditor from 'react-monaco-editor';
import { ChevronDown, ChevronRight, Copy, Maximize2, Minimize2 } from 'lucide-react';
import * as monaco from 'monaco-editor';
import {
  applyMonacoEmbeddedEditorUi,
  withOmniaMonacoChromeColors,
} from '@utils/monacoEmbeddedSetup';
import type {
  AgentMessageMotorPayload,
  AgentTemplateSegment,
} from '@domain/aiAgentUseCase/splitAgentMessageTemplate';

export interface AgentMessageMotorPreviewProps {
  motorPayload: AgentMessageMotorPayload | null;
  isStale: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
  /** When set, “Espandi” covers this container (albero use case + pannello dettaglio). */
  expandMountRef?: React.RefObject<HTMLDivElement | null>;
}

const INLINE_JSON_EDITOR_HEIGHT = 280;
const FULLSCREEN_HEADER_PX = 44;

export function AgentMessageMotorPreview({
  motorPayload,
  isStale,
  expanded,
  onToggleExpanded,
  expandMountRef,
}: AgentMessageMotorPreviewProps) {
  const segments: AgentTemplateSegment[] = motorPayload?.segments ?? [];
  const jsonStr = React.useMemo(
    () => (motorPayload ? JSON.stringify(motorPayload, null, 2) : ''),
    [motorPayload]
  );

  const [fullscreen, setFullscreen] = React.useState(false);
  const [fullEditorHeight, setFullEditorHeight] = React.useState(400);
  const [copyFlash, setCopyFlash] = React.useState(false);

  React.useEffect(() => {
    monaco.editor.defineTheme('omnia-json-panel', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: withOmniaMonacoChromeColors({
        'editor.background': '#0c0c0f',
        'editor.foreground': '#d4d4d8',
      }),
    });
  }, []);

  const handleEditorDidMount = React.useCallback(
    (editor: monaco.editor.IStandaloneCodeEditor) => {
      applyMonacoEmbeddedEditorUi(editor);
    },
    []
  );

  const measureShell = React.useCallback(() => {
    const el = expandMountRef?.current;
    if (!el) return;
    const h = Math.max(200, el.clientHeight - FULLSCREEN_HEADER_PX);
    setFullEditorHeight(h);
  }, [expandMountRef]);

  React.useEffect(() => {
    if (!fullscreen) return;
    measureShell();
    const el = expandMountRef?.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measureShell());
    ro.observe(el);
    window.addEventListener('resize', measureShell);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measureShell);
    };
  }, [fullscreen, expandMountRef, measureShell]);

  React.useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  const handleCopy = React.useCallback(async () => {
    if (!jsonStr) return;
    try {
      await navigator.clipboard.writeText(jsonStr);
      setCopyFlash(true);
      window.setTimeout(() => setCopyFlash(false), 1600);
    } catch {
      throw new Error('Impossibile copiare negli appunti.');
    }
  }, [jsonStr]);

  const monacoOptions = React.useMemo(
    () => ({
      readOnly: true,
      domReadOnly: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on' as const,
      automaticLayout: true,
      fontSize: 12,
      tabSize: 2,
      lineNumbers: 'on' as const,
      folding: true,
      renderLineHighlight: 'line' as const,
      mouseWheelZoom: true,
    }),
    []
  );

  const mountEl = expandMountRef?.current ?? null;
  const canExpandInShell = Boolean(jsonStr && mountEl);

  const fullscreenOverlay =
    fullscreen && mountEl
      ? createPortal(
          <div
            className="absolute inset-0 z-[80] flex flex-col bg-[#0c0c0f] ring-2 ring-emerald-700/40 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label="JSON motore ingrandito (albero e dettaglio scenario)"
          >
            <div
              className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-700 bg-slate-900/95 px-3 py-2"
              style={{ minHeight: FULLSCREEN_HEADER_PX }}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-200">JSON</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={!jsonStr}
                  onClick={() => void handleCopy()}
                  className="inline-flex items-center gap-1 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-200 hover:bg-slate-750 disabled:opacity-40"
                >
                  <Copy size={12} aria-hidden />
                  {copyFlash ? 'Copiato' : 'Copia'}
                </button>
                <button
                  type="button"
                  onClick={() => setFullscreen(false)}
                  className="inline-flex items-center gap-1 rounded border border-emerald-700/60 bg-emerald-950/70 px-2 py-1 text-[10px] font-semibold text-emerald-100 hover:bg-emerald-900/80"
                >
                  <Minimize2 size={12} aria-hidden />
                  Comprimi
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              {jsonStr ? (
                <MonacoEditor
                  width="100%"
                  height={fullEditorHeight}
                  language="json"
                  theme="omnia-json-panel"
                  value={jsonStr}
                  options={monacoOptions}
                  editorDidMount={handleEditorDidMount}
                />
              ) : null}
            </div>
          </div>,
          mountEl
        )
      : null;

  return (
    <>
      {fullscreenOverlay}
      <div className="rounded-lg border border-slate-700/60 bg-slate-950/50 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 border-b border-slate-700/50 bg-slate-900/80">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">JSON</span>
            {isStale ? (
              <span className="rounded border border-amber-500/60 bg-amber-950/50 px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-amber-100">
                Messaggio modificato — usa Aggiorna JSON
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              disabled={!jsonStr}
              title="Copia JSON negli appunti"
              onClick={() =>
                void handleCopy().catch(() => {
                  /* clipboard denied — silent */
                })
              }
              className="inline-flex items-center gap-0.5 rounded border border-slate-600/70 bg-slate-800/90 px-2 py-0.5 text-[10px] font-semibold text-slate-200 hover:bg-slate-700/90 disabled:opacity-40"
            >
              <Copy size={12} aria-hidden />
              {copyFlash ? 'Copiato' : 'Copia'}
            </button>
            <button
              type="button"
              disabled={!canExpandInShell}
              title={
                expandMountRef
                  ? 'Espandi il JSON su tutta l’area use case (albero + dettaglio)'
                  : 'Espandi non disponibile'
              }
              onClick={() => setFullscreen(true)}
              className="inline-flex items-center gap-0.5 rounded border border-emerald-700/55 bg-emerald-950/55 px-2 py-0.5 text-[10px] font-semibold text-emerald-100 hover:bg-emerald-900/65 disabled:opacity-40"
            >
              <Maximize2 size={12} aria-hidden />
              Espandi
            </button>
            <button
              type="button"
              onClick={onToggleExpanded}
              aria-expanded={expanded}
              title={expanded ? 'Nascondi dettaglio' : 'Mostra dettaglio'}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            >
              {expanded ? <ChevronDown size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
            </button>
          </div>
        </div>
        {expanded ? (
          <div className="px-2.5 py-2 space-y-2">
            {!motorPayload ? (
              <p className="text-xs text-slate-500">
                Nessun JSON sincronizzato. Usa &quot;Crea JSON&quot; dopo aver scritto il messaggio, oppure attendi la
                creazione automatica dello scenario.
              </p>
            ) : (
              <>
                <div className="rounded-md bg-slate-900/90 px-2 py-1.5 text-xs leading-relaxed text-slate-200 break-words">
                  {segments.length === 0 ? (
                    <span className="text-slate-500">—</span>
                  ) : (
                    segments.map((seg, i) => (
                      <SegmentSpan
                        key={
                          seg.kind === 'text'
                            ? `t:${i}:${seg.text.slice(0, 64)}`
                            : `s:${i}:${seg.raw}`
                        }
                        segment={seg}
                      />
                    ))
                  )}
                </div>
                <div className="rounded-md border border-slate-700/60 overflow-hidden bg-[#0c0c0f]">
                  <MonacoEditor
                    width="100%"
                    height={INLINE_JSON_EDITOR_HEIGHT}
                    language="json"
                    theme="omnia-json-panel"
                    value={jsonStr}
                    options={monacoOptions}
                    editorDidMount={handleEditorDidMount}
                  />
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}

function SegmentSpan({ segment }: { segment: AgentTemplateSegment }) {
  if (segment.kind === 'text') {
    return <span className="text-slate-200">{segment.text}</span>;
  }
  return (
    <span
      className="rounded-sm bg-yellow-400/20 px-0.5 font-medium text-yellow-200 ring-1 ring-yellow-400/45"
      title={`Slot: ${segment.name}`}
    >
      {segment.raw}
    </span>
  );
}
