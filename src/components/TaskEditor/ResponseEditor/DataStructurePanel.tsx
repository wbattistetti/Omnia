import React from 'react';
import { DataNodeV2 } from './types';
import DataNodeItem from './DataNodeItem';

interface DataStructurePanelProps {
  rootNode: DataNodeV2;
  getTranslation?: (key: string) => string;
}

const DataStructurePanel: React.FC<DataStructurePanelProps> = ({ rootNode, getTranslation }) => {
  return (
    <div style={{ background: '#f3f0fa', borderRadius: 10, padding: 16, minWidth: 320, maxWidth: 420, boxShadow: '0 2px 8px #0001' }}>
      <h3 style={{ color: '#a21caf', fontWeight: 700, fontSize: 18, marginBottom: 12 }}>Data Structure</h3>
      <DataNodeItem node={rootNode} getTranslation={getTranslation} />
    </div>
  );
};

export default DataStructurePanel; 