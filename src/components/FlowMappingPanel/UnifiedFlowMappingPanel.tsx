/**
 * Demo shell: local state + InterfaceMappingEditor (same UI as Backend Call mapping).
 */

import React, { useState } from 'react';
import type { FlowMappingVariant } from './types';
import { createMappingEntry, type MappingEntry } from './mappingTypes';
import { InterfaceMappingEditor } from './InterfaceMappingEditor';

const MOCK_API_FIELDS = ['ticketId', 'status', 'birth', 'day', 'month', 'year', 'validationOk'];
const MOCK_VARIABLES = [
  '11111111-1111-4111-8111-111111111101',
  '22222222-2222-4222-8222-222222222202',
];

const MOCK_DRAG_LABELS = ['demo', 'field'];

function seedBackendSend(): MappingEntry[] {
  return [
    createMappingEntry({
      wireKey: 'Numero',
      apiField: 'ticketId',
    }),
  ];
}

function seedBackendReceive(): MappingEntry[] {
  return [
    createMappingEntry({
      wireKey: 'stato',
      apiField: 'status',
    }),
    createMappingEntry({
      wireKey: 'data_di_nascita',
      apiField: 'birth',
    }),
    createMappingEntry({
      wireKey: 'data_di_nascita.giorno',
      apiField: 'day',
    }),
    createMappingEntry({
      wireKey: 'data_di_nascita.mese',
      apiField: 'month',
    }),
    createMappingEntry({
      wireKey: 'data_di_nascita.anno',
      apiField: 'year',
    }),
  ];
}

export interface UnifiedFlowMappingPanelProps {
  initialVariant?: FlowMappingVariant;
  title?: string;
}

export function UnifiedFlowMappingPanel({
  initialVariant = 'backend',
  title = 'Mapping',
}: UnifiedFlowMappingPanelProps) {
  const [variant, setVariant] = useState<FlowMappingVariant>(initialVariant);
  const [endpoint, setEndpoint] = useState('https://api.example.com/endpoint');
  const [endpointMethod, setEndpointMethod] = useState('POST');

  const [backendSend, setBackendSend] = useState<MappingEntry[]>(seedBackendSend);
  const [backendReceive, setBackendReceive] = useState<MappingEntry[]>(seedBackendReceive);
  const [interfaceInput, setInterfaceInput] = useState<MappingEntry[]>([]);
  const [interfaceOutput, setInterfaceOutput] = useState<MappingEntry[]>([]);

  return (
    <InterfaceMappingEditor
      variant={variant}
      onVariantChange={setVariant}
      showVariantToggle
      title={title}
      showEndpoint
      endpointUrl={endpoint}
      endpointMethod={endpointMethod}
      onEndpointUrlChange={setEndpoint}
      onEndpointMethodChange={setEndpointMethod}
      listIdPrefix="demo"
      backendSend={backendSend}
      backendReceive={backendReceive}
      onBackendSendChange={setBackendSend}
      onBackendReceiveChange={setBackendReceive}
      interfaceInput={interfaceInput}
      interfaceOutput={interfaceOutput}
      onInterfaceInputChange={setInterfaceInput}
      onInterfaceOutputChange={setInterfaceOutput}
      apiOptions={MOCK_API_FIELDS}
      variableOptions={MOCK_VARIABLES}
      interfaceDragLabels={MOCK_DRAG_LABELS}
      showInterfacePalette
      showLayoutHint
    />
  );
}
