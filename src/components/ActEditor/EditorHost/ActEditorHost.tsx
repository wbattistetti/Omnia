import React, { Suspense } from 'react';
import { registry } from './editorRegistry';
import { resolveEditorKind } from './resolveKind';
import type { EditorProps } from './types';
import { getAgentActVisualsByType } from '../../Flowchart/utils/actVisuals';

export default function ActEditorHost({ act, onClose }: EditorProps) {
  const kind = resolveEditorKind(act);

  const Comp = registry[kind];

  if (!Comp) {
    console.error('❌ [ActEditorHost] No component registered for kind:', kind, {
      actType: act?.type,
      availableKinds: Object.keys(registry)
    });
    return <div>No editor registered for {kind}</div>;
  }

  // DDTEditor, IntentEditor e TextMessageEditor sono importati direttamente, quindi non hanno bisogno di Suspense
  // Gli altri editori usano lazy loading, quindi hanno bisogno di Suspense
  const isLazy = kind !== 'ddt' && kind !== 'intent' && kind !== 'message';

  if (!isLazy) {
    // Render diretto per DDTEditor e IntentEditor (più veloce, no lazy loading)
    return (
      <div className="h-full w-full bg-slate-900 flex flex-col">
        <div className="min-h-0 flex-1">
          {/* @ts-expect-error registry type */}
          <Comp act={act} onClose={onClose} />
        </div>
      </div>
    );
  }

  // Suspense per lazy components
  return (
    <div className="h-full w-full bg-slate-900 flex flex-col">
      <div className="min-h-0 flex-1">
        <Suspense fallback={
          <div className="h-full flex items-center justify-center bg-slate-900">
            <div className="text-white text-sm">
              <div className="animate-pulse">Loading editor...</div>
            </div>
          </div>
        }>
          {/* @ts-expect-error lazy component */}
          <Comp act={act} onClose={onClose} />
        </Suspense>
      </div>
    </div>
  );
}


