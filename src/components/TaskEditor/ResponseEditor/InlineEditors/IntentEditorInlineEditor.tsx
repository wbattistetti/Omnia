import React, { useEffect } from 'react';
import EmbeddingEditorShell from '@features/intent-editor/EmbeddingEditorShell';
import { NLPProfile } from '@responseEditor/DataExtractionEditor';
import { useIntentStore } from '@features/intent-editor/state/intentStore';
import { taskRepository } from '@services/TaskRepository';
import type { ProblemIntent } from '@types/project';

interface IntentEditorInlineEditorProps {
  onClose: () => void;
  node?: any;
  profile?: NLPProfile;
  onProfileUpdate?: (profile: NLPProfile) => void;
  intentSelected?: string | null;
  act?: { id: string; type: string; label?: string; instanceId?: string };
}

// FASE 3: Convert ProblemIntent[] from Task to useIntentStore format
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

/**
 * Inline editor wrapper for EmbeddingEditorShell
 * Adapts EmbeddingEditorShell for use within DataExtractionEditor
 * Shows intent classifier/embeddings configuration
 */
export default function IntentEditorInlineEditor({
  onClose,
  node,
  profile,
  onProfileUpdate,
  intentSelected,
  act,
}: IntentEditorInlineEditorProps) {
  // FASE 3: Sync intents from Task to useIntentStore when editor opens
  useEffect(() => {
    if (!act) return;

    // ✅ NO FALLBACKS: Use instanceId as primary, id as fallback (both are valid properties)
    const instanceId = (act as any)?.instanceId ?? act.id ?? 'unknown';
    const task = taskRepository.getTask(instanceId);

    if (task?.intents) {
      // Convert ProblemIntent[] to useIntentStore format
      const intents = toEditorState(task.intents || []);
      useIntentStore.setState({ intents });

      console.log('[IntentEditorInlineEditor][SYNC] Synced intents from Task to useIntentStore', {
        instanceId,
        intentsCount: intents.length,
        intents: intents.map(it => ({ id: it.id, name: it.name, curatedCount: it.variants.curated.length, hardNegCount: it.variants.hardNeg.length }))
      });
    }
  }, [act?.id, act?.instanceId]);

  // FASE 3: Subscribe to useIntentStore changes and sync back to Task
  useEffect(() => {
    if (!act) return;

    // ✅ NO FALLBACKS: Use instanceId as primary, id as fallback (both are valid properties)
    const instanceId = (act as any)?.instanceId ?? act.id ?? 'unknown';
    let t: any;

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

          // FASE 3: Update Task (TaskRepository syncs with InstanceRepository automatically)
          taskRepository.updateTask(instanceId, { intents: problemIntents });

          console.log('[IntentEditorInlineEditor][SYNC_TO_TASK] Synced intents from useIntentStore to Task', {
            instanceId,
            intentsCount: problemIntents.length
          });
        } catch (err) {
          console.error('[IntentEditorInlineEditor][SYNC_TO_TASK][ERROR]', err);
        }
      }, 300); // Debounce di 300ms
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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
          marginBottom: 8,
          paddingBottom: 8,
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <h3 style={{ margin: 0, fontWeight: 600 }}>Intent Classifier (Embeddings)</h3>
        <button
          onClick={onClose}
          style={{
            padding: '6px 12px',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            background: '#fff',
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          Close
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {act ? (
          <EmbeddingEditorShell
            inlineMode={true}
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

