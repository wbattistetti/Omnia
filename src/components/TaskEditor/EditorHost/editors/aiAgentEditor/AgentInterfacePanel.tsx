/**
 * Agent task Interface editor: INPUT/OUTPUT only (wireKey-first; variables materialize on [[ref]]).
 */

import React, { useCallback } from 'react';
import { X } from 'lucide-react';
import { InterfaceMappingEditor } from '@components/FlowMappingPanel/InterfaceMappingEditor';
import type { MappingEntry } from '@components/FlowMappingPanel/mappingTypes';
import { createMappingEntry } from '@components/FlowMappingPanel/mappingTypes';
import { shouldSkipInterfaceDuplicate } from '@components/FlowMappingPanel/interfaceMappingLabels';
import type { FlowInterfaceDropPayload } from '@components/FlowMappingPanel/flowInterfaceDragTypes';
import type { AgentInterfaceParamSide } from '@domain/agentInterface/agentInterfaceState';

export interface AgentInterfacePanelProps {
  agentTitle: string;
  interfaceInput: MappingEntry[];
  interfaceOutput: MappingEntry[];
  onInterfaceInputChange: (next: MappingEntry[]) => void;
  onInterfaceOutputChange: (next: MappingEntry[]) => void;
  onClose: () => void;
  projectId?: string;
  listIdPrefix: string;
  className?: string;
}

function entryFromAgentBackendDrop(
  payload: FlowInterfaceDropPayload
): MappingEntry & { sourceBackendTaskId?: string; sourceSide?: AgentInterfaceParamSide } {
  const agent = payload.agentBackendParam!;
  return {
    ...createMappingEntry({ wireKey: agent.wireKey }),
    sourceBackendTaskId: agent.backendTaskId,
    sourceSide: agent.side,
  };
}

export function AgentInterfacePanel({
  agentTitle,
  interfaceInput,
  interfaceOutput,
  onInterfaceInputChange,
  onInterfaceOutputChange,
  onClose,
  projectId,
  listIdPrefix,
  className = '',
}: AgentInterfacePanelProps) {
  const onInputDrop = useCallback(
    (payload: FlowInterfaceDropPayload) => {
      if (payload.agentBackendParam) {
        if (payload.agentBackendParam.side !== 'send') return;
        const newEntry = entryFromAgentBackendDrop(payload);
        if (shouldSkipInterfaceDuplicate(interfaceInput, newEntry)) return;
        onInterfaceInputChange([...interfaceInput, newEntry]);
        return;
      }
      const path = payload.wireKey.trim();
      if (!path) return;
      const newEntry = createMappingEntry({
        wireKey: path,
        ...(payload.variableRefId?.trim() ? { variableRefId: payload.variableRefId.trim() } : {}),
      });
      if (shouldSkipInterfaceDuplicate(interfaceInput, newEntry)) return;
      onInterfaceInputChange([...interfaceInput, newEntry]);
    },
    [interfaceInput, onInterfaceInputChange]
  );

  const onOutputDrop = useCallback(
    (payload: FlowInterfaceDropPayload) => {
      if (payload.agentBackendParam) {
        if (payload.agentBackendParam.side !== 'receive') return;
        const newEntry = entryFromAgentBackendDrop(payload);
        if (shouldSkipInterfaceDuplicate(interfaceOutput, newEntry)) return;
        onInterfaceOutputChange([...interfaceOutput, newEntry]);
        return;
      }
      const path = payload.wireKey.trim();
      if (!path) return;
      const newEntry = createMappingEntry({
        wireKey: path,
        ...(payload.variableRefId?.trim() ? { variableRefId: payload.variableRefId.trim() } : {}),
      });
      if (shouldSkipInterfaceDuplicate(interfaceOutput, newEntry)) return;
      onInterfaceOutputChange([...interfaceOutput, newEntry]);
    },
    [interfaceOutput, onInterfaceOutputChange]
  );

  return (
    <div
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden border-l border-slate-700/60 bg-slate-950/80 ${className}`}
    >
      <InterfaceMappingEditor
        variant="interface"
        backendSend={[]}
        backendReceive={[]}
        onBackendSendChange={() => {}}
        onBackendReceiveChange={() => {}}
        interfaceInput={interfaceInput}
        interfaceOutput={interfaceOutput}
        onInterfaceInputChange={onInterfaceInputChange}
        onInterfaceOutputChange={onInterfaceOutputChange}
        interfaceDropWireKeyOnly
        onInterfaceInputDrop={onInputDrop}
        onInterfaceOutputDrop={onOutputDrop}
        enableAgentBackendParamDrop
        apiOptions={[]}
        variableOptions={[]}
        listIdPrefix={listIdPrefix}
        showVariantToggle={false}
        showInterfacePalette={false}
        showLayoutHint={false}
        interfaceFlowTitle={agentTitle.trim() || 'Agent'}
        className="min-h-0 flex-1"
        innerClassName="min-h-0 flex-1"
        projectId={projectId}
        interfaceShellHeaderExtra={
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Chiudi interfaccia agente"
            title="Chiudi interfaccia"
          >
            <X className="h-4 w-4" />
          </button>
        }
      />
    </div>
  );
}
