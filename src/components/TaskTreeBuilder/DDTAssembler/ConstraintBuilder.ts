import { v4 as uuidv4 } from 'uuid';
// TODO: Add zod validation for constraints in the future.

/**
 * Normalizes a single constraint object, ensuring all required fields are present.
 */
export function normalizeConstraint(c: any) {
  return {
    ...c,
    id: c.id || uuidv4(),
    label: c.label || c.type,
    payoff: c.payoff || '',
    prompts: Array.isArray(c.prompts) ? c.prompts : [],
    validationScript: c.validationScript || '',
    testSet: Array.isArray(c.testSet) ? c.testSet : [],
  };
}

/**
 * Enriches and translates an array of constraints, adding prompt translations.
 * Returns the enriched array. Mutates the translations object.
 */
export function enrichAndTranslateConstraints(
  constraints: any[],
  ddtId: string,
  translations: Record<string, string>
) {
  return constraints.map((c) => {
    const norm = normalizeConstraint(c);
    const newPrompts = norm.prompts.map((msg: string, idx: number) => {
      const key = `runtime.${ddtId}.constraint#${norm.id}.prompt#${idx+1}`;
      translations[key] = msg;
      return key;
    });
    return { ...norm, prompts: newPrompts };
  });
}