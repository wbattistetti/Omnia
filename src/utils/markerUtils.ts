// src/utils/markerUtils.ts
export function normalizeMarkerEnd(markerEnd?: string) {
  if (!markerEnd) return undefined;
  if (markerEnd.startsWith('url(')) {
    // Se già url(#...), estrai solo l'id
    const match = markerEnd.match(/url\(#([^)]+)\)/);
    return match ? match[1] : markerEnd;
  }
  return markerEnd;
} 