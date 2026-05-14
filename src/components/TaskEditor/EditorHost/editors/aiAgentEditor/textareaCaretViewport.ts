/**
 * Viewport (fixed-position) coordinates for a caret index inside a `<textarea>`.
 * Vendored logic adapted from `textarea-caret-position` (MIT, component/io).
 */

const MIRROR_PROPERTIES = [
  'direction',
  'boxSizing',
  'width',
  'height',
  'overflowX',
  'overflowY',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontSizeAdjust',
  'lineHeight',
  'fontFamily',
  'textAlign',
  'textTransform',
  'textIndent',
  'textDecoration',
  'letterSpacing',
  'wordSpacing',
  'tabSize',
  'MozTabSize',
] as const;

function getCaretCoordinates(element: HTMLTextAreaElement, position: number): {
  top: number;
  left: number;
  height: number;
} {
  const isFirefox = typeof window !== 'undefined' && window.mozInnerScreenX != null;
  const div = document.createElement('div');
  document.body.appendChild(div);

  const style = div.style;
  const computed = window.getComputedStyle(element);

  style.whiteSpace = 'pre-wrap';
  style.wordWrap = 'break-word';

  style.position = 'absolute';
  style.visibility = 'hidden';

  for (const prop of MIRROR_PROPERTIES) {
    const key = prop as keyof CSSStyleDeclaration;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (style as any)[prop] = computed[key] as string;
  }

  if (isFirefox) {
    if (element.scrollHeight > Number.parseInt(computed.height, 10)) {
      style.overflowY = 'scroll';
    }
  } else {
    style.overflow = 'hidden';
  }

  div.textContent = element.value.substring(0, position);

  const span = document.createElement('span');
  span.textContent = element.value.substring(position) || '.';
  div.appendChild(span);

  const borderTop = Number.parseInt(computed.borderTopWidth, 10) || 0;
  const borderLeft = Number.parseInt(computed.borderLeftWidth, 10) || 0;
  const coordinates = {
    top: span.offsetTop + borderTop,
    left: span.offsetLeft + borderLeft,
    height: Number.parseInt(computed.lineHeight, 10) || 16,
  };

  document.body.removeChild(div);
  return coordinates;
}

/**
 * Returns the caret position in viewport coordinates (suitable for `position: fixed`).
 */
export function getTextareaCaretViewportPoint(
  element: HTMLTextAreaElement,
  position: number
): { top: number; left: number } | null {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return null;
  }
  const clamped = Math.max(0, Math.min(position, element.value.length));
  const coordinates = getCaretCoordinates(element, clamped);
  const rect = element.getBoundingClientRect();
  return {
    top: coordinates.top - element.scrollTop + rect.top,
    left: coordinates.left - element.scrollLeft + rect.left,
  };
}
