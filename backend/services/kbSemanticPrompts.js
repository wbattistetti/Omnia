/**

 * System prompts for KB semantic analysis and guided chat.

 */



const ANALYZE_SEMANTIC_SYSTEM = `You analyze semi-structured knowledge-base documents (Markdown, plain text, CSV/TSV, Excel previews, JSON) in relation to a VIRTUAL AGENT TASK.

Extract semantic structure — not just syntax. Use the deterministic column/variable list and agent task summary in context as anchors.

Only propose rules that help the agent fulfill the task; mark low task relevance in relevanceToTask.



Tasks:

1. structure: document_type, entities/sections, properties [{ name, type, required, role, description }] tied to real fields when possible.

2. rules: 0–8 high-confidence induced rules. Group recurring patterns:

   - ruleKind "macro": one GENERAL pattern (must generalize all children; rule text MUST NOT copy a single micro). parentRuleId null.

   - ruleKind "micro": concrete examples under a macro (e.g. Cardiologia, Dermatologia). parentRuleId = macro id. Each micro rule text must be specific to that example, not the macro wording.

   - ruleKind "atomic": standalone rules without grouping.

   Each rule: title (short), field (or "—"), rule, evidence (document excerpt or reference list, not duplicate of rule), note "", fallback (optional), status "hypothesized", confidence, relevanceToTask. Do NOT output trigger or action fields.

   Prefer 1 macro + 2–4 micros over duplicate flat rules when the same pattern repeats.

3. reviewOpener: Italian (max 280 chars). If macro+micro: say you found N specific rules subsumable in macro-rule(s), invite opening accordions. Else one question about the first rule.



Return ONLY valid JSON (no markdown fence):

{

  "structure": { "document_type": "", "entities": [], "properties": [] },

  "rules": [{ "id", "ruleKind": "macro|micro|atomic", "parentRuleId": null, "title", "field", "rule", "evidence", "note", "fallback", "status": "hypothesized|validated|corrected|reworked|invalid", "confidence", "relevanceToTask", "included": true, "validation": null }],

  "reviewOpener": "string",

  "analysisNote": "optional"

}`;



const REANALYZE_SYSTEM = `You refine induced rules for a KB document using designer intent, agent task summary, and current rules.

Semantic analysis: constraints, uniqueness, cardinality, cross-field relations. Italian string values.

Each rule: title, field, rule, evidence, fallback (optional), status, confidence, relevanceToTask. Do NOT output trigger or action.

Return ONLY valid JSON:

{

  "structure": {...},

  "rules": [{ "id", "title", "field", "rule", "evidence", "note", "fallback", "status", "confidence", "relevanceToTask", "included": true, "validation": null }],

  "analysisNote": "optional"

}

Respect included, validation, notes, status; omit deleted rules. Use analysis objective from context.`;



const CHAT_SYSTEM = `You assist a designer reviewing ONE KB rule at a time for a virtual agent task. Reply in Italian.



STRICT style:

- Max 3 short sentences in the visible reply. Focus on the current rule id in context.

- Put ALL rule updates inside a single \`\`\`json ... \`\`\` block (rules array with one or more objects, must include id). Never include trigger or action in rule objects.

- Prose: acknowledge confirm/reject/defer only.



When the designer validates, set status "validated" and included true. Invalid → "invalid". After designer correction and re-analysis → "reworked". Designer manual fix → "corrected".`;



const CHAT_START_SYSTEM = `Open a guided KB review. Reply in Italian: max 2 sentences + 1 short question about the current rule. No document summary.`;



function stripJsonFence(content) {

  return String(content || '')

    .replace(/```json\s*[\s\S]*?```/gi, '')

    .trim();

}



function buildRulesSummaryIt(rules) {

  const list = Array.isArray(rules) ? rules.filter((r) => r && r.included !== false && r.status !== 'invalid') : [];

  if (list.length === 0) {

    return 'Analisi completata. Non ho aggiunto nuove regole — vuoi specificare cosa cercare?';

  }

  const macroCount = list.filter((r) => String(r.ruleKind || '').toLowerCase() === 'macro').length;

  const microCount = list.filter((r) => String(r.ruleKind || '').toLowerCase() === 'micro').length;

  if (macroCount > 0 && microCount > 0) {

    return (

      `Ho trovato ${microCount} regole specifiche che possono essere sussunte in ${macroCount} macro-regola/e. ` +

      `Apri le macro-regole nell'elenco per rivedere gli esempi. Partiamo dalla prima in sospeso?`

    );

  }

  const n = list.length;

  const titles = list

    .slice(0, 4)

    .map((r) => String(r.title || r.field || '').trim())

    .filter(Boolean)

    .join(', ');

  const more = n > 4 ? ` (+${n - 4})` : '';

  return `Ho trovato ${n} regola/e${titles ? `: ${titles}${more}` : ''}. Usa gli accordion sopra per confermare.`;

}



module.exports = {

  ANALYZE_SEMANTIC_SYSTEM,

  REANALYZE_SYSTEM,

  CHAT_SYSTEM,

  CHAT_START_SYSTEM,

  stripJsonFence,

  buildRulesSummaryIt,

};


