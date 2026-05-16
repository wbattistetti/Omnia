/**
 * HTML5 drag payloads from agent backend signature palette → agent Interface INPUT/OUTPUT.
 */

import type { DragEvent } from 'react';
import type { AgentInterfaceParamSide } from './agentInterfaceState';

export const DND_AGENT_BACKEND_PARAM = 'application/x-omnia-agent-backend-param';
/** Side-only MIME so dragover can validate zone without parsing JSON (when the browser exposes it). */
export const DND_AGENT_BACKEND_PARAM_SIDE = 'application/x-omnia-agent-backend-param-side';

export type AgentBackendParamDragPayload = {
  wireKey: string;
  backendTaskId: string;
  side: AgentInterfaceParamSide;
  backendLabel?: string;
};

function dragTypesList(dt: DataTransfer): string[] {
  return [...dt.types];
}

export function hasAgentBackendParamDrag(e: Pick<DragEvent, 'dataTransfer'>): boolean {
  const types = dragTypesList(e.dataTransfer);
  if (types.includes(DND_AGENT_BACKEND_PARAM)) return true;
  if (types.includes(DND_AGENT_BACKEND_PARAM_SIDE)) return true;
  return types.some(
    (t) =>
      t.toLowerCase() === DND_AGENT_BACKEND_PARAM.toLowerCase() ||
      t.toLowerCase() === DND_AGENT_BACKEND_PARAM_SIDE.toLowerCase()
  );
}

/** Best-effort side read during dragover (may be empty until drop in some browsers). */
export function readAgentBackendParamSideDuringDrag(
  dt: DataTransfer
): AgentInterfaceParamSide | null {
  const sideOnly = dt.getData(DND_AGENT_BACKEND_PARAM_SIDE);
  if (sideOnly === 'send' || sideOnly === 'receive') return sideOnly;
  return parseAgentBackendParamDropFromDataTransfer(dt)?.side ?? null;
}

export function isAgentBackendParamDropAllowedForZone(
  interfaceZone: 'input' | 'output' | undefined,
  side: AgentInterfaceParamSide | null
): boolean {
  if (!side) return true;
  if (interfaceZone === 'input') return side === 'send';
  if (interfaceZone === 'output') return side === 'receive';
  return true;
}

/** Call on dragover targets; returns true when this drag type was handled. */
export function handleAgentBackendParamDragOver(
  e: Pick<DragEvent, 'dataTransfer' | 'preventDefault'>,
  interfaceZone: 'input' | 'output' | undefined
): boolean {
  if (!hasAgentBackendParamDrag(e)) return false;
  const side = readAgentBackendParamSideDuringDrag(e.dataTransfer);
  e.preventDefault();
  e.dataTransfer.dropEffect = isAgentBackendParamDropAllowedForZone(interfaceZone, side)
    ? 'copy'
    : 'none';
  return true;
}

export function parseAgentBackendParamDropFromDataTransfer(
  dt: DataTransfer
): AgentBackendParamDragPayload | null {
  const raw = dt.getData(DND_AGENT_BACKEND_PARAM);
  if (!raw?.trim()) return null;
  try {
    const p = JSON.parse(raw) as Partial<AgentBackendParamDragPayload>;
    const wireKey = String(p.wireKey ?? '').trim();
    const backendTaskId = String(p.backendTaskId ?? '').trim();
    const side = p.side;
    if (!wireKey || !backendTaskId || (side !== 'send' && side !== 'receive')) return null;
    const backendLabel =
      typeof p.backendLabel === 'string' && p.backendLabel.trim() ? p.backendLabel.trim() : undefined;
    return { wireKey, backendTaskId, side, ...(backendLabel ? { backendLabel } : {}) };
  } catch {
    return null;
  }
}

export function writeAgentBackendParamDragData(
  dt: DataTransfer,
  payload: AgentBackendParamDragPayload
): void {
  dt.setData(DND_AGENT_BACKEND_PARAM, JSON.stringify(payload));
  dt.setData(DND_AGENT_BACKEND_PARAM_SIDE, payload.side);
  dt.setData('text/plain', payload.wireKey);
  dt.effectAllowed = 'copy';
}
