import React from 'react';
import TreeNode from '@responseEditor/TreeNode';
import { TreeRendererProps } from '@responseEditor/TreeView/TreeViewTypes';

const TreeRenderer: React.FC<TreeRendererProps> = ({
  nodes,
  parentId,
  level,
  selectedNodeId,
  onDrop,
  onRemove,
  setSelectedNodeId,
  stepKey,
  extraProps,
  singleEscalationSteps = ['start', 'success', 'confirmation']
}) => {
  const renderTree = (
    nodes: any[],
    parentId: string | undefined,
    level: number,
    selectedNodeId: string | null,
    onDrop: TreeRendererProps['onDrop'],
    onRemove: TreeRendererProps['onRemove'],
    setSelectedNodeId: (id: string | null) => void,
    stepKey?: string,
    extraProps?: Partial<TreeRendererProps> & { foreColor?: string; bgColor?: string; onToggleInclude?: (id: string) => void; onAIGenerate?: (actionId: string, exampleMessage: string, applyToAll: boolean) => Promise<void>; selectedStep?: string },
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
              currentStep={stepKey}
              onAIGenerate={extraProps?.onAIGenerate}
              stepType={extraProps?.selectedStep}
              {...(node.type === 'escalation' ? {
                childrenNodes,
                escalationLabel,
                included: node.included,
                onToggleInclude: extraProps?.onToggleInclude,
                isSingleEscalation,
                foreColor: extraProps?.foreColor,
                bgColor: extraProps?.bgColor
              } : {})}
            />
            {/* Solo se non escalation, ricorsione classica */}
            {node.type !== 'escalation' && renderTree(
              nodes,
              node.id,
              level + 1,
              selectedNodeId,
              onDrop,
              onRemove,
              setSelectedNodeId,
              stepKey,
              extraProps,
              singleEscalationSteps
            )}
          </React.Fragment>
        );
      });
  };

  return (
    <div>
      {renderTree(
        nodes,
        parentId,
        level,
        selectedNodeId,
        onDrop,
        onRemove,
        setSelectedNodeId,
        stepKey,
        extraProps,
        singleEscalationSteps
      )}
    </div>
  );
};

export default TreeRenderer;