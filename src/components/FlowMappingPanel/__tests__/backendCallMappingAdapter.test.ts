import { describe, expect, it } from 'vitest';
import {
  backendInputsToMappingEntries,
  backendOutputsToMappingEntries,
  mappingEntriesToBackendInputs,
  mappingEntriesToBackendOutputs,
} from '../backendCallMappingAdapter';
import { createMappingEntry } from '../mappingTypes';

describe('backendCallMappingAdapter', () => {
  const idToName = (id: string | undefined) => (id === 'gid1' ? 'foo' : null);

  it('skips empty internal names on task → entries', () => {
    const entries = backendInputsToMappingEntries(
      [{ internalName: '  ', apiParam: 'x', variable: '' }, { internalName: 'a', apiParam: 'p', variable: 'gid1' }],
      idToName
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].internalPath).toBe('a');
    expect(entries[0].apiField).toBe('p');
    expect(entries[0].linkedVariable).toBe('foo');
  });

  it('maps outputs apiField and variable label', () => {
    const entries = backendOutputsToMappingEntries(
      [{ internalName: 'out1', apiField: 'apiX', variable: 'gid1' }],
      idToName
    );
    expect(entries[0].apiField).toBe('apiX');
    expect(entries[0].linkedVariable).toBe('foo');
  });

  it('entries → inputs uses resolveVarId', () => {
    const entries = [
      createMappingEntry({ internalPath: 'x.y', apiField: 'q', linkedVariable: 'varLabel', externalName: 'x.y' }),
    ];
    const rows = mappingEntriesToBackendInputs(entries, (name) => (name === 'varLabel' ? 'vid' : ''));
    expect(rows).toEqual([{ internalName: 'x.y', apiParam: 'q', variable: 'vid' }]);
  });

  it('entries → outputs uses apiField key', () => {
    const entries = [createMappingEntry({ internalPath: 'o', apiField: 'f', linkedVariable: '', externalName: 'o' })];
    const rows = mappingEntriesToBackendOutputs(entries, () => '');
    expect(rows).toEqual([{ internalName: 'o', apiField: 'f', variable: '' }]);
  });
});
