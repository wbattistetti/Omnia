// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { WizardTaskTreeNode } from '../../../../../TaskBuilderAIWizard/types';

/**
 * Converte WizardTaskTreeNode[] (formato Wizard) in mainList (formato DDT/ResponseEditor).
 *
 * La mainList è un array di nodi DDT con questa struttura:
 * - label: string
 * - icon?: string
 * - subNodes?: any[] (per i sub-nodi) - ✅ USA subNodes (non subData)
 * - id?: string
 * - templateId?: string
 * - kind?: string
 *
 * IMPORTANTE: La Sidebar si aspetta subNodes, non subData.
 * Il validator rifiuta subData come legacy.
 *
 * @param wizardTree Array di WizardTaskTreeNode dal Wizard
 * @returns Array di nodi mainList compatibili con ResponseEditor
 */
export function convertWizardTaskTreeToMainList(wizardTree: WizardTaskTreeNode[]): any[] {
  console.log('[convertWizardTaskTreeToMainList] 🎯 Entry', {
    wizardTreeLength: wizardTree?.length,
    isArray: Array.isArray(wizardTree),
    wizardTreeStructure: wizardTree?.map(n => ({
      id: n.id,
      templateId: n.templateId,
      label: n.label,
      type: n.type,
      hasSubNodes: !!n.subNodes,
      subNodesCount: n.subNodes?.length,
    })),
  });

  if (!Array.isArray(wizardTree) || wizardTree.length === 0) {
    console.log('[convertWizardTaskTreeToMainList] ⏸️ Empty or invalid input', {
      isArray: Array.isArray(wizardTree),
      length: wizardTree?.length,
    });
    return [];
  }

  const converted = wizardTree.map((node, idx) => {
    console.log('[convertWizardTaskTreeToMainList] 🔄 Converting node', {
      index: idx,
      nodeId: node.id,
      nodeTemplateId: node.templateId,
      nodeLabel: node.label,
      nodeType: node.type,
      hasSubNodes: !!node.subNodes,
      subNodesCount: node.subNodes?.length,
    });

    const mainNode: any = {
      label: node.label || 'Unnamed',
      icon: node.type === 'object' ? 'Folder' : node.type === 'number' ? 'Hash' : 'FileText',
      id: node.id,
      templateId: node.templateId || node.id,
      kind: node.type === 'object' ? 'object' : node.type === 'number' ? 'number' : 'string',
    };

    // ✅ MANTIENI subNodes (non convertire in subData)
    // La Sidebar.getSubNodes() si aspetta subNodes
    if (node.subNodes && Array.isArray(node.subNodes) && node.subNodes.length > 0) {
      console.log('[convertWizardTaskTreeToMainList] 📝 Converting subNodes', {
        nodeId: node.id,
        subNodesCount: node.subNodes.length,
      });

      mainNode.subNodes = node.subNodes.map((subNode, subIdx) => {
        console.log('[convertWizardTaskTreeToMainList] 🔄 Converting subNode', {
          nodeId: node.id,
          subNodeIndex: subIdx,
          subNodeId: subNode.id,
          subNodeTemplateId: subNode.templateId,
          subNodeLabel: subNode.label,
          subNodeType: subNode.type,
        });

        return {
          label: subNode.label || 'Unnamed',
          icon: subNode.type === 'number' ? 'Hash' : 'FileText',
          id: subNode.id,
          templateId: subNode.templateId || subNode.id,
          kind: subNode.type === 'number' ? 'number' : 'string',
          required: true, // Default: tutti i sub-nodi sono required
        };
      });

      console.log('[convertWizardTaskTreeToMainList] ✅ SubNodes converted', {
        nodeId: node.id,
        subNodesCount: mainNode.subNodes.length,
        subNodesStructure: mainNode.subNodes.map(sn => ({
          id: sn.id,
          templateId: sn.templateId,
          label: sn.label,
        })),
      });
    }

    console.log('[convertWizardTaskTreeToMainList] ✅ Node converted', {
      nodeId: node.id,
      mainNodeId: mainNode.id,
      mainNodeTemplateId: mainNode.templateId,
      mainNodeLabel: mainNode.label,
      mainNodeKind: mainNode.kind,
      hasSubNodes: !!mainNode.subNodes,
      subNodesCount: mainNode.subNodes?.length,
    });

    return mainNode;
  });

  console.log('[convertWizardTaskTreeToMainList] ✅ All nodes converted', {
    inputLength: wizardTree.length,
    outputLength: converted.length,
    convertedStructure: converted.map(m => ({
      id: m.id,
      templateId: m.templateId,
      label: m.label,
      kind: m.kind,
      hasSubNodes: !!m.subNodes,
      subNodesCount: m.subNodes?.length,
    })),
  });

  return converted;
}
