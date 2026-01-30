import { useState, useEffect, useMemo, useRef } from 'react';

/**
 * Helper: deep clone avoiding circular references and DOM elements
 */
function safeDeepClone(obj: any, visited = new WeakSet()): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (visited.has(obj)) return null; // Circular reference detected
  if (obj instanceof Date) return new Date(obj);
  if (obj instanceof RegExp) return new RegExp(obj);
  // Skip DOM elements, events, and React Fiber nodes
  if (obj instanceof HTMLElement || obj instanceof Event || obj instanceof Node ||
      (typeof obj === 'object' && obj.constructor && obj.constructor.name === 'FiberNode')) {
    return null;
  }

  visited.add(obj);

  if (Array.isArray(obj)) {
    return obj.map(item => safeDeepClone(item, visited));
  }

  const clone: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      // Skip React internal properties
      if (key.startsWith('__react') || key.startsWith('__Fiber') || key === 'stateNode') {
        continue;
      }
      try {
        clone[key] = safeDeepClone(obj[key], visited);
      } catch {
        // Skip properties that can't be cloned
        continue;
      }
    }
  }

  return clone;
}

// ❌ RIMOSSO: coercePhoneKind, ensureStepsForNode, preserveStepsFromPrev
// Non serve più backward compatibility con vecchio modello DDT (.data[])

/**
 * Hook for initializing and managing DDT state in ResponseEditor.
 * Handles phone kind coercion, steps preservation, and synchronization from props.
 */
export function useDDTInitialization(
  ddt: any,
  wizardOwnsDataRef: React.RefObject<boolean>,
  mergedTranslationsBase: Record<string, string>,
  onSelectionReset?: () => void
) {
  // ✅ NUOVO MODELLO: Usa direttamente TaskTree (non più backward compatibility)
  const [localDDT, setLocalDDT] = useState<any>(ddt);

  // Track last DDT ID to avoid unnecessary resets
  const lastDDTIdRef = useRef<string | null>(null);

  // Synchronize from prop when DDT changes
  useEffect(() => {
    // Don't sync from prop if wizard owns the data
    if (wizardOwnsDataRef.current) {
      return;
    }

    const prevId = (localDDT && (localDDT.id || localDDT._id)) as any;
    const nextId = (ddt && (ddt.id || ddt._id)) as any;
    const isSameDDT = prevId && nextId && prevId === nextId;

    // Sync ONLY if it's a different DDT (ID changed) or first load
    const shouldSync = !prevId || !nextId || !isSameDDT;

    if (shouldSync && localDDT !== ddt) {
      setLocalDDT(ddt);
    }

    // Reset selection ONLY when a different DDT is opened (not on every render)
    const ddtIdString = nextId || 'no-id';
    if (lastDDTIdRef.current !== ddtIdString && !isSameDDT && onSelectionReset) {
      lastDDTIdRef.current = ddtIdString;
      onSelectionReset();
    } else if (lastDDTIdRef.current === null && nextId) {
      // First load - track the ID but don't reset (selection is already initialized)
      lastDDTIdRef.current = ddtIdString;
    }
  }, [ddt, localDDT, wizardOwnsDataRef, onSelectionReset]);

  return {
    localDDT,
    setLocalDDT,
  };
}

