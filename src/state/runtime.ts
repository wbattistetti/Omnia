let currentProjectId: string | null = null;

export function setCurrentProjectId(id: string | null) {
  currentProjectId = id ?? null;
}

export function getCurrentProjectId(): string | null {
  return currentProjectId;
}

// Expose best-effort on window for browser-only consumers without Node typings
try {
  (window as any).__omniaRuntime = {
    getCurrentProjectId,
    setCurrentProjectId,
  };
} catch {}


