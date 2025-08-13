import type { StepNotConfirmed, StepDisambiguation } from '../../DialogueDataEngine/model/ddt.v2.types';

export type V2DraftPerMain = {
  notConfirmed?: StepNotConfirmed;
  ask?: { reason?: string };
  disambiguation?: StepDisambiguation;
};

type V2Draft = Record<string, V2DraftPerMain>; // keyed by main label/path

const store: V2Draft = {};

export function setV2Draft(mainKey: string, patch: V2DraftPerMain) {
  if (!mainKey) return;
  store[mainKey] = { ...(store[mainKey] || {}), ...(patch || {}) };
}

export function getV2Draft(mainKey: string): V2DraftPerMain | undefined {
  return store[mainKey];
}

export function getAllV2Draft(): V2Draft {
  return { ...store };
}

export function clearV2Draft() {
  for (const k of Object.keys(store)) delete store[k];
}


