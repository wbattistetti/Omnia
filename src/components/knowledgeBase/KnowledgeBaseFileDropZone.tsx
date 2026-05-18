/**
 * File picker + drag-and-drop zone for knowledge-base documents (.txt / .xlsx).
 */

import React from 'react';
import { Upload } from 'lucide-react';

export type KnowledgeBaseFileDropZoneHandle = {
  openPicker: () => void;
};

export type KnowledgeBaseFileDropZoneProps = {
  accept: string;
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  emptyHint?: string;
  className?: string;
  children?: React.ReactNode;
};

function extractFiles(dataTransfer: DataTransfer): File[] {
  const out: File[] = [];
  if (dataTransfer.files?.length) {
    for (let i = 0; i < dataTransfer.files.length; i += 1) {
      const f = dataTransfer.files.item(i);
      if (f) out.push(f);
    }
  }
  return out;
}

export const KnowledgeBaseFileDropZone = React.forwardRef<
  KnowledgeBaseFileDropZoneHandle,
  KnowledgeBaseFileDropZoneProps
>(function KnowledgeBaseFileDropZone(
  {
    accept,
    onFiles,
    disabled = false,
    emptyHint = 'Trascina file qui oppure clicca per selezionare',
    className = '',
    children,
  },
  ref
) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);

  const emitFiles = React.useCallback(
    (list: File[]) => {
      if (disabled || list.length === 0) return;
      onFiles(list);
    },
    [disabled, onFiles]
  );

  const openPicker = React.useCallback(() => {
    if (disabled) return;
    inputRef.current?.click();
  }, [disabled]);

  React.useImperativeHandle(ref, () => ({ openPicker }), [openPicker]);

  const onInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const list = e.target.files ? Array.from(e.target.files) : [];
      emitFiles(list);
      e.target.value = '';
    },
    [emitFiles]
  );

  const onDragOver = React.useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      if (!e.dataTransfer.types.includes('Files')) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      setDragOver(true);
    },
    [disabled]
  );

  const onDragLeave = React.useCallback((e: React.DragEvent) => {
    const rel = e.relatedTarget;
    if (rel instanceof globalThis.Node && e.currentTarget.contains(rel)) return;
    setDragOver(false);
  }, []);

  const onDrop = React.useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      emitFiles(extractFiles(e.dataTransfer));
    },
    [disabled, emitFiles]
  );

  const pickerActivatorProps = {
    role: 'button' as const,
    tabIndex: disabled ? -1 : 0,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openPicker();
      }
    },
    onClick: () => openPicker(),
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        multiple
        accept={accept}
        disabled={disabled}
        onChange={onInputChange}
      />
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={
          'flex min-h-[120px] min-w-0 flex-col rounded-lg border border-dashed transition-colors ' +
          (disabled
            ? 'cursor-not-allowed border-slate-700/50 bg-slate-950/20 opacity-60'
            : dragOver
              ? 'border-violet-400/80 bg-violet-950/40'
              : 'border-slate-600/70 bg-slate-900/30')
        }
      >
        {children ? (
          <div
            className="flex min-h-0 flex-1 flex-col p-2"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {children}
          </div>
        ) : null}
        {!children ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-6 text-center">
            <Upload
              className={'h-8 w-8 ' + (dragOver ? 'text-violet-300' : 'text-slate-500')}
              aria-hidden
            />
            <p className="text-slate-400">{emptyHint}</p>
          </div>
        ) : (
          <div
            {...pickerActivatorProps}
            className={
              'flex shrink-0 cursor-pointer items-center justify-center gap-1 border-t border-slate-800/80 py-1.5 text-slate-500 ' +
              (disabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-slate-900/50 hover:text-slate-400')
            }
          >
            <Upload className="h-3 w-3" aria-hidden />
            Rilascia o clicca per aggiungere altri file
          </div>
        )}
      </div>
    </div>
  );
});
