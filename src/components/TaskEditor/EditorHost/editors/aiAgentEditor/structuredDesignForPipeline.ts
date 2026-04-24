/**
 * Maps editor structured section text into the JSON shape expected by
 * {@link StructuredDesignPipelineService} Phase 3 validation (goal, operational_sequence, …).
 */

/**
 * Split the single "Vincoli" field into must / must_not when the usual "Must not:" label is present.
 */
export function splitConstraintsToMustMustNot(constraintsText: string): { must: string; must_not: string } {
  const t = (constraintsText ?? '').trim();
  if (!t) return { must: 'missing', must_not: 'missing' };
  const lower = t.toLowerCase();
  const mnotIdx = lower.search(/\bmust\s+not\s*:/);
  if (mnotIdx === -1) {
    const stripped = t.replace(/^\s*must\s*:\s*/i, '').trim();
    return { must: stripped || t, must_not: 'missing' };
  }
  const before = t
    .slice(0, mnotIdx)
    .replace(/^\s*must\s*:\s*/i, '')
    .trim();
  const after = t.slice(mnotIdx).replace(/^\s*must\s+not\s*:\s*/i, '').trim();
  return {
    must: before || 'missing',
    must_not: after || 'missing',
  };
}

/**
 * Build `structured_design` for POST /design/ai-agent-generate (sections_only) or Phase 3 APIs.
 */
export function structuredDesignForPipelinePhase3(effectiveBySection: Record<string, string | undefined>): {
  goal: string;
  operational_sequence: string;
  context: string;
  constraints: { must: string; must_not: string };
  personality: string;
  tone: string;
} {
  const c = splitConstraintsToMustMustNot(String(effectiveBySection.constraints ?? ''));
  const g = String(effectiveBySection.goal ?? '').trim();
  return {
    goal: g || 'missing',
    operational_sequence: String(effectiveBySection.operational_sequence ?? '').trim() || 'missing',
    context: String(effectiveBySection.context ?? '').trim() || 'missing',
    constraints: { must: c.must, must_not: c.must_not },
    personality: String(effectiveBySection.personality ?? '').trim() || 'missing',
    tone: String(effectiveBySection.tone ?? '').trim() || 'missing',
  };
}
