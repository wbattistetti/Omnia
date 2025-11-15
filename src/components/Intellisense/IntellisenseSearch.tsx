import Fuse from 'fuse.js';
import { IntellisenseItem, IntellisenseResult, IntellisenseSearchOptions } from './IntellisenseTypes';

// Groq API configuration
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama3-70b-8192';
const MAX_ITEMS_IN_PROMPT = 200; // hard cap to avoid 400 payload too large
const MAX_FIELD_LEN = 120; // trim long descriptions

// Simple multilingual concept dictionary (IT/EN) to bias selection
const CONCEPT_SYNONYMS: Record<string, string[]> = {
  name: ['name', 'full name', 'first name', 'last name', 'surname', 'nome', 'nominativo', 'cognome'],
  email: ['email', 'e-mail', 'mail', 'posta', 'indirizzo email', 'address email'],
  phone: ['phone', 'telephone', 'cell', 'mobile', 'numero', 'telefono', 'cellulare'],
  address: ['address', 'indirizzo', 'via', 'civico', 'cap', 'postal code', 'postcode', 'city', 'città'],
};

function normalizeText(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectConceptFrom(text: string): string | null {
  const t = normalizeText(text);
  let best: { concept: string | null; hits: number } = { concept: null, hits: 0 };
  for (const [concept, words] of Object.entries(CONCEPT_SYNONYMS)) {
    const hits = words.reduce((acc, w) => (t.includes(normalizeText(w)) ? acc + 1 : acc), 0);
    if (hits > best.hits) best = { concept, hits };
  }
  return best.concept;
}

function conceptMatches(text: string, concept: string | null): boolean {
  if (!concept) return true;
  const t = normalizeText(text);
  const words = CONCEPT_SYNONYMS[concept] || [];
  return words.some(w => t.includes(normalizeText(w)));
}

// Default search configuration
const DEFAULT_SEARCH_OPTIONS: IntellisenseSearchOptions = {
  threshold: 0.4, // More permissive for typos
  includeScore: true,
  includeMatches: true,
  keys: [
    'label', 'shortLabel', 'description'
  ]
};

let fuseInstance: Fuse<IntellisenseItem> | null = null;

/**
 * Initialize the Fuse.js instance with intellisense data
 */
export function initializeFuzzySearch(items: IntellisenseItem[]): void {
  fuseInstance = new Fuse(items, DEFAULT_SEARCH_OPTIONS);
}

/**
 * Custom search: AND tra parole chiave (min 2 caratteri), match su inizio parola del titolo
 */
export function performFuzzySearch(query: string, items?: IntellisenseItem[]): IntellisenseResult[] {
  const raw = (query || '').trim();
  if (!raw) return [];

  // Usa tutti gli item se non passati (fallback per compatibilità)
  const allItems = items || (fuseInstance ? (fuseInstance as any)._docs : []);

  // Token della query separati da spazi
  // Includiamo tutti i token, anche quelli di 1 carattere, per evitare match errati
  // Es: "chiedi X" non deve matchare "chiedi data visita" se "X" non matcha
  const allTokens = raw
    .toLowerCase()
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length >= 1);

  if (allTokens.length === 0) return [];

  // Filtriamo solo i token di lunghezza >= 2 per la ricerca normale
  // Ma se ci sono token filtrati, dobbiamo verificare che TUTTI i token matchano
  const tokens = allTokens.filter(t => t.length >= 2);
  const shortTokens = allTokens.filter(t => t.length === 1);

  // Normalizzazione: minuscole, rimozione accenti, compattazione spazi/underscore/trattini
  const normalize = (s: string) =>
    (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9\s_-]/g, ' ')
      .replace(/[\s_-]+/g, ' ')
      .trim();

  const tokenizeFields = (item: IntellisenseItem): string[] => {
    const fields: string[] = [
      item.label,
      item.shortLabel,
      item.description,
      (item as any).name,
      ...(Array.isArray((item as any).tags) ? (item as any).tags : []),
    ].filter((f): f is string => typeof f === 'string' && f.trim() !== '');

    const words = fields
      .map(f => normalize(f))
      .join(' ')
      .split(/\s+/)
      .filter(Boolean);
    return words;
  };

  const results = allItems
    .map((item: IntellisenseItem) => {
      const words = tokenizeFields(item);
      const normalizedText = words.join(' ');

      // Verifica che TUTTI i token (inclusi quelli di 1 carattere) matchano
      // Token lunghi: devono essere all'inizio di una parola
      // Token corti: devono essere all'inizio di una parola o essere una parola completa
      const allTokensMatch = allTokens.every(tok => {
        if (tok.length >= 2) {
          // Token lungo: deve essere all'inizio di una parola
          return words.some(w => w.startsWith(tok));
        } else {
          // Token corto (1 carattere): deve essere all'inizio di una parola o essere una parola completa
          return words.some(w => w === tok || w.startsWith(tok));
        }
      });

      try {
        if (localStorage.getItem('debug.intellisense') === '1') {
          console.log('[Intellisense][matchDbg]', {
            label: item.label,
            words,
            allTokens,
            tokens,
            shortTokens,
            allTokensMatch
          });
        }
      } catch { }
      return allTokensMatch ? ({ item, score: 0 } as IntellisenseResult) : null;
    })
    .filter(Boolean) as IntellisenseResult[];

  return results;
}

/**
 * Highlight custom: solo inizio delle parole matchate
 */
export function highlightMatches(text: string, matches?: Array<{ indices: [number, number][] }>): React.ReactNode {
  if (!matches || matches.length === 0 || !matches[0].indices || matches[0].indices.length === 0) {
    return text;
  }
  const indices = matches[0].indices;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  // Ordina gli indici per start crescente
  const sortedIndices = [...indices].sort((a, b) => a[0] - b[0]);

  sortedIndices.forEach(([start, end], index) => {
    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start));
    }
    parts.push(
      <span key={index} className="font-bold underline decoration-1 underline-offset-2">
        {text.slice(start, end + 1)}
      </span>
    );
    lastIndex = end + 1;
  });
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

/**
 * Group search results by category and sort them
 */
export function groupAndSortResults(results: IntellisenseResult[]): Map<string, IntellisenseResult[]> {
  const grouped = new Map<string, IntellisenseResult[]>();

  // Define category priority order
  const categoryOrder = ['agentActs', 'userActs', 'backendActions', 'conditions', 'macrotasks'];

  results.forEach(result => {
    const category = result.item.categoryType;
    if (!grouped.has(category)) {
      grouped.set(category, []);
    }
    grouped.get(category)!.push(result);
  });

  // Sort results within each category by score (lower is better for Fuse.js)
  grouped.forEach(categoryResults => {
    categoryResults.sort((a, b) => (a.score || 0) - (b.score || 0));
  });

  // Return categories in priority order
  const sortedGrouped = new Map<string, IntellisenseResult[]>();
  categoryOrder.forEach(category => {
    if (grouped.has(category)) {
      sortedGrouped.set(category, grouped.get(category)!);
    }
  });

  return sortedGrouped;
}

/**
 * Build semantic search prompt for Groq
 */
function buildSemanticPrompt(items: IntellisenseItem[], query: string): string {
  const itemsList = items.map(item => {
    const name = String(item.name || item.label || '').slice(0, MAX_FIELD_LEN).replace(/\n/g, ' ');
    const discursive = String(item.description || item.shortLabel || name).slice(0, MAX_FIELD_LEN).replace(/\n/g, ' ');
    return `- [${item.id}, "${name}", "${discursive}"]`;
  }).join('\n');

  return `You are an assistant that maps a user query to predefined system items.

List of items:
[id, name, discursive, description]:
${itemsList}

User query:
"${query}"

Return ONLY a JSON array of the most relevant matches, sorted by relevance.
Format:
[
  {"id": "<ITEM_ID>", "score": <RELEVANCE_SCORE_FLOAT>}
]
Do NOT include any explanations or extra text.`;
}

/**
 * Call Groq API for semantic search
 */
async function callGroqAPI(prompt: string): Promise<any> {
  const apiKey = import.meta.env.VITE_GROQ_KEY;

  if (!apiKey) {
    console.error('[Intellisense][Groq] Missing VITE_GROQ_KEY');
    throw new Error('Groq API key not found. Make sure VITE_GROQ_KEY is set in your environment variables');
  }

  const body = {
    model: GROQ_MODEL,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.1,
    max_tokens: 512,
    response_format: { type: 'json_object' }
  } as any;

  try { console.log('[Intellisense][Groq][request]', { url: GROQ_API_URL, model: GROQ_MODEL, promptPreview: String(prompt).slice(0, 400) + (prompt.length > 400 ? '…' : '') }); } catch { }

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  try { console.log('[Intellisense][Groq][response]', { status: response.status, statusText: response.statusText, textPreview: text.slice(0, 400) + (text.length > 400 ? '…' : '') }); } catch { }

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status} ${response.statusText}`);
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    console.error('[Intellisense][Groq][parseError]', e);
    throw e;
  }
}

/**
 * Semantic search using Groq/Llama
 */
export async function performSemanticSearch(query: string, allItems: IntellisenseItem[]): Promise<IntellisenseResult[]> {
  try {
    // Lightweight prefilter to shrink payload drastically
    const q = normalizeText(query);
    const tokens = q.split(/\s+/).filter(Boolean);
    const haystack = (it: IntellisenseItem) => normalizeText(`${it.name || it.label || ''} ${it.shortLabel || ''} ${it.description || ''}`);

    const queryConcept = detectConceptFrom(q);
    let candidates = allItems.filter(it => tokens.every(t => haystack(it).includes(t)));
    if (candidates.length === 0) {
      // fallback: any token
      candidates = allItems.filter(it => tokens.some(t => haystack(it).includes(t)));
    }
    // bias by concept: keep only items matching the dominant concept if we have any
    if (queryConcept) {
      const conceptCandidates = candidates.filter(it => conceptMatches(haystack(it), queryConcept));
      if (conceptCandidates.length > 0) candidates = conceptCandidates;
    }
    if (candidates.length === 0) {
      candidates = allItems.slice(0, MAX_ITEMS_IN_PROMPT);
    }
    // hard cap and trim overly long fields
    const capped = candidates.slice(0, MAX_ITEMS_IN_PROMPT);

    try { console.log('[Intellisense][Groq][candidates]', { total: allItems.length, filtered: capped.length, query }); } catch { }

    // Build prompt for Groq
    const prompt = buildSemanticPrompt(capped, query);

    // Call Groq API
    const response = await callGroqAPI(prompt);

    // Extract content from response
    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No content in Groq response');
    }

    // Parse JSON response (accept array or wrapped object)
    let semanticMatches: Array<{ id: string; score: number }> | null = null;
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        semanticMatches = parsed;
      } else if (parsed && typeof parsed === 'object') {
        const maybe = (parsed.matches || parsed.items || parsed.results || parsed.data);
        if (Array.isArray(maybe)) {
          semanticMatches = maybe;
        }
      }
    } catch (parseError) {
      // fall through; will treat as invalid
    }
    if (!semanticMatches) {
      throw new Error('Groq response is not an array');
    }

    // Map IDs to IntellisenseItems
    let results: IntellisenseResult[] = [];
    const itemsMap = new Map(allItems.map(item => [item.id, item]));

    for (const match of semanticMatches) {
      if (match.id && typeof match.score === 'number') {
        const item = itemsMap.get(match.id);
        if (item) {
          results.push({
            item,
            score: match.score
          });
        }
      }
    }

    // Post-filter: if query has a concept and there are matches for it, drop conflicting concepts
    if (queryConcept) {
      const conceptMatchesOnly = results.filter(r => conceptMatches(`${(r.item as any).name || (r.item as any).label || ''} ${(r.item as any).description || ''}`, queryConcept));
      if (conceptMatchesOnly.length > 0) results = conceptMatchesOnly;
    }

    // Hybrid re-ranking: add a simple lexical bonus
    const tokenSet = new Set(tokens);
    results = results
      .map(r => {
        const text = haystack(r.item as any);
        const overlap = Array.from(tokenSet).reduce((acc, t) => (text.includes(t) ? acc + 1 : acc), 0);
        const lexBonus = Math.min(1, overlap / Math.max(1, tokens.length));
        const combined = 0.6 * (typeof r.score === 'number' ? r.score : 0) + 0.4 * lexBonus;
        return { ...r, score: combined } as IntellisenseResult;
      })
      .sort((a, b) => (b.score || 0) - (a.score || 0));
    try { console.log('[Intellisense][Groq][mappedResults]', { count: results.length, top: results.slice(0, 5).map(r => ({ id: r.item.id, name: (r.item as any).name || (r.item as any).label, score: r.score })) }); } catch { }

    return results;

  } catch (error) {
    console.error('[Intellisense][Groq][error]', error);
    // Return empty results on error to not break the UI
    return [];
  }
}

/**
 * Legacy semantic search function (kept for compatibility)
 */
export async function performSemanticSearchLegacy(query: string): Promise<IntellisenseResult[]> {
  // Return empty results for now
  return [];
}
