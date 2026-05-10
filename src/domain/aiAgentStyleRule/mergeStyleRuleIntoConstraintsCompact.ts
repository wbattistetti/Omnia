/**
 * Appends an induced style rule into AI Agent `runtime_compact.constraints_compact`
 * (persisted as `agentRuntimeCompactJson`).
 */

import type { AIAgentRuntimeCompact } from '@types/aiAgentDesign';

const MERGED_MAX_CHARS = 420;

function emptyCompact(): AIAgentRuntimeCompact {
  return {
    behavior_compact: '',
    constraints_compact: '',
    sequence_compact: '',
    corrections_compact: '',
    examples_compact: [],
  };
}

export interface MergeStyleRuleResult {
  /** Serialized JSON for `agentRuntimeCompactJson`. */
  nextJson: string;
  /** True when output was truncated to {@link MERGED_MAX_CHARS}. */
  truncated: boolean;
}

/**
 * @param agentRuntimeCompactJson - Existing task JSON or undefined for legacy empty compact.
 * @param ruleText - Non-empty induced rule (caller validates trim).
 */
export function mergeStyleRuleIntoConstraintsCompact(
  agentRuntimeCompactJson: string | undefined | null,
  ruleText: string
): MergeStyleRuleResult {
  const rule = ruleText.trim();
  if (!rule) {
    throw new Error('ruleText must be non-empty');
  }

  let compact: AIAgentRuntimeCompact;
  const raw = typeof agentRuntimeCompactJson === 'string' ? agentRuntimeCompactJson.trim() : '';
  if (!raw) {
    compact = emptyCompact();
  } else {
    try {
      const parsed = JSON.parse(raw) as Partial<AIAgentRuntimeCompact>;
      compact = {
        behavior_compact: typeof parsed.behavior_compact === 'string' ? parsed.behavior_compact : '',
        constraints_compact:
          typeof parsed.constraints_compact === 'string' ? parsed.constraints_compact : '',
        sequence_compact: typeof parsed.sequence_compact === 'string' ? parsed.sequence_compact : '',
        corrections_compact:
          typeof parsed.corrections_compact === 'string' ? parsed.corrections_compact : '',
        examples_compact: Array.isArray(parsed.examples_compact) ? parsed.examples_compact : [],
      };
    } catch {
      throw new Error('Invalid agentRuntimeCompactJson');
    }
  }

  const prev = compact.constraints_compact.trim();
  let merged = prev ? `${prev}; ${rule}` : rule;
  let truncated = false;
  if (merged.length > MERGED_MAX_CHARS) {
    merged = `${merged.slice(0, MERGED_MAX_CHARS - 1)}...`;
    truncated = true;
  }
  compact.constraints_compact = merged;

  return {
    nextJson: JSON.stringify(compact, null, 2),
    truncated,
  };
}
