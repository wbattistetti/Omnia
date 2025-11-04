import React, { useEffect } from 'react';
import EditorHeader from '../../components/common/EditorHeader';
import { getAgentActVisualsByType } from '../../components/Flowchart/utils/actVisuals';
import EmbeddingEditorShell from './EmbeddingEditorShell';
import { useIntentStore } from './state/intentStore';
import { useTestStore } from './state/testStore';
import type { ProblemPayload, ProblemIntent, ProblemEditorState } from '../../types/project';
import { ProjectDataService } from '../../services/ProjectDataService';
import { instanceRepository } from '../../services/InstanceRepository';

function toEditorState(payload?: ProblemPayload) {
  const intents = (payload?.intents || []).map((pi: ProblemIntent) => ({
    id: pi.id,
    name: pi.name,
    langs: ['it'],
    threshold: pi.threshold ?? 0.6,
    status: 'draft',
    variants: {
      curated: (pi.phrases?.matching || []).map(p => ({ id: p.id, text: p.text, lang: (p.lang as any) || 'it' })),
      staging: [],
      hardNeg: (pi.phrases?.notMatching || []).map(p => ({ id: p.id, text: p.text, lang: (p.lang as any) || 'it' })),
    },
    signals: { keywords: (pi.phrases?.keywords || []), synonymSets: [], patterns: [] },
  }));
  const tests = (payload?.editor?.tests || []).map(t => ({ id: t.id, text: t.text, status: t.status }));
  return { intents, tests };
}

function fromEditorState(): ProblemPayload {
  const intents = useIntentStore.getState().intents;
  const tests = useTestStore.getState().items;
  const outIntents: ProblemIntent[] = intents.map(it => ({
    id: it.id,
    name: it.name,
    threshold: it.threshold,
    phrases: {
      matching: it.variants.curated.map(v => ({ id: v.id, text: v.text, lang: v.lang as any })),
      notMatching: it.variants.hardNeg.map(v => ({ id: v.id, text: v.text, lang: v.lang as any })),
      keywords: it.signals.keywords,
    }
  }));
  const editor: ProblemEditorState = { tests: tests.map(t => ({ id: t.id, text: t.text, status: t.status })) };
  return { version: 1, intents: outIntents, editor };
}

export default function IntentHostAdapter(props: { act: { id: string; type: string; label?: string; problem?: ProblemPayload }, onClose?: () => void }) {
  // console.log('IntentHostAdapter props:', props); // RIMOSSO - causa spam
  // Hydrate from act.problem (if available) or from local shadow
  useEffect(() => {
    const pid = (() => { try { return localStorage.getItem('current.projectId') || ''; } catch { return ''; } })();
    const key = `problem.${pid}.${props.act.id}`;
    const payload: ProblemPayload | undefined = props.act.problem || ((): any => {
      try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : undefined; } catch { return undefined; }
    })();
    const { intents, tests } = toEditorState(payload);
    useIntentStore.setState({ intents });
    useTestStore.setState({ items: tests } as any);

    // Update InstanceRepository with current intents
    try {
      const instanceId = (props.act as any)?.instanceId;
      if (instanceId) {
        // console.log('✅ [IntentEditor] Extracted instanceId:', instanceId); // RIMOSSO
        const problemIntents = fromEditorState().intents.map(it => ({
          id: it.id,
          name: it.name,
          threshold: it.threshold,
          phrases: it.phrases
        }));
        // console.log('✅ [IntentEditor] OutIntents structure before saving:', problemIntents); // RIMOSSO
        instanceRepository.updateIntents(instanceId, problemIntents);
        // console.log('✅ [IntentEditor] Updated InstanceRepository with intents', { // RIMOSSO
        //   instanceId,
        //   intentsCount: problemIntents.length
        // });
      }
    } catch (err) {
      console.warn('[IntentEditor] Could not update InstanceRepository:', err);
    }

    // Debounced persist back to act shadow (local only; actual write to act model should be done by host when available)
    let t: any;
    const unsubA = useIntentStore.subscribe(() => {
      clearTimeout(t); t = setTimeout(() => {
        try {
          const next = fromEditorState();
          localStorage.setItem(key, JSON.stringify(next));
          // Also reflect into in-memory project graph so explicit Save includes it
          try { ProjectDataService.setAgentActProblemById(props.act.id, next); } catch { }

          // Update InstanceRepository when intents change
          try {
            const instanceId = (props.act as any)?.instanceId;
            console.log('[IntentEditor][SAVE][DEBOUNCED]', {
              actId: props.act.id,
              instanceId: instanceId || 'NOT_FOUND',
              intentsCount: next.intents.length,
              intents: next.intents.map(it => ({
                id: it.id,
                name: it.name,
                threshold: it.threshold,
                matchingCount: it.phrases?.matching?.length || 0,
                notMatchingCount: it.phrases?.notMatching?.length || 0,
                keywordsCount: it.phrases?.keywords?.length || 0
              }))
            });

            if (instanceId) {
              const problemIntents = next.intents.map(it => ({
                id: it.id,
                name: it.name,
                threshold: it.threshold,
                phrases: it.phrases
              }));

              console.log('[IntentEditor][UPDATE_INSTANCE_REPO][START]', {
                instanceId,
                intentsCount: problemIntents.length,
                firstIntent: problemIntents[0] ? {
                  id: problemIntents[0].id,
                  name: problemIntents[0].name,
                  matchingCount: problemIntents[0].phrases?.matching?.length || 0,
                  notMatchingCount: problemIntents[0].phrases?.notMatching?.length || 0
                } : null
              });

              const updated = instanceRepository.updateIntents(instanceId, problemIntents);

              console.log('[IntentEditor][UPDATE_INSTANCE_REPO][RESULT]', {
                instanceId,
                updated,
                note: updated ? 'InstanceRepository updated in memory - will be saved to DB on project save' : 'FAILED - instance not found'
              });
            } else {
              console.warn('[IntentEditor][UPDATE_INSTANCE_REPO][SKIP]', {
                actId: props.act.id,
                reason: 'instanceId not found in act',
                actKeys: Object.keys(props.act)
              });
            }
          } catch (err) {
            console.error('[IntentEditor][UPDATE_INSTANCE_REPO][ERROR]', {
              actId: props.act.id,
              error: String(err),
              stack: err?.stack?.substring(0, 200)
            });
          }
        } catch { }
      }, 700);
    });
    const unsubB = useTestStore.subscribe(() => {
      clearTimeout(t); t = setTimeout(() => {
        try {
          const next = fromEditorState();
          localStorage.setItem(key, JSON.stringify(next));
          try { ProjectDataService.setAgentActProblemById(props.act.id, next); } catch { }

          // Update InstanceRepository when tests change (which might affect intents)
          try {
            const instanceId = (props.act as any)?.instanceId;
            if (instanceId) {
              // console.log('✅ [IntentEditor] Extracted instanceId:', instanceId); // RIMOSSO
              const problemIntents = next.intents.map(it => ({
                id: it.id,
                name: it.name,
                threshold: it.threshold,
                phrases: it.phrases
              }));
              // console.log('✅ [IntentEditor] OutIntents structure before saving:', problemIntents); // RIMOSSO
              instanceRepository.updateIntents(instanceId, problemIntents);
            }
          } catch (err) {
            console.warn('[IntentEditor] Could not update InstanceRepository:', err);
          }
        } catch { }
      }, 700);
    });
    return () => { unsubA(); unsubB(); clearTimeout(t); };
  }, [props.act?.id]);
  const type = String(props.act?.type || 'ProblemClassification') as any;
  const { Icon, color } = getAgentActVisualsByType(type, true);
  return (
    <div className="h-full w-full flex flex-col min-h-0">
      <EditorHeader
        icon={<Icon size={18} style={{ color }} />}
        title={String(props.act?.label || 'Problem')}
        color="orange"
        onClose={props.onClose}
      />
      <div className="flex-1 min-h-0">
        <EmbeddingEditorShell />
      </div>
    </div>
  );
}


