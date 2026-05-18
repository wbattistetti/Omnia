/**
 * Read-only PDF viewer for KB documents (pdf.js + react-pdf-viewer).
 */

import React from 'react';
import { Worker, Viewer } from '@react-pdf-viewer/core';
import { zoomPlugin } from '@react-pdf-viewer/zoom';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/zoom/lib/styles/index.css';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';

export type KbPdfViewerProps = {
  fileUrl: string;
  className?: string;
};

export function KbPdfViewer({ fileUrl, className = '' }: KbPdfViewerProps): React.ReactElement {
  const zoomPluginInstance = zoomPlugin();

  return (
    <div className={'min-h-0 flex-1 overflow-hidden ' + className}>
      <Worker workerUrl={pdfWorkerUrl}>
        <Viewer
          fileUrl={fileUrl}
          plugins={[zoomPluginInstance]}
          defaultScale={1}
        />
      </Worker>
    </div>
  );
}
