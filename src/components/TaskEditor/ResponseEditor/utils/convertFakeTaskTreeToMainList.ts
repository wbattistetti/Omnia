// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { WizardTaskTreeNode } from '../../../../../TaskBuilderAIWizard/types';

/**
 * Converte FakeTaskTreeNode[] (formato Wizard) in mainList (formato DDT/ResponseEditor).
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
 * @param fakeTree Array di FakeTaskTreeNode dal Wizard
 * @returns Array di nodi mainList compatibili con ResponseEditor
 */
export function convertFakeTaskTreeToMainList(fakeTree: FakeTaskTreeNode[]): any[] {
  if (!Array.isArray(fakeTree) || fakeTree.length === 0) {
    return [];
  }

  const converted = fakeTree.map((node, idx) => {
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
