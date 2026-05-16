/**
 * Builds the «Error handling and others» section for the external conversational prompt.
 */

import type { ConversationalRule } from './types';

const RULES_HEADER_IT = `Regole conversazionali (error handling e altro)
Queste regole si applicano trasversalmente a tutti gli scenari del catalogo use case. Quando una situazione corrisponde a una regola, adatta tono e strategia di risposta di conseguenza, senza contraddire il template dello use case scelto.
Ogni voce ha \`scenario\` (quando applicarla) e \`exampleMessage\` (esempio di formulazione assistente).`;

export interface ConversationalRulePromptJson {
  readonly ruleId: string;
  readonly label: string;
  readonly scenario: string;
  readonly exampleMessage: string;
}

function projectRule(rule: ConversationalRule): ConversationalRulePromptJson | null {
  if (rule.enabled === false) return null;
  return {
    ruleId: rule.id,
    label: rule.label,
    scenario: rule.scenario.trim(),
    exampleMessage: rule.exampleMessage.trim(),
  };
}

/**
 * Text block appended after the business use-case catalog in {@link buildConversationalPrompt}.
 * Returns empty string when no enabled rules.
 */
export function buildConversationalRulesPromptSection(
  rules: readonly ConversationalRule[]
): string {
  const projected = rules
    .map(projectRule)
    .filter((r): r is ConversationalRulePromptJson => r !== null);
  if (projected.length === 0) return '';

  const blocks = projected.map(
    (r, index) => `### Regola ${index + 1}\n${JSON.stringify(r, null, 2)}`
  );
  return `${RULES_HEADER_IT}\n\n${blocks.join('\n\n')}\n`;
}
