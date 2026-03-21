/**
 * Demo shell: local state + InterfaceMappingEditor (same UI as Backend Call mapping).
 */

import React, { useState } from 'react';
import type { FlowMappingVariant } from './types';
import { createMappingEntry, type MappingEntry } from './mappingTypes';
import { InterfaceMappingEditor } from './InterfaceMappingEditor';

const MOCK_API_FIELDS = ['ticketId', 'status', 'birth', 'day', 'month', 'year', 'validationOk'];
const MOCK_VARIABLES = ['Numero', 'stato ticket', 'data di nascita', 'data di nascita.giorno', 'esito.validazione'];

const MOCK_DRAG_LABELS = [
  'data di nascita',
  'data di nascita.giorno',
  'data di nascita.mese',
  'data di nascita.anno',
  'stato ticket',
  'Numero',
  'esito.validazione',
];

function seedBackendSend(): MappingEntry[] {
  return [
    createMappingEntry({
      internalPath: 'Numero',
      apiField: 'ticketId',
      linkedVariable: 'Numero',
      externalName: 'Numero',
    }),
  ];
}

function seedBackendReceive(): MappingEntry[] {
  return [
    createMappingEntry({
      internalPath: 'stato',
      apiField: 'status',
      linkedVariable: 'stato ticket',
      externalName: 'stato',
    }),
    createMappingEntry({
      internalPath: 'data di nascita',
      apiField: 'birth',
      linkedVariable: 'data di nascita',
      externalName: 'data di nascita',
    }),
    createMappingEntry({
      internalPath: 'data di nascita.giorno',
      apiField: 'day',
      linkedVariable: 'data di nascita.giorno',
      externalName: 'data di nascita.giorno',
    }),
    createMappingEntry({
      internalPath: 'data di nascita.mese',
      apiField: 'month',
      linkedVariable: '',
      externalName: 'data di nascita.mese',
    }),
    createMappingEntry({
      internalPath: 'data di nascita.anno',
      apiField: 'year',
      linkedVariable: '',
      externalName: 'data di nascita.anno',
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
