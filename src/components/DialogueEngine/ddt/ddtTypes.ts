// DDT Navigation Types

import type { AssembledTaskTree } from '../../TaskTreeBuilder/DDTAssembler/currentDDT.types';

export type RetrieveEvent =
  | { type: 'noMatch' }
  | { type: 'noInput' }
  | { type: 'match'; value: any }
  | { type: 'confirmed' }
  | { type: 'notConfirmed' }
  | { type: 'exit'; exitAction: any };

export interface DDTState {
  memory: Record<string, { value: any; confirmed: boolean }>;
  noMatchCounters: Record<string, number>;
  noInputCounters: Record<string, number>;
  notConfirmedCounters: Record<string, number>;
}

export interface RetrieveResult {
  success: boolean;
  value?: any;
  exit?: boolean;
  exitAction?: any;
  error?: Error;
}

export interface DDTNavigatorCallbacks {
  onMessage?: (text: string, stepType?: string, escalationNumber?: number) => void;
  onGetRetrieveEvent?: (nodeId: string, ddt?: AssembledTaskTree) => Promise<RetrieveEvent>;
  onProcessInput?: (input: string, node: any) => Promise<{ status: 'match' | 'noMatch' | 'noInput' | 'partialMatch'; value?: any; matchedButInvalid?: boolean }>;
  onUserInputProcessed?: (input: string, matchStatus: 'match' | 'noMatch' | 'partialMatch', extractedValues?: any[]) => void;
  translations?: Record<string, string>; // Translations for resolving action text
}

