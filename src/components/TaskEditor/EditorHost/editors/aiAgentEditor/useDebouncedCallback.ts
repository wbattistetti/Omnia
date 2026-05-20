/**
 * Returns a stable debounced callback (trailing edge) for high-frequency editors (Monaco).
 */

import React from 'react';

export function useDebouncedCallback<T extends (...args: never[]) => void>(
  fn: T,
  delayMs: number
): T {
  const fnRef = React.useRef(fn);
  fnRef.current = fn;
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return React.useCallback(
    ((...args: Parameters<T>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        fnRef.current(...args);
      }, delayMs);
    }) as T,
    [delayMs]
  );
}
