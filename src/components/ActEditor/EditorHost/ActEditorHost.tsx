import React, { Suspense } from 'react';
import { registry } from './editorRegistry';
import { resolveEditorKind } from './resolveKind';
import type { EditorProps } from './types';
import { getAgentActVisualsByType } from '../../Flowchart/utils/actVisuals';

export default function ActEditorHost({ act, onClose }: EditorProps) {
  const kind = resolveEditorKind(act);
  const Comp = registry[kind];
  // quiet: remove mount spam; enable only via debug flag if needed
  try { if (localStorage.getItem('debug.actEditor') === '1') console.log('[ActEditorHost][mount]', { kind, act }); } catch { }

  return (
    <div className="h-full w-full bg-slate-900 flex flex-col">
      <div className="min-h-0 flex-1">
        <Suspense fallback={null}>
          {/* @ts-expect-error lazy component */}
          <Comp act={act} onClose={onClose} />
        </Suspense>
      </div>
    </div>
  );
}


