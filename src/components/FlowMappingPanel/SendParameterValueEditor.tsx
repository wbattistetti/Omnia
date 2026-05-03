/**
 * SEND backend mapping: chip (variabile o costante formattata) → editor tipizzato OpenAPI + lista variabili sotto.
 */

import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { getProjectTranslationsTable } from '../../utils/projectTranslationsRegistry';
import { resolveVariableDisplayName } from '../../utils/resolveVariableDisplayName';
import { isUuidString } from '../../utils/translationKeys';
import { useActiveFlowMetaTranslationsFlattened } from '../../hooks/useActiveFlowMetaTranslations';
import type { OpenApiInputUiKind } from '../../services/openApiBackendCallSpec';
import { SendLiteralTypedEditors } from './sendLiteralTypedEditors';
import { NumberLiteralEditor } from './NumberLiteralEditor';
import { formatSendChipLiteralDisplay } from './sendLiteralChipDisplay';
import type { EditorParamCommitPatch } from './editorParamTypes';

const mirror10 = 'text-[10px] px-2 py-1 font-normal';

/** Dev: `localStorage.setItem('EDITOR_PARAM_DEBUG','true')` + reload. */
function editorParamDebug(message: string, payload?: Record<string, unknown>) {
  if (!import.meta.env.DEV || typeof localStorage === 'undefined') return;
  if (localStorage.getItem('EDITOR_PARAM_DEBUG') !== 'true') return;
  if (payload != null) {
    console.log('[SendParameterValueEditor]', message, payload);
  } else {
    console.log('[SendParameterValueEditor]', message);
  }
}

const panelBaseClassName =
  'rounded-md border border-amber-500/40 bg-slate-950 shadow-lg ring-1 ring-amber-500/25';

function measureTextWidthPx(text: string, fontFamily: string): number {
  if (typeof document === 'undefined' || !text) return 0;
  const span = document.createElement('span');
  span.style.cssText = [
    'position:absolute',
    'visibility:hidden',
    'white-space:nowrap',
    'font-size:10px',
    'font-weight:400',
    `font-family:${fontFamily}`,
  ].join(';');
  span.textContent = text;
  document.body.appendChild(span);
  const w = span.offsetWidth;
  document.body.removeChild(span);
  return w;
}

export interface SendParameterValueEditorProps {
  variableRefId?: string;
  literalConstant?: string;
  knownVariableIds?: ReadonlySet<string>;
  variableOptions: string[];
  placeholder?: string;
  accentClassName?: string;
  onCommit: (patch: EditorParamCommitPatch) => void;
  openApiInputKind?: OpenApiInputUiKind;
  apiField?: string;
}

export function SendParameterValueEditor({
  variableRefId,
  literalConstant,
  knownVariableIds,
  variableOptions,
  placeholder = 'Variabile',
  accentClassName = 'text-amber-100/95',
  onCommit,
  openApiInputKind,
  apiField,
}: SendParameterValueEditorProps) {
  const missingSendHintId = useId();
  const flowTr = useActiveFlowMetaTranslationsFlattened();
  const mergedTr = useMemo(
    () => ({ ...getProjectTranslationsTable(), ...flowTr }),
    [flowTr]
  );
  const menuLabel = useCallback(
    (guid: string) =>
      resolveVariableDisplayName(guid, 'menuVariables', {
        compiledTranslations: mergedTr,
        flowMetaTranslations: mergedTr,
      }),
    [mergedTr]
  );

  const [open, setOpen] = useState(false);
  const [literalDraft, setLiteralDraft] = useState('');
  const [hideVariableListForDatePicker, setHideVariableListForDatePicker] = useState(false);
  const [labelColumnMaxPx, setLabelColumnMaxPx] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const skipNextDocumentCloseClickRef = useRef(false);

  const knownIds = useMemo(
    () => knownVariableIds ?? new Set(variableOptions),
    [knownVariableIds, variableOptions]
  );

  const literalChipText = useMemo(
    () => formatSendChipLiteralDisplay(literalConstant, openApiInputKind, apiField),
    [literalConstant, openApiInputKind, apiField]
  );

  const displayText = variableRefId
    ? menuLabel(variableRefId)
    : literalChipText
      ? literalChipText
      : '';

  useEffect(() => {
    if (open) {
      setHideVariableListForDatePicker(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      skipNextDocumentCloseClickRef.current = false;
    }, 0);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    editorParamDebug(open ? 'open state: panel visible' : 'open state: trigger visible', {
      apiField: (apiField || '').trim() || undefined,
      openApiInputKind: openApiInputKind ?? undefined,
      sendMissingEmpty:
        !variableRefId?.trim() && !literalConstant?.trim(),
    });
  }, [open, apiField, openApiInputKind, variableRefId, literalConstant]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (skipNextDocumentCloseClickRef.current) {
        skipNextDocumentCloseClickRef.current = false;
        editorParamDebug('document click ignored (opening gesture bubble)');
        return;
      }
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (t instanceof Element && t.closest('[data-omnia-date-picker-overlay]')) return;
      editorParamDebug('document click outside root → closing', {
        targetTag:
          t instanceof Element ? `${t.tagName}.${String((t as Element).className || '').split(/\s+/).slice(0, 4).join('.')}` : String(t),
      });
      setOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setLabelColumnMaxPx(0);
      return;
    }
    const root = rootRef.current;
    const fontFamily = root ? getComputedStyle(root).fontFamily : 'system-ui,sans-serif';
    let max = 0;
    for (const opt of variableOptions) {
      max = Math.max(max, measureTextWidthPx(menuLabel(opt), fontFamily));
    }
    max = Math.max(max, measureTextWidthPx('Costante (Invio)', fontFamily));
    max = Math.max(max, measureTextWidthPx(literalDraft, fontFamily));
    setLabelColumnMaxPx(Math.max(max, 40));
  }, [open, variableOptions, menuLabel, literalDraft]);

  useLayoutEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => {
      const el = panelRef.current?.querySelector<HTMLElement>('input, button[type="button"]');
      el?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (open) {
      setLiteralDraft(literalConstant?.trim() ?? '');
    }
  }, [open, literalConstant]);

  const showEmpty = !variableRefId?.trim() && !literalConstant?.trim();
  const emptyClass = 'text-slate-500 italic font-normal';
  const sendMissingEmpty = showEmpty;

  const pickExisting = useCallback(
    (varId: string) => {
      const id = String(varId || '').trim();
      if (!id || !isUuidString(id)) return;
      onCommit({ variableRefId: id, literalConstant: undefined });
      setOpen(false);
      setLiteralDraft('');
    },
    [onCommit]
  );

  const commitLiteralSend = useCallback(() => {
    const t = literalDraft.trim();
    if (!t) {
      onCommit({ variableRefId: undefined, literalConstant: undefined });
    } else if (knownIds.has(t)) {
      onCommit({ variableRefId: t, literalConstant: undefined });
    } else {
      onCommit({ variableRefId: undefined, literalConstant: t });
    }
    setOpen(false);
  }, [knownIds, onCommit, literalDraft]);

  const innerPadAndBorder = 16 + 2;
  const constantInputWidthPx =
    labelColumnMaxPx > 0
      ? Math.min(
          Math.max(labelColumnMaxPx + innerPadAndBorder, 72),
          Math.min(320, typeof window !== 'undefined' ? window.innerWidth - 16 : 320)
        )
      : undefined;

  const api = (apiField || '').trim();
  const useTypedLiteralUi = openApiInputKind != null || Boolean(api);
  const useNumberUi = openApiInputKind === 'number';

  const sendKeyHandlers = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitLiteralSend();
    }
    if (e.key === 'Escape') setOpen(false);
  };

  const expandedPanel = open ? (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Modifica valore parametro SEND"
      aria-invalid={sendMissingEmpty}
      className={`${panelBaseClassName} mt-1 w-fit max-w-[min(16rem,92vw)] min-w-0`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="border-b border-amber-500/20 px-2 pt-1.5 pb-1.5 flex flex-col gap-1 min-w-0">
        {useTypedLiteralUi ? (
          <div
            className="min-w-0 w-full"
            style={constantInputWidthPx != null ? { maxWidth: constantInputWidthPx } : undefined}
            onKeyDown={useNumberUi ? undefined : sendKeyHandlers}
          >
            {useNumberUi ? (
              <NumberLiteralEditor
                value={literalDraft}
                onChange={setLiteralDraft}
                onKeyDown={sendKeyHandlers}
              />
            ) : (
              <SendLiteralTypedEditors
                kind={openApiInputKind}
                apiField={apiField}
                value={literalDraft}
                onChange={setLiteralDraft}
                onLiteralCommitted={(next) => {
                  setLiteralDraft(next);
                  onCommit({ variableRefId: undefined, literalConstant: next });
                }}
                onCalendarOpenChange={setHideVariableListForDatePicker}
              />
            )}
          </div>
        ) : (
          <input
            type="text"
            className="min-w-0 rounded border border-amber-400/40 bg-slate-900 px-2 py-1 text-[10px] text-amber-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400/60 box-border"
            style={constantInputWidthPx != null ? { width: constantInputWidthPx } : { width: '100%' }}
            placeholder="Costante (Invio)"
            value={literalDraft}
            onChange={(e) => setLiteralDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitLiteralSend();
              }
              if (e.key === 'Escape') setOpen(false);
            }}
            title="Valore fisso inviato all’API se non scegli una variabile dall’elenco sotto"
          />
        )}
      </div>
      {!hideVariableListForDatePicker ? (
        <ul className="max-h-48 overflow-y-auto py-0.5" role="listbox" aria-label="Variabili disponibili">
          {variableOptions.length === 0 ? (
            <li className="px-2 py-1.5 text-[10px] text-slate-500">Nessuna variabile</li>
          ) : (
            variableOptions.map((opt) => (
              <li key={opt} role="option">
                <button
                  type="button"
                  className="w-full truncate px-2 py-1 text-left text-[10px] text-amber-100/95 hover:bg-amber-500/15"
                  onClick={(e) => {
                    e.stopPropagation();
                    pickExisting(opt);
                  }}
                >
                  {menuLabel(opt)}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  ) : null;

  return (
    <div
      ref={rootRef}
      className={`relative inline-flex min-w-0 max-w-full flex-col items-stretch ${mirror10} ${open ? 'z-20 overflow-visible' : ''}`}
    >
      {sendMissingEmpty && !open ? (
        <span id={missingSendHintId} className="sr-only">
          Valore obbligatorio per SEND: scegli una variabile dall&apos;elenco o immetti una costante.
        </span>
      ) : null}
      {!open ? (
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={false}
          aria-invalid={sendMissingEmpty}
          aria-describedby={sendMissingEmpty ? missingSendHintId : undefined}
          className={`inline-flex items-center gap-0.5 max-w-[min(16rem,92vw)] truncate rounded px-2 py-1 text-[10px] font-medium min-h-[1.75rem] border ${
            sendMissingEmpty
              ? 'border-red-500/55 bg-red-950/30 text-red-400 hover:border-red-500/75'
              : `border-transparent hover:border-amber-500/30 ${showEmpty ? emptyClass : accentClassName}`
          }`}
          onPointerDown={(e) => {
            editorParamDebug('trigger pointerdown (hit target)', {
              button: e.button,
              pointerType: e.pointerType,
              apiField: (apiField || '').trim() || undefined,
            });
          }}
          onClick={() => {
            editorParamDebug('trigger click → open panel', {
              apiField: (apiField || '').trim() || undefined,
              openApiInputKind: openApiInputKind ?? undefined,
              sendMissingEmpty,
            });
            skipNextDocumentCloseClickRef.current = true;
            setOpen(true);
          }}
          title={sendMissingEmpty ? 'Missing value — select variable or constant' : displayText || placeholder}
        >
          <span className="truncate">{sendMissingEmpty ? 'Missing value' : showEmpty ? placeholder : displayText}</span>
          <ChevronDown className="w-3 h-3 shrink-0 opacity-60" aria-hidden />
        </button>
      ) : (
        expandedPanel
      )}
    </div>
  );
}

/** Alias concettuale: editor valore parametro solo per SEND. */
export const ParameterValueEditor = SendParameterValueEditor;
