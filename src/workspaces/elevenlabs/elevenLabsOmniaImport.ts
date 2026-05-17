/**
 * Maps ElevenLabs workspace snapshot (node + agent settings + tools) into Omnia AI Agent fields.
 */

import { deriveBackendLabelFromUrl, type ManualCatalogEntry } from '@domain/backendCatalog';
import type { AIAgentProposedVariable } from '@types/aiAgentDesign';
import type { Task } from '@types/taskTypes';
import { extractTemplateVariableNames } from '../core/extractTemplateVariables';
import type {
  ImportNodeToOmniaResult,
  WorkspaceAgentSettings,
  WorkspaceAgentToolInventory,
  WorkspaceResolvedTool,
  WorkspaceWorkflowNode,
} from '../core/types';
import { generateSafeGuid } from '@utils/idGenerator';
import { taskRepository } from '@services/TaskRepository';
import { ensureManualCatalogBackendTask } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/ensureManualCatalogBackendTask';

export type OmniaImportTargets = {
  designDescription: string;
  setDesignDescription: (value: string) => void;
  proposedFields: readonly AIAgentProposedVariable[];
  onUpdateProposedField: (slotId: string, patch: Partial<AIAgentProposedVariable>) => void;
  addProposedFields: (fields: AIAgentProposedVariable[]) => void;
};

export type OmniaBackendCatalogTargets = {
  projectId: string | undefined;
  manualEntries: readonly ManualCatalogEntry[];
  setManualEntries: (entries: ManualCatalogEntry[]) => void;
  convaiBackendToolTaskIds: readonly string[];
  setConvaiBackendToolTaskIds: (ids: string[]) => void;
};

export type ElevenLabsOmniaImportInput = {
  node: WorkspaceWorkflowNode;
  agentName: string;
  settings: WorkspaceAgentSettings;
  toolInventory: WorkspaceAgentToolInventory;
  targets: OmniaImportTargets;
  backends?: OmniaBackendCatalogTargets;
};

function buildImportHeader(node: WorkspaceWorkflowNode, agentName: string): string {
  const parts = [
    `<!-- Workspace ElevenLabs: nodo "${node.label}" (${node.id}) -->`,
    agentName.trim() ? `Agente remoto: ${agentName.trim()}` : '',
  ].filter(Boolean);
  return parts.join('\n');
}

/** System prompt text to store in `agentDesignDescription` for this node. */
export function resolveSystemPromptForImport(
  node: WorkspaceWorkflowNode,
  settings: WorkspaceAgentSettings
): string {
  if (node.inheritsGlobalPrompt) {
    return String(settings.globalPrompt || '').trim();
  }
  return String(node.promptText || '').trim();
}

function isWebhookLikeTool(t: WorkspaceResolvedTool): boolean {
  return (
    t.kind === 'webhook' ||
    t.kind === 'api_integration_webhook' ||
    Boolean(t.url?.trim())
  );
}

/** Agent-inherited + node-local webhook tools applicable to this node. */
export function collectWebhookToolsForNode(
  node: WorkspaceWorkflowNode,
  toolInventory: WorkspaceAgentToolInventory
): WorkspaceResolvedTool[] {
  if (node.kind !== 'subagent' && node.kind !== 'tool') return [];
  const tools = node.tools;
  const inherited =
    tools?.inheritsAgentTools !== false ? toolInventory.agentTools.filter(isWebhookLikeTool) : [];
  const local = toolInventory.allTools.filter(
    (t) => t.scope === 'node' && t.nodeId === node.id && isWebhookLikeTool(t)
  );
  const byId = new Map<string, WorkspaceResolvedTool>();
  for (const t of [...inherited, ...local]) {
    if (!byId.has(t.id)) byId.set(t.id, t);
  }
  return [...byId.values()];
}

function normalizeUrlKey(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  try {
    const withScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(withScheme);
    return `${u.origin}${u.pathname}`.toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
}

/**
 * Appends manual catalog rows (one accordion each) for ElevenLabs webhook tools; dedupes by URL.
 */
export function mergeElevenLabsBackendsIntoCatalog(
  tools: readonly WorkspaceResolvedTool[],
  manualEntries: readonly ManualCatalogEntry[],
  projectId: string | undefined
): { manualEntries: ManualCatalogEntry[]; backendTaskIds: string[]; addedCount: number } {
  const entries = [...manualEntries];
  const urlToId = new Map<string, string>();
  for (const e of entries) {
    const key = normalizeUrlKey(e.endpointUrl);
    if (key) urlToId.set(key, e.id);
  }

  const backendTaskIds: string[] = [];
  let addedCount = 0;

  for (const tool of tools) {
    const url = tool.url?.trim();
    if (!url) continue;
    const urlKey = normalizeUrlKey(url);
    const existingId = urlKey ? urlToId.get(urlKey) : undefined;
    if (existingId) {
      backendTaskIds.push(existingId);
      continue;
    }

    const id = generateSafeGuid();
    const now = new Date().toISOString();
    const label = tool.name.trim() || deriveBackendLabelFromUrl(url);
    const entry: ManualCatalogEntry = {
      id,
      label,
      method: (tool.httpMethod || 'POST').trim().toUpperCase() || 'POST',
      endpointUrl: url,
      creationMode: 'import',
      importSpecRevealed: false,
      frozenMeta: {
        lastImportedAt: null,
        specSourceUrl: null,
        contentHash: null,
        importState: 'none',
      },
      lastStructuralEditAt: now,
      notes: tool.description?.trim() || undefined,
    };
    entries.push(entry);
    if (urlKey) urlToId.set(urlKey, id);
    backendTaskIds.push(id);
    addedCount += 1;

    ensureManualCatalogBackendTask(entry, projectId);
    const desc = tool.description?.trim();
    if (desc) {
      taskRepository.updateTask(id, { backendToolDescription: desc } as Partial<Task>, projectId);
    }
  }

  return { manualEntries: entries, backendTaskIds, addedCount };
}

/**
 * Imports system prompt → design description, template vars, and webhook backends (catalog + ConvAI ids).
 */
export function importElevenLabsNodeToOmnia(input: ElevenLabsOmniaImportInput): ImportNodeToOmniaResult {
  const { node, agentName, settings, toolInventory, targets, backends } = input;
  const prompt = resolveSystemPromptForImport(node, settings);
  const header = buildImportHeader(node, agentName);
  const inheritNote =
    node.inheritsGlobalPrompt && !prompt
      ? '\n\n(Prompt di sistema agente vuoto su ElevenLabs.)'
      : '';
  const block = prompt ? `${header}\n\n${prompt}` : `${header}${inheritNote}`;

  const prev = String(targets.designDescription || '').trim();
  targets.setDesignDescription(prev ? `${block}\n\n---\n\n${prev}` : block);

  const variableNames = extractTemplateVariableNames(prompt);
  const existingLabels = new Set(
    targets.proposedFields.map((f) => String(f.label || '').trim().toLowerCase())
  );
  const toAdd: AIAgentProposedVariable[] = [];
  for (const name of variableNames) {
    const key = name.toLowerCase();
    if (existingLabels.has(key)) continue;
    existingLabels.add(key);
    toAdd.push({
      slotId: generateSafeGuid(),
      label: name,
      type: 'text',
      required: false,
    });
  }
  if (toAdd.length > 0) {
    targets.addProposedFields(toAdd);
  }

  let backendsAdded = 0;
  let backendsLinked = 0;
  if (backends) {
    const webhookTools = collectWebhookToolsForNode(node, toolInventory);
    const merged = mergeElevenLabsBackendsIntoCatalog(
      webhookTools,
      backends.manualEntries,
      backends.projectId
    );
    backendsAdded = merged.addedCount;
    backendsLinked = merged.backendTaskIds.length;
    backends.setManualEntries(merged.manualEntries);

    const prevIds = new Set(
      (backends.convaiBackendToolTaskIds ?? []).map((x) => String(x).trim()).filter(Boolean)
    );
    for (const id of merged.backendTaskIds) prevIds.add(id);
    backends.setConvaiBackendToolTaskIds([...prevIds]);
  }

  return {
    promptApplied: prompt.length > 0,
    variableNames,
    toolCount: collectWebhookToolsForNode(node, toolInventory).length,
    backendsAdded,
    backendsLinked,
  };
}
