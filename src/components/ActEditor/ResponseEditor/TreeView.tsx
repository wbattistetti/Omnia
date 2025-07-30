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
  onToggleInclude?: (id: string) => void; // Aggiunto per passare la funzione di toggle
  bgColor?: string; // nuovo prop opzionale
}

const renderTree = (
  nodes: TreeNodeProps[],
  parentId: string | undefined,
  level: number,
  selectedNodeId: string | null,
  onDrop: TreeViewProps['onDrop'],
  onRemove: TreeViewProps['onRemove'],
  setSelectedNodeId: (id: string | null) => void,
  stepKey?: string, // aggiunto per propagare lo step corrente
  extraProps?: Partial<TreeViewProps> & { foreColor?: string; bgColor?: string },
  singleEscalationSteps: string[] = ['start', 'success', 'confirmation']
) => {
  return nodes
    .filter(node => node.parentId === parentId)
    .map((node, idx, siblings) => {
      // Se escalation, calcola la label dinamica solo tra escalation dello stesso step
      let escalationLabel = undefined;
      if (node.type === 'escalation') {
        // Trova tutte le escalation tra i siblings (già filtrati per step/tab)
        const allEscalations = siblings.filter(n => n.type === 'escalation');
        const escIdx = allEscalations.findIndex(n => n.id === node.id);
        escalationLabel = `${escIdx + 1}° recovery`;
      }
      // Se escalation, raccogli i figli
      const childrenNodes = node.type === 'escalation'
        ? nodes.filter(n => n.parentId === node.id).map(child => ({ ...child, level: level + 1 }))
        : undefined;
      // Calcola se questa escalation è l'unica nello step e lo step è single-escalation
      let isSingleEscalation = false;
      if (node.type === 'escalation' && stepKey && singleEscalationSteps.includes(stepKey)) {
        const escCount = siblings.filter(n => n.type === 'escalation').length;
        if (escCount === 1) isSingleEscalation = true;
      }
      return (
        <React.Fragment key={node.id}>
          <TreeNode
            {...node}
            level={level}
            selected={selectedNodeId === node.id}
            onDrop={(id, position, item) => {
              const safePosition = (position === 'before' || position === 'after' || position === 'child') ? position : 'after';
              const result = onDrop(id, safePosition, item);
              if (typeof result === 'string') {
                setSelectedNodeId(result);
              } else {
                setSelectedNodeId(id);
              }
            }}
            onCancelNewNode={onRemove}
            domId={'tree-node-' + node.id}
            {...(node.type === 'escalation' ? { childrenNodes, escalationLabel, included: node.included, onToggleInclude: extraProps?.onToggleInclude, isSingleEscalation, foreColor: extraProps?.foreColor, bgColor: extraProps?.bgColor } : {})}
          />
          {/* Solo se non escalation, ricorsione classica */}
          {node.type !== 'escalation' && renderTree(nodes, node.id, level + 1, selectedNodeId, onDrop, onRemove, setSelectedNodeId, stepKey, extraProps, singleEscalationSteps)}
        </React.Fragment>
      );
    });
};

const TreeView: React.FC<TreeViewProps & { onAddEscalation?: () => void; stepKey?: string; foreColor?: string; bgColor?: string }> = ({ nodes, onDrop, onRemove, onAddEscalation, onToggleInclude, stepKey, foreColor, bgColor }) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Drop preview state
  const [dropPreviewIdx, setDropPreviewIdx] = useState<number | null>(null);
  const [dropPreviewPosition, setDropPreviewPosition] = useState<'before' | 'after' | null>(null);

  // Drop su canvas (aggiungi come root)
  const [{ isOver }, dropRef] = useDrop({
    accept: 'ACTION',
    drop(item: any, monitor) {
      if (item && typeof item === 'object') {
        const clientOffset = monitor.getClientOffset();
        if (!clientOffset) {
          setDropPreviewIdx(null); setDropPreviewPosition(null);
          return;
        }
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (!containerRect) {
          setDropPreviewIdx(null); setDropPreviewPosition(null);
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
          setDropPreviewIdx(null); setDropPreviewPosition(null);
          onDrop(null, 'after', item);
          setSelectedNodeId(null);
          return;
        }
        // Se il punto di drop è sopra il primo nodo o sotto l'ultimo nodo, aggiungi come root
        if (y < minY - 16 || y > maxY + 16) { // 16px di tolleranza
          setDropPreviewIdx(null); setDropPreviewPosition(null);
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
            setDropPreviewIdx(closestIdx);
            setDropPreviewPosition(position);
            const result = onDrop(nodes[closestIdx].id, position, item);
            setDropPreviewIdx(null); setDropPreviewPosition(null);
            if (typeof result === 'string') {
              setSelectedNodeId(result);
            } else {
              setSelectedNodeId(nodes[closestIdx].id);
            }
            return;
          }
        }
        setDropPreviewIdx(null); setDropPreviewPosition(null);
      }
    },
    hover(item, monitor) {
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) { setDropPreviewIdx(null); setDropPreviewPosition(null); return; }
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) { setDropPreviewIdx(null); setDropPreviewPosition(null); return; }
      const y = clientOffset.y - containerRect.top;
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
      if (nodes.length === 0) { setDropPreviewIdx(null); setDropPreviewPosition(null); return; }
      if (y < minY - 16 || y > maxY + 16) { setDropPreviewIdx(null); setDropPreviewPosition(null); return; }
      let position: 'before' | 'after' = 'after';
      if (closestIdx !== -1) {
        const nodeElem = document.getElementById('tree-node-' + nodes[closestIdx].id);
        if (nodeElem) {
          const rect = nodeElem.getBoundingClientRect();
          const centerY = rect.top + rect.height / 2 - containerRect.top;
          position = y < centerY ? 'before' : 'after';
          setDropPreviewIdx(closestIdx);
          setDropPreviewPosition(position);
          return;
        }
      }
      setDropPreviewIdx(null); setDropPreviewPosition(null);
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
        {renderTree(nodes, undefined, 0, selectedNodeId, onDrop, onRemove, setSelectedNodeId, stepKey, { onToggleInclude, foreColor, bgColor })}
      </div>
      {/* Bottone aggiungi escalation in fondo se ci sono escalation visibili */}
      {onAddEscalation && nodes.some(n => n.type === 'escalation') && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
          <button
            onClick={onAddEscalation}
            style={{
              color: foreColor || '#ef4444',
              border: `1.5px solid ${foreColor || '#ef4444'}`,
              background: bgColor || 'rgba(239,68,68,0.08)',
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
            {stepKey === 'confirmation' ? 'Aggiungi conferma' : 'Aggiungi recovery'}
          </button>
        </div>
      )}
    </div>
  );
};

export default TreeView; 