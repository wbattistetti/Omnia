export function emitSidebarRefresh() {
  try { document.dispatchEvent(new CustomEvent('sidebar:refresh', { bubbles: true })); } catch {}
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


