/**
 * Parent variable auto-rename after task→subflow move (`prefix.leaf` when labels match child interface).
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { autoRenameParentVariablesForMovedTask } from '@domain/taskSubflowMove/autoRenameParentVariables';
import { variableCreationService } from '@services/VariableCreationService';
import { getVariableLabel } from '@utils/getVariableLabel';
import { makeTranslationKey } from '@utils/translationKeys';
import {
  getProjectTranslationsTable,
  setProjectTranslationsRegistry,
} from '@utils/projectTranslationsRegistry';

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
      [makeTranslationKey('variable', G_NOME)]: 'nome',
    });

    const childFlow = {
      id: 'child',
      meta: {
        flowInterface: {
          output: [
            {
              id: 'row-id-not-used',
              internalPath: 'nome',
              externalName: 'nome',
              variableRefId: G_NOME,
              linkedVariable: 'nome',
            },
          ],
        },
      },
    } as any;

    const { renamed } = autoRenameParentVariablesForMovedTask({
      projectId,
      parentFlowId: 'parent_f',
      parentFlow: { id: 'parent_f' } as any,
      childFlow,
      subflowDisplayTitle: 'dati',
      referencedVarIds: [G_NOME],
    });

    expect(renamed).toHaveLength(1);
    expect(renamed[0]?.nextName).toBe('dati.nome');

    const v = variableCreationService.getAllVariables(projectId).find((x) => x.id === G_NOME);
    expect(v?.varName).toBe('dati.nome');

    const label = getVariableLabel(G_NOME, getProjectTranslationsTable() as Record<string, string>);
    expect(label).toBe('dati.nome');
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
              internalPath: 'nome',
              externalName: 'nome',
              variableRefId: G_NOME,
              linkedVariable: 'nome',
            },
          ],
        },
      },
    } as any;

    const { renamed } = autoRenameParentVariablesForMovedTask({
      projectId,
      parentFlowId: 'parent_f',
      parentFlow: {} as any,
      childFlow,
      subflowDisplayTitle: 'dati',
      referencedVarIds: [G_NOME],
    });

    expect(renamed).toHaveLength(0);
    const v = variableCreationService.getAllVariables(projectId).find((x) => x.id === G_NOME);
    expect(v?.varName).toBe('nome');
  });

  it('telefono: prefix + leaf updates translation so UI does not show raw GUID', () => {
    const projectId = `p_${Math.random().toString(36).slice(2, 10)}`;
    variableCreationService.ensureManualVariableWithId(projectId, G_TEL, 'telefono', {
      scope: 'flow',
      scopeFlowId: 'main',
    });
    setProjectTranslationsRegistry({
      [makeTranslationKey('variable', G_TEL)]: 'telefono',
    });

    const childFlow = {
      meta: {
        flowInterface: {
          output: [
            {
              id: 'mapping-row-uuid',
              internalPath: 'telefono',
              externalName: 'telefono',
              variableRefId: G_TEL,
              linkedVariable: 'telefono',
            },
          ],
        },
      },
    } as any;

    autoRenameParentVariablesForMovedTask({
      projectId,
      parentFlowId: 'main',
      parentFlow: {} as any,
      childFlow,
      subflowDisplayTitle: 'dati',
      referencedVarIds: [G_TEL],
    });

    const label = getVariableLabel(G_TEL, getProjectTranslationsTable() as Record<string, string>);
    expect(label).toBe('dati.telefono');
    expect(label).not.toMatch(/^[0-9a-f-]{36}$/i);
  });
});
