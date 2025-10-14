import React, { useEffect } from 'react';
import EditorHeader from '../../components/common/EditorHeader';
import { getAgentActVisualsByType } from '../../components/Flowchart/actVisuals';
import IntentEditorShell from './IntentEditorShell';
import { useIntentStore } from './state/intentStore';
import { useTestStore } from './state/testStore';
import type { ProblemPayload, ProblemIntent, ProblemEditorState } from '../../types/project';
import { ProjectDataService } from '../../services/ProjectDataService';

function toEditorState(payload?: ProblemPayload){
  const intents = (payload?.intents || []).map((pi: ProblemIntent) => ({
    id: pi.id,
    name: pi.name,
    langs: ['it'],
    threshold: pi.threshold ?? 0.6,
    status: 'draft',
    variants: {
      curated: (pi.phrases?.matching || []).map(p=>({ id: p.id, text: p.text, lang: (p.lang as any)||'it' })),
      staging: [],
      hardNeg: (pi.phrases?.notMatching || []).map(p=>({ id: p.id, text: p.text, lang: (p.lang as any)||'it' })),
    },
    signals: { keywords: (pi.phrases?.keywords || []), synonymSets: [], patterns: [] },
  }));
  const tests = (payload?.editor?.tests || []).map(t=>({ id: t.id, text: t.text, status: t.status }));
  return { intents, tests };
}

function fromEditorState(): ProblemPayload{
  const intents = useIntentStore.getState().intents;
  const tests = useTestStore.getState().items;
  const outIntents: ProblemIntent[] = intents.map(it => ({
    id: it.id,
    name: it.name,
    threshold: it.threshold,
    phrases: {
      matching: it.variants.curated.map(v=>({ id: v.id, text: v.text, lang: v.lang as any })),
      notMatching: it.variants.hardNeg.map(v=>({ id: v.id, text: v.text, lang: v.lang as any })),
      keywords: it.signals.keywords,
    }
  }));
  const editor: ProblemEditorState = { tests: tests.map(t=>({ id: t.id, text: t.text, status: t.status })) };
  return { version: 1, intents: outIntents, editor };
}

export default function IntentHostAdapter(props: { act: { id: string; type: string; label?: string; problem?: ProblemPayload }, onClose?: () => void }) {
  // Hydrate from act.problem (if available) or from local shadow
  useEffect(() => {
    const pid = (()=>{ try { return localStorage.getItem('current.projectId') || ''; } catch { return ''; } })();
    const key = `problem.${pid}.${props.act.id}`;
    const payload: ProblemPayload | undefined = props.act.problem || ((): any => {
      try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : undefined; } catch { return undefined; }
    })();
    const { intents, tests } = toEditorState(payload);
    useIntentStore.setState({ intents });
    useTestStore.setState({ items: tests } as any);
    // Debounced persist back to act shadow (local only; actual write to act model should be done by host when available)
    let t: any;
    const unsubA = useIntentStore.subscribe(()=>{ clearTimeout(t); t = setTimeout(()=>{
      try {
        const next = fromEditorState();
        localStorage.setItem(key, JSON.stringify(next));
        // Also reflect into in-memory project graph so explicit Save includes it
        try { ProjectDataService.setAgentActProblemById(props.act.id, next); } catch {}
      } catch {}
    }, 700); });
    const unsubB = useTestStore.subscribe(()=>{ clearTimeout(t); t = setTimeout(()=>{
      try {
        const next = fromEditorState();
        localStorage.setItem(key, JSON.stringify(next));
        try { ProjectDataService.setAgentActProblemById(props.act.id, next); } catch {}
      } catch {}
    }, 700); });
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
        <IntentEditorShell />
      </div>
    </div>
  );
}


