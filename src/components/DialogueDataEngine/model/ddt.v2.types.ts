// DialogueDataEngine V2 — data model only (DDT schema and config)

export type Kind = 'name' | 'email' | 'phone' | 'date' | 'address' | 'generic';
export type StepType =
  | 'ask'
  | 'confirm'
  | 'notConfirmed'
  | 'violation'
  | 'disambiguation'
  | 'success'
  | 'fallback';

export interface StepAsk {
  base: string;
  reaskNoInput: string[]; // L1..L3
  reaskNoMatch: string[]; // L1..L3
  reason?: string;
  twoShot?: boolean;
  recognizeExtras?: boolean;
}

export interface StepConfirm {
  base: string;
  paraphraseBefore?: boolean;
  noInput: string[]; // L1..L3
  noMatch: string[]; // L1..L3
  reason?: string;
  twoShot?: boolean;
}

export interface StepNotConfirmed {
  prompts: string[]; // L1..L3
  askWhatToFix?: string;
  options?: Array<{ id: string; label: string }>;
  offerSkipAfter?: number; // default 3
  offerHandoffAfter?: number; // default 3
}

export interface StepViolation {
  preConfirmPolicy: 'never' | 'always' | 'threshold';
  preConfirmThreshold?: number;
  prompts: string[]; // L1..L3
}

export interface StepDisambiguation {
  prompt: string;
  softRanking: boolean;
  defaultWithCancel: boolean;
  selectionMode?: 'numbers' | 'buttons' | 'free_text';
}

export interface StepSuccess {
  base: string[]; // variants
  reward?: string[];
}

export interface StepMessages {
  ask: StepAsk;
  confirm?: StepConfirm; // only for main
  notConfirmed?: StepNotConfirmed; // only for main
  violation?: StepViolation;
  disambiguation?: StepDisambiguation;
  success?: StepSuccess;
  fallbacks?: Partial<{ ask: string; confirm: string; success: string }>;
}

export interface DDTNode {
  id: string;
  label: string;
  type: 'main' | 'sub';
  required?: boolean;
  kind: Kind;
  steps: StepMessages;
  subs?: string[];
  condition?: string;
  synonyms?: string[];
}

export interface HumanLikeConfig {
  backchannelRate: number;
  paraphraseRate: number;
  hedgingRate: number;
  implicitConfirm: boolean;
  typingIndicatorMs: { short: number; long: number };
  jitterMs: number;
  reaskStrategy: 'progressive' | 'rotate';
  antiLoopK: number;
  rewardRate: number;
  preConfirmOnViolation: 'never' | 'always' | 'threshold';
  preConfirmThreshold: number;
  disambiguation: { enabled: boolean; topK: number; softRanking: boolean; defaultWithCancel: boolean };
  styleMirroring: 'off' | 'light';
  explainWhyMaxChars: number;
}

export const DEFAULT_HUMANLIKE: HumanLikeConfig = {
  backchannelRate: 0.15,
  paraphraseRate: 0.1,
  hedgingRate: 0.1,
  implicitConfirm: false,
  typingIndicatorMs: { short: 400, long: 900 },
  jitterMs: 120,
  reaskStrategy: 'progressive',
  antiLoopK: 3,
  rewardRate: 0.15,
  preConfirmOnViolation: 'threshold',
  preConfirmThreshold: 0.7,
  disambiguation: { enabled: true, topK: 3, softRanking: true, defaultWithCancel: true },
  styleMirroring: 'light',
  explainWhyMaxChars: 0,
};

export interface DDTTemplateV2Metadata {
  id: string;
  label: string;
  owner?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DDTTemplateV2 {
  schemaVersion: '2';
  metadata: DDTTemplateV2Metadata;
  nodes: DDTNode[];
  humanLike?: HumanLikeConfig;
}


