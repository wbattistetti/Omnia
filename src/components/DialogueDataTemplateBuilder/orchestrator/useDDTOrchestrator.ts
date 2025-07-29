import { useState, useCallback } from 'react';
import type { DDTOrchestratorState, DDTGenerationStep } from './types';
import fetchStructure from './fetchStructure';
import enrichConstraints from './enrichConstraints';
import generateScripts from './generateScripts';
import batchMessages from './batchMessages';
import { buildDDT } from '../DDTAssembler/DDTBuilder';

const stepOrder: DDTGenerationStep[] = [
  'recognizeType',
  'structure',
  'constraints',
  'scripts',
  'messages',
  'assemble',
  'done',
];

async function recognizeTypeAPI(userDesc: string) {
  const res = await fetch('/step2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userDesc),
  });
  if (!res.ok) throw new Error('Type recognition failed');
  const data = await res.json();
  if (!data.ai || !data.ai.type || !data.ai.icon) throw new Error('Recognition response missing fields');
  return data.ai;
}

export default function useDDTOrchestrator() {
  const [state, setState] = useState<DDTOrchestratorState>({ step: 'recognizeType', isOffline: false });

  // Funzioni step-by-step
  const runStructure = useCallback(async (recognizedType: string, desc?: string) => {
    console.log('[orchestrator] runStructure: set step structure');
    setState(s => ({ ...s, step: 'structure', error: undefined }));
    try {
      console.log('[orchestrator] runStructure: calling fetchStructure', { recognizedType, desc });
      const { ddt, messages } = await fetchStructure(recognizedType, desc);
      console.log('[orchestrator] runStructure: fetchStructure OK', { ddt, messages });
      return { ddt, messages };
    } catch (err: any) {
      console.error('[orchestrator] runStructure: ERROR', err);
      throw err;
    }
  }, []);

  const runConstraints = useCallback(async (ddt: any) => {
    console.log('[orchestrator] runConstraints: set step constraints');
    setState(s => ({ ...s, step: 'constraints', error: undefined }));
    try {
      console.log('[orchestrator] runConstraints: calling enrichConstraints', { ddt });
      const ddtWithConstraints = await enrichConstraints(ddt);
      console.log('[orchestrator] runConstraints: enrichConstraints OK', { ddtWithConstraints });
      return ddtWithConstraints;
    } catch (err: any) {
      console.error('[orchestrator] runConstraints: ERROR', err);
      throw err;
    }
  }, []);

  const runScripts = useCallback(async (ddtWithConstraints: any) => {
    console.log('[orchestrator] runScripts: set step scripts');
    setState(s => ({ ...s, step: 'scripts', error: undefined }));
    try {
      console.log('[orchestrator] runScripts: calling generateScripts', { ddtWithConstraints });
      const ddtWithScripts = await generateScripts(ddtWithConstraints);
      console.log('[orchestrator] runScripts: generateScripts OK', { ddtWithScripts });
      return ddtWithScripts;
    } catch (err: any) {
      console.error('[orchestrator] runScripts: ERROR', err);
      throw err;
    }
  }, []);

  const runMessages = useCallback(async (ddtWithScripts: any, messages: any) => {
    console.log('[orchestrator] runMessages: set step messages');
    setState(s => ({ ...s, step: 'messages', error: undefined }));
    try {
      console.log('[orchestrator] runMessages: calling batchMessages', { ddtWithScripts, messages });
      const finalMessages = messages || {};
      console.log('[orchestrator] runMessages: batchMessages OK', { finalMessages });
      return { ddtWithScripts, finalMessages };
    } catch (err: any) {
      console.error('[orchestrator] runMessages: ERROR', err);
      throw err;
    }
  }, []);

  const runAssemble = useCallback(async (ddtWithScripts: any, finalMessages: any) => {
    console.log('[orchestrator] runAssemble: set step assemble');
    setState(s => ({ ...s, step: 'assemble', error: undefined }));
    try {
      console.log('[orchestrator] runAssemble: calling buildDDT', { ddtWithScripts, finalMessages });
      const final = buildDDT(ddtWithScripts, finalMessages);
      console.log('[orchestrator] runAssemble: buildDDT OK', { final });
      return final;
    } catch (err: any) {
      console.error('[orchestrator] runAssemble: ERROR', err);
      throw err;
    }
  }, []);

  // Avvia la generazione completa
  const start = useCallback(async (userDesc: string, desc?: string) => {
    try {
      console.log('[orchestrator] start: set step recognizeType');
      setState(s => ({ ...s, step: 'recognizeType', isOffline: false, lastUserDesc: userDesc, lastDesc: desc }));
      // Step 0: riconoscimento tipo
      console.log('[orchestrator] start: calling recognizeTypeAPI', { userDesc });
      const recognized = await recognizeTypeAPI(userDesc);
      console.log('[orchestrator] start: recognizeTypeAPI OK', { recognized });
      setState(s => ({
        ...s,
        recognizedType: recognized.type,
        recognizedIcon: recognized.icon,
        isCustom: recognized.is_custom,
        confirmedType: recognized.type,
        error: undefined,
      }));
      // Step 1: struttura base
      const { ddt, messages } = await runStructure(recognized.type, desc);
      // Step 2: arricchisci constraints
      const ddtWithConstraints = await runConstraints(ddt);
      // Step 3: genera scripts
      const ddtWithScripts = await runScripts(ddtWithConstraints);
      // Step 4: batch messages
      const { finalMessages } = await runMessages(ddtWithScripts, messages);
      // Step 5: assembla finale
      const final = await runAssemble(ddtWithScripts, finalMessages);
      setState(s => ({ ...s, step: 'done', finalDDT: final.ddt, messages: final.messages, error: undefined }));
      console.log('[orchestrator] start: DONE', { final });
    } catch (err: any) {
      // Gestione errori di rete
      const isOffline = !navigator.onLine || (err && err.name === 'TypeError');
      console.error('[orchestrator] start: ERROR', err);
      setState(s => ({
        ...s,
        error: err.message || 'Errore generazione DDT',
        isOffline,
      }));
    }
  }, [runStructure, runConstraints, runScripts, runMessages, runAssemble]);

  // Retry step corrente: rilancia solo lo step bloccato, senza limiti
  const retry = useCallback(async () => {
    if (!state.step || state.step === 'done') return;
    const currentStep = state.step === 'error'
      ? stepOrder[Math.max(0, stepOrder.indexOf(state.step) - 1)]
      : state.step;
    setState(s => ({ ...s, step: currentStep, error: undefined }));
    try {
      if (currentStep === 'structure') {
        const { ddt, messages } = await runStructure(state.recognizedType!, state.lastDesc);
        const ddtWithConstraints = await runConstraints(ddt);
        const ddtWithScripts = await runScripts(ddtWithConstraints);
        const { finalMessages } = await runMessages(ddtWithScripts, messages);
        const final = await runAssemble(ddtWithScripts, finalMessages);
        setState(s => ({ ...s, step: 'done', finalDDT: final.ddt, messages: final.messages, error: undefined }));
        console.log('[orchestrator] retry: DONE', { final });
      } else if (currentStep === 'constraints') {
        const ddtWithConstraints = await runConstraints(state.structure);
        const ddtWithScripts = await runScripts(ddtWithConstraints);
        const { finalMessages } = await runMessages(ddtWithScripts, state.messages);
        const final = await runAssemble(ddtWithScripts, finalMessages);
        setState(s => ({ ...s, step: 'done', finalDDT: final.ddt, messages: final.messages, error: undefined }));
        console.log('[orchestrator] retry: DONE', { final });
      } else if (currentStep === 'scripts') {
        const ddtWithScripts = await runScripts(state.structure);
        const { finalMessages } = await runMessages(ddtWithScripts, state.messages);
        const final = await runAssemble(ddtWithScripts, finalMessages);
        setState(s => ({ ...s, step: 'done', finalDDT: final.ddt, messages: final.messages, error: undefined }));
        console.log('[orchestrator] retry: DONE', { final });
      } else if (currentStep === 'messages') {
        const { finalMessages } = await runMessages(state.structure, state.messages);
        const final = await runAssemble(state.structure, finalMessages);
        setState(s => ({ ...s, step: 'done', finalDDT: final.ddt, messages: final.messages, error: undefined }));
        console.log('[orchestrator] retry: DONE', { final });
      } else if (currentStep === 'assemble') {
        const final = await runAssemble(state.structure, state.messages);
        setState(s => ({ ...s, step: 'done', finalDDT: final.ddt, messages: final.messages, error: undefined }));
        console.log('[orchestrator] retry: DONE', { final });
      }
    } catch (err: any) {
      const isOffline = !navigator.onLine || (err && err.name === 'TypeError');
      console.error('[orchestrator] retry: ERROR', err);
      setState(s => ({
        ...s,
        error: err.message || 'Errore generazione DDT',
        isOffline,
      }));
    }
  }, [state, runStructure, runConstraints, runScripts, runMessages, runAssemble]);

  return {
    state,
    start,
    retry,
    runStructure,
    runConstraints,
    runScripts,
    runMessages,
    runAssemble,
    step: state.step,
    error: state.error,
    finalDDT: state.finalDDT,
    messages: state.messages,
  };
} 