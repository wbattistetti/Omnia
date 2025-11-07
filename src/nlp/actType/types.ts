export type HeuristicType =
  | 'AI_AGENT'
  | 'MESSAGE'
  | 'REQUEST_DATA'
  | 'PROBLEM_SPEC'
  | 'SUMMARY'
  | 'BACKEND_CALL'
  | 'NEGOTIATION';

export type InternalType =
  | 'AIAgent'
  | 'Message'
  | 'DataRequest'
  | 'ProblemClassification'
  | 'Summarizer'
  | 'BackendCall'
  | 'Negotiation';

export type Lang = 'IT' | 'EN' | 'PT';

export type RuleSet = {
  AI_AGENT: RegExp[];
  MESSAGE: RegExp[];
  REQUEST_DATA: RegExp[];
  PROBLEM: RegExp;
  PROBLEM_SPEC_DIRECT: RegExp[];
  // Phrases that express the "reason of the call/contact" etc.
  PROBLEM_REASON?: RegExp[];
  SUMMARY: RegExp[];
  BACKEND_CALL: RegExp[];
  NEGOTIATION: RegExp[];
};

export type Inference = {
  type: HeuristicType;
  lang?: Lang;
  reason?: string;
};

export type InferOptions = {
  languageOrder?: Lang[];
};


