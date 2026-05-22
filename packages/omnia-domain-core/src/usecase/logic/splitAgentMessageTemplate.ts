/**
 * Parses assistant message text into literal segments vs `[slot]` placeholders for design-time preview
 * and a stable JSON shape aligned with runtime templating.
 */

export type AgentTemplateSegment =
  | { kind: 'text'; text: string }
  | { kind: 'slot'; name: string; raw: string };

/** Semantic slot binding: stable id + surface example from the utterance / template. */
export interface AgentMotorSlotBinding {
  slot_id: string;
  surface: string;
}

/** Semantic roles aligned with the annotated template (optional; from LLM). */
export interface AgentMotorSemanticSegment {
  text: string;
  slot: string;
}

/**
 * Repeatable linguistic pattern (list of times, etc.).
 * Legacy groups used `{ period, times }`; new schema adds pattern / separators.
 */
export interface AgentMotorGroup {
  slot_id: string;
  values: string[];
  pattern?: string;
  separator?: string;
  last_separator?: string;
  /** Legacy: bucket by period of day (optional). */
  period?: string;
}

export interface AgentMessageMotorPayload {
  use_case_id: string;
  label: string;
  template: string;
  segments: AgentTemplateSegment[];
  /** Semantic slots with stable ids (from IA annotate). */
  slots: AgentMotorSlotBinding[];
  groups?: AgentMotorGroup[];
  linear_semantic?: AgentMotorSemanticSegment[];
}

/**
 * Split content by `[token]` spans; literal brackets in text become slots only when matched by the pattern.
 */
export function splitAgentMessageBrackets(content: string): AgentTemplateSegment[] {
  const s = typeof content === 'string' ? content : '';
  if (!s) return [];
  const out: AgentTemplateSegment[] = [];
  const re = /\[([^\]]+)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const start = m.index;
    if (start > last) {
      out.push({ kind: 'text', text: s.slice(last, start) });
    }
    const inner = (m[1] ?? '').trim();
    out.push({ kind: 'slot', name: inner, raw: m[0] ?? '' });
    last = start + (m[0]?.length ?? 0);
  }
  if (last < s.length) {
    out.push({ kind: 'text', text: s.slice(last) });
  }
  return out;
}

function dedupeSlotBindings(rows: AgentMotorSlotBinding[]): AgentMotorSlotBinding[] {
  const seen = new Set<string>();
  const out: AgentMotorSlotBinding[] = [];
  for (const r of rows) {
    const id = String(r.slot_id ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      slot_id: id,
      surface: String(r.surface ?? '').trim() || id,
    });
  }
  return out;
}

function bindingsFallbackFromSegments(segments: AgentTemplateSegment[]): AgentMotorSlotBinding[] {
  const names = [
    ...new Set(
      segments.filter((x): x is Extract<AgentTemplateSegment, { kind: 'slot' }> => x.kind === 'slot').map((x) => x.name)
    ),
  ];
  return names.map((slot_id) => ({ slot_id, surface: slot_id }));
}

/**
 * Build JSON-safe payload for UI / downstream tooling (design-time).
 */
export function buildAgentMessageMotorPayload(params: {
  useCaseId: string;
  label: string;
  template: string;
  /** When omitted, each distinct bracket inner becomes slot_id and surface. */
  slotBindings?: AgentMotorSlotBinding[];
  groups?: AgentMotorGroup[];
  linear_semantic?: AgentMotorSemanticSegment[];
}): AgentMessageMotorPayload {
  const template = params.template ?? '';
  const segments = splitAgentMessageBrackets(template);
  const slots = dedupeSlotBindings(
    params.slotBindings?.length ? params.slotBindings : bindingsFallbackFromSegments(segments)
  );

  const out: AgentMessageMotorPayload = {
    use_case_id: params.useCaseId,
    label: params.label,
    template,
    segments,
    slots,
  };

  if (params.groups?.length) {
    out.groups = params.groups.map((g) => ({
      slot_id: String(g.slot_id ?? '').trim(),
      values: Array.isArray(g.values) ? g.values.map((t) => String(t ?? '').trim()).filter(Boolean) : [],
      ...(typeof g.pattern === 'string' && g.pattern.trim() ? { pattern: g.pattern.trim() } : {}),
      ...(typeof g.separator === 'string' ? { separator: g.separator } : {}),
      ...(typeof g.last_separator === 'string' ? { last_separator: g.last_separator } : {}),
      ...(typeof g.period === 'string' && g.period.trim() ? { period: g.period.trim() } : {}),
    }));
  }

  if (params.linear_semantic?.length) {
    out.linear_semantic = params.linear_semantic.map((row) => ({
      text: typeof row.text === 'string' ? row.text : '',
      slot: String(row.slot ?? '').trim(),
    }));
  }

  return out;
}
