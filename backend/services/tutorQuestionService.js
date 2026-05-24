/**
 * Active Tutor — domande libere LLM vincolate al manuale designer (JSON strutturato).
 */

const { retrieveManualForTutor } = require('./tutorManualRetrieval');
const { TUTOR_UI_IDS } = require('./tutorUiIdsAllowlist');

const WIZARD_PHASE_HINT = `
Wizard 7 step: 0 Task, 1 Knowledge Base, 2 Backend (+ Interface toggle), 3 Prompts, 4 Error Handling, 5 Dati, 6 Voce.
`;

const RESPONSE_SCHEMA = `
Schema risposta (SOLO JSON valido, niente markdown libero):
{
  "inManual": boolean,
  "message": {
    "title": "string",
    "body": "string",
    "actions": [{ "icon": "LucidePascalCase", "label": "string" }],
    "uiRefs": [{ "elementId": "string", "label": "string", "type": "glow"|"blink"|"pulse" }],
    "ensureView": null | "knowledgeBase" | "interface" | "backendMain" | "errorHandling"
  }
}
Regole:
- Se la risposta NON è nel manuale: inManual=false, message=null.
- Se È nel manuale: inManual=true, message compilato in italiano, tono amichevole.
- uiRefs.elementId SOLO da whitelist UI_IDS (sotto). Mai inventare ID.
- icon = nome componente Lucide PascalCase (es. ArrowRight, Check, BookOpen).
- uiRefs obbligatorio quando citi elementi UI nel body.
- ensureView solo se serve aprire sotto-vista wizard.
`;

/**
 * @param {object} params
 * @returns {Promise<{ inManual: boolean, message: object | null }>}
 */
async function answerTutorQuestion(params) {
  const {
    question,
    currentPhaseLabel = '',
    currentState = '',
    detectedPhaseLabel = '',
    aiProviderService,
    provider,
    model,
  } = params;

  const q = typeof question === 'string' ? question.trim() : '';
  if (!q) {
    const e = new Error('question is required');
    e.statusCode = 400;
    throw e;
  }
  if (!aiProviderService) {
    const e = new Error('aiProviderService is required');
    e.statusCode = 500;
    throw e;
  }

  const manualChunk = retrieveManualForTutor({
    question: q,
    activePhaseLabel: currentPhaseLabel,
    detectedPhaseLabel: detectedPhaseLabel || currentPhaseLabel,
  });

  const system = `Sei il Tutor Attivo di Omnia per designer non tecnici.

REGOLE ASSOLUTE:
- Rispondi SOLO usando il MANUALE (chunk) fornito sotto. Non inventare. Non usare conoscenza esterna.
- Output: SOLO JSON valido come da schema. Nessun testo fuori dal JSON.

${WIZARD_PHASE_HINT}

${RESPONSE_SCHEMA}

UI_IDS whitelist:
${TUTOR_UI_IDS.join(', ')}

MANUALE (chunk RAG — NON usare nulla fuori da questo testo):
${manualChunk}`;

  const user = JSON.stringify({
    question: q,
    currentPhase: currentPhaseLabel,
    detectedPhase: detectedPhaseLabel || currentPhaseLabel,
    currentState,
  });

  const result = await aiProviderService.callAI(
    provider,
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    {
      model: model || undefined,
      temperature: 0.2,
      maxTokens: 900,
      purpose: 'TUTOR_FREE_QUESTION',
    }
  );

  const rawText = extractChatText(result);
  if (!rawText) {
    return { inManual: false, message: null };
  }

  const text = stripMarkdownJsonFence(rawText);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { inManual: false, message: null };
  }

  if (parsed.inManual !== true || !parsed.message || typeof parsed.message !== 'object') {
    return { inManual: false, message: null };
  }

  const msg = normalizeMessage(parsed.message);
  if (!msg.title && !msg.body) {
    return { inManual: false, message: null };
  }

  return { inManual: true, message: msg };
}

function normalizeMessage(raw) {
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const body = typeof raw.body === 'string' ? raw.body.trim() : '';
  const actions = Array.isArray(raw.actions)
    ? raw.actions
        .filter((a) => a && typeof a.icon === 'string' && typeof a.label === 'string')
        .map((a) => ({ icon: a.icon.trim(), label: a.label.trim() }))
    : [];
  const uiRefs = Array.isArray(raw.uiRefs)
    ? raw.uiRefs
        .filter(
          (u) =>
            u &&
            typeof u.elementId === 'string' &&
            TUTOR_UI_IDS.includes(u.elementId.trim()) &&
            typeof u.label === 'string'
        )
        .map((u) => ({
          elementId: u.elementId.trim(),
          label: u.label.trim(),
          type: ['glow', 'blink', 'pulse'].includes(u.type) ? u.type : 'glow',
        }))
    : [];
  let ensureView = raw.ensureView ?? null;
  const validEnsure = ['knowledgeBase', 'interface', 'backendMain', 'errorHandling'];
  if (ensureView !== null && !validEnsure.includes(ensureView)) {
    ensureView = null;
  }
  return {
    title: title || 'Tutor',
    body,
    actions,
    uiRefs,
    ensureView,
  };
}

function extractChatText(response) {
  const content = response?.choices?.[0]?.message?.content;
  return typeof content === 'string' ? content.trim() : '';
}

function stripMarkdownJsonFence(text) {
  const t = text.trim();
  const m = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(t);
  return m ? m[1].trim() : t;
}

module.exports = { answerTutorQuestion };
