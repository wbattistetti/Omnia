/**
 * HTML5 drag payload for ElevenLabs workflow node → Omnia flow canvas drop.
 */

import type { WorkspaceAgentSnapshot, WorkspaceWorkflowNode } from '../core/types';

export const ELEVENLABS_NODE_DRAG_MIME = 'application/omnia-elevenlabs-workflow-node+json';

export type ElevenLabsNodeDragPayload = {
  remoteAgentId: string;
  remoteAgentName: string;
  node: WorkspaceWorkflowNode;
  /** Serialized agent snapshot for import without re-fetch on drop. */
  snapshot: WorkspaceAgentSnapshot;
};

export function writeElevenLabsNodeDragData(
  dataTransfer: DataTransfer,
  payload: ElevenLabsNodeDragPayload
): void {
  const json = JSON.stringify(payload);
  dataTransfer.setData(ELEVENLABS_NODE_DRAG_MIME, json);
  dataTransfer.setData('text/plain', payload.node.label || 'ElevenLabs node');
  dataTransfer.effectAllowed = 'copy';
}

export function readElevenLabsNodeDragPayload(
  dataTransfer: DataTransfer
): ElevenLabsNodeDragPayload | null {
  const raw = dataTransfer.getData(ELEVENLABS_NODE_DRAG_MIME);
  if (!raw?.trim()) return null;
  try {
    const o = JSON.parse(raw) as ElevenLabsNodeDragPayload;
    if (!o?.node?.id || !o?.snapshot?.workflow) return null;
    return o;
  } catch {
    return null;
  }
}

export function hasElevenLabsNodeDrag(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes(ELEVENLABS_NODE_DRAG_MIME);
}
