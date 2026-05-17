/**
 * Opens or activates an ElevenLabs ConvAI workspace tab beside the main flow tab.
 */

import type { DockNode, DockTabElevenLabsWorkspace } from './types';
import { activateTab, getTab, upsertAddNextTo } from './ops';

/** Stable dock tab id for a remote ConvAI agent. */
export function elevenLabsWorkspaceTabId(agentId: string): string {
  const safe = String(agentId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 96);
  return `el_ws_${safe || 'agent'}`;
}

export function buildElevenLabsWorkspaceTab(
  agentId: string,
  agentName?: string,
  linkedTaskInstanceId?: string
): DockTabElevenLabsWorkspace {
  const id = elevenLabsWorkspaceTabId(agentId);
  const label = String(agentName || '').trim();
  const title = label ? `EL: ${label}` : `ElevenLabs: ${agentId}`;
  return {
    id,
    title,
    type: 'elevenlabsWorkspace',
    agentId: String(agentId).trim(),
    agentName: label || undefined,
    linkedTaskInstanceId: linkedTaskInstanceId?.trim() || undefined,
  };
}

/**
 * Inserts the workspace tab after `tab_main`, or focuses it when already open.
 */
export function openElevenLabsWorkspaceInDock(
  tree: DockNode,
  agentId: string,
  agentName?: string,
  linkedTaskInstanceId?: string
): DockNode {
  const tab = buildElevenLabsWorkspaceTab(agentId, agentName, linkedTaskInstanceId);
  if (getTab(tree, tab.id)) {
    return activateTab(tree, tab.id);
  }
  return upsertAddNextTo(tree, 'tab_main', tab);
}
