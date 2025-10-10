let currentProjectId: string | null = null;
let draft: boolean = false;
let tempId: string | null = null;

export function setCurrentProjectId(id: string | null) {
  currentProjectId = id ?? null;
}

export function getCurrentProjectId(): string | null {
  return currentProjectId;
}

export function setDraft(v: boolean) {
  draft = Boolean(v);
}

export function isDraft(): boolean {
  return draft;
}

export function setTempId(id: string | null) {
  tempId = id ?? null;
}

export function getTempId(): string | null {
  return tempId;
}

// Expose best-effort on window for browser-only consumers without Node typings
try {
  (window as any).__omniaRuntime = {
    getCurrentProjectId,
    setCurrentProjectId,
    isDraft,
    setDraft,
    getTempId,
    setTempId,
  };
} catch {}


