import { describe, expect, it } from 'vitest';
import { createMappingEntry } from '../../../components/FlowMappingPanel/mappingTypes';
import type { BackendMockTableRow } from '../backendTestRowTypes';
import {
  isBackendMockTableReadyForBulkTest,
  listDesignRequiredSendWireKeys,
  listMissingDesignRequiredSendWireKeysForMockTest,
} from '../backendMockTestReadiness';

describe('backendMockTestReadiness', () => {
  it('lists only design-required wire keys', () => {
    const entries = [
      createMappingEntry({
        wireKey: 'a',
        apiField: 'projectId',
        sendBindingDesignTimeRequired: true,
      }),
      createMappingEntry({ wireKey: 'b', apiField: 'constraints', sendBindingOptional: true }),
      createMappingEntry({
        wireKey: 'c',
        apiField: 'conversationId',
        sendBindingBindingPhase: 'runtime',
      }),
      createMappingEntry({ wireKey: 'd', apiField: 'windowDays' }),
    ];
    expect(listDesignRequiredSendWireKeys(entries).sort()).toEqual(['a']);
  });

  it('ignores schema outline nodes (Signature-only nested OpenAPI)', () => {
    const entries = [
      createMappingEntry({ wireKey: 'windowDays', apiField: 'windowDays' }),
      createMappingEntry({
        wireKey: 'constraints.allowedMonths',
        apiField: 'allowedMonths',
        schemaOutlineOnly: true,
      }),
    ];
    expect(listDesignRequiredSendWireKeys(entries)).toEqual([]);
    expect(isBackendMockTableReadyForBulkTest(entries, [{ id: '1', inputs: {}, outputs: {} }], {})).toBe(
      true
    );
  });

  it('ready when only optional params are empty', () => {
    const entries = [
      createMappingEntry({ wireKey: 'constraints', apiField: 'constraints', sendBindingOptional: true }),
      createMappingEntry({ wireKey: 'windowDays', apiField: 'windowDays', sendBindingOptional: true }),
    ];
    expect(isBackendMockTableReadyForBulkTest(entries, [], {})).toBe(true);
  });

  it('ready when required bound in mapping without mock cells', () => {
    const entries = [
      createMappingEntry({
        wireKey: 'projectId',
        apiField: 'projectId',
        literalConstant: 'app-1',
      }),
      createMappingEntry({ wireKey: 'constraints', apiField: 'constraints', sendBindingOptional: true }),
    ];
    const row: BackendMockTableRow = { id: '1', inputs: {}, outputs: {} };
    expect(isBackendMockTableReadyForBulkTest(entries, [row], {})).toBe(true);
  });

  it('not ready when required missing everywhere', () => {
    const entries = [
      createMappingEntry({
        wireKey: 'projectId',
        apiField: 'projectId',
        sendBindingDesignTimeRequired: true,
      }),
      createMappingEntry({ wireKey: 'constraints', apiField: 'constraints', sendBindingOptional: true }),
    ];
    expect(isBackendMockTableReadyForBulkTest(entries, [{ id: '1', inputs: {}, outputs: {} }], {})).toBe(
      false
    );
  });
});
