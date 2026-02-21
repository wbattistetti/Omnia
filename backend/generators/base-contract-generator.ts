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
    canonicalKey: string;
    /** Technical regex group name (format: g_[a-f0-9]{12}). Sole source of truth for extraction. */
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
  regex: {
    patterns: string[];
    patternModes?: string[];  // ✅ Context-aware: ['main', 'day', 'month', 'year', ...]
    ambiguityPattern?: string;  // ✅ Regex per rilevare valori ambigui (es. numeri 1-12 per date)
    ambiguity?: {  // ✅ Configurazione ambiguità
      ambiguousValues: {
        pattern: string;  // Regex che matcha i valori ambigui
        description: string;  // Descrizione umana (es: "Numbers 1-12 can be interpreted as day or month")
      };
      ambiguousCanonicalKeys: string[];  // Lista di canonicalKey che possono essere ambigui (es: ['day', 'month'])
    };
    testCases: string[];
  };
  rules: {
    extractorCode: string;
    validators: any[];
    testCases: string[];
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
   * Builds SubDataMapping with GUID groupNames.
   *
   * Each entry receives:
   *  - canonicalKey: semantic key (e.g. "day", "month") — UI/domain use only.
   *  - groupName:    GUID technical name (g_[a-f0-9]{12}) — sole regex group identifier.
   *  - label:        human-readable label.
   *  - type:         data type.
   *
   * Neither canonicalKey nor label must ever appear as a regex group name.
   */
  protected buildSubDataMapping(template: any): SubDataMapping {
    const mapping: SubDataMapping = {};
    const subData = template.subData || template.subDataIds || [];

    subData.forEach((sub: any, index: number) => {
      const subId = sub.id || sub._id || `sub-${index}`;
      const label = String(sub.label || sub.name || '').toLowerCase();

      const canonicalKey = this.mapLabelToCanonicalKey(label, sub.type);

      mapping[subId] = {
        canonicalKey,
        groupName: generateGroupName(),
        label: sub.label || sub.name || '',
        type: sub.type || 'generic'
      };
    });

    return mapping;
  }

  /**
   * Mappa label a canonicalKey (logica standard)
   */
  protected mapLabelToCanonicalKey(label: string, type?: string): string {
    const normalized = label.toLowerCase().replace(/[^a-z0-9]+/g, '');

    // Mapping esplicito per date
    if (normalized.includes('day') || normalized.includes('giorno') || normalized.includes('dia')) return 'day';
    if (normalized.includes('month') || normalized.includes('mese') || normalized.includes('mes')) return 'month';
    if (normalized.includes('year') || normalized.includes('anno') || normalized.includes('ano')) return 'year';

    // Mapping esplicito per name
    if (normalized.includes('first') || normalized.includes('nome') || normalized.includes('prenome')) return 'firstname';
    if (normalized.includes('last') || normalized.includes('cognome') || normalized.includes('sobrenome')) return 'lastname';

    // Fallback: usa il tipo o la label normalizzata
    return type === 'number' ? normalized : normalized;
  }

  /**
   * Genera prompt LLM parametrico
   */
  protected generateLLMPrompt(contract: NLPContract, text: string): string {
    const subDataList = Object.entries(contract.subDataMapping)
      .map(([subId, mapping]) => `- ${mapping.canonicalKey}: ${mapping.label} (${mapping.type})`)
      .join('\n');

    const canonicalKeys = Object.values(contract.subDataMapping)
      .map(m => m.canonicalKey)
      .join(', ');

    return `Extract ${contract.templateName} from: "${text}"

Sub-data structure:
${subDataList}

Return JSON with optional keys: ${canonicalKeys}
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

