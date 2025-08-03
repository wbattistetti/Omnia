import React from 'react';
import ResponseEditor from './ResponseEditor';
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
      className="relative bg-white border-t border-gray-200"
      style={{ ...style, minHeight: 200 }}
    >
      <ResizeHandle
        direction="vertical"
        position="top"
        onResize={handleResize}
        min={200}
        max={window.innerHeight * 0.8}
        initialSize={size}
        persistKey="response-editor-height"
      />
      <ResponseEditor
        ddt={ddt}
        translations={translations}
        lang={lang}
        onClose={onClose}
      />
    </div>
  );
};

export default ResizableResponseEditor; 