// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { SemanticContract, EngineConfig, ExtractionResult, EngineType } from '../types/semanticContract';

/**
 * ContractExtractor: Runtime extraction engine that applies both engine and contract
 * This is the source of truth for extraction at runtime
 */
export class ContractExtractor {
  constructor(
    private contract: SemanticContract,
    private engine: EngineConfig
  ) {}

  /**
   * Extract values from text using engine + contract
   * Returns canonical output format
   *
   * Note: This is synchronous for backward compatibility, but some engines (LLM, NER, Embedding) are async
   * Use extractAsync() for full async support
   */
  extract(text: string): ExtractionResult {
    // For sync engines (regex, rule_based), use sync extraction
    if (this.engine.type === 'regex' || this.engine.type === 'rule_based') {
      const rawValues = this.engine.type === 'regex'
        ? this.applyRegexEngine(text)
        : this.applyRuleBasedEngine(text);

      const normalizedValues = this.applyContractNormalization(rawValues);
      const validation = this.validateWithContract(normalizedValues);
      const constrainedValues = this.applyContractConstraints(normalizedValues);

      return {
        values: constrainedValues,
        hasMatch: validation.valid,
        errors: validation.errors,
        source: this.engine.type,
        confidence: this.calculateConfidence(normalizedValues, validation)
      };
    }

    // For async engines, return empty result (caller should use extractAsync)
    console.warn('[ContractExtractor] extract() called with async engine, use extractAsync() instead');
    return {
      values: {},
      hasMatch: false,
      source: null,
      errors: ['Async engine requires extractAsync()'],
      confidence: 0
    };
  }

  /**
   * Extract values from text using engine + contract (async version)
   * Returns canonical output format
   */
  async extractAsync(text: string): Promise<ExtractionResult> {
    // 1. Apply engine to extract raw values
    const rawValues = await this.applyEngine(text);

    // 2. Apply contract for normalization
    const normalizedValues = this.applyContractNormalization(rawValues);

    // 3. Apply contract for validation
    const validation = this.validateWithContract(normalizedValues);

    // 4. Apply contract for constraints
    const constrainedValues = this.applyContractConstraints(normalizedValues);

    // 5. Produce canonical output
    return {
      values: constrainedValues,
      hasMatch: validation.valid,
      errors: validation.errors,
      source: this.engine.type,
      confidence: this.calculateConfidence(normalizedValues, validation)
    };
  }

  /**
   * Apply engine to extract raw values
   */
  private async applyEngine(text: string): Promise<Record<string, any>> {
    switch (this.engine.type) {
      case 'regex':
        return this.applyRegexEngine(text);
      case 'llm':
        return await this.applyLLMEngine(text);
      case 'rule_based':
        return this.applyRuleBasedEngine(text);
      case 'ner':
        return await this.applyNEREngine(text);
      case 'embedding':
        return await this.applyEmbeddingEngine(text);
      default:
        return {};
    }
  }

  /**
   * Extract with escalation support (tries multiple engines in order)
   * Returns the first successful extraction or empty if all fail
   *
   * This is a static method that creates extractors for each engine
   */
  static async extractWithEscalation(
    contract: SemanticContract,
    escalation: Array<{ type: EngineType; priority: number; enabled: boolean }>,
    engines: Map<EngineType, EngineConfig>,
    text: string
  ): Promise<ExtractionResult> {
    // Sort engines by priority
    const sortedEngines = escalation
      .filter(e => e.enabled)
      .sort((a, b) => a.priority - b.priority);

    // Try each engine in order
    for (const engineConfig of sortedEngines) {
      const engine = engines.get(engineConfig.type);
      if (!engine) {
        console.warn(`[ContractExtractor] Engine ${engineConfig.type} not found in engines map`);
        continue;
      }

      try {
        // Create extractor for this engine
        const extractor = new ContractExtractor(contract, engine);
        const result = await extractor.extractAsync(text);

        // If we got a match, return it
        if (result.hasMatch && Object.keys(result.values).length > 0) {
          return result;
        }
      } catch (error) {
        console.error(`[ContractExtractor] Engine ${engineConfig.type} failed:`, error);
        // Continue to next engine
      }
    }

    // All engines failed
    return {
      values: {},
      hasMatch: false,
      source: null,
      errors: ['All extraction engines failed'],
      confidence: 0
    };
  }

  /**
   * Apply regex engine
   */
  private applyRegexEngine(text: string): Record<string, any> {
    const regex = this.engine.config.regex;
    if (!regex) {
      return {};
    }

    try {
      const match = text.match(new RegExp(regex, 'g'));
      if (!match || match.length === 0) {
        return {};
      }

      // Find the longest match (best match)
      let bestMatch: RegExpExecArray | null = null;
      let longestMatch = '';
      const re = new RegExp(regex, 'g');
      let m: RegExpExecArray | null;

      re.lastIndex = 0;
      while ((m = re.exec(text)) !== null) {
        if (m[0].length > longestMatch.length) {
          longestMatch = m[0];
          bestMatch = m;
        }
      }

      if (!bestMatch) {
        // Fallback: try without global flag
        const reNoG = new RegExp(regex);
        const mNoG = text.match(reNoG);
        if (mNoG && mNoG[0].length > longestMatch.length) {
          bestMatch = mNoG as RegExpExecArray;
        }
      }

      if (!bestMatch) {
        return {};
      }

      // Extract named groups
      const extracted: Record<string, any> = {};
      if (bestMatch.groups) {
        Object.entries(bestMatch.groups).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            const trimmed = String(value).trim();
            if (trimmed !== '') {
              extracted[key] = trimmed;
            }
          }
        });
      }

      return extracted;
    } catch (error) {
      console.error('[ContractExtractor] Regex error:', error);
      return {};
    }
  }

  /**
   * Apply contract normalization rules
   * Supports both new structure (subentities) and legacy (subgroups)
   */
  private applyContractNormalization(rawValues: Record<string, any>): Record<string, any> {
    const normalized: Record<string, any> = {};
    const subentities = this.contract.subentities || this.contract.subgroups || [];

    subentities.forEach(subgroup => {
      const rawValue = rawValues[subgroup.subTaskKey];
      if (rawValue === undefined) return;

      // Apply normalization defined in contract
      if (subgroup.normalization) {
        normalized[subgroup.subTaskKey] = this.applyNormalizationRule(
          rawValue,
          subgroup.normalization,
          subgroup.subTaskKey
        );
      } else {
        normalized[subgroup.subTaskKey] = rawValue;
      }
    });

    return normalized;
  }

  /**
   * Apply a single normalization rule
   */
  private applyNormalizationRule(value: any, rule: string, subTaskKey: string): any {
    // Year normalization: "year always 4 digits (61 -> 1961, 05 -> 2005)"
    if (rule.includes('year') && rule.includes('4 digits')) {
      const num = parseInt(String(value), 10);
      if (!isNaN(num) && num < 100) {
        return num < 50 ? 2000 + num : 1900 + num;
      }
      return num;
    }

    // Month normalization: "month always numeric (january -> 1, february -> 2)"
    if (rule.includes('month') && rule.includes('numeric')) {
      const monthNames = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december',
        'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
        'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
        'gen', 'feb', 'mar', 'apr', 'mag', 'giu',
        'lug', 'ago', 'set', 'ott', 'nov', 'dic'
      ];

      const valueStr = String(value).toLowerCase().trim();
      const monthIndex = monthNames.indexOf(valueStr);
      if (monthIndex >= 0) {
        return (monthIndex % 12) + 1;
      }

      // Try numeric
      const num = parseInt(valueStr, 10);
      if (!isNaN(num) && num >= 1 && num <= 12) {
        return num;
      }

      return value;
    }

    // Day normalization: "day always numeric (1-31)"
    if (rule.includes('day') && rule.includes('numeric')) {
      const num = parseInt(String(value), 10);
      if (!isNaN(num) && num >= 1 && num <= 31) {
        return num;
      }
      return value;
    }

    // Default: return as-is
    return value;
  }

  /**
   * Validate extracted values against contract
   * Uses StructuredConstraint if available, otherwise uses heuristics
   */
  private validateWithContract(values: Record<string, any>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const subentities = this.contract.subentities || this.contract.subgroups || [];

    subentities.forEach(subgroup => {
      const value = values[subgroup.subTaskKey];

      // Check required fields (if not optional)
      if (!subgroup.optional && (value === undefined || value === null || value === '')) {
        errors.push(`Missing required field: ${subgroup.label} (${subgroup.subTaskKey})`);
      }

      // Use StructuredConstraint if available
      if (subgroup.constraints) {
        const constraint = subgroup.constraints;

        // Min/Max validation
        if (constraint.min !== undefined && value !== undefined && value !== null) {
          const num = typeof value === 'number' ? value : parseFloat(String(value));
          if (!isNaN(num) && num < constraint.min) {
            errors.push(`Value for ${subgroup.label} (${num}) is below minimum (${constraint.min})`);
          }
        }
        if (constraint.max !== undefined && value !== undefined && value !== null) {
          const num = typeof value === 'number' ? value : parseFloat(String(value));
          if (!isNaN(num) && num > constraint.max) {
            errors.push(`Value for ${subgroup.label} (${num}) is above maximum (${constraint.max})`);
          }
        }

        // Length validation
        if (constraint.minLength !== undefined && value !== undefined && value !== null) {
          const str = String(value);
          if (str.length < constraint.minLength) {
            errors.push(`Value for ${subgroup.label} (${str.length} chars) is below minimum length (${constraint.minLength})`);
          }
        }
        if (constraint.maxLength !== undefined && value !== undefined && value !== null) {
          const str = String(value);
          if (str.length > constraint.maxLength) {
            errors.push(`Value for ${subgroup.label} (${str.length} chars) is above maximum length (${constraint.maxLength})`);
          }
        }

        // Pattern validation
        if (constraint.pattern && value !== undefined && value !== null) {
          const regex = new RegExp(constraint.pattern);
          if (!regex.test(String(value))) {
            errors.push(`Value for ${subgroup.label} does not match required pattern`);
          }
        }
      }

      // Type validation (fallback if no constraint)
      if (value !== undefined && value !== null && subgroup.type && !subgroup.constraints) {
        if (subgroup.type === 'number') {
          const num = typeof value === 'number' ? value : parseInt(String(value), 10);
          if (isNaN(num)) {
            errors.push(`Invalid number for ${subgroup.label}: ${value}`);
          }
        }
      }

      // Heuristic range validation for dates (if no constraint)
      if (!subgroup.constraints) {
        if (subgroup.subTaskKey.includes('day')) {
          const day = typeof value === 'number' ? value : parseInt(String(value), 10);
          if (!isNaN(day) && (day < 1 || day > 31)) {
            errors.push(`Invalid day: ${day} (must be 1-31)`);
          }
        }
        if (subgroup.subTaskKey.includes('month')) {
          const month = typeof value === 'number' ? value : parseInt(String(value), 10);
          if (!isNaN(month) && (month < 1 || month > 12)) {
            errors.push(`Invalid month: ${month} (must be 1-12)`);
          }
        }
        if (subgroup.subTaskKey.includes('year')) {
          const year = typeof value === 'number' ? value : parseInt(String(value), 10);
          if (!isNaN(year) && (year < 1900 || year > 2100)) {
            errors.push(`Invalid year: ${year} (must be 1900-2100)`);
          }
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Apply contract constraints
   */
  private applyContractConstraints(values: Record<string, any>): Record<string, any> {
    // For now, just return normalized values
    // Can be extended with additional constraint logic
    return values;
  }

  /**
   * Apply rule-based engine
   */
  private applyRuleBasedEngine(text: string): Record<string, any> {
    const rules = this.engine.config.rules;
    if (!rules || !Array.isArray(rules)) {
      return {};
    }

    const extracted: Record<string, any> = {};

    // Apply each rule in order
    for (const rule of rules) {
      // Simple rule evaluation (can be extended)
      // For now, rules are expected to be pre-compiled patterns
      // TODO: Implement full rule engine with condition evaluation
      if (rule.condition && rule.action) {
        // Basic pattern matching for now
        const conditionRegex = new RegExp(rule.condition, 'i');
        if (conditionRegex.test(text)) {
          // Extract value based on action
          const actionRegex = new RegExp(rule.action, 'i');
          const match = text.match(actionRegex);
          if (match && match.groups) {
            Object.assign(extracted, match.groups);
          }
        }
      }
    }

    return extracted;
  }

  /**
   * Apply NER engine
   */
  private async applyNEREngine(text: string): Promise<Record<string, any>> {
    const entityTypes = this.engine.config.nerEntityTypes;
    if (!entityTypes) {
      return {};
    }

    try {
      // Call NER backend endpoint
      const response = await fetch('/api/ner/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          entityTypes: entityTypes
        })
      });

      if (!response.ok) {
        console.error('[ContractExtractor] NER extraction failed:', response.statusText);
        return {};
      }

      const result = await response.json();
      const extracted: Record<string, any> = {};

      // Map NER entities to contract subTaskKeys
      if (result.candidates && Array.isArray(result.candidates)) {
        for (const candidate of result.candidates) {
          if (candidate.value) {
            // Map entity types to subTaskKeys
            Object.entries(entityTypes).forEach(([subTaskKey, entityType]) => {
              if (candidate.entityType === entityType && candidate.value[subTaskKey]) {
                extracted[subTaskKey] = candidate.value[subTaskKey];
              }
            });
          }
        }
      }

      return extracted;
    } catch (error) {
      console.error('[ContractExtractor] NER engine error:', error);
      return {};
    }
  }

  /**
   * Apply Embedding engine
   */
  private async applyEmbeddingEngine(text: string): Promise<Record<string, any>> {
    const examples = this.engine.config.embeddingExamples;
    const threshold = this.engine.config.embeddingThreshold || 0.7;

    if (!examples || (!examples.positive || examples.positive.length === 0)) {
      return {};
    }

    try {
      // Compute embedding for input text
      const response = await fetch('/api/intents/classify-embedding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          intentIds: [] // Will be populated by backend based on examples
        })
      });

      if (!response.ok) {
        console.error('[ContractExtractor] Embedding extraction failed:', response.statusText);
        return {};
      }

      const result = await response.json();
      const extracted: Record<string, any> = {};

      // If similarity is above threshold, extract values
      if (result.best && result.best.score >= threshold) {
        // Map embedding result to contract structure
        // This is simplified - in practice, you'd need to map the embedding match to actual values
        // For now, return the matched text as a single value
        const subentities = this.contract.subentities || this.contract.subgroups || [];
        if (subentities.length === 1) {
          extracted[subentities[0].subTaskKey] = text; // Simplified: return full text
        }
      }

      return extracted;
    } catch (error) {
      console.error('[ContractExtractor] Embedding engine error:', error);
      return {};
    }
  }

  /**
   * Apply LLM engine
   */
  private async applyLLMEngine(text: string): Promise<Record<string, any>> {
    const promptTemplate = this.engine.config.llmPrompt;
    if (!promptTemplate) {
      return {};
    }

    try {
      // Build prompt from template and contract
      const prompt = this.buildLLMPrompt(promptTemplate, text);

      // Call LLM backend endpoint
      const response = await fetch('/api/nlp/llm-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          prompt,
          schema: this.contract.outputCanonical
        })
      });

      if (!response.ok) {
        console.error('[ContractExtractor] LLM extraction failed:', response.statusText);
        return {};
      }

      const result = await response.json();

      // LLM should return values in canonical format
      if (result.values && typeof result.values === 'object') {
        return result.values;
      }

      return {};
    } catch (error) {
      console.error('[ContractExtractor] LLM engine error:', error);
      return {};
    }
  }

  /**
   * Build LLM prompt from template
   */
  private buildLLMPrompt(template: string, text: string): string {
    const subentities = this.contract.subentities || this.contract.subgroups || [];
    const entityDescription = this.contract.entity?.description || this.contract.mainGroup?.description || '';

    // Replace placeholders in template
    return template
      .replace('{text}', text)
      .replace('{entityDescription}', entityDescription)
      .replace('{subentities}', JSON.stringify(subentities.map(sg => ({
        key: sg.subTaskKey,
        label: sg.label,
        meaning: sg.meaning
      })), null, 2))
      .replace('{outputSchema}', JSON.stringify(this.contract.outputCanonical, null, 2));
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    values: Record<string, any>,
    validation: { valid: boolean; errors: string[] }
  ): number {
    if (!validation.valid) {
      return 0;
    }

    const subentities = this.contract.subentities || this.contract.subgroups || [];
    const expectedKeys = this.contract.outputCanonical.keys || subentities.map(sg => sg.subTaskKey);
    const extractedKeys = Object.keys(values);

    if (expectedKeys.length === 0) {
      return extractedKeys.length > 0 ? 0.9 : 0;
    }

    // Confidence based on how many expected keys were extracted
    const coverage = extractedKeys.length / expectedKeys.length;

    // High confidence if all keys extracted
    if (coverage >= 1.0) {
      return 0.95;
    }

    // Medium confidence if partial extraction
    if (coverage >= 0.5) {
      return 0.7;
    }

    // Low confidence if minimal extraction
    return 0.5;
  }
}
