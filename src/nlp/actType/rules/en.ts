import { RuleSet } from '../types';

export const EN_RULES: RuleSet = {
  MESSAGE: [
    /^(say|tell|notify|display|announce|explain)\b/i,
    /^(says|tells|notifies|displays|announces|explains)\b/i,
  ],
  REQUEST_DATA: [
    /^(ask(\s+for)?|request|collect|prompt(\s+for)?|capture)\b/i,
    /^(asks(\s+for)?|requests|collects|prompts(\s+for)?|captures)\b/i,
  ],
  PROBLEM: /\b(issue|problem|error|failure|bug|symptom[s]?)\b/i,
  PROBLEM_SPEC_DIRECT: [
    /^(describe|explain|detail|list)\s+(the\s+)?(issue|problem|error|failure|bug|symptom[s]?)\b/i,
    /^(describes|explains|details|lists)\s+(the\s+)?(issue|problem|error|failure|bug|symptom[s]?)\b/i,
  ],
  PROBLEM_REASON: [
    /^(ask(\s+for)?|request)\s+(the\s+)?(problem|reason\s+for\s+(the\s+)?(call|contact|request))\b/i,
    /^(asks(\s+for)?|requests)\s+(the\s+)?(problem|reason\s+for\s+(the\s+)?(call|contact|request))\b/i,
  ],
  CONFIRM_DATA: [
    /^(confirm|verify|make\s+sure)\b/i,
    /\b(is (that )?correct|right)\??$/i,
    /^(confirms|verifies|makes\s+sure)\b/i,
  ],
  SUMMARY: [
    /^(summari[sz]e|recap|provide\s+a\s+summary)\b/i,
    /^(summari[sz]es|recaps|provides\s+a\s+summary)\b/i,
    /\b(in summary|in short)\b/i,
  ],
  BACKEND_CALL: [
    /\b(api|webhook|endpoint|crm|erp|token)\b/i,
    /\b(get|post|put|patch|delete)\b/i,
    /^(call|invoke|execute|fetch|update|delete|create)\b/i,
    /^(calls|invokes|executes|fetches|updates|deletes|creates)\b/i,
  ],
};


