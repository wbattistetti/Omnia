/**
 * Date Contract Generator
 * Genera contract NLP completo per template DATE leggendo costanti dal DB
 * - Regex modulari con gruppi nominati opzionali
 * - Rules con normalizzazione centralizzata
 * - NER abilitato
 * - LLM prompt parametrico
 */

import { BaseContractGenerator, NLPContract, Constant } from './base-contract-generator';
import { normalizeDate, DateComponents } from '../postProcess/dateNormalizer';

export class DateContractGenerator extends BaseContractGenerator {
  async generateContract(template: any): Promise<NLPContract> {
    const templateId = template._id || template.id || template.name || 'date';
    const subDataMapping = this.buildSubDataMapping(template);

    // Carica costanti mesi dal DB
    const monthsConstants = await this.getConstantsByType('months', 'global');
    if (monthsConstants.length === 0) {
      throw new Error('Constants for months not found in DB. Run populate-constants.js first.');
    }

    // Carica separatori
    const separatorsConstant = await this.getConstant('separators', 'global', 'global');
    if (!separatorsConstant) {
      throw new Error('Constants for separators not found in DB. Run populate-constants.js first.');
    }

    // Costruisci pattern regex modulari
    const monthsPattern = this.buildMonthsPattern(monthsConstants);
    const separatorsPattern = separatorsConstant.values.pattern;
    const monthsMapping = this.buildMonthsMapping(monthsConstants);

    return {
      templateName: 'date',
      templateId,
      subDataMapping,

      regex: {
        // ✅ SINGOLA REGEX UNIVERSALE costruita dinamicamente dal DB
        patterns: [this.generateUniversalRegex(monthsPattern)],
        examples: [
          '12 aprile 1980',
          '12 abril 1980',
          '12 di aprile',
          '12 de abril',
          '02 abril',
          '2/4/1980',
          '2 abr 1980',
          'aprile 1980',
          'dic. 80',
          '16 dicembre'
        ],
        testCases: [
          // Completo
          '12 aprile 1980',
          '12 abril 1980',
          '2/4/1980',
          '16-12-1980',
          // Parziale
          '12 aprile',
          'aprile 1980',
          'dic. 80',
          // Con preposizioni
          '12 di aprile',
          '12 de abril',
          // Negativo
          'pizza margherita',
          '123456'
        ]
      },

      rules: {
        extractorCode: this.generateExtractorCode(monthsPattern, separatorsPattern, monthsMapping),
        validators: [
          { type: 'range', field: 'day', min: 1, max: 31 },
          { type: 'range', field: 'month', min: 1, max: 12 },
          { type: 'range', field: 'year', min: 1900, max: 2100 }
        ],
        testCases: [
          '16/12/1980',
          'dicembre 12',
          '1980'
        ]
      },

      ner: {
        entityTypes: ['DATE', 'BIRTHDATE'],
        confidence: 0.7,
        enabled: true
      },

      llm: {
        systemPrompt: 'You are a date extraction assistant. Extract date of birth from user input. Return JSON with keys: day (1-31), month (1-12), year (4 digits). All fields are optional for partial matches.',
        userPromptTemplate: this.generateLLMPrompt.bind(this),
        responseSchema: {
          type: 'object',
          properties: {
            day: { type: 'number', minimum: 1, maximum: 31 },
            month: { type: 'number', minimum: 1, maximum: 12 },
            year: { type: 'number', minimum: 1900, maximum: 2100 }
          }
        },
        enabled: true
      }
    };
  }

  /**
   * Genera SINGOLA regex TEMPLATE per date (con placeholder per mesi)
   * ✅ Il placeholder ${MONTHS_PLACEHOLDER} verrà sostituito quando si crea l'istanza
   * ✅ Permette: giorno+mese, mese+anno, solo mese, giorno+mese+anno
   * ✅ Mapping automatico tramite canonicalKey (day, month, year)
   */
  private generateUniversalRegex(monthsPattern: string): string {
    // ✅ NOTA: monthsPattern viene IGNORATO qui - usiamo placeholder
    // Il pattern verrà compilato quando si crea l'istanza con la lingua del progetto
    // ✅ Usa anchor ^...$ per forzare match completo (non spezza "12" in "1" + "2")

    // Giorno: 0?[1-9]|[12][0-9]|3[01] (1-31, con o senza zero iniziale) - OPCIONALE
    const dayPattern = '(?<day>0?[1-9]|[12][0-9]|3[01])';

    // Mese: testuale (PLACEHOLDER) O numerico (1-12) - OPCIONALE per permettere solo anno
    // ✅ ORDINE: nomi mesi (placeholder) prima dei numeri
    // ✅ Usa stringa letterale per placeholder (non template literal)
    // ✅ Mese numerico richiede separatore (per evitare che "1980" matchi "1" come mese)
    const monthPattern = `(?<month>${MONTHS_PLACEHOLDER}|(?:0?[1-9]|1[0-2])(?=${separators}|$))`;

    // Anno: 2 o 4 cifre - OPCIONALE
    const yearPattern = '(?<year>\\d{2,4})';

    // Separatori: uno o più spazi OPPURE separatore (/ - \) con spazi opzionali prima e dopo
    // Pattern: (\s+|\s*[/\\-]\s*)
    const separators = '(?:\\s+|\\s*[/\\\\-]\\s*)';

    // ✅ REGEX TEMPLATE con placeholder e anchor
    // ^...$  → forza match completo della stringa (non spezza "12" in "1" + "2")
    // [\s/\\-]+ → richiede almeno un separatore tra i componenti
    // Tutti i componenti sono opzionali: "1980" (solo anno), "aprile 1980" (mese+anno), "12 aprile 1980" (tutto), "12 aprile" (giorno+mese)
    // Pattern: (giorno+separatore)? (mese+separatore?)? (anno)?
    // ✅ Separatore dopo mese è opzionale (per permettere "12 aprile" senza anno)
    // ✅ Lookahead positivo per assicurare che almeno UN componente sia presente (non matcha stringa vuota)
    // Il placeholder ${MONTHS_PLACEHOLDER} verrà sostituito con i mesi reali quando si crea l'istanza
    // ✅ Mese numerico usa lookahead per richiedere separatore (evita match "1" in "1980")
    const monthWithLookahead = `(?<month>${MONTHS_PLACEHOLDER}|(?:0?[1-9]|1[0-2])(?=${separators}|$))`;
    return `^(?=.*[0-9])(?:(?<day>0?[1-9]|[12][0-9]|3[01])${separators})?(?:(?:${monthWithLookahead})(?:${separators})?)?(?<year>\\d{2,4})?$`;
  }

  /**
   * Genera extractorCode TypeScript con costanti inline
   */
  private generateExtractorCode(
    monthsPattern: string,
    separatorsPattern: string,
    monthsMapping: Record<string, number>
  ): string {
    // Serializza monthsMapping come codice TypeScript
    const monthsMappingCode = JSON.stringify(monthsMapping, null, 2)
      .replace(/"/g, "'")
      .replace(/\n/g, '\n    ');

    return `
// Date extractor with normalization
// Generated from DB constants - do not edit manually

const MONTHS_MAPPING: Record<string, number> = ${monthsMappingCode};

function normalizeDate(components: { day?: number | string; month?: number | string; year?: number | string }): { day?: number; month?: number; year?: number } | null {
  const result: { day?: number; month?: number; year?: number } = {};

  // Normalizza day
  if (components.day !== undefined && components.day !== null) {
    const day = typeof components.day === 'string' ? parseInt(components.day, 10) : components.day;
    if (isNaN(day) || day < 1 || day > 31) {
      return null;
    }
    result.day = day;
  }

  // Normalizza month (testuale → numero)
  if (components.month !== undefined && components.month !== null) {
    let month: number;

    if (typeof components.month === 'string') {
      // Prova come numero
      const monthNum = parseInt(components.month, 10);
      if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
        month = monthNum;
      } else {
        // Prova come nome/abbreviazione
        const monthLower = components.month.toLowerCase().replace(/\\.$/, '');
        month = MONTHS_MAPPING[monthLower];
        if (!month) {
          return null;
        }
      }
    } else {
      month = components.month;
    }

    if (month < 1 || month > 12) {
      return null;
    }
    result.month = month;
  }

  // Normalizza year (2 cifre → 4 cifre)
  if (components.year !== undefined && components.year !== null) {
    let year = typeof components.year === 'string' ? parseInt(components.year, 10) : components.year;

    if (isNaN(year)) {
      return null;
    }

    // Normalizza anni a 2 cifre: < 50 → 2000+, >= 50 → 1900+
    if (year < 100) {
      year = year < 50 ? 2000 + year : 1900 + year;
    }

    if (year < 1900 || year > 2100) {
      return null;
    }
    result.year = year;
  }

  return Object.keys(result).length > 0 ? result : null;
}

export function extractDate(text: string): { day?: number; month?: number; year?: number } | null {
  // ✅ FIXED: Regex patterns riorganizzati per gestire correttamente "12 abril"
  // Pattern più specifici (numero + nome mese) vengono provati PRIMA
  const sep = \`${separatorsPattern.replace(/[\\[\\]]/g, '')}\`;
  const patterns = [
    // Pattern 1: DD MonthName YYYY (es. "12 abril 1980") - PRIORITÀ ALTA
    new RegExp(\`(?<day>\\\\d{1,2})\${sep}(?<month>${monthsPattern})\${sep}(?<year>\\\\d{2,4})?\`, 'i'),
    // Pattern 2: DD MonthName (es. "12 abril") - PRIORITÀ ALTA
    new RegExp(\`(?<day>\\\\d{1,2})\${sep}(?<month>${monthsPattern})\`, 'i'),
    // Pattern 3: DD/MM/YYYY o DD-MM-YYYY (numeri)
    new RegExp(\`(?<day>\\\\d{1,2})?\${sep}(?<month>\\\\d{1,2})\${sep}(?<year>\\\\d{2,4})?\`, 'i'),
    // Pattern 4: MonthName DD, YYYY (es. "dicembre 12, 1980")
    new RegExp(\`(?<month>${monthsPattern})\${sep}(?<day>\\\\d{1,2})?\${sep}(?<year>\\\\d{2,4})?\`, 'i'),
    // Pattern 5: DD MonthName YYYY (variante)
    new RegExp(\`(?<day>\\\\d{1,2})?\${sep}(?<month>${monthsPattern})\${sep}(?<year>\\\\d{2,4})?\`, 'i'),
    // Pattern 6: Solo MonthName + year (es. "abril 1980") - SOLO nomi, NON numeri
    new RegExp(\`(?<month>${monthsPattern})\${sep}(?<year>\\\\d{2,4})?\`, 'i'),
    // Pattern 7: Solo day + month numerico (es. "16/12")
    new RegExp(\`(?<day>\\\\d{1,2})\${sep}(?<month>\\\\d{1,2})\`, 'i')
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match.groups) {
      const components = {
        day: match.groups.day ? parseInt(match.groups.day, 10) : undefined,
        month: match.groups.month,
        year: match.groups.year ? parseInt(match.groups.year, 10) : undefined
      };

      const normalized = normalizeDate(components);
      if (normalized) {
        return normalized;
      }
    }
  }

  return null;
}
`.trim();
  }
}

