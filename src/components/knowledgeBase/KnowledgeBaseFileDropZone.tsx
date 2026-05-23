/**
 * File picker + full-area drag-and-drop for the KB document list column.
 */

import React from 'react';

export type KnowledgeBaseFileDropZoneHandle = {
  openPicker: () => void;
};

export type KnowledgeBaseFileDropZoneProps = {
  accept: string;
  onFiles: (files: File[]) => void;
  disabled?: boolean;
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
  { accept, onFiles, disabled = false, className = '', children },
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
      if (!e.dataTransfer.types.includes('Files')) return;
      e.preventDefault();
      e.stopPropagation();
      if (disabled) {
        e.dataTransfer.dropEffect = 'none';
        return;
      }
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
      if (!e.dataTransfer.types.includes('Files')) return;
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      if (disabled) return;
      emitFiles(extractFiles(e.dataTransfer));
    },
    [disabled, emitFiles]
  );

  return (
    <div
      className={
        className +
        ' flex min-h-0 min-w-0 flex-col transition-colors ' +
        (dragOver ? 'bg-violet-950/25 ring-1 ring-inset ring-violet-500/40' : '')
      }
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        multiple
        accept={accept}
        disabled={disabled}
        onChange={onInputChange}
      />
      {children}
    </div>
  );
});
