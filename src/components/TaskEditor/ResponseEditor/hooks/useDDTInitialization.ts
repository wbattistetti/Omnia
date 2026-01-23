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

/**
 * Helper: enforce phone kind by label when missing/mis-set
 */
function coercePhoneKind(src: any) {
  if (!src) return src;
  try {
    const clone = safeDeepClone(src);
    if (!clone) return src; // If clone failed, return original

    const mains = Array.isArray(clone?.data) ? clone.data : [];
    for (const m of mains) {
      const label = String(m?.label || '').toLowerCase();
      if (/phone|telephone|tel|cellulare|mobile/.test(label)) {
        if ((m?.kind || '').toLowerCase() !== 'phone') {
          m.kind = 'phone';
          (m as any)._kindManual = 'phone';
        }
      }
    }
    return clone;
  } catch (err) {
    console.warn('[coercePhoneKind] Failed to clone, returning original:', err);
    return src; // Return original if cloning fails
  }
}

/**
 * Helpers: preserve/ensure steps on reopen (UI-only; no persistence)
 */
function ensureStepsForNode(node: any): any {
  if (!node) return node;
  const steps = node.steps;
  // If steps exist in either object or array form, leave unchanged
  if (steps && (Array.isArray(steps) ? steps.length > 0 : Object.keys(steps || {}).length > 0)) return node;
  const messages = node.messages || {};
  const stepKeys = Object.keys(messages || {});
  if (stepKeys.length === 0) return node;
  // Build minimal steps object: one escalation with sayMessage(textKey)
  const built: any = {};
  for (const k of stepKeys) {
    const textKey = messages[k]?.textKey;
    built[k] = {
      escalations: [
        {
          tasks: [  // ✅ New field
            {
              templateId: 'sayMessage',
              taskId: '',  // Will be set when task is created
              parameters: textKey ? [{ parameterId: 'text', value: textKey }] : [],
            }
          ],
          actions: [  // ✅ Legacy alias for backward compatibility
            {
              actionId: 'sayMessage',
              parameters: textKey ? [{ parameterId: 'text', value: textKey }] : [],
            }
          ],
        }
      ],
    };
  }
  return { ...node, steps: built };
}

function preserveStepsFromPrev(prev: any, next: any): any {
  if (!prev || !next) return next;
  const prevMains = Array.isArray(prev?.data) ? prev.data : [];
  const nextMains = Array.isArray(next?.data) ? next.data : [];
  const mapByLabel = (arr: any[]) => {
    const m = new Map<string, any>();
    arr.forEach((n: any) => { if (n?.label) m.set(String(n.label), n); });
    return m;
  };
  const prevMap = mapByLabel(prevMains);
  const enrichedMains = nextMains.map((n: any) => {
    const prevNode = prevMap.get(String(n?.label));
    let merged = n;
    if (prevNode && !n?.steps && prevNode?.steps) merged = { ...n, steps: prevNode.steps };
    const subs = Array.isArray(n?.subData) ? n.subData : [];
    const prevSubs = Array.isArray(prevNode?.subData) ? prevNode.subData : [];
    const prevSubsMap = mapByLabel(prevSubs);
    const mergedSubs = subs.map((s: any) => {
      const prevS = prevSubsMap.get(String(s?.label));
      if (prevS && !s?.steps && prevS?.steps) return { ...ensureStepsForNode(s), steps: prevS.steps };
      return ensureStepsForNode(s);
    });
    return { ...ensureStepsForNode(merged), subData: mergedSubs };
  });
  return { ...next, data: enrichedMains };
}

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
  // Local editable copies (initialize with coerced phone kind)
  const [localDDT, setLocalDDT] = useState<any>(() => coercePhoneKind(ddt));

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
    const coerced = coercePhoneKind(ddt);

    // Sync ONLY if it's a different DDT (ID changed) or first load
    const shouldSync = !prevId || !nextId || !isSameDDT;

    if (shouldSync && localDDT !== coerced) {
      // Preserve steps from previous in-memory DDT when reopening same template; ensure steps from messages if missing
      const enriched = preserveStepsFromPrev(localDDT, coerced);
      setLocalDDT(enriched);
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
    coercePhoneKind, // Expose for external use if needed
  };
}

