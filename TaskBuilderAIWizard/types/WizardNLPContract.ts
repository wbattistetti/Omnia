export type WizardNLPContract = {
  templateName: string;
  templateId: string;
  subDataMapping: Record<string, {
    canonicalKey: string;
    label: string;
    type: string;
  }>;
  regex: { patterns: string[]; testCases: string[] };
  rules: { extractorCode: string; validators: any[]; testCases: string[] };
  ner?: { entityTypes: string[]; confidence: number; enabled: boolean };
  llm: { systemPrompt: string; userPromptTemplate: string; responseSchema: object; enabled: boolean };
};
