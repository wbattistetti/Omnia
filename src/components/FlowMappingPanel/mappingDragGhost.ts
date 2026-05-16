/**
 * HTML5 drag preview: semi-transparent label chip following the pointer.
 */

/** Attaches a custom drag image; removes the ghost element on dragend. */
export function setMappingDragLabelGhost(
  e: React.DragEvent,
  label: string,
  opts?: { offsetX?: number; offsetY?: number }
): void {
  const text = String(label ?? '').trim();
  if (!text) return;
  const ghost = document.createElement('div');
  ghost.textContent = text;
  Object.assign(ghost.style, {
    position: 'fixed',
    top: '-200px',
    left: '-200px',
    zIndex: '2147483647',
    padding: '4px 10px',
    background: 'rgba(15, 23, 42, 0.88)',
    border: '1px solid rgba(56, 189, 248, 0.55)',
    borderRadius: '6px',
    boxShadow: '0 6px 18px rgba(0,0,0,0.45)',
    color: 'rgba(226, 232, 240, 0.95)',
    fontSize: '11px',
    fontWeight: '600',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    opacity: '0.92',
  });
  document.body.appendChild(ghost);
  ghost.getBoundingClientRect();
  const ox = opts?.offsetX ?? 10;
  const oy = opts?.offsetY ?? 10;
  try {
    e.dataTransfer.setDragImage(ghost, ox, oy);
  } catch {
    /* ignore */
  }
  const rm = () => {
    ghost.remove();
    document.removeEventListener('dragend', rm);
  };
  document.addEventListener('dragend', rm);
}
