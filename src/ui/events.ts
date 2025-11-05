let __sidebarRefreshTimer: any = null;
export function emitSidebarRefresh(delay: number = 60) {
  try {
    if (__sidebarRefreshTimer) {
      clearTimeout(__sidebarRefreshTimer);
    }
    __sidebarRefreshTimer = setTimeout(() => {
      try { document.dispatchEvent(new CustomEvent('sidebar:refresh', { bubbles: true })); } catch {}
      __sidebarRefreshTimer = null;
    }, Math.max(0, delay | 0));
  } catch {}
}

export function emitSidebarForceRender() {
  try { document.dispatchEvent(new CustomEvent('sidebar:forceRender', { bubbles: true })); } catch {}
}

export function emitSidebarOpenAccordion(entityType: string) {
  try { document.dispatchEvent(new CustomEvent('sidebar:openAccordion', { detail: { entityType }, bubbles: true })); } catch {}
}

export function emitSidebarHighlightItem(entityType: string, itemName: string) {
  try { document.dispatchEvent(new CustomEvent('sidebar:highlightItem', { detail: { entityType, itemName }, bubbles: true })); } catch {}
}

// Condition editor events
export function emitConditionEditorOpen(detail: { variables?: any; script?: string; label?: string; name?: string }) {
  try { document.dispatchEvent(new CustomEvent('conditionEditor:open', { detail, bubbles: true })); } catch {}
}
export function emitConditionEditorSave(script: string) {
  try { document.dispatchEvent(new CustomEvent('conditionEditor:save', { detail: { script }, bubbles: true })); } catch {}
}
export function emitConditionEditorRename(label: string) {
  try { document.dispatchEvent(new CustomEvent('conditionEditor:rename', { detail: { label }, bubbles: true })); } catch {}
}

// Non-interactive editor events
export function emitNonInteractiveEditorOpen(detail: { title?: string; template: string; instanceId?: string; accentColor?: string }) {
  try { document.dispatchEvent(new CustomEvent('nonInteractiveEditor:open', { detail, bubbles: true })); } catch {}
}

// Act Editor Host events
export function emitActEditorOpen(detail: { id: string; type: string; label?: string }) {
  try { document.dispatchEvent(new CustomEvent('actEditor:open', { detail, bubbles: true })); } catch {}
}

// Tutor events
export function emitTutorOpen(tutorId: string) {
  try { document.dispatchEvent(new CustomEvent('tutor:open', { detail: { tutorId }, bubbles: true })); } catch {}
}

