export type HeuristicType =
  | 'MESSAGE'
  | 'REQUEST_DATA'
  | 'PROBLEM_SPEC'
  | 'CONFIRM_DATA'
  | 'SUMMARY'
  | 'BACKEND_CALL';

export type InternalType =
  | 'Message'
  | 'DataRequest'
  | 'ProblemClassification'
  | 'Confirmation'
  | 'Summarizer'
  | 'BackendCall';

export type Lang = 'IT' | 'EN' | 'PT';

export type RuleSet = {
  MESSAGE: RegExp[];
  REQUEST_DATA: RegExp[];
  PROBLEM: RegExp;
  PROBLEM_SPEC_DIRECT: RegExp[];
  // Phrases that express the "reason of the call/contact" etc.
  PROBLEM_REASON?: RegExp[];
  CONFIRM_DATA: RegExp[];
  SUMMARY: RegExp[];
  BACKEND_CALL: RegExp[];
};

export type Inference = {
  type: HeuristicType;
  score: number;
  lang?: Lang;
  reason?: string;
};

export type InferOptions = {
  languageOrder?: Lang[];
  minScore?: number;
};


