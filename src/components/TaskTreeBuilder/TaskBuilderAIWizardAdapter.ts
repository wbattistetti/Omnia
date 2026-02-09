// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { WizardTaskTreeNode, WizardStepMessages } from '../../TaskBuilderAIWizard/types';
import type { TaskTree, TaskTreeNode } from '../../types/taskTypes';

/**
 * Converts WizardTaskTreeNode[] to TaskTree (format expected by the system)
 */
export function convertWizardTaskTreeToTaskTree(
  wizardTree: WizardTaskTreeNode[],
  labelKey?: string,
  messages?: WizardStepMessages
): TaskTree {
  // Convert wizard nodes to TaskTreeNode
  const nodes: TaskTreeNode[] = wizardTree.map(convertWizardNodeToTaskNode);

  // Build steps from messages if available
  const steps: Record<string, Record<string, any>> = {};
  if (messages) {
    wizardTree.forEach((wizardNode) => {
      steps[wizardNode.templateId] = convertMessagesToSteps(messages, wizardNode.templateId);
    });
  }

  // Extract constraints from first root node (if present)
  const rootConstraints = wizardTree[0]?.constraints || [];

  // Extract dataContract from first root node (if present)
  const rootDataContract = wizardTree[0]?.dataContract;

  return {
    labelKey: labelKey || generateLabelKey(wizardTree[0]?.label || 'task'),
    nodes,
    steps,
    constraints: rootConstraints.length > 0 ? rootConstraints : undefined,
    dataContract: rootDataContract,
  };
}

/**
 * Converts a single WizardTaskTreeNode to TaskTreeNode
 */
function convertWizardNodeToTaskNode(wizardNode: WizardTaskTreeNode): TaskTreeNode {
  const node: TaskTreeNode = {
    id: wizardNode.id,
    templateId: wizardNode.templateId,
    label: wizardNode.label,
    type: wizardNode.type,
    icon: wizardNode.icon,
    constraints: wizardNode.constraints,
    dataContract: wizardNode.dataContract,
  };

  // Recursively convert subNodes
  if (wizardNode.subNodes && wizardNode.subNodes.length > 0) {
    node.subNodes = wizardNode.subNodes.map(convertWizardNodeToTaskNode);
  }

  return node;
}

/**
 * Converts WizardStepMessages to steps format for TaskTree
 */
function convertMessagesToSteps(
  messages: WizardStepMessages,
  templateId: string
): Record<string, any> {
  const stepRecord: Record<string, any> = {};

  // Ask messages
  if (messages.ask?.base && messages.ask.base.length > 0) {
    stepRecord.start = {
      messages: messages.ask.base.map((text) => ({ text, role: 'bot' })),
    };
  }

  // Reask messages
  if (messages.ask?.reask && messages.ask.reask.length > 0) {
    stepRecord.noMatch = {
      messages: messages.ask.reask.map((text) => ({ text, role: 'bot' })),
    };
  }

  // Confirm messages
  if (messages.confirm?.base && messages.confirm.base.length > 0) {
    stepRecord.confirmation = {
      messages: messages.confirm.base.map((text) => ({ text, role: 'bot' })),
    };
  }

  // Not confirmed
  if (messages.notConfirmed?.base && messages.notConfirmed.base.length > 0) {
    stepRecord.notConfirmed = {
      messages: messages.notConfirmed.base.map((text) => ({ text, role: 'bot' })),
    };
  }

  // Violation messages
  if (messages.violation?.base && messages.violation.base.length > 0) {
    stepRecord.violation = {
      messages: messages.violation.base.map((text) => ({ text, role: 'bot' })),
    };
  }

  // Success messages
  if (messages.success?.base && messages.success.base.length > 0) {
    stepRecord.success = {
      messages: messages.success.base.map((text) => ({ text, role: 'bot' })),
    };
  }

  return stepRecord;
}

/**
 * Generates a labelKey from a label
 */
function generateLabelKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Converts TaskTree to WizardTaskTreeNode[] (for edit mode)
 */
export function convertTaskTreeToWizardTaskTree(taskTree: TaskTree): WizardTaskTreeNode[] {
  return taskTree.nodes.map((node) => convertTaskNodeToWizardNode(node));
}

function convertTaskNodeToWizardNode(node: TaskTreeNode): WizardTaskTreeNode {
  const wizardNode: WizardTaskTreeNode = {
    id: node.id,
    templateId: node.templateId,
    label: node.label,
    type: node.type,
    icon: node.icon,
    constraints: node.constraints,
    dataContract: node.dataContract,
    pipelineStatus: {
      constraints: node.constraints ? 'completed' : 'pending',
      parser: node.dataContract ? 'completed' : 'pending',
      messages: 'pending',
    },
  };

  if (node.subNodes && node.subNodes.length > 0) {
    wizardNode.subNodes = node.subNodes.map(convertTaskNodeToWizardNode);
  }

  return wizardNode;
}
