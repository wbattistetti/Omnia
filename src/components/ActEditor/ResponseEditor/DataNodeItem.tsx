import React from 'react';
import { DataNodeV2 } from './types';

interface DataNodeItemProps {
  node: DataNodeV2;
  getTranslation?: (key: string) => string;
  level?: number;
}

const DataNodeItem: React.FC<DataNodeItemProps> = ({ node, getTranslation, level = 0 }) => {
  return (
    <div style={{ marginLeft: level * 18, borderLeft: level > 0 ? '2px solid #eee' : undefined, paddingLeft: 8, marginBottom: 6 }}>
      <div style={{ fontWeight: 600, fontSize: 15, color: '#a21caf' }}>
        {getTranslation ? getTranslation(node.label) : node.label} <span style={{ color: '#555', fontWeight: 400, fontSize: 13 }}>({node.type})</span>
      </div>
      {node.variable && (
        <div style={{ color: '#666', fontSize: 13, marginBottom: 2 }}>
          <b>Variable:</b> {getTranslation ? getTranslation(node.variable.label) : node.variable.label}
        </div>
      )}
      {node.subData && node.subData.length > 0 && (
        <div style={{ marginTop: 4 }}>
          {node.subData.map((child, idx) => (
            <DataNodeItem key={child.id || idx} node={child} getTranslation={getTranslation} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export default DataNodeItem; 