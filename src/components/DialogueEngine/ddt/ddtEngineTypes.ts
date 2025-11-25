// DDT Engine Types - New Clean Architecture
// This file defines types for the new DDT engine implementation

import type { AssembledDDT, MainDataNode } from '../../DialogueDataTemplateBuilder/DDTAssembler/currentDDT.types';
import type { DDTNavigatorCallbacks } from './ddtTypes';

// ============================================================================
// Core Types
// ============================================================================

export type TurnState = 'Start' | 'NoMatch' | 'NoInput' | 'Confirmation' | 'NotConfirmed' | 'Success' | null;
export type TurnEvent = 'Match' | 'NoMatch' | 'NoInput' | 'Confirmed' | 'NotConfirmed' | 'Unknown';
export type Context = 'CollectingMain' | 'CollectingSub';

export interface TurnStateDescriptor {
  turnState: TurnState;
  context: Context;
  counter: number;
  nextDataId?: string; // For CollectingSub context
}

export interface Response {
  message: string;
  tasks: Array<{ condition: boolean; action: () => void }>;
  stepType: string;
  escalationLevel?: number;
}

export interface CurrentData {
  mainData: MainDataNode;
  subData?: MainDataNode;
  nodeId: string;
  isMain: boolean;
}

export interface Limits {
  noMatchMax: number;
  noInputMax: number;
  notConfirmedMax: number;
}

export interface Counters {
  noMatch: number;
  noInput: number;
  notConfirmed: number;
  confirmation: number;
}

export interface DDTEngineState {
  memory: Record<string, { value: any; confirmed: boolean }>;
  counters: Record<string, Counters>;
  currentMainId?: string;
  currentSubId?: string;
  turnState: TurnState;
  context: Context;
}

export interface RecognitionResult {
  status: 'match' | 'noMatch' | 'noInput' | 'partialMatch';
  value?: any;
  matchedButInvalid?: boolean;
}

export interface NodeState {
  step: TurnState;
  counters: Counters;
}

export interface DDTEngineCallbacks extends DDTNavigatorCallbacks {
  // Extended callbacks for new engine
}

