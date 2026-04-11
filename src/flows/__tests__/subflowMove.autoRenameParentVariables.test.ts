/**
 * Parent variable auto-rename after task→subflow move (`prefix.leaf` when labels match child interface).
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { autoRenameParentVariablesForMovedTask } from '@domain/taskSubflowMove/autoRenameParentVariables';
import { variableCreationService } from '@services/VariableCreationService';
import { getVariableLabel } from '@utils/getVariableLabel';
import { makeTranslationKey } from '@utils/translationKeys';
import { setProjectTranslationsRegistry } from '@utils/projectTranslationsRegistry';
import { getActiveFlowMetaTranslationsFlattened } from '@utils/activeFlowTranslations';
import { FlowWorkspaceSnapshot } from '@flows/FlowWorkspaceSnapshot';

const G_NOME = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const G_TEL = '1cee6a03-1907-4468-944e-f3599fc8a563';

describe('autoRenameParentVariablesForMovedTask', () => {
  beforeEach(() => {
    setProjectTranslationsRegistry({});
  });

  it('renames parent var to prefix.leaf when labels match (dati.nome)', () => {
    const projectId = `p_${Math.random().toString(36).slice(2, 10)}`;
    variableCreationService.ensureManualVariableWithId(projectId, G_NOME, 'nome', {
      scope: 'flow',
      scopeFlowId: 'parent_f',
    });

    setProjectTranslationsRegistry({
      [makeTranslationKey('var', G_NOME)]: 'nome',
    });

    const childFlow = {
      id: 'child',
      meta: {
        flowInterface: {
          output: [
            {
              id: 'row-id-not-used',
              wireKey: 'nome',
              variableRefId: G_NOME,
              apiField: '',
            },
          ],
        },
      },
    } as any;

    const flowsBase = {
      parent_f: { id: 'parent_f', title: 'P', nodes: [], edges: [], meta: {} },
    } as any;

    const { renamed, flowsNext } = autoRenameParentVariablesForMovedTask({
      projectId,
      parentFlowId: 'parent_f',
      parentFlow: { id: 'parent_f' } as any,
      childFlow,
      subflowDisplayTitle: 'dati',
      taskVariableIds: [G_NOME],
      flows: flowsBase,
    });

    expect(renamed).toHaveLength(1);
    expect(renamed[0]?.nextName).toBe('dati.nome');

    FlowWorkspaceSnapshot.setSnapshot(flowsNext as any, 'parent_f');
    const label = getVariableLabel(G_NOME, getActiveFlowMetaTranslationsFlattened());
    expect(label).toBe('dati.nome');

    const tr = (flowsNext.parent_f.meta as { translations?: Record<string, string> })?.translations;
    expect(tr?.[makeTranslationKey('var', G_NOME)]).toBe('dati.nome');
  });

  it('does not rename when subflowAutoRenameLocked is set (user override)', () => {
    const projectId = `p_${Math.random().toString(36).slice(2, 10)}`;
    variableCreationService.ensureManualVariableWithId(projectId, G_NOME, 'nome', {
      scope: 'flow',
      scopeFlowId: 'parent_f',
    });
    variableCreationService.setSubflowAutoRenameLocked(projectId, G_NOME, true);

    const childFlow = {
      meta: {
        flowInterface: {
          output: [
            {
              wireKey: 'nome',
              variableRefId: G_NOME,
              apiField: '',
            },
          ],
        },
      },
    } as any;

    const { renamed, flowsNext } = autoRenameParentVariablesForMovedTask({
      projectId,
      parentFlowId: 'parent_f',
      parentFlow: {} as any,
      childFlow,
      subflowDisplayTitle: 'dati',
      taskVariableIds: [G_NOME],
      flows: { parent_f: { id: 'parent_f', meta: {} } } as any,
    });

    expect(renamed).toHaveLength(0);
    FlowWorkspaceSnapshot.setSnapshot(
      {
        parent_f: {
          id: 'parent_f',
          meta: {
            translations: { [makeTranslationKey('var', G_NOME)]: 'nome' },
          },
        },
      } as any,
      'parent_f'
    );
    expect(getVariableLabel(G_NOME, getActiveFlowMetaTranslationsFlattened())).toBe('nome');
  });

  it('telefono: prefix + leaf updates translation so UI does not show raw GUID', () => {
    const projectId = `p_${Math.random().toString(36).slice(2, 10)}`;
    variableCreationService.ensureManualVariableWithId(projectId, G_TEL, 'telefono', {
      scope: 'flow',
      scopeFlowId: 'main',
    });
    setProjectTranslationsRegistry({
      [makeTranslationKey('var', G_TEL)]: 'telefono',
    });

    const childFlow = {
      meta: {
        flowInterface: {
          output: [
            {
              id: 'mapping-row-uuid',
              wireKey: 'telefono',
              variableRefId: G_TEL,
              apiField: '',
            },
          ],
        },
      },
    } as any;

    const { flowsNext } = autoRenameParentVariablesForMovedTask({
      projectId,
      parentFlowId: 'main',
      parentFlow: {} as any,
      childFlow,
      subflowDisplayTitle: 'dati',
      taskVariableIds: [G_TEL],
      flows: { main: { id: 'main', meta: {} } } as any,
    });

    FlowWorkspaceSnapshot.setSnapshot(flowsNext as any, 'main');
    const label = getVariableLabel(G_TEL, getActiveFlowMetaTranslationsFlattened());
    expect(label).toBe('dati.telefono');
    expect(label).not.toMatch(/^[0-9a-f-]{36}$/i);
  });
});
