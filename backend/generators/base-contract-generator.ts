/**
 * Base Contract Generator
 * Classe base per generare contract NLP leggendo costanti dal DB Factory
 * Niente hardcoded: tutto dal database
 */

import { MongoClient } from 'mongodb';
import { randomBytes } from 'crypto';

/**
 * Generates a technical GUID-based regex group name.
 * Format: g_[a-f0-9]{12}
 * Must match the VB.NET constraint: ^g_[a-f0-9]{12}$
 */
function generateGroupName(): string {
  return 'g_' + randomBytes(6).toString('hex');
}

export interface SubDataMapping {
  [subId: string]: {
    /** Technical regex group name (format: s[0-9]+ or g_[a-f0-9]{12}). Sole source of truth for extraction. */
    groupName: string;
    label: string;
    type: string;
    patternIndex?: number;  // ✅ Context-aware: quale pattern usare per questo sub
  };
}

export interface NLPContract {
  templateName: string;
  templateId: string;
  subDataMapping: SubDataMapping;
  // ✅ TEST PHRASES at contract level (not in engines)
  testPhrases?: string[];
  regex: {
    patterns: string[];
    patternModes?: string[];  // ✅ Context-aware: ['main', 'day', 'month', 'year', ...]
    ambiguityPattern?: string;  // ✅ Regex per rilevare valori ambigui (es. numeri 1-12 per date)
    ambiguity?: {  // ✅ Configurazione ambiguità
      ambiguousValues: {
        pattern: string;  // Regex che matcha i valori ambigui
        description: string;  // Descrizione umana (es: "Numbers 1-12 can be interpreted as day or month")
      };
      ambiguousSubIds: string[];  // Lista di subId che possono essere ambigui
    };
  };
  rules: {
    extractorCode: string;
    validators: any[];
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

export interface Constant {
  _id: string;
  type: string;
  locale: string;
  scope: string;
  version: string;
  values: any;
  mapping?: Record<string, any>;
}

export abstract class BaseContractGenerator {
  protected db: any;
  protected constantsCache: Map<string, Constant> = new Map();

  constructor(db: any) {
    this.db = db;
  }

  abstract generateContract(template: any): Promise<NLPContract>;

  /**
   * Carica una costante dal DB (con cache)
   */
  protected async getConstant(type: string, locale: string, scope: string = 'global'): Promise<Constant | null> {
    const cacheKey = `${type}_${locale}_${scope}`;

    if (this.constantsCache.has(cacheKey)) {
      return this.constantsCache.get(cacheKey)!;
    }

    const constantsCollection = this.db.collection('Constants');
    const constant = await constantsCollection.findOne({
      type,
      locale,
      scope
    });

    if (constant) {
      this.constantsCache.set(cacheKey, constant);
    }

    return constant;
  }

  /**
   * Carica tutte le costanti di un tipo per tutte le lingue
   */
  protected async getConstantsByType(type: string, scope: string = 'global'): Promise<Constant[]> {
    const constantsCollection = this.db.collection('Constants');
    const constants = await constantsCollection.find({
      type,
      scope
    }).toArray();

    return constants;
  }

  /**
   * Builds SubDataMapping with deterministic groupNames (s1, s2, s3...).
   *
   * Each entry receives:
   *  - groupName:    Deterministic technical name (s[0-9]+) — sole regex group identifier.
   *  - label:        human-readable label (required).
   *  - type:         data type.
   *
   * Label must always exist (required in DDT structure).
   */
  protected buildSubDataMapping(template: any): SubDataMapping {
    const mapping: SubDataMapping = {};
    const subData = template.subData || template.subDataIds || [];

    subData.forEach((sub: any, index: number) => {
      const subId = sub.id || sub._id || `sub-${index}`;
      const label = sub.label || sub.name || '';

      if (!label) {
        console.warn('[BaseContractGenerator] Missing label for subData:', subId);
        return;
      }

      mapping[subId] = {
        groupName: `s${index + 1}`,  // Deterministic: s1, s2, s3...
        label,
        type: sub.type || 'generic'
      };
    });

    return mapping;
  }

  /**
   * Genera prompt LLM parametrico
   */
  protected generateLLMPrompt(contract: NLPContract, text: string): string {
    const subDataList = Object.entries(contract.subDataMapping)
      .map(([subId, mapping]) => `- ${subId} (${mapping.groupName}): ${mapping.label} (${mapping.type})`)
      .join('\n');

    const subIds = Object.keys(contract.subDataMapping).join(', ');

    return `Extract ${contract.templateName} from: "${text}"

Sub-data structure:
${subDataList}

Return JSON with optional keys (use subId): ${subIds}
Schema: ${JSON.stringify(contract.llm.responseSchema, null, 2)}`;
  }

  /**
   * Costruisce pattern regex per mesi da costanti DB
   * ✅ Supporta struttura semplificata (values come array) e legacy (values.full/abbr)
   */
  protected buildMonthsPattern(constants: Constant[]): string {
    const allMonths: string[] = [];

    for (const constant of constants) {
      // ✅ Nuova struttura semplificata: values è un array diretto
      if (Array.isArray(constant.values)) {
        allMonths.push(...constant.values);
      }
      // ✅ Legacy: supporta ancora full/abbr per retrocompatibilità
      else {
        if (constant.values.full && Array.isArray(constant.values.full)) {
          allMonths.push(...constant.values.full);
        }
        if (constant.values.abbr && Array.isArray(constant.values.abbr)) {
          // Aggiungi abbreviazioni con punto opzionale
          allMonths.push(...constant.values.abbr.map((m: string) => `${m}\\.?`));
        }
      }
    }

    // Rimuovi duplicati e ordina per lunghezza (più lunghi prima per match corretto)
    const unique = Array.from(new Set(allMonths)).sort((a, b) => b.length - a.length);

    return `(${unique.join('|')})`;
  }

  /**
   * Costruisce mapping mesi → numero da costanti DB
   */
  protected buildMonthsMapping(constants: Constant[]): Record<string, number> {
    const mapping: Record<string, number> = {};

    for (const constant of constants) {
      if (constant.mapping) {
        Object.assign(mapping, constant.mapping);
      }
    }

    return mapping;
  }
}

