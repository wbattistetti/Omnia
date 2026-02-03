// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { SemanticContract, EngineConfig, EngineType } from '../types/semanticContract';

/**
 * Prompt variables for AI generation
 */
export interface PromptVariables {
  contract: SemanticContract;
  currentText: string;
  testerFeedback: Array<{ value: string; expected: 'match' | 'no_match'; note?: string }>;
  engine: EngineType;
}

/**
 * FIXED PROMPT TEMPLATE - Structure is immutable, only variables are parametric
 * This ensures consistency, stability, and predictability
 */
const PROMPT_TEMPLATE = `CONTRACT (Semantic Definition - Invariant):

Main Entity:
- Name: {mainGroupName}
- Description: {mainGroupDescription}
- Type: {mainGroupKind}

Structure:
{subgroupsList}

Output Canonical Format:
{outputCanonicalFormat}

This contract defines WHAT must be recognized and HOW the result must be structured, regardless of the extraction engine.

ENGINE: {engineType}

{engineInstructions}

USER TEXT (regex + comments + instructions):
"""
{currentText}
"""

TESTER FEEDBACK:
{testerFeedback}

OUTPUT FORMAT:
{outputFormat}

No markdown. No code fences. No text outside the JSON. No comments. Only valid JSON.`;

/**
 * Build AI prompt using fixed template
 */
export function buildAIPrompt(vars: PromptVariables): string {
  const contractSection = formatContractSection(vars.contract);
  const engineSection = getEngineInstructions(vars.engine, vars.contract);
  const outputFormat = getOutputFormatForEngine(vars.engine);

  // Support both new structure (entity, subentities) and legacy (mainGroup, subgroups)
  const entityName = vars.contract.entity?.label || vars.contract.mainGroup?.name || 'entity';
  const entityDescription = vars.contract.entity?.description || vars.contract.mainGroup?.description || '';
  const entityKind = vars.contract.entity?.type || vars.contract.mainGroup?.kind || 'generic';
  const subgroups = vars.contract.subentities || vars.contract.subgroups || [];
  const outputKeys = vars.contract.outputCanonical.keys || [];

  return PROMPT_TEMPLATE
    .replace('{mainGroupName}', entityName)
    .replace('{mainGroupDescription}', entityDescription)
    .replace('{mainGroupKind}', entityKind)
    .replace('{subgroupsList}', formatSubgroupsList(subgroups))
    .replace('{outputCanonicalFormat}', formatOutputCanonical(outputKeys))
    .replace('{engineType}', vars.engine)
    .replace('{engineInstructions}', engineSection)
    .replace('{currentText}', vars.currentText)
    .replace('{testerFeedback}', JSON.stringify(vars.testerFeedback, null, 2))
    .replace('{outputFormat}', outputFormat);
}

/**
 * Format contract section
 * Supports both new structure (entity) and legacy (mainGroup)
 */
function formatContractSection(contract: SemanticContract): string {
  const entityName = contract.entity?.label || contract.mainGroup?.name || 'entity';
  const entityDescription = contract.entity?.description || contract.mainGroup?.description || '';
  return `Main Entity: ${entityName} (${entityDescription})`;
}

/**
 * Format subgroups list
 */
function formatSubgroupsList(subgroups: SemanticContract['subgroups']): string {
  return subgroups.map((sg, idx) => {
    const parts = [
      `${idx + 1}. ${sg.subTaskKey} (${sg.label}): ${sg.meaning}`,
      sg.optional ? '[optional]' : '[required]',
      sg.formats && sg.formats.length > 0 ? `Formats: ${sg.formats.join(', ')}` : '',
      sg.normalization ? `Normalization: ${sg.normalization}` : ''
    ].filter(Boolean);
    return `  ${parts.join(' - ')}`;
  }).join('\n');
}

/**
 * Format output canonical format
 */
function formatOutputCanonical(keys: string[]): string {
  if (keys.length === 0) {
    return '{\n  "value": "<extracted value>"\n}';
  }

  const entries = keys.map(key => `  "${key}": "<extracted value>"`).join(',\n');
  return `{\n${entries}\n}`;
}

/**
 * Get engine-specific instructions
 * All instructions are deterministic and based on the Semantic Contract
 */
function getEngineInstructions(engine: string, contract: SemanticContract): string {
  const subentities = contract.subentities || contract.subgroups || [];
  const outputKeys = contract.outputCanonical.keys || [];

  switch (engine) {
    case 'regex':
      return `Requirements:
1. Generate a JavaScript-compatible regular expression
2. Use EXACTLY these named groups (all optional):
${subentities.map(sg => `   - (?<${sg.subTaskKey}>...) for "${sg.label}"`).join('\n')}
3. Do NOT invent group names
4. Keep the same order of groups
5. Make every group optional (use (?<name>pattern)? syntax)
6. Escape special characters properly for JavaScript (use \\\\ for backslashes)
7. Respect ALL instructions found in the user text
8. Consider constraints: ${subentities.map(sg =>
  sg.constraints ? `${sg.subTaskKey}(${JSON.stringify(sg.constraints)})` : ''
).filter(Boolean).join(', ')}
9. Be robust, precise, readable and correct

Interpretation Rules:
- The regex in user text is only a starting point
- The rest of the text contains instructions about how the final regex must behave
- Use tester feedback to refine the regex:
  * If expected = "match" and no note → the string MUST match
  * If expected = "no_match" → the string MUST NOT match
  * If expected = "match" but note describes mismatch → adjust accordingly`;

    case 'llm':
      return `Requirements:
1. Generate an LLM extraction prompt template
2. The prompt must extract values in this EXACT canonical format:
${formatOutputCanonical(outputKeys)}
3. The prompt must describe the entity: ${contract.entity?.description || contract.mainGroup?.description}
4. For each subentity, include:
${subentities.map(sg => `   - ${sg.subTaskKey} (${sg.label}): ${sg.meaning}${sg.constraints ? ` - Constraints: ${JSON.stringify(sg.constraints)}` : ''}`).join('\n')}
5. Handle ambiguities intelligently
6. Respect ALL instructions found in the user text
7. Use tester feedback to refine the extraction prompt
8. Include few-shot examples if available

Output Format:
The LLM must return JSON matching the canonical format exactly.`;

    case 'rule_based':
      return `Requirements:
1. Generate explicit if-then rules (not regex, not LLM prompt)
2. Each rule must have:
   - condition: a clear condition description (e.g., "text contains date pattern dd/mm/yyyy")
   - action: what to extract (e.g., "extract day, month, year using regex pattern")
   - examples: example inputs that match this rule
3. Rules must respect constraints:
${subentities.map(sg =>
  sg.constraints ? `   - ${sg.subTaskKey}: ${JSON.stringify(sg.constraints)}` : ''
).filter(Boolean).join('\n')}
4. Rules must produce output in canonical format:
${formatOutputCanonical(outputKeys)}
5. Describe conditions clearly and unambiguously
6. Return rules + examples in structured format
7. Respect ALL instructions found in the user text`;

    case 'ner':
      return `Requirements:
1. Map each subentity to a Named Entity Recognition entity type
2. Use standard NER entity types (PERSON, DATE, LOCATION, ORGANIZATION, MONEY, etc.)
3. For each subentity, specify:
${subentities.map(sg => `   - ${sg.subTaskKey} (${sg.label}): map to entity type based on "${sg.meaning}"`).join('\n')}
4. Define context patterns to disambiguate entities when needed
5. Specify canonical formats for each entity type
6. Consider constraints when mapping:
${subentities.map(sg =>
  sg.constraints ? `   - ${sg.subTaskKey}: ${JSON.stringify(sg.constraints)}` : ''
).filter(Boolean).join('\n')}
7. Output must be in canonical format:
${formatOutputCanonical(outputKeys)}
8. Respect ALL instructions found in the user text`;

    case 'embedding':
      return `Requirements:
1. Generate seed examples for each subentity
2. Examples must be realistic and cover various formats
3. For each subentity, provide:
${subentities.map(sg => `   - ${sg.subTaskKey} (${sg.label}): positive examples that match "${sg.meaning}"`).join('\n')}
4. Include negative examples (what should NOT match)
5. Define similarity thresholds (0-1) for each subentity
6. Consider constraints when generating examples:
${subentities.map(sg =>
  sg.constraints ? `   - ${sg.subTaskKey}: ${JSON.stringify(sg.constraints)}` : ''
).filter(Boolean).join('\n')}
7. Examples should help train the embedding model to recognize the entity
8. Output must be in canonical format:
${formatOutputCanonical(outputKeys)}
9. Respect ALL instructions found in the user text`;

    default:
      return `Requirements for engine "${engine}" to be defined.`;
  }
}

/**
 * Get output format for specific engine
 * All formats must produce canonical output matching the contract
 */
function getOutputFormatForEngine(engine: string): string {
  switch (engine) {
    case 'regex':
      return `{
  "regex": "<final regex with named groups matching subTaskKeys>",
  "explanation": ["point 1", "point 2", "..."],
  "examples_match": ["...", "..."],
  "examples_no_match": [
    { "value": "...", "reason": "..." }
  ],
  "suggestions": ["...", "..."],
  "test_cases": ["...", "..."]
}`;
    case 'llm':
      return `{
  "extraction_prompt": "<prompt template for LLM extraction - must produce canonical format>",
  "explanation": ["...", "..."],
  "examples_match": ["...", "..."],
  "few_shot_examples": [
    { "input": "...", "output": { "canonical format" } }
  ],
  "confidence_threshold": 0.8
}`;
    case 'rule_based':
      return `{
  "rules": [
    {
      "condition": "<clear condition description>",
      "action": "<what to extract and how>",
      "examples": ["...", "..."]
    }
  ],
  "explanation": ["...", "..."],
  "output_format": "canonical format matching contract"
}`;
    case 'ner':
      return `{
  "entityTypes": {
    "<subTaskKey>": "<NER_ENTITY_TYPE>",
    ...
  },
  "contextPatterns": {
    "<subTaskKey>": "<pattern to disambiguate>",
    ...
  },
  "canonicalFormats": {
    "<subTaskKey>": "<how to format extracted entity>",
    ...
  },
  "explanation": ["...", "..."]
}`;
    case 'embedding':
      return `{
  "examples": {
    "positive": [
      { "text": "...", "expected": { "canonical format" } },
      ...
    ],
    "negative": [
      { "text": "...", "reason": "..." },
      ...
    ]
  },
  "thresholds": {
    "<subTaskKey>": 0.8,
    ...
  },
  "explanation": ["...", "..."]
}`;
    default:
      return `{
  "result": "..."
}`;
  }
}

/**
 * Get system message for specific engine
 */
export function getSystemMessageForEngine(engine: string): string {
  switch (engine) {
    case 'regex':
      return 'You are a regex expert. Always return valid JSON. Generate JavaScript-compatible regex patterns with named groups.';
    case 'llm':
      return 'You are an information extraction expert. Always return valid JSON. Generate LLM prompt templates that produce canonical output.';
    case 'rule_based':
      return 'You are a rule-based extraction expert. Always return valid JSON. Generate explicit if-then rules that produce canonical output.';
    case 'ner':
      return 'You are a Named Entity Recognition expert. Always return valid JSON. Map entities to standard NER types and produce canonical output.';
    case 'embedding':
      return 'You are an embedding and similarity matching expert. Always return valid JSON. Generate training examples that help recognize entities in canonical format.';
    default:
      return 'You are a data extraction expert. Always return valid JSON.';
  }
}
