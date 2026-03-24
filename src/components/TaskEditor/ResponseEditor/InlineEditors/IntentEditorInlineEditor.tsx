/**
 * Inline embedding editor: Task.semanticValues (with embedding) ↔ useIntentStore.
 * Bootstrap: if task has no semantic values, seed from row closed-domain values (see getSemanticValuesForRow).
 */

import React, { useEffect } from 'react';
import EmbeddingEditorShell from '@features/intent-editor/EmbeddingEditorShell';
import { NLPProfile } from '@responseEditor/DataExtractionEditor';
import { useIntentStore } from '@features/intent-editor/state/intentStore';
import { FlowWorkspaceSnapshot } from '../../../../flows/FlowWorkspaceSnapshot';
import { taskRepository } from '@services/TaskRepository';
import { variableCreationService } from '@services/VariableCreationService';
import { getActiveFlowCanvasId } from '../../../../flows/activeFlowCanvas';
import { getSemanticValuesForRow } from '@utils/semanticValuesRowState';
import {
  problemIntentsToSemanticValues,
  semanticValuesToProblemIntents,
} from '@utils/semanticValueClassificationBridge';
import type { NodeRowData, ProblemIntent } from '@types/project';
import type { SemanticValue } from '@types/taskTypes';

interface IntentEditorInlineEditorProps {
  onClose: () => void;
  node?: any;
  profile?: NLPProfile;
  onProfileUpdate?: (profile: NLPProfile) => void;
  intentSelected?: string | null;
  act?: { id: string; type: string; label?: string; instanceId?: string };
}

function toEditorState(intents: ProblemIntent[] = []) {
  return intents.map((pi: ProblemIntent) => ({
    id: pi.id,
    name: pi.name,
    langs: ['it'],
    threshold: pi.threshold ?? 0.6,
    status: 'draft' as const,
    enabled: true,
    variants: {
      curated: (pi.phrases?.matching || []).map(p => ({ id: p.id, text: p.text, lang: (p.lang as any) || 'it' })),
      staging: [],
      hardNeg: (pi.phrases?.notMatching || []).map(p => ({ id: p.id, text: p.text, lang: (p.lang as any) || 'it' })),
    },
    signals: { keywords: (pi.phrases?.keywords || []), synonymSets: [], patterns: [] },
  }));
}

function resolveCurrentProjectId(): string | null {
  if (typeof window === 'undefined') return null;
  const fromRuntime = (window as unknown as { __omniaRuntime?: { getCurrentProjectId?: () => string } })
    .__omniaRuntime?.getCurrentProjectId?.();
  if (typeof fromRuntime === 'string' && fromRuntime) return fromRuntime;
  return localStorage.getItem('currentProjectId');
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
  useEffect(() => {
    if (!act) return;

    const instanceId = (act as any)?.instanceId ?? act.id ?? 'unknown';
    if (instanceId === 'unknown') return;

    const task = taskRepository.getTask(instanceId);
    const sv = task?.semanticValues;
    const stored = semanticValuesToProblemIntents(Array.isArray(sv) ? sv : null);

    if (stored.length > 0) {
      useIntentStore.setState({ intents: toEditorState(stored) });
      return;
    }

    const row = findRowForTaskId(instanceId);
    if (!row) {
      useIntentStore.setState({ intents: [] });
      return;
    }

    const { items, isOpenDomain } = getSemanticValuesForRow(row);
    if (isOpenDomain || items.length === 0) {
      useIntentStore.setState({ intents: [] });
      return;
    }

    const boot = bootstrapSemanticValuesFromItems(items);
    if (boot.length === 0) {
      useIntentStore.setState({ intents: [] });
      return;
    }

    const projectId = resolveCurrentProjectId();
    const slotId = row.meta?.semanticSlotRefId;
    if (projectId && slotId) {
      const rawLabel = (task as { label?: string } | undefined)?.label ?? row.text ?? '';
      const flowForSlot =
        String((task as any)?.parameters?.flowId ?? (task as any)?.flowId ?? '').trim() ||
        getActiveFlowCanvasId();
      variableCreationService.ensureManualVariableWithId(
        projectId,
        slotId,
        variableCreationService.normalizeTaskLabel(rawLabel),
        { scope: 'flow', scopeFlowId: flowForSlot }
      );
    }

    taskRepository.updateTask(instanceId, { semanticValues: boot });
    useIntentStore.setState({ intents: toEditorState(semanticValuesToProblemIntents(boot)) });
  }, [act?.id, act?.instanceId]);

  useEffect(() => {
    if (!act) return;

    const instanceId = (act as any)?.instanceId ?? act.id ?? 'unknown';
    let t: ReturnType<typeof setTimeout>;

    const unsubscribe = useIntentStore.subscribe(() => {
      clearTimeout(t);
      t = setTimeout(() => {
        try {
          const intents = useIntentStore.getState().intents;
          const problemIntents: ProblemIntent[] = intents.map(it => ({
            id: it.id,
            name: it.name,
            threshold: it.threshold,
            phrases: {
              matching: (it.variants?.curated || []).map(v => ({ id: v.id, text: v.text, lang: v.lang as any })),
              notMatching: (it.variants?.hardNeg || []).map(v => ({ id: v.id, text: v.text, lang: v.lang as any })),
              keywords: (it.signals?.keywords || []),
            }
          }));

          const prev = taskRepository.getTask(instanceId)?.semanticValues;
          const semanticValues = problemIntentsToSemanticValues(problemIntents, prev ?? null);
          taskRepository.updateTask(instanceId, { semanticValues });
        } catch (err) {
          console.error('[IntentEditorInlineEditor][SYNC_TO_TASK][ERROR]', err);
        }
      }, 300);
    });

    return () => {
      clearTimeout(t);
      unsubscribe();
    };
  }, [act?.id, act?.instanceId]);

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
            instanceId={(act as any)?.instanceId ?? act.id ?? 'unknown'}
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
