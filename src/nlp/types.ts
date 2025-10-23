export type Confidence = number; // 0..1

export type ExtractResult<T> = {
  value?: T;
  confidence: Confidence;
  missing?: string[];
  reasons?: string[];
  candidates?: Array<{ value: T; confidence: Confidence }>; // optional for multi-candidate extractors
};

export interface DataExtractor<T> {
  extract: (text: string, prev?: Partial<T>) => ExtractResult<T>;
  validate: (value: T) => { ok: boolean; errors?: string[] };
  format: (value: T) => string;
}

export type Registry = Record<string, DataExtractor<any>>;

export type SlotDecision<T> =
  | { status: 'accepted'; value: T; source: 'deterministic' | 'ner'; confidence: Confidence }
  | { status: 'ask-more'; missing: string[]; hint?: string; value?: Partial<T>; confidence?: Confidence }
  | { status: 'reject'; reasons: string[] };

export type DOB = { day?: number; month?: number; year?: number };
export type Phone = { e164: string };
export type Email = string;

export interface Validator {
  type: 'range' | 'format' | 'regex' | 'length' | 'custom';
  value?: any;
  min?: number;
  max?: number;
  pattern?: string;
  reason: string;
}

export interface NLPConfigDB {
  supportedKinds: string[];
  aliases: Record<string, string[]>;  // Changed to string[] for multiple aliases
  extractorMapping: Record<string, string>;
  typeMetadata: Record<string, {
    description: string;
    examples: string[];
    regex?: string[];
    validators?: Validator[];
    llmPrompt?: string;
    constraints?: any[];  // Additional constraints
    defaultValue?: any;   // Default value for the type
    formatHint?: string;  // Format guidance for UI
  }>;
  aiPrompts?: Record<string, any>;
  version: string;        // Config version
  lastUpdated: string;    // Last update timestamp
  // Enterprise features
  permissions?: {
    canEdit: boolean;
    canCreate: boolean;
    canDelete: boolean;
  };
  auditLog?: boolean;     // Enable audit logging
}

export interface FactoryType {
  id: string;
  name: string; // "number", "email", "phone"
  extractorCode: string; // Complete TypeScript code
  regexPatterns: string[];
  llmPrompt: string;
  nerRules: string;
  validators: any[];
  examples: string[];
  metadata: {
    description: string;
    version: string;
    lastUpdated: string;
    author?: string;
    tags?: string[];
  };
  permissions?: {
    canEdit: boolean;
    canCreate: boolean;
    canDelete: boolean;
    canShare: boolean;
  };
  auditLog?: boolean;
}

export interface FactoryDatabase {
  types: Record<string, FactoryType>; // name -> FactoryType
  version: string;
  lastUpdated: string;
  description: string;
}


