import { describe, expect, it } from 'vitest';
import {
  backendInputsToMappingEntries,
  backendOutputsToMappingEntries,
  mappingEntriesToBackendInputs,
  mappingEntriesToBackendOutputs,
} from '../backendCallMappingAdapter';
import { createMappingEntry } from '../mappingTypes';

describe('backendCallMappingAdapter', () => {
  it('skips empty internal names on task → entries', () => {
    const entries = backendInputsToMappingEntries([
      { internalName: '  ', apiParam: 'x', variable: '' },
      { internalName: 'a', apiParam: 'p', variable: 'gid1' },
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].wireKey).toBe('a');
    expect(entries[0].apiField).toBe('p');
    expect(entries[0].variableRefId).toBe('gid1');
  });

  it('maps outputs apiField and variable id', () => {
    const entries = backendOutputsToMappingEntries([{ internalName: 'out1', apiField: 'apiX', variable: 'gid1' }]);
    expect(entries[0].apiField).toBe('apiX');
    expect(entries[0].variableRefId).toBe('gid1');
  });

  it('entries → inputs persists variableRefId', () => {
    const entries = [createMappingEntry({ wireKey: 'x.y', apiField: 'q', variableRefId: 'vid' })];
    const rows = mappingEntriesToBackendInputs(entries);
    expect(rows).toEqual([{ internalName: 'x.y', apiParam: 'q', variable: 'vid' }]);
  });

  it('entries → inputs uses variableRefId guid', () => {
    const entries = [
      createMappingEntry({
        wireKey: 'nome',
        apiField: '',
        variableRefId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      }),
    ];
    const rows = mappingEntriesToBackendInputs(entries);
    expect(rows[0].variable).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  });

  it('task → entries preserves variable as variableRefId', () => {
    const entries = backendInputsToMappingEntries([{ internalName: 'nome', apiParam: '', variable: 'gid-guid' }]);
    expect(entries[0].variableRefId).toBe('gid-guid');
  });

  it('entries → outputs uses apiField key', () => {
    const entries = [createMappingEntry({ wireKey: 'o', apiField: 'f' })];
    const rows = mappingEntriesToBackendOutputs(entries);
    expect(rows).toEqual([{ internalName: 'o', apiField: 'f', variable: '' }]);
  });
});
