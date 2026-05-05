/**
 * Menu contestuale HTML (portal): Taglia/Copia/Incolla, variabili di flusso (nomi), Param e Prev in sottomenu espandibili.
 */

import React from 'react';
import { createPortal } from 'react-dom';
import type * as MonacoNS from 'monaco-editor';
import {
  buildAdvancementInsertMenuModel,
  type AdvancementMonacoInsertOpts,
} from './advancementInsertMenuModel';

const CLIPBOARD_ACTION_IDS: Record<'cut' | 'copy' | 'paste', string> = {
  cut: 'editor.action.clipboardCutAction',
  copy: 'editor.action.clipboardCopyAction',
  paste: 'editor.action.clipboardPasteAction',
};

function clampMenuPosition(clientX: number, clientY: number): { x: number; y: number } {
  const pad = 6;
  const estW = 280;
  const estH = Math.min(480, window.innerHeight - 2 * pad);
  const x = Math.min(clientX, Math.max(pad, window.innerWidth - estW - pad));
  const y = Math.min(clientY, Math.max(pad, window.innerHeight - estH - pad));
  return { x, y };
}

export function AdvancementMonacoContextMenuHost({
  editor,
  insertOpts,
}: {
  editor: MonacoNS.editor.IStandaloneCodeEditor | null;
  insertOpts: AdvancementMonacoInsertOpts;
}) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState({ x: 0, y: 0 });
  const [paramExpanded, setParamExpanded] = React.useState(false);
  const [prevExpanded, setPrevExpanded] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const model = React.useMemo(() => buildAdvancementInsertMenuModel(insertOpts), [insertOpts]);

  const close = React.useCallback(() => {
    setOpen(false);
    setParamExpanded(false);
    setPrevExpanded(false);
  }, []);

  const insertText = React.useCallback(
    (text: string) => {
      if (!editor) return;
      const sel = editor.getSelection();
      if (!sel) return;
      editor.executeEdits('omnia-advancement-insert', [{ range: sel, text, forceMoveMarkers: true }]);
      editor.focus();
      close();
    },
    [editor, close]
  );

  const runClipboard = React.useCallback(
    (action: 'cut' | 'copy' | 'paste') => {
      if (!editor) return;
      const id = CLIPBOARD_ACTION_IDS[action];
      void Promise.resolve(editor.getAction(id)?.run()).catch(() => {});
      editor.focus();
      close();
    },
    [editor, close]
  );

  React.useEffect(() => {
    const dom = editor?.getDomNode();
    if (!dom || !editor) return;

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const { x, y } = clampMenuPosition(e.clientX, e.clientY);
      setPos({ x, y });
      setParamExpanded(false);
      setPrevExpanded(false);
      setOpen(true);
    };

    dom.addEventListener('contextmenu', onContextMenu, true);
    return () => dom.removeEventListener('contextmenu', onContextMenu, true);
  }, [editor]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const onPointer = (e: PointerEvent) => {
      const el = menuRef.current;
      if (el && el.contains(e.target as Node)) return;
      close();
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onPointer, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onPointer, true);
    };
  }, [open, close]);

  if (!open || typeof document === 'undefined') return null;

  const hasParamPrev = model.paramKeys.length > 0;

  const menu = (
    <div
      ref={menuRef}
      role="menu"
      className="omnia-advancement-ctx-menu fixed z-[2147483000] max-h-[min(480px,78vh)] w-[min(280px,92vw)] overflow-y-auto overflow-x-hidden rounded-md border border-teal-500/50 bg-[#0d1117] py-1 text-[11px] shadow-[0_8px_32px_rgba(0,0,0,0.65)]"
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {(['cut', 'copy', 'paste'] as const).map((action) => (
        <button
          key={action}
          type="button"
          role="menuitem"
          className="flex w-full px-3 py-1.5 text-left font-sans text-slate-100 hover:bg-teal-900/50"
          onClick={() => runClipboard(action)}
        >
          {action === 'cut' ? 'Taglia' : action === 'copy' ? 'Copia' : 'Incolla'}
        </button>
      ))}
      {model.flowRows.length > 0 || hasParamPrev ? (
        <div className="my-1 border-t border-slate-600/80" role="separator" />
      ) : null}

      {model.flowRows.length > 0 ? (
        <>
          <div className="px-3 pb-0.5 pt-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
            Variabili di flusso
          </div>
          {model.flowRows.map((row, i) => (
            <button
              key={`flow-${i}-${row.displayLabel}`}
              type="button"
              role="menuitem"
              className="flex w-full max-w-full truncate px-3 py-1.5 text-left font-sans text-[11px] text-amber-100/95 hover:bg-slate-800/90"
              title={row.title}
              onClick={() => insertText(row.insertText)}
            >
              {row.displayLabel}
            </button>
          ))}
        </>
      ) : null}

      {hasParamPrev ? (
        <>
          {model.flowRows.length > 0 ? (
            <div className="my-1 border-t border-slate-600/80" role="separator" />
          ) : null}

          <button
            type="button"
            role="menuitem"
            aria-expanded={paramExpanded}
            className="flex w-full items-center justify-between px-3 py-1.5 text-left font-sans text-slate-200 hover:bg-slate-800/90"
            onClick={() => setParamExpanded((v) => !v)}
          >
            <span className="font-semibold">Param</span>
            <span className="text-[10px] text-slate-500">{paramExpanded ? '▼' : '▶'}</span>
          </button>
          {paramExpanded
            ? model.paramKeys.map((k) => (
                <button
                  key={`param-${k}`}
                  type="button"
                  role="menuitem"
                  className="flex w-full border-l-2 border-teal-600/40 pl-5 pr-3 py-1 text-left font-mono text-[10px] text-teal-100/95 hover:bg-slate-800/90"
                  title={`Inserisce param.${k}`}
                  onClick={() => insertText(`param.${k}`)}
                >
                  {k}
                </button>
              ))
            : null}

          <button
            type="button"
            role="menuitem"
            aria-expanded={prevExpanded}
            className="flex w-full items-center justify-between px-3 py-1.5 text-left font-sans text-slate-200 hover:bg-slate-800/90"
            onClick={() => setPrevExpanded((v) => !v)}
          >
            <span className="font-semibold">Prev</span>
            <span className="text-[10px] text-slate-500">{prevExpanded ? '▼' : '▶'}</span>
          </button>
          {prevExpanded
            ? model.paramKeys.map((k) => (
                <button
                  key={`prev-${k}`}
                  type="button"
                  role="menuitem"
                  className="flex w-full border-l-2 border-orange-600/35 pl-5 pr-3 py-1 text-left font-mono text-[10px] text-orange-100/90 hover:bg-slate-800/90"
                  title={`Inserisce prev.${k} (batch precedente)`}
                  onClick={() => insertText(`prev.${k}`)}
                >
                  {k}
                </button>
              ))
            : null}
        </>
      ) : null}
    </div>
  );

  return createPortal(menu, document.body);
}
