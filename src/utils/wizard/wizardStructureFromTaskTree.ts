// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * PR2: Wizard structure is the TaskTree in Zustand (same pipeline as manual).
 * This module derives wizard-facing nodes, merges pipeline UI state, and commits AI/template structure to the editor store.
 */

import { DialogueTaskService } from '@services/DialogueTaskService';
import type { TaskTree } from '@types/taskTypes';
import {
  convertTaskTreeToWizardTaskTree,
  convertWizardTaskTreeToTaskTree,
} from '@components/TaskTreeBuilder/TaskBuilderAIWizardAdapter';
import { useTaskTreeStore } from '@responseEditor/core/state';
import { ensureTaskTreeNodeIds } from '@responseEditor/core/taskTree';
import type { TaskPipelineStatus, WizardTaskTreeNode } from '@TaskBuilderAIWizard/types/WizardTaskTreeNode';
import { useWizardStore } from '@TaskBuilderAIWizard/store/wizardStore';

function mergePipelineIntoNode(
  node: WizardTaskTreeNode,
  byId: Record<string, TaskPipelineStatus>
): WizardTaskTreeNode {
  const patch = byId[node.id];
  const base: TaskPipelineStatus = node.pipelineStatus ?? {
    constraints: 'pending',
    parser: 'pending',
    messages: 'pending',
  };
  const next: WizardTaskTreeNode = {
    ...node,
    pipelineStatus: patch ? { ...base, ...patch } : base,
  };
  if (node.subNodes?.length) {
    next.subNodes = node.subNodes.map((s) => mergePipelineIntoNode(s, byId));
  }
  return next;
}

/**
 * Overlay per-node pipeline progress from wizard UI store onto derived wizard nodes.
 */
export function mergeWizardPipelineIntoNodes(
  roots: WizardTaskTreeNode[],
  pipelineByNodeId: Record<string, TaskPipelineStatus>
): WizardTaskTreeNode[] {
  return roots.map((n) => mergePipelineIntoNode(n, pipelineByNodeId));
}

/**
 * Copy constraints/dataContract from in-memory templates onto wizard nodes (generation uses template cache).
 */
export function enrichWizardNodesFromTemplates(roots: WizardTaskTreeNode[]): WizardTaskTreeNode[] {
  const walk = (node: WizardTaskTreeNode): WizardTaskTreeNode => {
    const template = DialogueTaskService.getTemplate(node.id);
    const next: WizardTaskTreeNode = {
      ...node,
      ...(template?.constraints ? { constraints: template.constraints } : {}),
      ...(template?.dataContract ? { dataContract: template.dataContract } : {}),
    };
    if (node.subNodes?.length) {
      next.subNodes = node.subNodes.map(walk);
    }
    return next;
  };
  return roots.map(walk);
}

/**
 * Build wizard-facing tree from TaskTree + pipeline UI map (pure; safe for React memo deps).
 */
export function buildWizardStructureView(
  taskTree: TaskTree | null | undefined,
  pipelineByNodeId: Record<string, TaskPipelineStatus>
): WizardTaskTreeNode[] {
  if (!taskTree?.nodes?.length) {
    return [];
  }
  const base = convertTaskTreeToWizardTaskTree(taskTree);
  const enriched = enrichWizardNodesFromTemplates(base);
  return mergeWizardPipelineIntoNodes(enriched, pipelineByNodeId);
}

/**
 * Single snapshot: current Zustand TaskTree + wizard pipeline UI.
 */
export function getWizardStructureSnapshot(): WizardTaskTreeNode[] {
  const taskTree = useTaskTreeStore.getState().taskTree;
  const pipelineMap = useWizardStore.getState().nodePipelineUiById;
  return buildWizardStructureView(taskTree, pipelineMap);
}

export interface CommitWizardStructureOptions {
  taskLabel?: string;
  replaceSelectedTaskTree?: (taskTree: TaskTree) => void;
}

/**
 * Writes wizard/AI structure into the shared TaskTree store and notifies the DDT manager.
 */
export function commitWizardStructureToEditor(
  wizardNodes: WizardTaskTreeNode[],
  options: CommitWizardStructureOptions = {}
): TaskTree {
  const raw = convertWizardTaskTreeToTaskTree(
    wizardNodes,
    options.taskLabel,
    undefined
  );
  const ensured = ensureTaskTreeNodeIds(raw);
  useTaskTreeStore.getState().setTaskTree(ensured);
  try {
    options.replaceSelectedTaskTree?.(ensured);
  } catch {
    /* ignore */
  }
  return ensured;
}
