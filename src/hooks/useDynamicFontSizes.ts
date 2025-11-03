import { useFontStore } from '../state/fontStore';

/**
 * Hook per ottenere font sizes dinamici basati sulle preferenze globali
 * Invece di usare costanti hardcoded, questi valori si adattano alle preferenze utente
 */
export function useDynamicFontSizes() {
  const { fontSize } = useFontStore();

  // Mappatura fontSize (xs, sm, base, md, lg) a valori pixel
  // Questi valori sono proporzionali alle classi text-intent-* definite in tailwind.config.js
  const sizeMap = {
    xs: { nodeTitle: '10px', nodeRow: '10px', edgeCaption: '10px' },
    sm: { nodeTitle: '12px', nodeRow: '12px', edgeCaption: '12px' },
    base: { nodeTitle: '14px', nodeRow: '14px', edgeCaption: '14px' },
    md: { nodeTitle: '16px', nodeRow: '16px', edgeCaption: '16px' },
    lg: { nodeTitle: '18px', nodeRow: '18px', edgeCaption: '18px' },
  };

  return sizeMap[fontSize];
}

