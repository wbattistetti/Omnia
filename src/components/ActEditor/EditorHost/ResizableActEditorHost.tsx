import React from 'react';
import ActEditorHost from './ActEditorHost';
import ResizeHandle from '../../common/ResizeHandle';
import { useResizablePanel } from '../../../hooks/useResizablePanel';
import type { ActMeta } from './types';

export default function ResizableActEditorHost({ act, onClose }: { act: ActMeta; onClose?: () => void }){
  const { size, handleResize, style } = useResizablePanel({
    initialSize: 420,
    min: 260,
    max: typeof window !== 'undefined' ? window.innerHeight * 0.85 : 800,
    direction: 'vertical',
    persistKey: 'act-editor-height'
  });

  return (
    <div className="relative" style={{ ...style, minHeight: 320, zIndex: 20, background: '#0b1220', display: 'flex', flexDirection: 'column' }}>
      <ResizeHandle
        direction="vertical"
        position="top"
        onResize={handleResize}
        min={260}
        max={typeof window !== 'undefined' ? window.innerHeight * 0.85 : 800}
        initialSize={size}
        persistKey="act-editor-height"
        inverted={true}
      />
      <div style={{ flex: 1, minHeight: 0 }}>
        <ActEditorHost act={act} onClose={onClose} />
      </div>
    </div>
  );
}


