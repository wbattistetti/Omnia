import React, { useEffect } from 'react';
import EmbeddingEditorShell from '../../../../features/intent-editor/EmbeddingEditorShell';
import { NLPProfile } from '../NLPExtractorProfileEditor';
import { useIntentStore } from '../../../../features/intent-editor/state/intentStore';
import { instanceRepository } from '../../../../services/InstanceRepository';
import type { ProblemIntent } from '../../../../types/project';

interface IntentEditorInlineEditorProps {
  onClose: () => void;
  node?: any;
  profile?: NLPProfile;
  onProfileUpdate?: (profile: NLPProfile) => void;
  intentSelected?: string | null;
  act?: { id: string; type: string; label?: string; instanceId?: string };
}

// Convert ProblemIntent[] from instanceRepository to useIntentStore format
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
 * Adapts EmbeddingEditorShell for use within NLPExtractorProfileEditor
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
  // Sync intents from instanceRepository to useIntentStore when editor opens
  useEffect(() => {
    if (!act) return;

    const instanceId = (act as any)?.instanceId || act.id;
    const instance = instanceRepository.getInstance(instanceId);

    if (instance?.problemIntents) {
      // Convert ProblemIntent[] to useIntentStore format
      const intents = toEditorState(instance.problemIntents);
      useIntentStore.setState({ intents });

      console.log('[IntentEditorInlineEditor][SYNC] Synced intents from instanceRepository to useIntentStore', {
        instanceId,
        intentsCount: intents.length,
        intents: intents.map(it => ({ id: it.id, name: it.name, curatedCount: it.variants.curated.length, hardNegCount: it.variants.hardNeg.length }))
      });
    }
  }, [act?.id, act?.instanceId]);

  // Subscribe to useIntentStore changes and sync back to instanceRepository
  useEffect(() => {
    if (!act) return;

    const instanceId = (act as any)?.instanceId || act.id;
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

          instanceRepository.updateIntents(instanceId, problemIntents);

          console.log('[IntentEditorInlineEditor][SYNC_TO_INSTANCE] Synced intents from useIntentStore to instanceRepository', {
            instanceId,
            intentsCount: problemIntents.length
          });
        } catch (err) {
          console.error('[IntentEditorInlineEditor][SYNC_TO_INSTANCE][ERROR]', err);
        }
      }, 300); // Debounce di 300ms
    });

    return () => {
      clearTimeout(t);
      unsubscribe();
    };
  }, [act?.id, act?.instanceId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 600 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #e5e7eb' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Intent Classifier (Embeddings)</h3>
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

      {/* EmbeddingEditorShell with inlineMode prop and intentSelected */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <EmbeddingEditorShell
          inlineMode={true}
          intentSelected={intentSelected}
          instanceId={act ? ((act as any)?.instanceId || act.id) : undefined}
        />
      </div>
    </div>
  );
}

