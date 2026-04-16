/**
 * Bumps when FlowStateBridge debugger overlay changes so highlight hooks recompute.
 */
import { useEffect, useState } from 'react';

const EVENT = 'debugger-flow-highlight-change';

export function useDebuggerFlowHighlightVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    const onChange = () => setV((x) => x + 1);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return v;
}
