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
      body: JSON.stringify({ nl, variables, provider: (window as any).__AI_PROVIDER || undefined })
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

  // Build module-level prompt aligned to runtime (CONDITION + main(ctx), read from ctx[...])
  const sys = [
    'You are an expert backend engineer for our Condition DSL.',
    'Produce a complete JavaScript module that our runner executes as-is.',
    'Requirements:',
    'Define const CONDITION = { label: "<auto>", type: "predicate", inputs: ["<exact dotted key(s)>"] }.',
    'Define function main(ctx){ ... } that returns a boolean.',
    'Read inputs only from ctx["<exact dotted key>"] (case-sensitive, exactly as provided).',
    'Include any helper functions inline. No comments, no console.log, no external libs.',
    'Always guard null/undefined/format before using values.',
    'If the NL description is insufficient, return only {"question":"..."}.',
  ].join('\n');

  const guidelines = [
    'Guidelines by data type:',
    '- Date of Birth / age: parse explicitly; support dd/mm/yyyy and yyyy-mm-dd, Date instances and timestamps; invalid/missing ⇒ false; compute age in UTC and compare to threshold (default 18).',
    '- Date comparisons: parse both, compare getTime().',
    '- Email: basic robust regex; lowercase trim.',
    '- Phone: strip non-digits; length ≥ 9; optional leading +.',
    '- Strings: trim; case-insensitive unless stated otherwise.',
    '- Numbers: coerce with Number(); guard NaN.',
    '- Access variables strictly via ctx["Act.Main[.Sub]"] using the exact dotted keys provided.',
  ].join('\n');

  const examples = [
    'Example (age >= 18):',
    'NL: "utente maggiorenne"; Variables include "agents asks for personal data.Date of Birth"',
    '{"label":"Utente maggiorenne","script":"const CONDITION={label:\"Utente maggiorenne\",type:\"predicate\",inputs:[\"agents asks for personal data.Date of Birth\"]};function main(ctx){const k=\"agents asks for personal data.Date of Birth\";if(!ctx||!Object.prototype.hasOwnProperty.call(ctx,k))return false;const d=parseDate(ctx[k]);if(!d)return false;const t=new Date();let a=t.getUTCFullYear()-d.getUTCFullYear();const m=t.getUTCMonth()-d.getUTCMonth();if(m<0||(m===0&&t.getUTCDate()<d.getUTCDate()))a--;return a>=18;}function parseDate(v){if(v instanceof Date&&!Number.isNaN(v.valueOf()))return v;if(typeof v===\"number\"&&Number.isFinite(v))return new Date(v);if(typeof v===\"string\"){const s=v.trim();let m=s.match(/^(\\d{1,2})[\\/\\-](\\d{1,2})[\\/\\-](\\d{2,4})$/);if(m){let d=parseInt(m[1],10),mo=parseInt(m[2],10)-1,y=parseInt(m[3],10);if(y<100)y+=2000;const dt=new Date(Date.UTC(y,mo,d));return dt.getUTCFullYear()===y&&dt.getUTCMonth()===mo&&dt.getUTCDate()===d?dt:null;}m=s.match(/^(\\d{4})[\\/\\-](\\d{1,2})[\\/\\-](\\d{1,2})$/);if(m){const y=parseInt(m[1],10),mo=parseInt(m[2],10)-1,d=parseInt(m[3],10);const dt=new Date(Date.UTC(y,mo,d));return dt.getUTCFullYear()===y&&dt.getUTCMonth()===mo&&dt.getUTCDate()===d?dt:null;}const tt=Date.parse(s);if(!Number.isNaN(tt))return new Date(tt);}return null;}"}',
  ].join('\n');

  const user = [
    'Natural language description:',
    nl,
    '',
    'Available variables (dotted, exact):',
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

export async function suggestConditionCases(nl: string, variables: string[], provider?: 'groq'|'openai'): Promise<SuggestedCases> {
  try {
    const res = await fetch('/api/conditions/suggest-cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nl, variables, provider: provider ?? ((window as any).__AI_PROVIDER || undefined) })
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

export async function suggestMinimalVars(nl: string, variables: string[], provider?: 'groq'|'openai'): Promise<SuggestedVars> {
  try {
    const res = await fetch('/api/conditions/suggest-vars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nl, variables, provider: provider ?? ((window as any).__AI_PROVIDER || undefined) })
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

export async function repairCondition(script: string, failures: Array<any>, variables?: string[], provider?: 'groq'|'openai'):
  Promise<{ script?: string; error?: string; raw?: string }>
{
  try {
    const res = await fetch('/api/conditions/repair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script, failures, variables: variables || [], provider: provider ?? ((window as any).__AI_PROVIDER || undefined) })
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (res.ok && !data.error) return data as { script: string };
    return { error: String(data?.error || res.statusText || 'backend_error'), raw: text.slice(0, 400) };
  } catch (e: any) {
    return { error: String(e?.message || e) };
  }
}

export async function normalizePseudoCode(req: {
  chat: Array<{ role: 'user' | 'assistant'; content: string }>;
  pseudo: string;
  currentCode: string;
  variables: string[];
  mode?: 'predicate' | 'value' | 'object' | 'enum';
  provider?: 'groq' | 'openai';
  label?: string;
}): Promise<{ script?: string; error?: string }> {
  try {
    const res = await fetch('/api/conditions/normalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat: req.chat || [],
        pseudo: req.pseudo || '',
        currentCode: req.currentCode || '',
        variables: req.variables || [],
        mode: req.mode || 'predicate',
        provider: req.provider || undefined,
        label: req.label || undefined
      })
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    return data;
  } catch {
    return { error: 'network' };
  }
}
