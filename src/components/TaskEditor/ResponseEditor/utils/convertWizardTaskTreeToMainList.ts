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
  if (!Array.isArray(wizardTree) || wizardTree.length === 0) {
    return [];
  }

  const converted = wizardTree.map((node, idx) => {
    // ✅ FIX: For root node (idx === 0), use generalizedLabel if available
    const nodeLabel = (idx === 0 && node.generalizedLabel)
      ? node.generalizedLabel
      : (node.label || 'Unnamed');

    const mainNode: any = {
      label: nodeLabel,
      icon: node.type === 'object' ? 'Folder' : node.type === 'number' ? 'Hash' : 'FileText',
      id: node.id,
      templateId: node.templateId || node.id,
      kind: node.type === 'object' ? 'object' : node.type === 'number' ? 'number' : 'string',
    };

    // ✅ MANTIENI subNodes (non convertire in subData)
    // La Sidebar.getSubNodes() si aspetta subNodes
    if (node.subNodes && Array.isArray(node.subNodes) && node.subNodes.length > 0) {
      mainNode.subNodes = node.subNodes.map((subNode, subIdx) => {
        return {
          label: subNode.label || 'Unnamed',
          icon: subNode.type === 'number' ? 'Hash' : 'FileText',
          id: subNode.id,
          templateId: subNode.templateId || subNode.id,
          kind: subNode.type === 'number' ? 'number' : 'string',
          required: true, // Default: tutti i sub-nodi sono required
        };
      });
    }

    return mainNode;
  });

  return converted;
}
