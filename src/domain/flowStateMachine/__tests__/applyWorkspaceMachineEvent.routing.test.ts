import { describe, expect, it } from 'vitest';
import { applyWorkspaceMachineEvent } from '../applyWorkspaceMachineEvent';
import type { WorkspaceState } from '@flows/FlowTypes';

const emptyState: WorkspaceState = {
  flows: {
    main: {
      id: 'main',
      title: 'Main',
      nodes: [],
      edges: [],
      hydrated: false,
      variablesReady: false,
      hasLocalChanges: false,
    },
  },
  openFlows: ['main'],
  activeFlowId: 'main',
};

describe('applyWorkspaceMachineEvent', () => {
  it('routes renameFlow through the same transition as the legacy reducer', () => {
    const out = applyWorkspaceMachineEvent(emptyState, {
      type: 'renameFlow',
      flowId: 'main',
      title: 'Renamed',
    });
    expect(out.workspace.flows.main.title).toBe('Renamed');
  });

  it('applies upsertFlows in one workspace step', () => {
    const flowA = {
      ...emptyState.flows.main,
      id: 'main',
      title: 'Main',
      nodes: [{ id: 'n1' }] as any,
      edges: [],
      hasLocalChanges: true,
    };
    const flowB = {
      id: 'subflow_x',
      title: 'Sub',
      nodes: [{ id: 'n2' }] as any,
      edges: [],
      hydrated: false,
      variablesReady: false,
      hasLocalChanges: true,
    };
    const out = applyWorkspaceMachineEvent(emptyState, {
      type: 'upsertFlows',
      flows: [flowA as any, flowB as any],
    });
    expect(out.workspace.flows.main.nodes?.length).toBe(1);
    expect(out.workspace.flows.subflow_x?.title).toBe('Sub');
  });
});
