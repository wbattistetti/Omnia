export type WizardNLPContract = {
  templateName: string;
  templateId: string;
  subDataMapping: Record<string, {
    canonicalKey: string;
    /** Technical regex group name (format: g_[a-f0-9]{12}). Sole source of truth for extraction. */
    groupName: string;
    label: string;
    type: string;
  }>;
  regex: { patterns: string[]; testCases: string[] };
  rules: { extractorCode: string; validators: any[]; testCases: string[] };
  ner?: { entityTypes: string[]; confidence: number; enabled: boolean };
  llm: { systemPrompt: string; userPromptTemplate: string; responseSchema: object; enabled: boolean };
};
