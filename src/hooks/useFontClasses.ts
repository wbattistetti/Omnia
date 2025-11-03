import { useFontStore } from '../state/fontStore';

/**
 * Hook per ottenere le classi CSS Tailwind per font type e size
 * basate sulle preferenze globali dallo store
 */
export function useFontClasses() {
  const { fontType, fontSize } = useFontStore();

  const fontTypeClass = {
    sans: 'font-intent-sans',
    serif: 'font-intent-serif',
    mono: 'font-intent-mono',
  }[fontType];

  const fontSizeClass = {
    xs: 'text-intent-xs',
    sm: 'text-intent-sm',
    base: 'text-intent-base',
    md: 'text-intent-md',
    lg: 'text-intent-lg',
  }[fontSize];

  return {
    fontTypeClass,
    fontSizeClass,
    combinedClass: `${fontTypeClass} ${fontSizeClass}`,
    fontType,
    fontSize,
  };
}

