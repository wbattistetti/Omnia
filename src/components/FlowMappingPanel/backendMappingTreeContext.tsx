/**
 * Context condiviso tra `BackendMappingTree` e il renderer riga Arborist.
 */

import React, { createContext, useContext } from 'react';
import type { OpenApiInputUiKind } from '../../services/openApiBackendCallSpec';
import type { MappingEntry } from './mappingTypes';
import type { ParamDropPlacement, ParamDropPosition } from './backendParamInsert';
import type { BackendSendAdvancementApi } from './backendMappingTreeTypes';
import type { DropPreviewTone } from './backendMappingTreeDnD';
import type { AgentBackendParamDragPayload } from '@domain/agentInterface/agentInterfaceDragTypes';

export type AgentParamDragSource = Pick<
  AgentBackendParamDragPayload,
  'backendTaskId' | 'backendLabel'
>;

export type BackendMappingDropIndicator = {
  targetPathKey: string;
  placement: ParamDropPlacement;
} | null;

export interface BackendMappingTreeContextValue {
  entries: MappingEntry[];
  onEntriesChange: (next: MappingEntry[]) => void;
  listIdPrefix: string;
  showApiFields: boolean;
  enableBackendParamDrop: boolean;
  dropIndicator: BackendMappingDropIndicator;
  onBackendParamDragOver: (pathKey: string, placement: ParamDropPlacement) => void;
  onInsertBackendParam: (pos: ParamDropPosition) => void;
  onBackendFlowVariableDrop?: (e: React.DragEvent, pos: ParamDropPosition) => void;
  pendingLabelEditId: string | null;
  onConsumeLabelEditIntent: () => void;
  onAbandonEphemeralEntry: (entryId: string) => void;
  backendColumn?: 'send' | 'receive';
  variableOptions: string[];
  onCreateOutputVariable?: (displayName: string) => { id: string; label: string } | null;
  onOutputVariableCreated?: () => void;
  backendKnownVariableIds?: ReadonlySet<string>;
  backendSendParamKindByWireKey?: Record<string, OpenApiInputUiKind>;
  backendSendParamEnumByWireKey?: Record<string, string[]>;
  backendSendAdvancement?: BackendSendAdvancementApi;
  embeddedSignatureSubToolbarOpen?: boolean;
  /** When set, leaf rows drag to agent Interface with ghost. */
  agentParamDragSource?: AgentParamDragSource;
  dropLineIndentPx: (level: number) => number;
  dropLineTone: DropPreviewTone;
}

const BackendMappingTreeContext = createContext<BackendMappingTreeContextValue | null>(null);

export function BackendMappingTreeProvider({
  value,
  children,
}: {
  value: BackendMappingTreeContextValue;
  children: React.ReactNode;
}) {
  return <BackendMappingTreeContext.Provider value={value}>{children}</BackendMappingTreeContext.Provider>;
}

export function useBackendMappingTreeContext(): BackendMappingTreeContextValue {
  const ctx = useContext(BackendMappingTreeContext);
  if (!ctx) {
    throw new Error('useBackendMappingTreeContext must be used within BackendMappingTreeProvider');
  }
  return ctx;
}
