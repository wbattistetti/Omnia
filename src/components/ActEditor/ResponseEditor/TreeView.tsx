// Executive summary: Renders the tree structure of response nodes and manages their state and drag & drop logic.
import React, { useRef, useState } from 'react';
import TreeNode from './TreeNode';
import { TreeNodeProps } from './types';
import { useDrop, useDragLayer } from 'react-dnd';
import { Plus } from 'lucide-react';

// Sposto defaultNodes fuori dal componente
const defaultNodes: TreeNodeProps[] = [
  { id: '1', text: "What is the patient's date of birth?", type: 'root' },
  { id: '2', text: "I didn't understand. Could you provide the patient's date of birth?", type: 'nomatch', level: 1, parentId: '1' },
  { id: '3', text: "Please provide the patient's date of birth.", type: 'noinput', level: 1, parentId: '1' }
];

interface TreeViewProps {
  nodes: TreeNodeProps[];
  onDrop: (targetId: string | null, position: 'before' | 'after' | 'child', item: any) => void;
  onRemove: (id: string) => void;
}

const renderTree = (
  nodes: TreeNodeProps[],
  parentId: string | undefined,
  level: number,
  selectedNodeId: string | null,
  onDrop: TreeViewProps['onDrop'],
  onRemove: TreeViewProps['onRemove'],
  setSelectedNodeId: (id: string | null) => void
) => {
  console.log('[renderTree] called', { parentId, level, nodes });
  return nodes
    .filter(node => node.parentId === parentId)
    .map(node => {
      // Se escalation, raccogli i figli
      const childrenNodes = node.type === 'escalation'
        ? nodes.filter(n => n.parentId === node.id).map(child => ({ ...child, level: level + 1 }))
        : undefined;
      return (
        <React.Fragment key={node.id}>
          <TreeNode
            {...node}
            level={level}
            selected={selectedNodeId === node.id}
            onDrop={(id, position, item) => {
              console.log('[TreeNode onDrop] called', { id, position, item });
              // Forza il tipo per evitare errori di tipo
              const safePosition = (position === 'before' || position === 'after' || position === 'child') ? position : 'after';
              const result = onDrop(id, safePosition, item);
              if (typeof result === 'string') {
                setSelectedNodeId(result); // Se è stato aggiunto un nuovo nodo, seleziona quello
              } else {
                setSelectedNodeId(id); // Altrimenti seleziona il nodo target
              }
            }}
            onCancelNewNode={onRemove}
            domId={'tree-node-' + node.id}
            {...(node.type === 'escalation' ? { childrenNodes } : {})}
          />
          {/* Solo se non escalation, ricorsione classica */}
          {node.type !== 'escalation' && renderTree(nodes, node.id, level + 1, selectedNodeId, onDrop, onRemove, setSelectedNodeId)}
        </React.Fragment>
      );
    });
};

const TreeView: React.FC<TreeViewProps & { onAddEscalation?: () => void }> = ({ nodes, onDrop, onRemove, onAddEscalation }) => {
  console.log('[TreeView] render', { nodes });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Drop su canvas (aggiungi come root)
  const [{ isOver }, dropRef] = useDrop({
    accept: 'ACTION',
    drop(item: any, monitor) {
      console.log('[TreeView useDrop] drop handler', { item, monitor });
      if (item && typeof item === 'object') {
        const clientOffset = monitor.getClientOffset();
        if (!clientOffset) {
          console.log('[TreeView useDrop] clientOffset missing');
          return;
        }
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (!containerRect) {
          console.log('[TreeView useDrop] containerRect missing');
          return;
        }
        const y = clientOffset.y - containerRect.top;
        // Trova il nodo più vicino al punto di drop
        let closestIdx = -1;
        let minDist = Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        nodes.forEach((node, idx) => {
          const nodeElem = document.getElementById('tree-node-' + node.id);
          if (nodeElem) {
            const rect = nodeElem.getBoundingClientRect();
            const centerY = rect.top + rect.height / 2 - containerRect.top;
            if (centerY < minY) minY = centerY;
            if (centerY > maxY) maxY = centerY;
            const dist = Math.abs(centerY - y);
            if (dist < minDist) {
              minDist = dist;
              closestIdx = idx;
            }
          }
        });
        // Se non ci sono nodi, aggiungi come root
        if (nodes.length === 0) {
          console.log('[TreeView useDrop] drop on canvas (no nodes)', { item });
          onDrop(null, 'after', item);
          setSelectedNodeId(null);
          return;
        }
        // Se il punto di drop è sopra il primo nodo o sotto l'ultimo nodo, aggiungi come root
        if (y < minY - 16 || y > maxY + 16) { // 16px di tolleranza
          console.log('[TreeView useDrop] drop on canvas (sopra/sotto tutti i nodi)', { item });
          onDrop(null, 'after', item);
          setSelectedNodeId(null);
          return;
        }
        // Altrimenti, drop tra i nodi
        let position: 'before' | 'after' | 'child' = 'after';
        if (closestIdx !== -1) {
          const nodeElem = document.getElementById('tree-node-' + nodes[closestIdx].id);
          if (nodeElem) {
            const rect = nodeElem.getBoundingClientRect();
            const centerY = rect.top + rect.height / 2 - containerRect.top;
            position = y < centerY ? 'before' : 'after';
            console.log('[TreeView useDrop] drop on node', { targetId: nodes[closestIdx].id, position, item });
            const result = onDrop(nodes[closestIdx].id, position, item);
            if (typeof result === 'string') {
              setSelectedNodeId(result);
            } else {
              setSelectedNodeId(nodes[closestIdx].id);
            }
            return;
          }
        }
      }
    },
    collect: monitor => ({
      isOver: monitor.isOver({ shallow: true })
    })
  });

  // Ghost custom (già presente)
  const CustomDragLayer: React.FC<{ nodes: TreeNodeProps[] }> = ({ nodes }) => {
    const { isDragging, item, currentOffset } = useDragLayer((monitor) => ({
      isDragging: monitor.isDragging(),
      item: monitor.getItem(),
      currentOffset: monitor.getSourceClientOffset(),
    }));
    if (!isDragging || !item || !currentOffset) return null;
    const draggedNode = nodes.find(n => n.id === item.id);
    if (!draggedNode) return null;
    const previewText = (draggedNode.text || draggedNode.label || '').slice(0, 30) + (draggedNode.text && draggedNode.text.length > 30 ? '...' : '');
    console.log('[CustomDragLayer] render', { draggedNode, previewText });
    return (
      <div style={{
        position: 'fixed',
        pointerEvents: 'none',
        left: currentOffset.x,
        top: currentOffset.y,
        zIndex: 1000,
        transform: 'translate(-50%, -50%)',
        background: '#fff',
        border: '2px solid #2563eb',
        borderRadius: 6,
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        padding: '8px 16px',
        minWidth: 120,
        maxWidth: 240,
        fontWeight: 500,
        fontSize: 15,
        color: '#222',
        opacity: 0.95
      }}>
        {previewText}
      </div>
    );
  };

  return (
    <div
      ref={node => { dropRef(node); containerRef.current = node; }}
      className="h-full flex flex-col"
      style={{
        position: 'relative',
        minHeight: 200,
        border: isOver ? '2px solid #60a5fa' : '2px solid transparent',
        transition: 'border 0.2s',
        background: isOver ? 'rgba(96,165,250,0.08)' : undefined
      }}
    >
      <CustomDragLayer nodes={nodes} />
      <div>
        {renderTree(nodes, undefined, 0, selectedNodeId, onDrop, onRemove, setSelectedNodeId)}
      </div>
      {/* Bottone aggiungi escalation in fondo se ci sono escalation visibili */}
      {onAddEscalation && nodes.some(n => n.type === 'escalation') && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
          <button
            onClick={onAddEscalation}
            style={{
              color: '#ef4444',
              border: '1.5px solid #ef4444',
              background: 'rgba(239,68,68,0.08)',
              borderRadius: 999,
              padding: '5px 18px',
              fontWeight: 700,
              fontSize: 15,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              marginTop: 8
            }}
          >
            <Plus size={18} style={{ marginRight: 6 }} />
            Aggiungi recovery
          </button>
        </div>
      )}
    </div>
  );
};

export default TreeView; 