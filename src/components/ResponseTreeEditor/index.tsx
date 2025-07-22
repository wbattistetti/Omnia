import React from 'react';
import { mapDDTtoActionNodes } from './adapters';
import { useDDTContext } from '../../context/DDTContext';
import { ActionNode } from './types';

interface ResponseTreeEditorProps {
  nodes: ActionNode[];
  onChange?: (nodes: ActionNode[]) => void;
}

const ActionParameterNode: React.FC<{ paramKey: string; value: string }> = ({ paramKey, value }) => (
  <div style={{ marginLeft: 32, fontSize: 14, color: '#333', marginBottom: 2 }}>
    <b>{paramKey}:</b> {value}
  </div>
);

const ActionTreeNode: React.FC<{ node: ActionNode }> = ({ node }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span>{/* TODO: Renderizza icona vera */} <span style={{ fontSize: 20 }}>{node.icon}</span></span>
      {node.label && (
        <span style={{ fontSize: 12, color: '#888', opacity: 0.7, textShadow: '0 1px 4px #fff', marginRight: 8 }}>{node.label}</span>
      )}
      <span style={{ fontWeight: 500, fontSize: 15 }}>{node.primaryParameter}</span>
    </div>
    {/* Parametri figli */}
    {node.parameters && node.parameters.length > 0 && (
      <div>
        {node.parameters.map(param => (
          <ActionParameterNode key={param.key} paramKey={param.key} value={param.value} />
        ))}
      </div>
    )}
    {/* Ricorsione per i figli azione */}
    {node.children && node.children.length > 0 && (
      <div style={{ marginLeft: 24, borderLeft: '2px solid #e0e7ef', paddingLeft: 8, marginTop: 4 }}>
        {node.children.map(child => (
          <ActionTreeNode key={child.id} node={child} />
        ))}
      </div>
    )}
  </div>
);

const ResponseTreeEditor: React.FC = () => {
  const { ddt, actionsCatalog, translations, lang } = useDDTContext();
  const nodes: ActionNode[] = mapDDTtoActionNodes(ddt, actionsCatalog, translations, lang);

  return (
    <div style={{ width: '100%', minHeight: 400, background: '#f8fafc', borderRadius: 8, boxShadow: '0 1px 4px #0001', padding: 16 }}>
      {nodes.length === 0 ? (
        <div style={{ color: '#64748b', fontStyle: 'italic' }}>
          (Qui verrà renderizzato l’albero delle azioni e parametri)
        </div>
      ) : (
        nodes.map(node => <ActionTreeNode key={node.id} node={node} />)
      )}
    </div>
  );
};

export default ResponseTreeEditor; 