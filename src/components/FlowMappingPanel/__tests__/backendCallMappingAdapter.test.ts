import { describe, expect, it } from 'vitest';
import {
  backendInputsToMappingEntries,
  backendOutputsToMappingEntries,
  mappingEntriesToBackendInputs,
  mappingEntriesToBackendOutputs,
  splitTaskVariableField,
} from '../backendCallMappingAdapter';
import { createMappingEntry } from '../mappingTypes';

describe('splitTaskVariableField', () => {
  it('treats membership in known set as variable', () => {
    const known = new Set(['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']);
    expect(splitTaskVariableField('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', known)).toEqual({
      variableRefId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
  });

  it('treats unknown string as literal', () => {
    const known = new Set(['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']);
    expect(splitTaskVariableField('hello', known)).toEqual({ literalConstant: 'hello' });
  });

  it('legacy mode puts any non-empty string in variableRefId', () => {
    expect(splitTaskVariableField('anything')).toEqual({ variableRefId: 'anything' });
  });
});

describe('backendCallMappingAdapter', () => {
  it('skips empty internal names on task → entries', () => {
    const entries = backendInputsToMappingEntries(
      [
        { internalName: '  ', apiParam: 'x', variable: '' },
        { internalName: 'a', apiParam: 'p', variable: 'gid1' },
      ],
      new Set(['gid1'])
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].wireKey).toBe('a');
    expect(entries[0].apiField).toBe('p');
    expect(entries[0].variableRefId).toBe('gid1');
    expect(entries[0].literalConstant).toBeUndefined();
  });

  it('maps unknown variable string to literalConstant when known set provided', () => {
    const entries = backendInputsToMappingEntries(
      [{ internalName: 'nome', apiParam: '', variable: 'gid-guid' }],
      new Set(['other-id'])
    );
    expect(entries[0].variableRefId).toBeUndefined();
    expect(entries[0].literalConstant).toBe('gid-guid');
  });

  it('maps outputs apiField and variable id', () => {
    const entries = backendOutputsToMappingEntries(
      [{ internalName: 'out1', apiField: 'apiX', variable: 'gid1' }],
      new Set(['gid1'])
    );
    expect(entries[0].apiField).toBe('apiX');
    expect(entries[0].variableRefId).toBe('gid1');
  });

  it('entries → inputs persists variableRefId', () => {
    const entries = [createMappingEntry({ wireKey: 'x.y', apiField: 'q', variableRefId: 'vid' })];
    const rows = mappingEntriesToBackendInputs(entries);
    expect(rows).toEqual([{ internalName: 'x.y', apiParam: 'q', variable: 'vid' }]);
  });

  it('entries → inputs prefers variableRefId over literalConstant', () => {
    const entries = [
      createMappingEntry({
        wireKey: 'nome',
        apiField: '',
        variableRefId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        literalConstant: 'should-not-win',
      }),
    ];
    const rows = mappingEntriesToBackendInputs(entries);
    expect(rows[0].variable).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  });

  it('entries → inputs uses literalConstant when no variableRefId', () => {
    const entries = [createMappingEntry({ wireKey: 'k', apiField: '', literalConstant: '42' })];
    const rows = mappingEntriesToBackendInputs(entries);
    expect(rows[0].variable).toBe('42');
  });

  it('task → entries preserves variable as variableRefId when legacy (no known set)', () => {
    const entries = backendInputsToMappingEntries([{ internalName: 'nome', apiParam: '', variable: 'gid-guid' }]);
    expect(entries[0].variableRefId).toBe('gid-guid');
  });

  it('entries → outputs uses apiField key', () => {
    const entries = [createMappingEntry({ wireKey: 'o', apiField: 'f' })];
    const rows = mappingEntriesToBackendOutputs(entries);
    expect(rows).toEqual([{ internalName: 'o', apiField: 'f', variable: '' }]);
  });
});
