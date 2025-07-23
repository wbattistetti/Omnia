import React from 'react';
import { FlowEditor } from './Flowchart/FlowEditor';

interface DockablePanelsProps {
  flowEditorProps: any;
}

const DockablePanels: React.FC<DockablePanelsProps> = ({ flowEditorProps }) => {
  // Solo il canvas (FlowEditor) sempre visibile
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <FlowEditor {...flowEditorProps} />
    </div>
  );
};

export default DockablePanels; 