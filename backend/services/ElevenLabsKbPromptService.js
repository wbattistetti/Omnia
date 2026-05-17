/**
 * LLM helpers for ElevenLabs workspace KB snippets (Markdown) and aggregated system prompts.
 */

const { assertAiCallContract } = require('./aiCallContract');

const SNIPPET_SYSTEM = `You write ConvAI agent system-prompt fragments in Markdown (Italian or English per user request).
Rules:
- Output ONLY Markdown. No JSON. Do not wrap the entire answer in a single outer code fence.
- Use section headings (##) when useful.
- Mention each variable using the exact {{placeholder}} provided (e.g. {{id}}, {{nome}}).
- Be concise: role of this knowledge base, when to use it, how to read columns/fields, 5–12 bullet rules max.
- Do not invent variables not listed.`;

const AGGREGATE_SYSTEM = `You merge multiple knowledge-base (KB) Markdown fragments into one coherent agent system prompt in Markdown.
Rules:
- Output ONLY Markdown. No JSON. No outer code fence wrapping everything.
- Start with a short ## Ruolo / ## Scopo generale if missing.
- For each document, keep a ## KB: <document name> section integrating the local snippet.
- Preserve all {{variable}} placeholders exactly as given across documents.
- Remove duplication; resolve conflicts by stating precedence clearly.
- Be actionable for a voice/chat agent.`;

function extractMarkdownContent(response) {
  const content = response?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Model returned empty content');
  }
  let out = content.trim();
  if (out.startsWith('```')) {
    out = out.replace(/^```(?:markdown|md)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  }
  return out;
}

/**
 * @param {object} params
 * @param {string} params.documentName
 * @param {string} params.howToUse
 * @param {Array<{ sourceColumn: string, placeholder: string }>} params.variables
 * @param {string} [params.existingMarkdown]
 * @param {string} params.provider
 * @param {string} params.model
 * @param {import('./AIProviderService')} params.aiProviderService
 * @param {string} [params.outputLanguage]
 */
async function generateKbDocumentSnippetMarkdown({
  documentName,
  howToUse,
  variables,
  existingMarkdown,
  provider,
  model,
  aiProviderService,
  outputLanguage,
  purpose,
  taskId,
  taskLabel,
}) {
  const contract = assertAiCallContract({ provider, model, action: 'KB snippet' });
  const how = String(howToUse || '').trim();
  if (how.length < 8) {
    throw new Error('howToUse must be at least 8 characters');
  }
  const varLines =
    Array.isArray(variables) && variables.length > 0
      ? variables.map((v) => `- Column «${v.sourceColumn}» → ${v.placeholder}`).join('\n')
      : '- (no variables detected)';

  const lang =
    typeof outputLanguage === 'string' && outputLanguage.trim()
      ? outputLanguage.trim()
      : 'it-IT';

  const refine = typeof existingMarkdown === 'string' && existingMarkdown.trim().length > 0;
  const userContent = refine
    ? `Refine the Markdown snippet below using the designer notes. Keep valid {{placeholders}}.

Document: ${documentName}
Output language: ${lang}

Variables:
${varLines}

Designer notes:
${how}

Current snippet:
${existingMarkdown.trim()}

Return the improved Markdown only.`
    : `Write a new Markdown KB snippet for this document.

Document file name: ${documentName}
Output language: ${lang}

Designer description (how the agent should use this data):
${how}

Available variables (use these placeholders in the text):
${varLines}

Return Markdown only.`;

  const response = await aiProviderService.callAI(
    contract.provider,
    [
      { role: 'system', content: SNIPPET_SYSTEM },
      { role: 'user', content: userContent },
    ],
    {
      model: contract.model,
      temperature: 0.35,
      maxTokens: contract.provider === 'openai' ? 2048 : 4096,
      purpose: purpose || 'EL_KB_SNIPPET',
      taskId,
      taskLabel,
    }
  );

  return extractMarkdownContent(response);
}

/**
 * @param {object} params
 * @param {Array<{ documentName: string, nodeLabel?: string, markdownSnippet: string, variables?: Array<{ sourceColumn: string, placeholder: string }> }>} params.localSnippets
 * @param {string} [params.existingPromptMarkdown]
 */
async function aggregateKbSystemPromptMarkdown({
  localSnippets,
  existingPromptMarkdown,
  provider,
  model,
  aiProviderService,
  outputLanguage,
  purpose,
  taskId,
  taskLabel,
}) {
  const contract = assertAiCallContract({ provider, model, action: 'KB aggregate prompt' });
  const snippets = Array.isArray(localSnippets) ? localSnippets.filter((s) => s?.markdownSnippet?.trim()) : [];
  if (snippets.length === 0) {
    throw new Error('At least one local Markdown snippet is required to aggregate');
  }

  const lang =
    typeof outputLanguage === 'string' && outputLanguage.trim()
      ? outputLanguage.trim()
      : 'it-IT';

  const blocks = snippets
    .map((s, i) => {
      const vars =
        Array.isArray(s.variables) && s.variables.length > 0
          ? s.variables.map((v) => `${v.placeholder} (${v.sourceColumn})`).join(', ')
          : '';
      return `### Document ${i + 1}: ${s.documentName}${s.nodeLabel ? ` (node: ${s.nodeLabel})` : ''}
Variables: ${vars || '—'}
---
${String(s.markdownSnippet).trim()}
---`;
    })
    .join('\n\n');

  const refine =
    typeof existingPromptMarkdown === 'string' && existingPromptMarkdown.trim().length > 0;

  const userContent = refine
    ? `Merge and refine into one system prompt (Markdown). Language: ${lang}

Current system prompt:
${existingPromptMarkdown.trim()}

Local KB snippets:
${blocks}

Return the full merged Markdown system prompt only.`
    : `Build one unified agent system prompt (Markdown) from these local KB snippets. Language: ${lang}

${blocks}

Return the full Markdown system prompt only.`;

  const response = await aiProviderService.callAI(
    contract.provider,
    [
      { role: 'system', content: AGGREGATE_SYSTEM },
      { role: 'user', content: userContent },
    ],
    {
      model: contract.model,
      temperature: 0.35,
      maxTokens: contract.provider === 'openai' ? 4096 : 8192,
      purpose: purpose || 'EL_KB_AGGREGATE',
      taskId,
      taskLabel,
    }
  );

  return extractMarkdownContent(response);
}

const REFINE_SYSTEM = `You improve ConvAI agent system prompts written in Markdown.
Rules:
- Output ONLY Markdown. No JSON. No outer code fence wrapping everything.
- Preserve every {{variable}} placeholder exactly as written.
- Keep structure clear (## headings): role, behavior, KB usage, constraints.
- Be concise and actionable for voice/chat agents.`;

/**
 * @param {object} params
 * @param {string} params.existingPromptMarkdown
 */
async function refineSystemPromptMarkdown({
  existingPromptMarkdown,
  provider,
  model,
  aiProviderService,
  outputLanguage,
  purpose,
  taskId,
  taskLabel,
}) {
  const contract = assertAiCallContract({ provider, model, action: 'KB refine system prompt' });
  const text = String(existingPromptMarkdown || '').trim();
  if (text.length < 12) {
    throw new Error('existingPromptMarkdown must be at least 12 characters');
  }

  const lang =
    typeof outputLanguage === 'string' && outputLanguage.trim()
      ? outputLanguage.trim()
      : 'it-IT';

  const response = await aiProviderService.callAI(
    contract.provider,
    [
      { role: 'system', content: REFINE_SYSTEM },
      {
        role: 'user',
        content: `Refine this agent system prompt (Markdown). Language: ${lang}

---
${text}
---

Return the improved Markdown only.`,
      },
    ],
    {
      model: contract.model,
      temperature: 0.35,
      maxTokens: contract.provider === 'openai' ? 4096 : 8192,
      purpose: purpose || 'EL_KB_REFINE_PROMPT',
      taskId,
      taskLabel,
    }
  );

  return extractMarkdownContent(response);
}

/**
 * Success: raw Markdown body (not JSON) for Monaco / text clients.
 * @param {import('express').Response} res
 * @param {string} markdown
 */
function sendKbMarkdownHttpResponse(res, markdown) {
  const text = String(markdown ?? '').trim();
  if (!text) {
    res.status(502).json({ success: false, error: 'Model returned empty Markdown' });
    return;
  }
  res
    .status(200)
    .type('text/markdown; charset=utf-8')
    .set('X-Omnia-Response-Format', 'markdown')
    .send(text);
}

module.exports = {
  generateKbDocumentSnippetMarkdown,
  aggregateKbSystemPromptMarkdown,
  refineSystemPromptMarkdown,
  sendKbMarkdownHttpResponse,
};
