import Fuse from 'fuse.js';
import { IntellisenseItem, IntellisenseResult, IntellisenseSearchOptions } from './IntellisenseTypes';

// Groq API configuration
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama3-70b-8192';

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
  if (!query.trim()) return [];

  // Usa tutti gli item se non passati (fallback per compatibilità)
  const allItems = items || (fuseInstance ? (fuseInstance as any)._docs : []);

  const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length >= 1);
  if (keywords.length === 0) return [];

  const results = allItems
    .map((item: IntellisenseItem) => {
      // Cerca su label, shortLabel e description
      const fields = [item.label, item.shortLabel, item.description].filter((f): f is string => typeof f === 'string' && f.trim() !== '').map(f => f.toLowerCase());
      const words = fields.join(' ').split(/\s+/);
      // AND logico: ogni keyword deve matchare almeno una parola di uno dei campi
      const allMatched = keywords.every(k => words.some(w => w.startsWith(k)));
      if (!allMatched) return null;
      // Highlight: per ogni parola, se matcha una keyword, segna la lunghezza
      const highlights = words.map(w => {
        const kw = keywords.find(k => w.startsWith(k));
        return kw ? { word: w, highlightLength: kw.length } : { word: w, highlightLength: 0 };
      });
      return {
        item,
        score: 0,
        matches: [{ indices: highlights
          .flatMap((h, i) => h.highlightLength > 0 ? [[words.slice(0, i).join(' ').length + (i > 0 ? 1 : 0), words.slice(0, i).join(' ').length + h.highlightLength - 1 + (i > 0 ? 1 : 0)]] : [])
        }]
      };
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
  const categoryOrder = ['agentActs', 'userActs', 'backendActions', 'conditions', 'tasks', 'macrotasks'];
  
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
    const discursive = item.description || item.name;
    return `- [${item.id}, "${item.name}", "${discursive}", "${item.description || ''}"]`;
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
    throw new Error('Groq API key not found. Make sure VITE_GROQ_KEY is set in your environment variables');
  }

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Semantic search using Groq/Llama
 */
export async function performSemanticSearch(query: string, allItems: IntellisenseItem[]): Promise<IntellisenseResult[]> {
  try {
    // Build prompt for Groq
    const prompt = buildSemanticPrompt(allItems, query);
    
    // Call Groq API
    const response = await callGroqAPI(prompt);
    
    // Extract content from response
    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No content in Groq response');
    }
    
    // Parse JSON response
    let semanticMatches: Array<{ id: string; score: number }>;
    try {
      semanticMatches = JSON.parse(content);
    } catch (parseError) {
      throw new Error('Invalid JSON response from Groq');
    }
    
    // Validate response format
    if (!Array.isArray(semanticMatches)) {
      throw new Error('Groq response is not an array');
    }
    
    // Map IDs to IntellisenseItems
    const results: IntellisenseResult[] = [];
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
    
    return results;
    
  } catch (error) {
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
