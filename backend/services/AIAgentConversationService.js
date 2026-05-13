// Design-time wizard passo 2 ("conversations"):
// - assembleConversation: monta una conversazione user/agent mescolando più use case,
//   con outcome esplicito (positive/negative) e opzionale ammissione di use case emergenti
//   (lampadina). Le bubble agente usano la frase canonica dello use case VERBATIM (la bubble è
//   una vista del canonico). Le bubble degli use case emergenti hanno id sintetico `suggested:<uuid>`
//   e nascono in stato `pending` (decisione di promozione/rigetto presa dal designer).
// - proofreadConversationAgentTurns: corregge SOLO ortografia/punteggiatura/capitalizzazione/spazi
//   sulle bubble modificate dal designer, senza riformulare (temp bassa).
//   L'alias `homogenizeConversationAgentTurns` resta esportato per compatibilità di route.
//
// Il servizio è separato da AIAgentUseCaseService per SRP (file < 300 righe).

const { extractJsonString } = require('./AIAgentDesignService');

const ASSEMBLE_CONVERSATION_TIMEOUT_MS = 180000;
const PROOFREAD_CONVERSATION_TIMEOUT_MS = 120000;

const ASSEMBLE_CONVERSATION_SYSTEM = `You design simulated multi-use-case conversations for OMNIA design-time review.
Mix MULTIPLE use cases into ONE coherent dialog with a COMPLETE NARRATIVE ARC:
- Opening: initial proposal / first available option / opening request (inferred from the AVAILABLE_USE_CASES catalog and the task context).
- Middle: 1–3 intermediate scenarios (refusals, clarifications, alternative requests, edge cases) — this is the part that varies across different conversations on the same task.
- Closing: depends on OUTCOME (positive vs negative); see the user message for the strict rules.

For every conversation you also produce a "scenario_summary": 1–2 short sentences in OUTPUT_LANGUAGE that describe what THIS specific conversation is about (the user goal, the key twist, how it ends). This summary is shown to the designer above the bubble chat as a quick orientation label, so be CONCRETE and SPECIFIC to the arc you just designed — not a generic template.

CRITICAL — use the canonical assistant phrase VERBATIM:
For every AGENT turn, the field "text" MUST be the EXACT \`assistant_example\` of the chosen use case from AVAILABLE_USE_CASES.
Do NOT rephrase. Do NOT shorten. Do NOT adapt to context. The agent text is the canonical phrase, end of story.
The only "creative" choices you make are: which use case appears at each turn position, the wording of the USER turns, and the scenario_summary.

Respond with a single valid JSON object only (no markdown fences, no commentary).
Every id and turn_id in the JSON must be a string value (quoted), never a number.
When OUTPUT_LANGUAGE is set, write every USER turn AND the scenario_summary in that language (agent turns are verbatim from the catalog).`;

const PROOFREAD_AGENT_TURNS_SYSTEM = `You proofread designer-edited assistant lines in an OMNIA simulated conversation.
Apply ONLY:
- spelling corrections
- punctuation corrections
- capitalization corrections
- whitespace normalization
You MUST NOT:
- rephrase the text
- change vocabulary, tone, register or persona
- alter sentence structure
- shorten, expand, summarize or paraphrase
- replace expressions with synonyms
The designer's wording is authoritative. Preserve it verbatim except for objective orthographic errors.
Respond with a single valid JSON object only (no markdown fences).`;

function makeTurnId() {
  return `ct-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function makeConversationId() {
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function makeSuggestedUseCaseId() {
  return `suggested:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Compact summary of use cases for the prompt (id, label, payoff, assistant example line).
 * @param {object[]} useCases
 */
function summarizeUseCasesForConversationPrompt(useCases) {
  if (!Array.isArray(useCases)) return [];
  return useCases.map((u) => {
    const dialogue = Array.isArray(u?.dialogue) ? u.dialogue : [];
    const assistant = dialogue.find((t) => t && t.role === 'assistant');
    return {
      id: typeof u?.id === 'string' ? u.id : '',
      label: typeof u?.label === 'string' ? u.label : '',
      payoff:
        typeof u?.payoff === 'string'
          ? String(u.payoff).slice(0, 600)
          : '',
      assistant_example:
        assistant && typeof assistant.content === 'string' ? assistant.content : '',
    };
  });
}

function clampInt(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.floor(value), min), max);
}

/**
 * Calcola parametri dinamici di lunghezza in funzione del catalogo disponibile.
 * - Turni: clamp(useCases.length * 2, 8, 14).
 * - Use case da mescolare: clamp(useCases.length, 2, 5) — se il catalogo è piccolo, mescoliamo
 *   tutti gli use case disponibili.
 */
function computeConversationLengthHints(useCasesCount) {
  const targetTurns = clampInt(useCasesCount * 2, 8, 14);
  const minMix = Math.min(2, useCasesCount);
  const maxMix = Math.min(5, useCasesCount);
  return { targetTurns, minMix, maxMix };
}

function describeOutcome(outcome) {
  if (outcome === 'negative') {
    return {
      label: 'NEGATIVE',
      closingRule:
        'CLOSING (negative outcome) — close ONLY in one of these two ways:\n' +
        '  (a) After 2–3 DISTINCT proposals refused by the user, the agent acknowledges and closes politely;\n' +
        '  (b) The user abandons politely (e.g. "ok lasciamo perdere, cerco in un\'altra clinica").\n' +
        'Do NOT invent other forms of negative closure. The closing MUST NOT use any use case whose label/payoff ' +
        'represents acceptance, confirmation, or final agreement — the negative arc never reaches a confirming use case.',
      finalUserTurnHint:
        'The final USER turn is either a polite acknowledgement of the failure ("ok va bene, grazie", "ho capito, alla prossima") ' +
        'or an explicit abandonment ("lasciamo perdere, cerco altrove"). It MUST NOT confirm or accept.',
    };
  }
  return {
    label: 'POSITIVE',
    closingRule:
      'CLOSING (positive outcome) — the LAST agent turn MUST drive the conversation to ' +
      'acceptance/confirmation/agreement (use the AVAILABLE_USE_CASES whose label/payoff reads like ' +
      '"accettazione", "conferma", "chiusura positiva", or otherwise the most closure-shaped scenario). ' +
      'Do NOT leave the conversation unresolved.',
    finalUserTurnHint:
      'The final USER turn should be a confirmation message (e.g. "ok va bene", "perfetto, confermo").',
  };
}

function buildAssembleConversationUserMessage({
  useCases,
  outputLanguage,
  runtimeContext,
  globalStyleContract,
  previousConversationsCount,
  outcome,
  allowSuggestedUseCases,
}) {
  const lang =
    typeof outputLanguage === 'string' && outputLanguage.trim()
      ? `OUTPUT_LANGUAGE (BCP 47, for USER turns): ${outputLanguage.trim()}\n`
      : '';
  const ctx =
    typeof runtimeContext === 'string' && runtimeContext.trim()
      ? `\nRUNTIME_PROMPT_OR_SECTIONS (context for the task — use to infer the domain and the opening scenario):\n"""\n${runtimeContext.slice(0, 8000)}\n"""\n`
      : '';
  const style =
    typeof globalStyleContract === 'string' && globalStyleContract.trim()
      ? `\nGLOBAL_STYLE_CONTRACT (already applied to canonical assistant phrases — keep USER turns coherent with this register):\n${globalStyleContract.trim().slice(0, 4000)}`
      : '';
  const previousHint =
    typeof previousConversationsCount === 'number' && previousConversationsCount > 0
      ? `\nThis is conversation #${previousConversationsCount + 1}: keep the SAME arc shape (Opening → Middle → Closing) but vary the MIDDLE use cases vs the previous conversations when possible.`
      : '';
  const { targetTurns, minMix, maxMix } = computeConversationLengthHints(useCases.length);
  const outcomeInfo = describeOutcome(outcome);
  const compact = JSON.stringify(summarizeUseCasesForConversationPrompt(useCases)).slice(0, 16000);

  const suggestedRules = allowSuggestedUseCases
    ? `
EMERGENT USE CASES (lightbulb) — REQUIRED in this conversation (target: exactly 1, hard cap: 1):
The designer has EXPLICITLY requested to discover ONE missing scenario from AVAILABLE_USE_CASES via this conversation.
You MUST identify a plausible MIDDLE-arc scenario that the catalog does NOT cover (a likely follow-up, clarification,
edge case, or refinement of an existing flow that has no dedicated use case yet) and emit EXACTLY ONE agent turn
with a synthetic use_case_id of the form "suggested:<random-suffix>". Rules for that emergent turn:
- place it in the MIDDLE of the arc (never in Opening, never as the final Closing turn);
- "use_case_label" is a brief, NEW, plausible name for the missing scenario (max 60 chars);
- "use_case_label" MUST NOT be a synonym, restatement, translation or near-duplicate of any existing catalog label
  (the server rejects suggestions with label similarity ≥ 0.88 to any existing label);
- "text" is realistic for that scenario (NOT verbatim from any catalog phrase — there is no canonical phrase yet);
- the surrounding agent turns (Opening / Closing / other Middle slots) MUST still use the canonical assistant_example
  of real catalog use cases verbatim;
- if and ONLY if the catalog is genuinely so exhaustive that no missing scenario exists, you may emit zero suggested
  turns — but treat this as a rare exception: in nearly all real catalogs there are missing follow-ups.`
    : `
EMERGENT USE CASES (lightbulb) — NOT ALLOWED in this conversation:
Every agent turn MUST refer to an existing id from AVAILABLE_USE_CASES.
Do NOT invent new use cases or use "suggested:" ids.`;

  return `${lang}OUTCOME: ${outcomeInfo.label}
TARGET_TURNS: ${targetTurns} (strictly alternating user/agent, start user, end agent)
USE_CASE_MIX: pick between ${minMix} and ${maxMix} distinct use cases from the catalog

AVAILABLE_USE_CASES (id, label, payoff, assistant_example):
${compact}
${ctx}${style}${previousHint}

Task: build ONE simulated conversation between a USER and an AGENT with a COMPLETE NARRATIVE ARC.

CONVERSATION ARC:
1. Opening — the FIRST agent turn opens with the most representative initial scenario inferred from the task context and AVAILABLE_USE_CASES (e.g. an initial proposal / first option / opening request).
2. Middle — 1 to 3 intermediate use cases (refusals, clarifications, alternative requests, edge cases). This is the part that must look different across conversations.
3. ${outcomeInfo.closingRule}

FINAL USER TURN: ${outcomeInfo.finalUserTurnHint}

AGENT TEXT POLICY (critical):
For every AGENT turn referring to a real catalog use case, "text" MUST be the EXACT \`assistant_example\` of that use case (verbatim, no edits).
You do NOT rephrase, shorten, lengthen, soften, or contextualize. The catalog phrase IS the agent line.
This is a hard constraint of the OMNIA design model: the agent bubble is a *view* of the canonical use-case phrase.
${suggestedRules}

Output a single valid JSON object with this exact shape:
{
  "conversation_id": "<string>",
  "scenario_summary": "<1–2 short sentences (max ~200 chars) summarizing the conversation arc>",
  "turns": [
    { "turn_id": "<string>", "role": "user", "text": "<string>" },
    { "turn_id": "<string>", "role": "agent", "text": "<string>", "use_case_id": "<id from AVAILABLE_USE_CASES OR suggested:xxx if allowed>", "use_case_label": "<label from AVAILABLE_USE_CASES for that id, or proposed label for suggested>" },
    ...
  ]
}

SCENARIO_SUMMARY rules:
- 1 to 2 short sentences (max ~200 characters total), in OUTPUT_LANGUAGE.
- Describe the ACTUAL arc of THIS specific conversation (what the user wants, the key middle twist, how it closes).
- Be concrete, not generic: name the scenario, not the abstract pattern. Examples in Italian:
  * "Il paziente accetta la prima data proposta dopo aver chiesto chiarimenti sulla durata."
  * "Tre date alternative vengono rifiutate; il paziente abbandona educatamente cercando un'altra clinica."
  * "L'agente propone una visita di controllo; emerge l'esigenza non coperta di un richiamo telefonico di promemoria."
- No marketing tone, no exclamations, no enumerations.

Rules:
- Exactly ${targetTurns} turns (±1 acceptable), strictly alternating user/agent (start user, end agent).
- Every agent turn MUST have \`use_case_id\` and \`use_case_label\`.
- An agent turn referring to a real use case MUST set "text" = canonical \`assistant_example\` of that id (verbatim).
- USER turns are written by you (paraphrased from realistic phrasings a real user would say); do NOT copy the catalog assistant_example into a user turn.
- Each \`turn_id\` is a unique non-empty string.
- \`text\` is non-empty for every turn.
- \`scenario_summary\` is non-empty.
- Do NOT include extra keys. Valid JSON only.`;
}

/**
 * Anti-sinonimi: similarità tra due label catalogata vs proposta (Levenshtein normalizzata
 * su token lowercase concatenati). Sopra una soglia, la proposta è considerata sinonimo.
 */
function normalizedLabelForSimilarity(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[\s\-_/]+/g, ' ')
    .replace(/[^\p{L}\p{N} ]+/gu, '')
    .trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = a.length;
  const n = b.length;
  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

function labelSimilarityRatio(a, b) {
  const na = normalizedLabelForSimilarity(a);
  const nb = normalizedLabelForSimilarity(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  return 1 - dist / maxLen;
}

/**
 * Soglia oltre la quale due label sono considerate sinonime (Levenshtein normalizzata).
 * Alzata da 0.82 a 0.88: con 0.82 venivano degradate anche proposte legittime (es. una label
 * di 12 caratteri con 2 differenze ha ratio ≈ 0.83 e finiva nel catalogo esistente).
 * Il prompt LLM è allineato a questo numero.
 */
const SUGGESTED_SYNONYM_SIMILARITY_THRESHOLD = 0.88;

/**
 * Se la label proposta dall'AI è troppo simile a una label del catalogo, restituisce l'id del
 * catalogo più affine. Altrimenti null. Soglia: 0.82 (Levenshtein normalizzata).
 *
 * Effetto: il backend «degrada» l'emergente a match con il catalogo, evitando lampadine fasulle.
 */
function findCatalogSynonymForSuggestion(proposedLabel, useCases) {
  if (!Array.isArray(useCases) || useCases.length === 0) return null;
  let bestId = null;
  let bestRatio = 0;
  for (const u of useCases) {
    const ratio = labelSimilarityRatio(proposedLabel, u?.label);
    if (ratio >= SUGGESTED_SYNONYM_SIMILARITY_THRESHOLD && ratio > bestRatio) {
      bestRatio = ratio;
      bestId = typeof u?.id === 'string' ? u.id : null;
    }
  }
  return bestId;
}

/**
 * @param {object} params
 * @param {object[]} params.useCases
 * @param {string} [params.runtimeContext]
 * @param {string} [params.outputLanguage]
 * @param {string} [params.globalStyleContract]
 * @param {number} [params.previousConversationsCount]
 * @param {'positive'|'negative'} [params.outcome]
 * @param {boolean} [params.allowSuggestedUseCases]
 * @param {string} [params.provider]
 * @param {string} [params.model]
 * @param {import('./AIProviderService')} params.aiProviderService
 */
async function assembleConversation({
  useCases,
  runtimeContext,
  outputLanguage,
  globalStyleContract,
  previousConversationsCount,
  outcome,
  allowSuggestedUseCases,
  provider = 'groq',
  model,
  purpose,
  taskId = null,
  taskLabel = null,
  aiProviderService,
}) {
  if (!Array.isArray(useCases) || useCases.length < 2) {
    throw new Error('assembleConversation: at least 2 use cases required');
  }
  const normalizedOutcome = outcome === 'negative' ? 'negative' : 'positive';
  const allowSuggested = Boolean(allowSuggestedUseCases);
  const messages = [
    { role: 'system', content: ASSEMBLE_CONVERSATION_SYSTEM },
    {
      role: 'user',
      content: buildAssembleConversationUserMessage({
        useCases,
        outputLanguage,
        runtimeContext,
        globalStyleContract,
        previousConversationsCount,
        outcome: normalizedOutcome,
        allowSuggestedUseCases: allowSuggested,
      }),
    },
  ];
  const maxTokens = provider === 'openai' ? 3072 : 6144;
  const response = await aiProviderService.callAI(provider, messages, {
    model: model || undefined,
    temperature: 0.55,
    maxTokens,
    timeout: ASSEMBLE_CONVERSATION_TIMEOUT_MS,
    purpose,
    taskId,
    taskLabel,
  });
  const content = response?.choices?.[0]?.message?.content;
  const jsonStr = extractJsonString(content);
  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    const err = new Error(`Model returned non-JSON: ${e.message}`);
    err.rawSnippet = jsonStr.slice(0, 500);
    throw err;
  }
  return normalizeAssembledConversation(parsed, useCases, {
    outcome: normalizedOutcome,
    allowSuggestedUseCases: allowSuggested,
  });
}

function normalizeAssembledConversation(raw, useCases, options) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.turns)) {
    throw new Error('assembleConversation: invalid JSON shape');
  }
  const validUseCases = new Map();
  const canonicalAssistantById = new Map();
  for (const u of useCases) {
    if (!u || typeof u.id !== 'string' || !u.id.trim()) continue;
    const id = u.id.trim();
    validUseCases.set(id, typeof u.label === 'string' ? u.label : '');
    const dialogue = Array.isArray(u.dialogue) ? u.dialogue : [];
    const assistant = dialogue.find((t) => t && t.role === 'assistant');
    canonicalAssistantById.set(
      id,
      assistant && typeof assistant.content === 'string' ? assistant.content : ''
    );
  }
  const conversationId =
    typeof raw.conversation_id === 'string' && raw.conversation_id.trim()
      ? raw.conversation_id.trim()
      : makeConversationId();
  const allowSuggested = Boolean(options?.allowSuggestedUseCases);
  const turns = [];
  let suggestedCount = 0;
  for (const t of raw.turns) {
    if (!t || typeof t !== 'object') continue;
    const role = t.role === 'agent' ? 'agent' : t.role === 'user' ? 'user' : null;
    if (!role) continue;
    const text = typeof t.text === 'string' ? t.text : '';
    if (!text.trim()) continue;
    const turnId = typeof t.turn_id === 'string' && t.turn_id.trim() ? t.turn_id.trim() : makeTurnId();
    if (role === 'user') {
      turns.push({ turnId, role: 'user', text });
      continue;
    }
    const rawUseCaseId = typeof t.use_case_id === 'string' ? t.use_case_id.trim() : '';
    if (!rawUseCaseId) continue;
    const isSuggested = rawUseCaseId.startsWith('suggested:');

    if (isSuggested) {
      if (!allowSuggested) continue;
      const proposedLabel =
        typeof t.use_case_label === 'string' && t.use_case_label.trim()
          ? t.use_case_label.trim().slice(0, 120)
          : 'Use case suggerito';
      /** Anti-sinonimi: se l'AI propone "Conferma appuntamento" ma il catalogo ha "Conferma data",
       *  degradiamo al canonico più simile e forziamo il testo verbatim. */
      const synonymOfId = findCatalogSynonymForSuggestion(proposedLabel, useCases);
      if (synonymOfId && validUseCases.has(synonymOfId)) {
        const canonicalText = canonicalAssistantById.get(synonymOfId) || '';
        turns.push({
          turnId,
          role: 'agent',
          useCaseId: synonymOfId,
          useCaseLabel: validUseCases.get(synonymOfId) || '',
          text: canonicalText || text,
        });
        continue;
      }
      if (suggestedCount >= 1) {
        /** Cap a 1 suggerimento per conversazione; il secondo viene scartato. */
        continue;
      }
      suggestedCount += 1;
      const syntheticId = makeSuggestedUseCaseId();
      turns.push({
        turnId,
        role: 'agent',
        useCaseId: syntheticId,
        useCaseLabel: proposedLabel,
        text,
        suggestion: { status: 'pending', proposedLabel },
      });
      continue;
    }

    if (!validUseCases.has(rawUseCaseId)) continue;
    const labelFromModel =
      typeof t.use_case_label === 'string' && t.use_case_label.trim()
        ? t.use_case_label.trim()
        : validUseCases.get(rawUseCaseId) || '';
    /** Filosofia bubble = canonico: forziamo text = canonical assistant_example dello use case.
     *  Se assente, ripieghiamo sul testo del modello (uses case appena creato senza turn assistente). */
    const canonicalText = canonicalAssistantById.get(rawUseCaseId);
    const finalText = canonicalText && canonicalText.trim() ? canonicalText : text;
    turns.push({
      turnId,
      role: 'agent',
      useCaseId: rawUseCaseId,
      useCaseLabel: labelFromModel,
      text: finalText,
    });
  }
  if (turns.length < 2) {
    throw new Error('assembleConversation: too few valid turns after normalization');
  }
  /**
   * Scenario summary: 1–2 frasi prodotte dall'LLM per orientare il designer. Trim, taglio
   * a 400 caratteri come safety net (il prompt chiede ~200). Se assente o vuoto, omettiamo
   * il campo: lato client la label semplicemente non viene renderizzata.
   */
  const rawSummary =
    typeof raw.scenario_summary === 'string' ? raw.scenario_summary.trim() : '';
  const scenarioSummary = rawSummary ? rawSummary.slice(0, 400) : '';
  return {
    conversationId,
    turns,
    ...(scenarioSummary ? { scenarioSummary } : {}),
  };
}

function buildProofreadAgentTurnsUserMessage(conversation, targets, outputLanguage) {
  const lang =
    typeof outputLanguage === 'string' && outputLanguage.trim()
      ? `OUTPUT_LANGUAGE (BCP 47): ${outputLanguage.trim()}\n`
      : '';
  const conversationSummary = JSON.stringify(conversation).slice(0, 12000);
  const targetIds = targets.map((t) => t.turnId);
  return `${lang}CONVERSATION (current, designer-edited — full context for reference only, do NOT touch user turns):
${conversationSummary}

TARGETS (proofread ONLY these agent turns):
${JSON.stringify(targets).slice(0, 8000)}

Return a single JSON object:
{
  "updates": [
    { "turn_id": "<turn_id from TARGETS>", "text": "<proofread text>" },
    ...
  ]
}

Rules:
- Emit exactly one update per turn_id in TARGETS, in the same order: ${JSON.stringify(targetIds)}.
- Every "text" must be non-empty.
- Apply ONLY: spelling, punctuation, capitalization, whitespace.
- Do NOT rephrase, shorten, expand, change tone, or replace expressions with synonyms.
- The designer's wording is authoritative — preserve it verbatim aside from objective orthographic fixes.
- Do NOT add or remove turns. Do NOT touch user turns.
- Valid JSON only.`;
}

/**
 * Proofread (solo ortografia/punteggiatura) delle bubble agente modificate dal designer.
 * Sostituisce la vecchia `homogenize*` (più permissiva). Mantiene l'alias di export per
 * non rompere chiamate di route già in flight.
 *
 * @param {object} params
 * @param {{conversationId:string, turns: Array<object>}} params.conversation
 * @param {Array<{turnId:string, useCaseId:string, currentText:string, baselineText:string}>} params.modifiedAgentTurns
 * @param {string} [params.outputLanguage]
 * @param {string} [params.provider]
 * @param {string} [params.model]
 * @param {import('./AIProviderService')} params.aiProviderService
 */
async function proofreadConversationAgentTurns({
  conversation,
  modifiedAgentTurns,
  outputLanguage,
  provider = 'groq',
  model,
  purpose,
  taskId = null,
  taskLabel = null,
  aiProviderService,
}) {
  if (!conversation || typeof conversation !== 'object' || !Array.isArray(conversation.turns)) {
    throw new Error('proofreadConversationAgentTurns: invalid conversation');
  }
  if (!Array.isArray(modifiedAgentTurns) || modifiedAgentTurns.length === 0) {
    throw new Error('proofreadConversationAgentTurns: no modified agent turns');
  }
  const messages = [
    { role: 'system', content: PROOFREAD_AGENT_TURNS_SYSTEM },
    {
      role: 'user',
      content: buildProofreadAgentTurnsUserMessage(conversation, modifiedAgentTurns, outputLanguage),
    },
  ];
  const maxTokens = provider === 'openai' ? 2048 : 4096;
  const response = await aiProviderService.callAI(provider, messages, {
    model: model || undefined,
    /** Temperatura bassa: il proofread deve essere conservativo e ripetibile. */
    temperature: 0.1,
    maxTokens,
    timeout: PROOFREAD_CONVERSATION_TIMEOUT_MS,
    purpose,
    taskId,
    taskLabel,
  });
  const content = response?.choices?.[0]?.message?.content;
  const jsonStr = extractJsonString(content);
  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    const err = new Error(`Model returned non-JSON: ${e.message}`);
    err.rawSnippet = jsonStr.slice(0, 400);
    throw err;
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.updates)) {
    throw new Error('Invalid JSON: expected { updates: [] }');
  }
  const wantIds = new Set(modifiedAgentTurns.map((t) => String(t.turnId)));
  const updates = [];
  const seen = new Set();
  for (const row of parsed.updates) {
    if (!row || typeof row !== 'object') continue;
    const turnId = typeof row.turn_id === 'string' ? row.turn_id.trim() : '';
    const text = typeof row.text === 'string' ? row.text.trim() : '';
    if (!turnId || !wantIds.has(turnId) || seen.has(turnId)) continue;
    if (!text) continue;
    seen.add(turnId);
    updates.push({ turnId, text });
  }
  if (updates.length !== modifiedAgentTurns.length) {
    throw new Error(
      `Expected ${modifiedAgentTurns.length} updates, got ${updates.length} (turns: ${[...wantIds].join(', ')})`
    );
  }
  return { updates };
}

module.exports = {
  assembleConversation,
  proofreadConversationAgentTurns,
  /** Alias retro-compatibile: la route legacy continua a funzionare con il nuovo prompt proofread. */
  homogenizeConversationAgentTurns: proofreadConversationAgentTurns,
};
