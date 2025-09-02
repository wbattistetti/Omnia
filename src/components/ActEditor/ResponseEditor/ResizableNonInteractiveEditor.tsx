import React from 'react';
import { X } from 'lucide-react';
import ResizeHandle from '../../common/ResizeHandle';
import { useResizablePanel } from '../../../hooks/useResizablePanel';
import NonInteractiveResponseEditor, { NonInteractiveResponse } from './NonInteractiveResponseEditor';

interface ResizableNonInteractiveEditorProps {
  title?: string;
  value: NonInteractiveResponse;
  onChange: (next: NonInteractiveResponse) => void;
  onClose: () => void;
  accentColor?: string; // header background color, typically act forecolor
}

const ResizableNonInteractiveEditor: React.FC<ResizableNonInteractiveEditorProps> = ({ title, value, onChange, onClose, accentColor }) => {
  const { size, handleResize, style } = useResizablePanel({
    initialSize: 260,
    min: 180,
    max: window.innerHeight * 0.7,
    direction: 'vertical',
    persistKey: 'noninteractive-editor-height'
  });

  return (
    <div className="relative" style={{ ...style, minHeight: 200, zIndex: 20, background: '#0b1220', display: 'flex', flexDirection: 'column' }}>
      <ResizeHandle
        direction="vertical"
        position="top"
        onResize={handleResize}
        min={180}
        max={window.innerHeight * 0.7}
        initialSize={size}
        persistKey="noninteractive-editor-height"
        inverted={true}
      />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '6px 10px', background: 'var(--sidebar-content-bg, #18181b)', borderBottom: '1px solid rgba(0,0,0,0.2)', color: accentColor || 'var(--sidebar-content-text, #f1f5f9)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, color: accentColor || 'var(--sidebar-content-text, #f1f5f9)' }}>{title || ''}</span>
          {/* Close as an X icon only */}
          <button onClick={onClose} title="Chiudi" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: accentColor || 'var(--sidebar-content-text, #f1f5f9)' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <NonInteractiveResponseEditor value={value} onChange={onChange} onClose={onClose} />
        </div>
      </div>
    </div>
  );
};

export default ResizableNonInteractiveEditor;


