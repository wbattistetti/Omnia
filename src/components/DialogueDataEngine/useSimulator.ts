import { useCallback, useRef, useState } from 'react';
import type { LogEvent } from './logger';
import type { DDTTemplateV2, HumanLikeConfig } from './model/ddt.v2.types';
import { initEngine, advance, type SimulatorState } from './engine';

export interface HookConfig {
  typingIndicatorMs?: number; // simple delay before applying engine advance
  onLog?: (e: LogEvent) => void;
  debug?: boolean; // if true, also log to console
}

export function useDDTSimulator(template: DDTTemplateV2, initialConfig?: HookConfig) {
  const [state, setState] = useState<SimulatorState>(() => initEngine(template));
  const cfgRef = useRef<HookConfig>({ typingIndicatorMs: 0, ...(initialConfig || {}) });
  const pendingBgRef = useRef<any | null>(null);

  const send = useCallback(async (input: string) => {
    cfgRef.current.onLog?.({ ts: Date.now(), kind: 'input', message: input });
    if (cfgRef.current.debug) {
      // eslint-disable-next-line no-console
      console.log('[DDE] input:', input);
    }
    const delay = Math.max(0, cfgRef.current.typingIndicatorMs || 0);
    await new Promise((res) => setTimeout(res, delay));
    setState((prev) => {
      const next = advance(prev, input);
      // Detailed memory debug (flattened) for inspection
      if (cfgRef.current.debug) {
        try {
          const mainId = next.plan.order[next.currentIndex];
          const flatten = (s: SimulatorState) => Object.fromEntries(Object.entries(s.memory || {}).map(([k, v]) => [k, v?.value]));
          console.log('[DDE] memory:', flatten(next));
          console.log('[DDE] main:', mainId, next.plan.byId[mainId]?.label);
        } catch {}
      }
      if (next.mode !== prev.mode) {
        cfgRef.current.onLog?.({ ts: Date.now(), kind: 'mode', message: `Mode -> ${next.mode}` });
        if (cfgRef.current.debug) {
          // eslint-disable-next-line no-console
          console.log('[DDE] mode:', next.mode);
        }
        // When entering ConfirmingMain, if there is residual text, launch background address parse
        if (next.mode === 'ConfirmingMain') {
          try {
            const residual = ''; // placeholder: engine could expose residual; for now, skip
            if (residual && residual.length > 12 && !pendingBgRef.current) {
              pendingBgRef.current = true;
              fetch('/api/parse-address', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: residual }),
              })
                .then((r) => r.json())
                .then((data) => {
                  if (data?.ok && data.address) {
                    // Stash; application at next user commit would require a reducer or external handler.
                    cfgRef.current.onLog?.({ ts: Date.now(), kind: 'bg', message: 'address parsed' });
                  }
                })
                .finally(() => {
                  pendingBgRef.current = null;
                });
            }
          } catch {}
        }
      }
      if (next.currentSubId !== prev.currentSubId && next.currentSubId) {
        cfgRef.current.onLog?.({ ts: Date.now(), kind: 'subTarget', message: `Sub -> ${next.currentSubId}` });
        if (cfgRef.current.debug) {
          // eslint-disable-next-line no-console
          console.log('[DDE] subTarget:', next.currentSubId);
        }
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setState(initEngine(template));
  }, [template]);

  const setConfig = useCallback((next: HookConfig) => {
    cfgRef.current = { ...cfgRef.current, ...(next || {}) };
  }, []);

  return { state, send, reset, setConfig };
}


