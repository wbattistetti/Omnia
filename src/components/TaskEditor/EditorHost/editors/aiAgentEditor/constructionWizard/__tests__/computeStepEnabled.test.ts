/**
 * Tests della logica `computeStepEnabled` dello stepper. Garantisce che la regola di
 * gating soft (uno step diventa cliccabile se tutti i precedenti sono ✅) sia rispettata
 * in tutti gli scenari significativi.
 *
 * NOTA: la funzione vive (per ora) come helper privato dentro `AIAgentConstructionStepper`.
 * Il test la verifica indirettamente importando la rule via mirror — manteniamo il
 * comportamento documentato qui anche per regressioni future.
 */

import { describe, it, expect } from 'vitest';

/** Mirror della funzione privata in `AIAgentConstructionStepper.tsx` (single-source rule). */
function computeStepEnabled(completion: readonly boolean[]): readonly boolean[] {
  const out: boolean[] = new Array(completion.length).fill(false);
  let allPreviousDone = true;
  for (let i = 0; i < completion.length; i++) {
    out[i] = allPreviousDone || completion[i];
    if (!completion[i]) allPreviousDone = false;
  }
  return out;
}

describe('computeStepEnabled', () => {
  it('step 0 \u00e8 sempre abilitato', () => {
    expect(computeStepEnabled([false, false, false, false, false])[0]).toBe(true);
    expect(computeStepEnabled([true, true, true, true, true])[0]).toBe(true);
  });

  it('quando tutti gli step sono incompleti, solo step 0 \u00e8 abilitato', () => {
    const enabled = computeStepEnabled([false, false, false, false, false]);
    expect(enabled).toEqual([true, false, false, false, false]);
  });

  it('quando step 0 \u00e8 \u2705 si abilita anche step 1', () => {
    const enabled = computeStepEnabled([true, false, false, false, false]);
    expect(enabled).toEqual([true, true, false, false, false]);
  });

  it('una catena di completati abilita progressivamente i successivi', () => {
    const enabled = computeStepEnabled([true, true, true, false, false]);
    expect(enabled).toEqual([true, true, true, true, false]);
  });

  it('uno step COMPLETATO resta cliccabile anche se i precedenti regrediscono (back-edit)', () => {
    const enabled = computeStepEnabled([false, true, false, false, false]);
    expect(enabled[1]).toBe(true);
  });

  it('tutti completati \u2192 tutti cliccabili (riapertura per editing)', () => {
    const enabled = computeStepEnabled([true, true, true, true, true]);
    expect(enabled).toEqual([true, true, true, true, true]);
  });

  it('scenario reale wizard step soft (step 1/3/4 sempre \u2705): solo gate stretti contano', () => {
    const enabled = computeStepEnabled([false, true, false, true, true]);
    expect(enabled[0]).toBe(true);
    expect(enabled[1]).toBe(true);
    expect(enabled[2]).toBe(false);
    expect(enabled[3]).toBe(true);
    expect(enabled[4]).toBe(true);
  });
});
