import React, { lazy, Suspense } from 'react';

const IntentEditorShell = lazy(() => import('./IntentEditorShell'));

export default function IntentEditorRoute() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading…</div>}>
      <IntentEditorShell />
    </Suspense>
  );
}


