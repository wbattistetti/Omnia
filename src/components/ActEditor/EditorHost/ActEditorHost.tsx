import React, { Suspense } from 'react';
import { registry } from './editorRegistry';
import { resolveEditorKind } from './resolveKind';
import type { EditorProps } from './types';
import { getAgentActVisualsByType } from '../../Flowchart/actVisuals';

export default function ActEditorHost({ act, onClose }: EditorProps) {
  const kind = resolveEditorKind(act);
  const Comp = registry[kind];
  // quiet: remove mount spam; enable only via debug flag if needed
  try { if (localStorage.getItem('debug.actEditor')==='1') console.log('[ActEditorHost][mount]', { kind, act }); } catch {}

  return (
    <div className="h-full w-full grid grid-rows-[48px_1fr] bg-slate-900">
      <div className="flex items-center justify-between px-3 border-b border-slate-800 bg-amber-400">
        <div className="font-semibold text-slate-900 flex items-center gap-2">
          {(() => {
            const type = String(act?.type || 'Message') as any;
            const { Icon, color } = getAgentActVisualsByType(type, false);
            return <Icon size={18} style={{ color: '#0b1220' }} />; // contrast su header ambra
          })()}
          <span>{act.label || 'Editor'}</span>
        </div>
        <button className="px-2 py-1 text-sm rounded-lg border border-amber-400 bg-white" onClick={() => { try { if (localStorage.getItem('debug.actEditor')==='1') console.log('[ActEditorHost][close:click]'); } catch {} onClose(); }}>Close</button>
      </div>
      <div className="min-h-0">
        <Suspense fallback={null}>
          {/* @ts-expect-error lazy component */}
          <Comp act={act} onClose={onClose} />
        </Suspense>
      </div>
    </div>
  );
}


