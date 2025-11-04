import React, { lazy, Suspense } from 'react';

const EmbeddingEditorShell = lazy(() => import('./EmbeddingEditorShell'));

export default function IntentEditorRoute() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading…</div>}>
      <EmbeddingEditorShell />
    </Suspense>
  );
}


