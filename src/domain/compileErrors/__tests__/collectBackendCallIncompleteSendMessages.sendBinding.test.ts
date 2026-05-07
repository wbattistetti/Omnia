/**
 * Validazione SEND con `openapiSendBinding` (BookFromAgenda / x-omnia).
 */

import { describe, expect, it } from 'vitest';
import { TaskType, type Task } from '../../../types/taskTypes';
import type { OpenApiSendBindingRules } from '../../backendCatalog/catalogTypes';
import { listIncompleteBackendSendWireKeys } from '../collectBackendCallIncompleteSendMessages';

const bookRules: OpenApiSendBindingRules = {
  optionalApiParams: ['queryConstraints', 'horizon.start', 'horizon.end'],
  requireOneOfSets: [
    {
      id: 'agenda_source',
      label: 'Sorgente',
      alternatives: [{ allApiParams: ['agenda.json'] }, { allApiParams: ['agenda.url', 'agenda.type'] }],
    },
  ],
};

describe('listIncompleteBackendSendWireKeys (openapiSendBinding)', () => {
  it('treats optional API params as not requiring a binding', () => {
    const t = {
      type: TaskType.BackendCall,
      inputs: [
        { internalName: 'qc', apiParam: 'queryConstraints', variable: '' },
        { internalName: 'j', apiParam: 'agenda.json', variable: 'v' },
      ],
      backendCallSpecMeta: { schemaVersion: 1 as const, openapiSendBinding: bookRules },
    } as unknown as Task;
    expect(listIncompleteBackendSendWireKeys(t)).toEqual([]);
  });

  it('requires one complete alternative in requireOneOfSets', () => {
    const t = {
      type: TaskType.BackendCall,
      inputs: [
        { internalName: 'u', apiParam: 'agenda.url', variable: 'http://x' },
        { internalName: 'ty', apiParam: 'agenda.type', variable: '' },
      ],
      backendCallSpecMeta: { schemaVersion: 1 as const, openapiSendBinding: bookRules },
    } as unknown as Task;
    expect(listIncompleteBackendSendWireKeys(t).sort()).toEqual(['ty']);
  });

  it('accepts url+type branch when both wired', () => {
    const t = {
      type: TaskType.BackendCall,
      inputs: [
        { internalName: 'u', apiParam: 'agenda.url', variable: 'http://x' },
        { internalName: 'ty', apiParam: 'agenda.type', variable: 'ICS' },
      ],
      backendCallSpecMeta: { schemaVersion: 1 as const, openapiSendBinding: bookRules },
    } as unknown as Task;
    expect(listIncompleteBackendSendWireKeys(t)).toEqual([]);
  });

  it('accepts agenda.json branch alone', () => {
    const t = {
      type: TaskType.BackendCall,
      inputs: [{ internalName: 'j', apiParam: 'agenda.json', variable: '{}' }],
      backendCallSpecMeta: { schemaVersion: 1 as const, openapiSendBinding: bookRules },
    } as unknown as Task;
    expect(listIncompleteBackendSendWireKeys(t)).toEqual([]);
  });

  const bookRulesDesignProject: OpenApiSendBindingRules = {
    optionalApiParams: ['conversationId', 'forceRefresh'],
    designTimeRequiredApiParams: ['projectId'],
    requireOneOfSets: [
      {
        id: 'agenda_source_or_cached',
        alternatives: [{ allApiParams: ['agenda.json'] }, { allApiParams: ['projectId'] }],
      },
    ],
  };

  it('requires designTimeRequiredApiParams even when a one-of alternative is satisfied', () => {
    const t = {
      type: TaskType.BackendCall,
      inputs: [
        { internalName: 'j', apiParam: 'agenda.json', variable: '{}' },
        { internalName: 'pid', apiParam: 'projectId', variable: '' },
      ],
      backendCallSpecMeta: { schemaVersion: 1 as const, openapiSendBinding: bookRulesDesignProject },
    } as unknown as Task;
    expect(listIncompleteBackendSendWireKeys(t)).toEqual(['pid']);
  });

  it('does not require optional runtime params when empty', () => {
    const t = {
      type: TaskType.BackendCall,
      inputs: [
        { internalName: 'j', apiParam: 'agenda.json', variable: '{}' },
        { internalName: 'pid', apiParam: 'projectId', variable: 'my-app-v1' },
        { internalName: 'cid', apiParam: 'conversationId', variable: '' },
      ],
      backendCallSpecMeta: { schemaVersion: 1 as const, openapiSendBinding: bookRulesDesignProject },
    } as unknown as Task;
    expect(listIncompleteBackendSendWireKeys(t)).toEqual([]);
  });
});
