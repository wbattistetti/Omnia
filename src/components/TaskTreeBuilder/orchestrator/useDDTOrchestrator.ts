import { useState, useCallback } from 'react';
import type { DDTOrchestratorState, DDTGenerationStep } from './types';
import fetchStructure from './fetchStructure';
import enrichConstraints from './enrichConstraints';
import generateScripts from './generateScripts';
import batchMessages from './batchMessages';
import { buildDDT } from '../DDTAssembler/DDTBuilder';

const API_BASE = '';

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
  const url = `/step2-with-provider`;
  const body = { userDesc, provider: 'openai' };
  const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  console.log('[DDT][Orchestrator][DetectType][request]', { url, body });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const elapsed = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - t0;
  let raw = '';
  try { raw = await res.clone().text(); } catch { }
  console.log('[DDT][Orchestrator][DetectType][response]', { status: res.status, ok: res.ok, ms: Math.round(elapsed), preview: (raw || '').slice(0, 400) });
  if (!res.ok) throw new Error('Type recognition failed');
  const data = await res.json();
  if (!data.ai || !data.ai.type || !data.ai.icon) throw new Error('Recognition response missing fields');

  // Gestisci la nuova struttura con sub-data dal Template Intelligence Service
  const aiData = data.ai;
  console.log('[DDT][Orchestrator][DetectType][aiData]', {
    type: aiData.type,
    icon: aiData.icon,
    label: aiData.label,
    subDataCount: aiData.subData?.length || 0,
    hasIntelligenceAnalysis: !!aiData.intelligence_analysis
  });

  return aiData;
}

export default function useDDTOrchestrator() {
  const [state, setState] = useState<DDTOrchestratorState>({ step: 'recognizeType', isOffline: false });

  // Funzioni step-by-step
  const runStructure = useCallback(async (recognizedType: string, desc?: string) => {
    setState(s => ({ ...s, step: 'structure', error: undefined }));
    try {
      const { ddt, messages } = await fetchStructure(recognizedType, desc);
      return { ddt, messages };
    } catch (err: any) {
      console.error('[orchestrator] runStructure: ERROR', err);
      throw err;
    }
  }, []);

  const runConstraints = useCallback(async (ddt: any) => {
    setState(s => ({ ...s, step: 'constraints', error: undefined }));
    try {
      const ddtWithConstraints = await enrichConstraints(ddt);
      return ddtWithConstraints;
    } catch (err: any) {
      console.error('[orchestrator] runConstraints: ERROR', err);
      throw err;
    }
  }, []);

  const runScripts = useCallback(async (ddtWithConstraints: any) => {
    setState(s => ({ ...s, step: 'scripts', error: undefined }));
    try {
      const ddtWithScripts = await generateScripts(ddtWithConstraints);
      return ddtWithScripts;
    } catch (err: any) {
      console.error('[orchestrator] runScripts: ERROR', err);
      throw err;
    }
  }, []);

  const runMessages = useCallback(async (ddtWithScripts: any, messages: any) => {
    setState(s => ({ ...s, step: 'messages', error: undefined }));
    try {
      const finalMessages = messages || {};
      return { ddtWithScripts, finalMessages };
    } catch (err: any) {
      console.error('[orchestrator] runMessages: ERROR', err);
      throw err;
    }
  }, []);

  const runAssemble = useCallback(async (ddtWithScripts: any, finalMessages: any) => {
    setState(s => ({ ...s, step: 'assemble', error: undefined }));
    try {
      const final = buildDDT(ddtWithScripts, finalMessages);
      return final;
    } catch (err: any) {
      console.error('[orchestrator] runAssemble: ERROR', err);
      throw err;
    }
  }, []);

  // Avvia la generazione completa
  const start = useCallback(async (userDesc: string, desc?: string) => {
    try {
      setState(s => ({ ...s, step: 'recognizeType', isOffline: false, lastUserDesc: userDesc, lastDesc: desc }));
      // Step 0: riconoscimento tipo con Template Intelligence
      const recognized = await recognizeTypeAPI(userDesc);
      setState(s => ({
        ...s,
        recognizedType: recognized.type,
        recognizedIcon: recognized.icon,
        isCustom: recognized.is_custom,
        confirmedType: recognized.type,
        error: undefined,
      }));

      // Se abbiamo sub-data dal Template Intelligence Service, usali direttamente
      if (recognized.subData && recognized.subData.length > 0) {
        console.log('[DDT][Orchestrator] Using sub-data from Template Intelligence Service:', recognized.subData);
        // Crea DDT direttamente dai sub-data
        const ddt = {
          label: recognized.label || userDesc,
          type: recognized.type,
          icon: recognized.icon,
          data: [{
            label: recognized.label || userDesc,
            type: recognized.type,
            icon: recognized.icon,
            subData: recognized.subData
          }]
        };

        // Salta fetchStructure e vai direttamente ai constraints
        setState(s => ({ ...s, step: 'constraints', structure: ddt, messages: {} }));
        const ddtWithConstraints = await runConstraints(ddt);
        const ddtWithScripts = await runScripts(ddtWithConstraints);
        const { finalMessages } = await runMessages(ddtWithScripts, {});
        const final = await runAssemble(ddtWithScripts, finalMessages);
        setState(s => ({ ...s, step: 'done', finalDDT: final.ddt, messages: final.messages, error: undefined }));
      } else {
        // Fallback: usa il vecchio sistema
        console.log('[DDT][Orchestrator] No sub-data from Template Intelligence, using fallback');
        const { ddt, messages } = await runStructure(recognized.type, desc);
        const ddtWithConstraints = await runConstraints(ddt);
        const ddtWithScripts = await runScripts(ddtWithConstraints);
        const { finalMessages } = await runMessages(ddtWithScripts, messages);
        const final = await runAssemble(ddtWithScripts, finalMessages);
        setState(s => ({ ...s, step: 'done', finalDDT: final.ddt, messages: final.messages, error: undefined }));
      }
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
      } else if (currentStep === 'constraints') {
        const ddtWithConstraints = await runConstraints(state.structure);
        const ddtWithScripts = await runScripts(ddtWithConstraints);
        const { finalMessages } = await runMessages(ddtWithScripts, state.messages);
        const final = await runAssemble(ddtWithScripts, finalMessages);
        setState(s => ({ ...s, step: 'done', finalDDT: final.ddt, messages: final.messages, error: undefined }));
      } else if (currentStep === 'scripts') {
        const ddtWithScripts = await runScripts(state.structure);
        const { finalMessages } = await runMessages(ddtWithScripts, state.messages);
        const final = await runAssemble(ddtWithScripts, finalMessages);
        setState(s => ({ ...s, step: 'done', finalDDT: final.ddt, messages: final.messages, error: undefined }));
      } else if (currentStep === 'messages') {
        const { finalMessages } = await runMessages(state.structure, state.messages);
        const final = await runAssemble(state.structure, finalMessages);
        setState(s => ({ ...s, step: 'done', finalDDT: final.ddt, messages: final.messages, error: undefined }));
      } else if (currentStep === 'assemble') {
        const final = await runAssemble(state.structure, state.messages);
        setState(s => ({ ...s, step: 'done', finalDDT: final.ddt, messages: final.messages, error: undefined }));
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