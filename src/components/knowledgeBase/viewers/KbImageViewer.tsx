/**
 * Image viewer for KB documents with zoom and sibling navigation.
 */

import React from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

export type KbImageViewerProps = {
  fileUrl: string;
  documentName: string;
  imageIds: readonly string[];
  currentId: string;
  onSelectId: (id: string) => void;
};

export function KbImageViewer({
  fileUrl,
  documentName,
  imageIds,
  currentId,
  onSelectId,
}: KbImageViewerProps): React.ReactElement {
  const [scale, setScale] = React.useState(1);
  const idx = imageIds.indexOf(currentId);
  const hasPrev = idx > 0;
  const hasNext = idx >= 0 && idx < imageIds.length - 1;

  React.useEffect(() => {
    setScale(1);
  }, [fileUrl, currentId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 px-2 py-1">
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => onSelectId(imageIds[idx - 1]!)}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 disabled:opacity-40"
            aria-label="Immagine precedente"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={!hasNext}
            onClick={() => onSelectId(imageIds[idx + 1]!)}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 disabled:opacity-40"
            aria-label="Immagine successiva"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {imageIds.length > 1 ? (
            <span className="text-xs text-slate-500">
              {idx + 1} / {imageIds.length}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(0.25, s - 0.25))}
            className="rounded p-1 text-slate-400 hover:bg-slate-800"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="min-w-[3rem] text-center text-xs text-slate-500">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(4, s + 0.25))}
            className="rounded p-1 text-slate-400 hover:bg-slate-800"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>
        </div>
      <div className="min-h-0 flex-1 overflow-auto bg-slate-950/80 p-4">
        <div className="flex min-h-full items-center justify-center">
          <img
            src={fileUrl}
            alt={documentName}
            draggable={false}
            style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
            className="max-h-full max-w-full object-contain transition-transform"
          />
        </div>
      </div>
    </div>
  );
}
