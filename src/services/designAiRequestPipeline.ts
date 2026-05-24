/**
 * Pipeline client per le chiamate HTTP di progettazione IA (rotte /design/* che invocano LLM):
 * limita le richieste concorrenti per ridurre tempeste dal browser.
 *
 * Config: `VITE_DESIGN_AI_MAX_IN_FLIGHT` (default 2, minimo 1).
 */

const DEFAULT_MAX_IN_FLIGHT = 2;

function parseMaxInFlight(): number {
  const raw = import.meta.env.VITE_DESIGN_AI_MAX_IN_FLIGHT;
  const n = typeof raw === 'string' ? parseInt(raw, 10) : typeof raw === 'number' ? raw : NaN;
  if (!Number.isFinite(n) || n < 1) return DEFAULT_MAX_IN_FLIGHT;
  return Math.min(32, Math.floor(n));
}

/** Pathname relativi all'origine (dev proxy) delle rotte LLM design-time. */
export const DESIGN_AI_LLM_PATH_PREFIXES = [
  '/design/ai-agent-generate',
  '/design/extract-structure',
  '/design/ai-agent-induce-style-rule',
  '/design/ai-agent-analyze-debug-turn',
  '/design/advancement-dsl-translate',
  '/design/tutor-question',
] as const;

function isDesignAiLlmRequestUrl(url: string): boolean {
  const u = url.trim();
  return DESIGN_AI_LLM_PATH_PREFIXES.some((p) => u === p || u.startsWith(`${p}?`));
}

class Semaphore {
  private current = 0;

  private readonly waiters: Array<() => void> = [];

  constructor(private readonly max: number) {}

  private acquireSync(): void {
    this.current += 1;
  }

  async acquire(): Promise<void> {
    if (this.current < this.max) {
      this.acquireSync();
      return;
    }
    await new Promise<void>((resolve) => {
      this.waiters.push(() => {
        this.acquireSync();
        resolve();
      });
    });
  }

  release(): void {
    this.current -= 1;
    const next = this.waiters.shift();
    if (next) next();
  }
}

const semaphore = new Semaphore(parseMaxInFlight());

/**
 * `fetch` verso le rotte design LLM, con limite di concorrenza; altre URL passano a `fetch` diretto.
 */
export async function designAiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.pathname + input.search
        : String(input);
  if (!isDesignAiLlmRequestUrl(url)) {
    return fetch(input, init);
  }
  await semaphore.acquire();
  try {
    return await fetch(input, init);
  } finally {
    semaphore.release();
  }
}
