/**
 * Maps persisted {@link AgentStructuredSections} to the normalized {@link PromptIR} view-model.
 */

import type { AgentStructuredSections } from './types';
import type { PromptIR } from './promptIr';

function splitNonEmptyLines(s: string): string[] {
  return s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/**
 * Best-effort parse of the free-text Examples section into structured turns.
 */
export function parseExamplesSection(examples: string | undefined): Array<{ user: string; agent: string }> {
  const raw = (examples ?? '').trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      const out: Array<{ user: string; agent: string }> = [];
      for (const row of parsed) {
        if (row && typeof row === 'object' && !Array.isArray(row)) {
          const u = String((row as Record<string, unknown>).user ?? '');
          const a = String((row as Record<string, unknown>).agent ?? '');
          if (u.trim() || a.trim()) out.push({ user: u, agent: a });
        }
      }
      if (out.length > 0) return out;
    }
  } catch {
    // fall through
  }

  const pairs: Array<{ user: string; agent: string }> = [];
  const blocks = raw.split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((l) => l.trim());
    let u = '';
    let a = '';
    for (const line of lines) {
      const um = /^user\s*:\s*(.*)$/i.exec(line);
      const am = /^assistant\s*:\s*(.*)$/i.exec(line);
      const agentAlt = /^agent\s*:\s*(.*)$/i.exec(line);
      if (um) u = um[1] ?? '';
      else if (am || agentAlt) a = (am ?? agentAlt)?.[1] ?? '';
    }
    if (u || a) pairs.push({ user: u, agent: a });
  }
  if (pairs.length > 0) return pairs;

  if (raw.length > 0) {
    return [{ user: '', agent: raw }];
  }
  return [];
}

export function agentStructuredSectionsToPromptIR(ir: AgentStructuredSections): PromptIR {
  const constraints = (ir.constraints ?? '').trim();
  const op = (ir.operational_sequence ?? '').trim();
  const rules: string[] = [];
  if (op) rules.push(...splitNonEmptyLines(op));
  if (constraints) rules.push(...splitNonEmptyLines(constraints));

  let outputSchema: unknown = {};
  const schemaFence = /```(?:json)?\s*([\s\S]*?)```/i.exec(constraints);
  if (schemaFence) {
    try {
      outputSchema = JSON.parse(schemaFence[1].trim());
    } catch {
      outputSchema = {};
    }
  }

  return {
    goal: (ir.goal ?? '').trim(),
    persona: (ir.personality ?? '').trim(),
    style: (ir.tone ?? '').trim(),
    rules,
    examples: parseExamplesSection(ir.examples),
    outputSchema,
    context: (ir.context ?? '').trim(),
  };
}
