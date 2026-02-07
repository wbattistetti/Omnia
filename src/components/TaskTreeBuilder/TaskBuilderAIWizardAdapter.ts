// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { FakeTaskTreeNode, FakeStepMessages } from '../../TaskBuilderAIWizard/types';
import type { TaskTree, TaskTreeNode } from '../../types/taskTypes';

/**
 * Converts FakeTaskTreeNode[] to TaskTree (format expected by the system)
 */
export function convertFakeTaskTreeToTaskTree(
  fakeTree: FakeTaskTreeNode[],
  labelKey?: string,
  messages?: FakeStepMessages
): TaskTree {
  // Convert fake nodes to TaskTreeNode
  const nodes: TaskTreeNode[] = fakeTree.map(convertFakeNodeToTaskNode);

  // Build steps from messages if available
  const steps: Record<string, Record<string, any>> = {};
  if (messages) {
    fakeTree.forEach((fakeNode) => {
      steps[fakeNode.templateId] = convertMessagesToSteps(messages, fakeNode.templateId);
    });
  }

  // Extract constraints from first root node (if present)
  const rootConstraints = fakeTree[0]?.constraints || [];

  // Extract dataContract from first root node (if present)
  const rootDataContract = fakeTree[0]?.dataContract;

  return {
    labelKey: labelKey || generateLabelKey(fakeTree[0]?.label || 'task'),
    nodes,
    steps,
    constraints: rootConstraints.length > 0 ? rootConstraints : undefined,
    dataContract: rootDataContract,
  };
}

/**
 * Converts a single FakeTaskTreeNode to TaskTreeNode
 */
function convertFakeNodeToTaskNode(fakeNode: FakeTaskTreeNode): TaskTreeNode {
  const node: TaskTreeNode = {
    id: fakeNode.id,
    templateId: fakeNode.templateId,
    label: fakeNode.label,
    type: fakeNode.type,
    icon: fakeNode.icon,
    constraints: fakeNode.constraints,
    dataContract: fakeNode.dataContract,
  };

  // Recursively convert subNodes
  if (fakeNode.subNodes && fakeNode.subNodes.length > 0) {
    node.subNodes = fakeNode.subNodes.map(convertFakeNodeToTaskNode);
  }

  return node;
}

/**
 * Converts FakeStepMessages to steps format for TaskTree
 */
function convertMessagesToSteps(
  messages: FakeStepMessages,
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
 * Converts TaskTree to FakeTaskTreeNode[] (for edit mode)
 */
export function convertTaskTreeToFakeTaskTree(taskTree: TaskTree): FakeTaskTreeNode[] {
  return taskTree.nodes.map((node) => convertTaskNodeToFakeNode(node));
}

function convertTaskNodeToFakeNode(node: TaskTreeNode): FakeTaskTreeNode {
  const fakeNode: FakeTaskTreeNode = {
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
    fakeNode.subNodes = node.subNodes.map(convertTaskNodeToFakeNode);
  }

  return fakeNode;
}
