/**
 * File picker + drag-and-drop zone for ElevenLabs workspace panels (KB documents, tool defs).
 */

import React from 'react';
import { Upload } from 'lucide-react';
import { formatStagedFileSize } from '@workspaces/elevenlabs/elevenLabsStagedNodeFiles';

export type ElevenLabsFileDropZoneHandle = {
  openPicker: () => void;
};

export type ElevenLabsFileDropZoneProps = {
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
    return out;
  }
  return out;
}

export const ElevenLabsFileDropZone = React.forwardRef<
  ElevenLabsFileDropZoneHandle,
  ElevenLabsFileDropZoneProps
>(function ElevenLabsFileDropZone(
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

  const hasChildren = Boolean(children);

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
            <p className="text-xs text-slate-400">{emptyHint}</p>
          </div>
        ) : (
          <div
            {...pickerActivatorProps}
            className={
              'flex shrink-0 cursor-pointer items-center justify-center gap-1 border-t border-slate-800/80 py-1.5 text-[10px] text-slate-500 ' +
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

export type StagedFileListRowProps = {
  name: string;
  size: number;
  badge?: string;
  onRemove?: () => void;
  icon?: React.ReactNode;
};

export function StagedFileListRow({
  name,
  size,
  badge,
  onRemove,
  icon,
}: StagedFileListRowProps): React.ReactElement {
  return (
    <li className="flex items-start gap-2 rounded-md border border-slate-700/60 bg-slate-900/50 px-2.5 py-2 text-xs text-slate-300">
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{name}</span>
          {badge ? (
            <span className="rounded bg-violet-950/80 px-1.5 py-0.5 text-[10px] font-medium text-violet-300">
              {badge}
            </span>
          ) : null}
        </span>
        <span className="text-[10px] text-slate-500">{formatStagedFileSize(size)}</span>
      </span>
      {onRemove ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-slate-800 hover:text-rose-300"
          aria-label={`Rimuovi ${name}`}
        >
          Rimuovi
        </button>
      ) : null}
    </li>
  );
}
