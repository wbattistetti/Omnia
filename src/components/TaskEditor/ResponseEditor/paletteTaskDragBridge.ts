/**
 * Bridge react-dnd (palette TASK_VIEWER) ↔ @dnd-kit (lista use case): mentre si trascina
 * un'azione dal catalogo, i sensori dnd-kit si disattivano così il drop HTML5 nel response
 * non compete con PointerSensor sulla stessa superficie.
 */

type Listener = (active: boolean) => void;

let paletteDragActive = false;
const listeners = new Set<Listener>();

export function getPaletteTaskDragActive(): boolean {
  return paletteDragActive;
}

export function setPaletteTaskDragActive(active: boolean): void {
  if (paletteDragActive === active) return;
  paletteDragActive = active;
  for (const listener of listeners) {
    listener(active);
  }
}

export function subscribePaletteTaskDrag(listener: Listener): () => void {
  listeners.add(listener);
  listener(paletteDragActive);
  return () => {
    listeners.delete(listener);
  }
}
