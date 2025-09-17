export type ConditionAIOutput = {
  label?: string;
  script?: string;
  question?: string;
  rationale?: string;
};

export type SuggestedCases = {
  trueCase?: Record<string, any>;
  falseCase?: Record<string, any>;
  hintTrue?: string;
  hintFalse?: string;
};

export type SuggestedVars = {
  selected: string[];
  rationale?: string;
};

const MODEL = 'llama-3.1-70b-instruct';

export async function generateConditionWithAI(nl: string, variables: string[]): Promise<ConditionAIOutput> {
  // Prefer backend endpoint to avoid exposing keys in frontend
  try {
    try { console.log('[ConditionAI][req][backend]', { url: '/api/conditions/generate', nlPreview: String(nl).slice(0, 160), varsCount: (variables || []).length }); } catch {}
    const res = await fetch('/api/conditions/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nl, variables })
    });
    const text = await res.text();
    try { console.log('[ConditionAI][res][backend]', { status: res.status, statusText: res.statusText, textPreview: text.slice(0, 300) }); } catch {}
    const data = text ? JSON.parse(text) : {};
    if (res.ok && !data.error) {
      return data as ConditionAIOutput;
    }
    // If backend returns an error, raise to UI
    throw new Error('backend_error: ' + (data?.error || res.statusText || 'unknown'));
  } catch (e) {
    // Network/backend unavailable: fallback to direct Groq only if explicitly enabled
    const envAny: any = (import.meta as any).env || {};
    const allowFallback = String(envAny.VITE_GROQ_FALLBACK_DIRECT || '').trim() === '1';
    if (!allowFallback) throw e;
    try { console.warn('[ConditionAI][fallback->directGroq]', e); } catch {}
  }

  const env: any = (import.meta as any).env || {};
  const apiKey = (env.VITE_GROQ_KEY as string | undefined) || (env.VITE_GROQ_API_KEY as string | undefined);
  if (!apiKey) throw new Error('Missing VITE_GROQ_KEY');

  // Build general, type-aware prompt with clarification protocol
  const sys = [
    'You are an expert backend engineer. You write boolean condition code and propose concise labels.',
    'Input: a natural-language description of a condition and the list of available variables (dotted names).',
    'Output policy:',
    '- If the description is sufficient, return JSON {"label":"...","script":"..."}.',
    '- If it is not sufficient, return ONLY {"question":"..."} asking one clear follow-up.',
    '- Never include comments or console.log in the script.',
    '- The script must be a single, safe JavaScript function body that returns true/false when executed, and only reference variables through vars["..."]',
    '- Always add null/undefined/format checks before using values.',
  ].join('\n');

  const guidelines = [
    'Guidelines by data type:',
    '- Date of Birth / age checks: compute age from date; true if age >= 18 (or other threshold). Handle parse errors and missing values by returning false.',
    '- Date comparisons: parse both dates (ISO preferred); compare getTime(); return boolean.',
    '- Email validity: basic robust regex; lowercase trim; return boolean.',
    '- Phone number validity: strip non-digits; check min length (>= 9) and optionally leading +; return boolean.',
    '- Strings: use trim(); contains/equals checks should be case-insensitive unless stated otherwise.',
    '- Numbers: coerce with Number(); guard against NaN.',
    '- Generic presence: return Boolean(vars["..."]) with appropriate type guard.',
    'Variable access: always use vars["Act.Main[.Sub]"] exactly as provided in the variables list.',
  ].join('\n');

  const examples = [
    'Example 1:',
    'NL: "l\'utente è maggiorenne"; Variables include "Agent asks for personal data.Date of Birth"',
    '{"label":"Utente maggiorenne","script":"try { const dob = vars[\"Agent asks for personal data.Date of Birth\"]; if (!dob) return false; const d = new Date(dob); if (isNaN(d.getTime())) return false; const now = new Date(); let age = now.getFullYear() - d.getFullYear(); const m = now.getMonth() - d.getMonth(); if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--; return age >= 18; } catch { return false; }"}',
    '',
    'Example 2:',
    'NL: "email valida"; Variables include "Agent asks...Email"',
    '{"label":"Email valida","script":"try { const v = (vars[\"Agent asks...Email\"] || \"\").toString().trim().toLowerCase(); if (!v) return false; const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; return re.test(v); } catch { return false; }"}',
  ].join('\n');

  const user = [
    'Natural language description:',
    nl,
    '',
    'Available variables (dotted):',
    variables.join(' | '),
    '',
    'Return only JSON per the Output policy.',
  ].join('\n');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: sys },
        { role: 'system', content: guidelines },
        { role: 'system', content: examples },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
      max_tokens: 900,
    }),
  });

  if (!res.ok) throw new Error('Groq API error');
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || '{}';
  try {
    const parsed = JSON.parse(text);
    return parsed as ConditionAIOutput;
  } catch {
    return { question: 'Potresti chiarire meglio la condizione?' };
  }
}

export async function suggestConditionCases(nl: string, variables: string[]): Promise<SuggestedCases> {
  try {
    const res = await fetch('/api/conditions/suggest-cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nl, variables })
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (res.ok && !data.error) return data as SuggestedCases;
    throw new Error(data?.error || res.statusText || 'backend_error');
  } catch (e) {
    try { console.warn('[ConditionAI][suggestCases][error]', e); } catch {}
    return {};
  }
}

export async function suggestMinimalVars(nl: string, variables: string[]): Promise<SuggestedVars> {
  try {
    const res = await fetch('/api/conditions/suggest-vars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nl, variables })
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (res.ok && !data.error) return data as SuggestedVars;
    throw new Error(data?.error || res.statusText || 'backend_error');
  } catch (e) {
    try { console.warn('[ConditionAI][suggestVars][error]', e); } catch {}
    return { selected: [] };
  }
}
