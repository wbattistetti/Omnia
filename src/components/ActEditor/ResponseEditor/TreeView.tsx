// Executive summary: Renders the tree structure of response nodes and manages their state and drag & drop logic.
import React, { useState } from 'react';
import TreeNode from './TreeNode';
import { TreeNodeProps } from './types';
import { useTreeNodes } from './useTreeNodes';
import { useDrop } from 'react-dnd';

interface TreeViewProps {
  initialNodes?: TreeNodeProps[];
}

const defaultNodes: TreeNodeProps[] = [
  { id: '1', text: "What is the patient's date of birth?", type: 'root', onDrop: () => {} },
  { id: '2', text: "I didn't understand. Could you provide the patient's date of birth?", type: 'nomatch', level: 1, parentId: '1', onDrop: () => {} },
  { id: '3', text: "Please provide the patient's date of birth.", type: 'noinput', level: 1, parentId: '1', onDrop: () => {} }
];

const TreeView: React.FC<TreeViewProps> = ({ initialNodes }) => {
  const { nodes, handleDrop, removeNode } = useTreeNodes(initialNodes || defaultNodes);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const [{ isOver }, dropRef] = useDrop({
    accept: 'ACTION',
    drop(item: any, monitor) {
      if (item && typeof item === 'object' && item.action && containerRef.current) {
        const clientOffset = monitor.getClientOffset();
        if (!clientOffset) return;
        const containerRect = containerRef.current.getBoundingClientRect();
        const y = clientOffset.y - containerRect.top;
        // Trova il nodo più vicino al punto di drop
        let closestIdx = -1;
        let minDist = Infinity;
        nodes.forEach((node, idx) => {
          const nodeElem = document.getElementById('tree-node-' + node.id);
          if (nodeElem) {
            const rect = nodeElem.getBoundingClientRect();
            const centerY = rect.top + rect.height / 2 - containerRect.top;
            const dist = Math.abs(centerY - y);
            if (dist < minDist) {
              minDist = dist;
              closestIdx = idx;
            }
          }
        });
        let position: 'before' | 'after' = 'after';
        if (closestIdx !== -1) {
          const nodeElem = document.getElementById('tree-node-' + nodes[closestIdx].id);
          if (nodeElem) {
            const rect = nodeElem.getBoundingClientRect();
            const centerY = rect.top + rect.height / 2 - containerRect.top;
            position = y < centerY ? 'before' : 'after';
            console.log('[DROP][CANVAS] clientOffset:', clientOffset, 'y:', y, 'closestIdx:', closestIdx, 'targetId:', nodes[closestIdx].id, 'position:', position);
            const newId = handleDrop(nodes[closestIdx].id, position, item.action);
            if (newId) setSelectedNodeId(newId);
            return;
          }
        }
        // Se non ci sono nodi, aggiungi in fondo
        console.log('[DROP][CANVAS] clientOffset:', clientOffset, 'y:', y, 'NO NODES, inserisco come root in fondo');
        const newId = handleDrop(null, 'after', item.action);
        if (newId) setSelectedNodeId(newId);
      }
    },
    collect: monitor => ({
      isOver: monitor.isOver({ shallow: true })
    })
  });

  return (
    <div
      ref={node => {
        dropRef(node);
        // containerRef.current = node; // RIMOSSO: current è readonly
      }}
      className="h-full flex flex-col"
      style={{
        position: 'relative',
        minHeight: 200,
        border: isOver ? '2px solid #60a5fa' : '2px solid transparent',
        transition: 'border 0.2s',
        background: isOver ? 'rgba(96,165,250,0.08)' : undefined
      }}
    >
      {/* Lista dei nodi */}
      <div>
        {nodes.map(node => (
          <TreeNode
            key={node.id}
            {...node}
            selected={selectedNodeId === node.id}
            onDrop={(id, position, action) => {
              const newId = handleDrop(id, position, action);
              if (newId) setSelectedNodeId(newId);
            }}
            onCancelNewNode={id => {
              removeNode(id);
              setSelectedNodeId(null);
            }}
            domId={'tree-node-' + node.id}
          />
        ))}
      </div>
    </div>
  );
};

export default TreeView; 