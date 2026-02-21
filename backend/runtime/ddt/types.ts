// DDT Engine Types - Backend Runtime
// Copied from frontend and adapted for backend

// Re-export types from shared types if available, otherwise define locally
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
  stepOrEscalation?: any; // Step or escalation to execute with executeStep
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

export interface RetrieveResult {
  success: boolean;
  value?: any;
  exit?: boolean;
  exitAction?: any;
  error?: Error;
}

// DDT Types (from currentDDT.types.ts)
export interface MainDataNode {
  id: string;
  name?: string;
  label?: string;
  type?: string;
  required?: boolean;
  condition?: string;
  steps: StepGroup[];
  subData?: MainDataNode[];
  synonyms?: string[];
  constraints?: any[];
}

export interface AssembledDDT {
  id: string;
  label: string;
  mainData: MainDataNode | MainDataNode[];
  translations: Record<string, string>;
  introduction?: StepGroup;
}

export interface StepGroup {
  type: string;
  escalations?: Escalation[];
  tasks?: Task[];
}

export interface Escalation {
  tasks: Task[];
  type?: string;
  escalationType?: string;
}

export interface Task {
  id?: string;
  type?: string;
  text?: string;
  parameters?: TaskParameter[];
}

export interface TaskParameter {
  parameterId?: string;
  key?: string;
  value?: any;
}

// DDT Navigator Callbacks
export type RetrieveEvent =
  | { type: 'noMatch' }
  | { type: 'noInput' }
  | { type: 'match'; value: any }
  | { type: 'confirmed' }
  | { type: 'notConfirmed' }
  | { type: 'exit'; exitAction: any };

export interface DDTNavigatorCallbacks {
  onMessage?: (text: string, stepType?: string, escalationNumber?: number) => void;
  onGetRetrieveEvent?: (nodeId: string, ddt?: AssembledDDT) => Promise<RetrieveEvent>;
  onProcessInput?: (input: string, node: any) => Promise<{ status: 'match' | 'noMatch' | 'noInput' | 'partialMatch'; value?: any; matchedButInvalid?: boolean }>;
  onUserInputProcessed?: (input: string, matchStatus: 'match' | 'noMatch' | 'partialMatch', extractedValues?: any[]) => void;
  translations?: Record<string, string>; // Translations for resolving action text
}

// Contract-related types (for backend compatibility)
export interface NLPContract {
  templateName: string;
  templateId: string;
  sourceTemplateId?: string;
  subDataMapping: {
    [subId: string]: {
      canonicalKey: string;
      /** Technical regex group name (format: g_[a-f0-9]{12}). Sole source of truth for extraction. */
      groupName: string;
      label: string;
      type: string;
      patternIndex?: number;
    };
  };
  regex: {
    patterns: string[];
    patternModes?: string[];
    ambiguityPattern?: string;
    ambiguity?: {
      ambiguousValues: {
        pattern: string;
        description: string;
      };
      ambiguousCanonicalKeys: string[];
    };
    testCases: string[];
  };
  rules: {
    extractorCode: string;
    validators: any[];
    testCases: string[];
  };
  ner?: {
    entityTypes: string[];
    confidence: number;
    enabled: boolean;
  };
  llm: {
    systemPrompt: string;
    userPromptTemplate: string;
    responseSchema: object;
    enabled: boolean;
  };
}



