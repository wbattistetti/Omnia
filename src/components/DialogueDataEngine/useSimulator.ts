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
      if (next.mode !== prev.mode) {
        cfgRef.current.onLog?.({ ts: Date.now(), kind: 'mode', message: `Mode -> ${next.mode}` });
        if (cfgRef.current.debug) {
          // eslint-disable-next-line no-console
          console.log('[DDE] mode:', next.mode);
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


