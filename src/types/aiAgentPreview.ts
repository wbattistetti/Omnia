/**
 * Design-time chat preview for AI Agent tasks: per-style simulated dialogue with designer notes.
 */

export interface AIAgentPreviewTurn {
  role: 'assistant' | 'user';
  content: string;
  /** Istruzioni / annotazioni del designer sotto il messaggio agente. */
  designerNote?: string;
  /** Opzionale: id logico dello step (per allineamento a istruzioni comuni in futuro). */
  logicalStepId?: string;
}

export interface AIAgentPreviewStyle {
  id: string;
  label: string;
}

/** Stili predefiniti per l'anteprima (estendibili in seguito). */
export const AI_AGENT_PREVIEW_STYLES: AIAgentPreviewStyle[] = [
  { id: 'formal', label: 'Formale' },
  { id: 'informal', label: 'Non formale' },
  { id: 'friendly', label: 'Amichevole' },
];

export const AI_AGENT_DEFAULT_PREVIEW_STYLE_ID = 'informal';

export function mapSampleToPreviewTurns(
  sample: Array<{ role: string; content: string }>
): AIAgentPreviewTurn[] {
  return sample.map((t, i) => ({
    role: t.role === 'user' ? 'user' : 'assistant',
    content: t.content,
    logicalStepId: t.role === 'assistant' ? `agent_step_${i}` : undefined,
  }));
}

export function previewTurnsToLegacySample(turns: AIAgentPreviewTurn[]): Array<{ role: string; content: string }> {
  return turns.map((t) => ({ role: t.role, content: t.content }));
}

function cloneTurns(turns: AIAgentPreviewTurn[]): AIAgentPreviewTurn[] {
  return turns.map((t) => ({ ...t }));
}

/**
 * Load preview map from task or migrate from legacy agentSampleDialogue.
 */
export function normalizeAgentPreviewFromTask(raw: any, legacySample: AIAgentPreviewTurn[]): {
  byStyle: Record<string, AIAgentPreviewTurn[]>;
  styleId: string;
} {
  const styleIdRaw = typeof raw?.agentPreviewStyleId === 'string' ? raw.agentPreviewStyleId : '';
  const styleId = AI_AGENT_PREVIEW_STYLES.some((s) => s.id === styleIdRaw)
    ? styleIdRaw
    : AI_AGENT_DEFAULT_PREVIEW_STYLE_ID;

  const fromTask = raw?.agentPreviewByStyle;
  if (fromTask && typeof fromTask === 'object' && !Array.isArray(fromTask)) {
    const normalized: Record<string, AIAgentPreviewTurn[]> = {};
    for (const s of AI_AGENT_PREVIEW_STYLES) {
      const arr = fromTask[s.id];
      normalized[s.id] = Array.isArray(arr)
        ? arr.map((t: any) => ({
            role: t?.role === 'user' ? 'user' : 'assistant',
            content: String(t?.content ?? ''),
            designerNote: typeof t?.designerNote === 'string' ? t.designerNote : undefined,
            logicalStepId: typeof t?.logicalStepId === 'string' ? t.logicalStepId : undefined,
          }))
        : cloneTurns(legacySample);
    }
    return { byStyle: normalized, styleId };
  }

  const base = legacySample.length > 0 ? legacySample : [];
  const byStyle: Record<string, AIAgentPreviewTurn[]> = {};
  for (const s of AI_AGENT_PREVIEW_STYLES) {
    byStyle[s.id] = cloneTurns(base);
  }
  return { byStyle, styleId };
}

export function seedPreviewByStyleFromSample(
  sample: Array<{ role: string; content: string }>
): Record<string, AIAgentPreviewTurn[]> {
  const base = mapSampleToPreviewTurns(sample);
  const byStyle: Record<string, AIAgentPreviewTurn[]> = {};
  for (const s of AI_AGENT_PREVIEW_STYLES) {
    byStyle[s.id] = cloneTurns(base);
  }
  return byStyle;
}
