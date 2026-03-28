/**
 * Inline embedding editor: Task.semanticValues ↔ useIntentStore.
 * Uses unified problem classification persistence (localStorage + TaskRepository) like IntentHostAdapter.
 * When the task has no semantic values, seeds from row closed-domain values (getSemanticValuesForRow).
 */

import React, { useCallback } from 'react';
import EmbeddingEditorShell from '@features/intent-editor/EmbeddingEditorShell';
import { NLPProfile } from '@responseEditor/DataExtractionEditor';
import { useProblemClassificationPersistence } from '@features/intent-editor/hooks/useProblemClassificationPersistence';
import { FlowWorkspaceSnapshot } from '../../../../flows/FlowWorkspaceSnapshot';
import { taskRepository } from '@services/TaskRepository';
import { variableCreationService } from '@services/VariableCreationService';
import { getActiveFlowCanvasId } from '../../../../flows/activeFlowCanvas';
import { getSemanticValuesForRow } from '@utils/semanticValuesRowState';
import { normalizeProblemPayload } from '@utils/semanticValueClassificationBridge';
import type { NodeRowData, ProblemPayload } from '@types/project';
import type { SemanticValue } from '@types/taskTypes';

interface IntentEditorInlineEditorProps {
  onClose: () => void;
  node?: any;
  profile?: NLPProfile;
  onProfileUpdate?: (profile: NLPProfile) => void;
  intentSelected?: string | null;
  act?: { id: string; type: string; label?: string; instanceId?: string };
}

function resolveCurrentProjectId(): string {
  if (typeof window === 'undefined') return '';
  const fromRuntime = (window as unknown as { __omniaRuntime?: { getCurrentProjectId?: () => string } })
    .__omniaRuntime?.getCurrentProjectId?.();
  if (typeof fromRuntime === 'string' && fromRuntime) return fromRuntime;
  return localStorage.getItem('currentProjectId') || '';
}

function findRowForTaskId(taskId: string): NodeRowData | null {
  for (const n of FlowWorkspaceSnapshot.getNodes()) {
    const rows = n.data?.rows;
    if (!rows?.length) continue;
    const row = rows.find(r => r.id === taskId);
    if (row) return row as NodeRowData;
  }
  return null;
}

function bootstrapSemanticValuesFromItems(items: SemanticValue[]): SemanticValue[] {
  const out: SemanticValue[] = [];
  for (const v of items) {
    const label = v.label?.trim();
    if (!label) continue;
    out.push({
      id: v.id || crypto.randomUUID(),
      label,
      embedding: {
        threshold: v.embedding?.threshold ?? 0.6,
        enabled: true,
        phrases: v.embedding?.phrases ?? {
          matching: [],
          notMatching: [],
          keywords: [],
        },
      },
    });
  }
  return out;
}

export default function IntentEditorInlineEditor({
  onClose,
  node,
  profile,
  onProfileUpdate,
  intentSelected,
  act,
}: IntentEditorInlineEditorProps) {
  const instanceId = (act as { instanceId?: string } | undefined)?.instanceId ?? act?.id ?? '';
  const projectId = resolveCurrentProjectId();

  const bootstrapPayload = useCallback(
    (merged: ProblemPayload): ProblemPayload => {
      if (merged.semanticValues?.length) return merged;

      const row = findRowForTaskId(instanceId);
      if (!row) return merged;

      const { items, isOpenDomain } = getSemanticValuesForRow(row);
      if (isOpenDomain || items.length === 0) return merged;

      const boot = bootstrapSemanticValuesFromItems(items);
      if (boot.length === 0) return merged;

      const task = taskRepository.getTask(instanceId);
      const pid = resolveCurrentProjectId();
      const variableRefId = row.meta?.variableRefId;
      if (pid && variableRefId) {
        const rawLabel = (task as { label?: string } | undefined)?.label ?? row.text ?? '';
        const flowForSlot =
          String((task as { parameters?: { flowId?: string } })?.parameters?.flowId ?? (task as { flowId?: string })?.flowId ?? '').trim() ||
          getActiveFlowCanvasId();
        variableCreationService.ensureManualVariableWithId(
          pid,
          variableRefId,
          variableCreationService.normalizeTaskLabel(rawLabel),
          { scope: 'flow', scopeFlowId: flowForSlot },
        );
      }

      taskRepository.updateTask(instanceId, { semanticValues: boot });
      return normalizeProblemPayload({
        version: 1,
        semanticValues: boot,
        editor: merged.editor,
      });
    },
    [instanceId],
  );

  useProblemClassificationPersistence({
    instanceId,
    projectId,
    templateTaskId: act?.id,
    debounceMs: 300,
    bootstrapPayload,
    enabled: Boolean(act && instanceId && instanceId !== 'unknown'),
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {act ? (
          <EmbeddingEditorShell
            inlineMode
            inlineHeaderTitle="Intent Classifier (Embeddings)"
            onInlineClose={onClose}
            intentSelected={intentSelected}
            instanceId={instanceId || 'unknown'}
          />
        ) : (
          <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>
            <p>No task available. Please select a task node first.</p>
            <p style={{ fontSize: 12, marginTop: 8, opacity: 0.7 }}>
              The embeddings editor requires a task node to be selected.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
