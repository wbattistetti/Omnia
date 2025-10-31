import React, { Suspense } from 'react';
import { registry } from './editorRegistry';
import { resolveEditorKind } from './resolveKind';
import type { EditorProps } from './types';
import { getAgentActVisualsByType } from '../../Flowchart/utils/actVisuals';

export default function ActEditorHost({ act, onClose }: EditorProps) {
  const kind = resolveEditorKind(act);
  const Comp = registry[kind];
  console.log('🎯 [ActEditorHost] Rendering:', { kind, actId: act?.id, actType: act?.type, instanceId: act?.instanceId });
  // quiet: remove mount spam; enable only via debug flag if needed
  try { if (localStorage.getItem('debug.actEditor') === '1') console.log('[ActEditorHost][mount]', { kind, act }); } catch { }

  if (!Comp) {
    console.error('❌ [ActEditorHost] No component registered for kind:', kind);
    return <div>No editor registered for {kind}</div>;
  }

  console.log('✅ [ActEditorHost] Component found, rendering');

  // DDTEditor è importato direttamente, quindi non ha bisogno di Suspense
  // Gli altri editori usano lazy loading, quindi hanno bisogno di Suspense
  const isLazy = kind !== 'ddt';

  if (!isLazy) {
    // Render diretto per DDTEditor (più veloce, no lazy loading)
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


