import React from 'react';
// Use the NEW Response Editor (purple header) exported by index.tsx
import ResponseEditor from './index';
import ResizeHandle from '../../common/ResizeHandle';
import { useResizablePanel } from '../../../hooks/useResizablePanel';

interface ResizableResponseEditorProps {
  ddt: any;
  translations: any;
  lang: string;
  onClose: () => void;
}

const ResizableResponseEditor: React.FC<ResizableResponseEditorProps> = ({
  ddt,
  translations,
  lang,
  onClose
}) => {
  const { size, handleResize, style } = useResizablePanel({
    initialSize: 400,
    min: 200,
    max: window.innerHeight * 0.8,
    direction: 'vertical',
    persistKey: 'response-editor-height'
  });

  return (
    <div
      className="relative"
      style={{ ...style, minHeight: 360, zIndex: 20, background: '#0b1220', display: 'flex', flexDirection: 'column' }}
    >
      <ResizeHandle
        direction="vertical"
        position="top"
        onResize={handleResize}
        min={200}
        max={window.innerHeight * 0.8}
        initialSize={size}
        persistKey="response-editor-height"
        inverted={true} // Per pannelli in basso che si espandono verso l'alto
      />
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponseEditor
          ddt={ddt}
          translations={translations}
          lang={lang}
          onClose={onClose}
        />
      </div>
    </div>
  );
};

export default ResizableResponseEditor; 