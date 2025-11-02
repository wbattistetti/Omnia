import { useCallback, useEffect, useRef, useState } from 'react';
import type { LogEvent } from './logger';
import type { DDTTemplateV2, HumanLikeConfig } from './model/ddt.v2.types';
import { initEngine, advance, type SimulatorState } from './engine';
import { runAddressEnrichment } from './effects/addressEnrichment';
import { setMemory } from './state';
import type { Logger } from './logger';
import { setLogger } from './logger';
import type { KindParser } from './parsers/registry';
import { registerKind } from './parsers/registry';

export interface HookConfig {
  typingIndicatorMs?: number; // simple delay before applying engine advance
  onLog?: (e: LogEvent) => void;
  debug?: boolean; // if true, also log to console
  logger?: Logger; // injected logger
  parsers?: Record<string, KindParser>; // injected kind parsers/overrides
  effects?: SimulatorEffect[]; // injected effects
}

export type EffectAPI = {
  getState: () => SimulatorState;
  updateMemory: (updater: (mem: SimulatorState['memory'], plan: SimulatorState['plan']) => SimulatorState['memory']) => void;
  setState: (updater: (curr: SimulatorState) => SimulatorState) => void;
};

export type SimulatorEffect = {
  onUserInput?: (input: string, api: EffectAPI) => void | Promise<void>;
  onStateChange?: (prev: SimulatorState, next: SimulatorState, api: EffectAPI) => void | Promise<void>;
  onDispose?: () => void;
};

export function useDDTSimulator(template: DDTTemplateV2, initialConfig?: HookConfig) {
  const [state, setState] = useState<SimulatorState>(() => initEngine(template));
  const cfgRef = useRef<HookConfig>({ typingIndicatorMs: 0, ...(initialConfig || {}) });
  const pendingBgRef = useRef<any | null>(null);
  const effectsRef = useRef<SimulatorEffect[]>([]);
  const stateRef = useRef<SimulatorState>(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // Install logger, parsers, effects
  useEffect(() => {
    const cfg = cfgRef.current || {};
    if (cfg.logger) setLogger(cfg.logger);
    if (cfg.parsers) {
      for (const [k, parser] of Object.entries(cfg.parsers)) registerKind(k, parser);
    }
    // Default effect keeps previous address enrichment behavior
    effectsRef.current = (cfg.effects && cfg.effects.length > 0)
      ? cfg.effects
      : [{
          onUserInput: (input, api) => {
            if (pendingBgRef.current) return;
            pendingBgRef.current = true;
            runAddressEnrichment(String(input || ''), (updater) => api.setState(updater));
            setTimeout(() => { pendingBgRef.current = null; }, 0);
          }
        }];
    return () => {
      try { effectsRef.current.forEach(e => e.onDispose?.()); } catch {}
    };
  }, []);

  const send = useCallback(async (input: string, extractedVariables?: Record<string, any>) => {
    cfgRef.current.onLog?.({ ts: Date.now(), kind: 'input', message: input });
    if (cfgRef.current.debug) {
      // eslint-disable-next-line no-console
      console.log('[DDE] input:', input);
      if (extractedVariables) {
        console.log('[DDE] extractedVariables:', extractedVariables);
      }
    }
    // 🆕 Skip delay in debug mode or when using regex (instant processing)
    // Delay is only useful for simulating typing in production
    const delay = cfgRef.current.debug ? 0 : Math.max(0, cfgRef.current.typingIndicatorMs || 0);
    if (delay > 0) {
      await new Promise((res) => setTimeout(res, delay));
    }

    // EffectAPI for effects
    const api: EffectAPI = {
      getState: () => stateRef.current,
      updateMemory: (updater) => setState((curr) => ({ ...curr, memory: updater(curr.memory, curr.plan) } as SimulatorState)),
      setState: (updater) => setState(updater),
    };

    // Run user-input effects
    try {
      const tasks = effectsRef.current.map(e => e.onUserInput?.(input, api)).filter(Boolean) as Promise<void>[];
      if (tasks.length) await Promise.allSettled(tasks);
    } catch {}

    setState((prev) => {
      const next = advance(prev, input, extractedVariables);
      // Detailed memory debug (flattened) for inspection
      if (cfgRef.current.debug) {
        try {
          const mainId = next.plan.order[next.currentIndex];
          const flatten = (s: SimulatorState) => Object.fromEntries(Object.entries(s.memory || {}).map(([k, v]) => [k, v?.value]));
          console.log('[DDE] memory:', flatten(next));
          console.log('[DDE] main:', mainId, (next.plan.byId as any)[mainId]?.label);
        } catch {}
      }
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
      try { effectsRef.current.forEach(e => e.onStateChange?.(prev, next, api)); } catch {}
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


