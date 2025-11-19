/**
 * Script per generare contract NLP per template di dati
 * Legge template da Task_Templates e costanti da Constants
 * Genera contract completi (regex, rules, NER, LLM) e li salva nei template
 */

const { MongoClient } = require('mongodb');

// Import generatori (se usiamo TypeScript, compilare prima o usare ts-node)
// Per ora usiamo require con path relativo
const path = require('path');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const DB_NAME = 'factory';

async function generateContracts() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(DB_NAME);
    const templatesCollection = db.collection('Task_Templates');

    // Per ora generiamo solo DATE (primo caso completo)
    // TODO: Aggiungere NAME, EMAIL, PHONE dopo validazione DATE

    console.log('🔍 Looking for DATE template...');
    const dateTemplate = await templatesCollection.findOne({
      $or: [
        { name: 'date' },
        { type: 'date' },
        { label: /date/i }
      ]
    });

    if (!dateTemplate) {
      console.error('❌ Template DATE non trovato nel database');
      console.log('💡 Assicurati che esista un template con name="date" o type="date"');
      return;
    }

    console.log(`✅ Found DATE template: ${dateTemplate.label || dateTemplate.name}\n`);

    // Per ora usiamo una versione semplificata in JS
    // TODO: Compilare TypeScript o usare ts-node per usare i generatori TypeScript
    console.log('📝 Generating DATE contract...');

    // Carica costanti
    const constantsCollection = db.collection('Constants');
    const monthsConstants = await constantsCollection.find({ type: 'months', scope: 'global' }).toArray();
    const separatorsConstant = await constantsCollection.findOne({ type: 'separators', locale: 'global' });

    if (monthsConstants.length === 0) {
      throw new Error('Constants for months not found. Run populate-constants.js first.');
    }
    if (!separatorsConstant) {
      throw new Error('Constants for separators not found. Run populate-constants.js first.');
    }

    // Genera contract (logica semplificata in JS per ora)
    const contract = await generateDateContract(dateTemplate, monthsConstants, separatorsConstant);

    // Salva contract nel template
    await templatesCollection.updateOne(
      { _id: dateTemplate._id },
      { $set: { nlpContract: contract } }
    );

    console.log('✅ DATE contract generated and saved\n');
    console.log('📋 Contract summary:');
    console.log(`   - Template: ${contract.templateName}`);
    console.log(`   - Regex patterns: ${contract.regex.patterns.length}`);
    console.log(`   - Test cases: ${contract.regex.testCases.length}`);
    console.log(`   - NER enabled: ${contract.ner?.enabled || false}`);
    console.log(`   - LLM enabled: ${contract.llm.enabled}`);

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

/**
 * Genera contract DATE (versione semplificata in JS)
 * TODO: Sostituire con chiamata a DateContractGenerator TypeScript
 */
async function generateDateContract(template, monthsConstants, separatorsConstant) {
  // Costruisci subDataMapping
  const subDataMapping = {};
  const subData = template.subData || template.subDataIds || [];

  subData.forEach((sub, index) => {
    const subId = sub.id || sub._id || `sub-${index}`;
    const label = String(sub.label || sub.name || '').toLowerCase();

    let canonicalKey = 'generic';
    if (label.includes('day') || label.includes('giorno')) canonicalKey = 'day';
    else if (label.includes('month') || label.includes('mese')) canonicalKey = 'month';
    else if (label.includes('year') || label.includes('anno')) canonicalKey = 'year';

    subDataMapping[subId] = {
      canonicalKey,
      label: sub.label || sub.name || '',
      type: sub.type || 'generic'
    };
  });

  // Costruisci pattern mesi
  const allMonths = [];
  monthsConstants.forEach(constant => {
    if (constant.values.full) allMonths.push(...constant.values.full);
    if (constant.values.abbr) {
      allMonths.push(...constant.values.abbr.map(m => `${m}\\.?`));
    }
  });
  const monthsPattern = `(${Array.from(new Set(allMonths)).sort((a, b) => b.length - a.length).join('|')})`;

  // Costruisci mapping mesi
  const monthsMapping = {};
  monthsConstants.forEach(constant => {
    if (constant.mapping) {
      Object.assign(monthsMapping, constant.mapping);
    }
  });

  const separatorsPattern = separatorsConstant.values.pattern;
  const dayPattern = '(?<day>\\d{1,2})';
  const monthPattern = `(?<month>\\d{1,2}|${monthsPattern})`;
  const yearPattern = '(?<year>\\d{2,4})';

  return {
    templateName: 'date',
    templateId: template._id || template.id || template.name || 'date',
    subDataMapping,

    regex: {
      patterns: [
        `${dayPattern}?${separatorsPattern}${monthPattern}${separatorsPattern}${yearPattern}?`,
        `${monthPattern}${separatorsPattern}${dayPattern}?${separatorsPattern}${yearPattern}?`,
        `${dayPattern}?${separatorsPattern}${monthPattern}${separatorsPattern}${yearPattern}?`,
        `${monthPattern}${separatorsPattern}${yearPattern}?`,
        `${dayPattern}${separatorsPattern}${monthPattern}`
      ],
      examples: [
        '16/12/1980',
        'dicembre 12 1980',
        '12 dicembre 1980',
        '16-12-1980',
        'dic. 80',
        'dicembre 1980',
        '16 dicembre'
      ],
      testCases: [
        '16/12/1980',
        'dicembre 12 1980',
        '12 dicembre 1980',
        '16-12-1980',
        'dicembre 1980',
        '16 dicembre',
        'dicembre 12',
        'dic. 80',
        'dic 80',
        'pizza margherita',
        '123456'
      ]
    },

    rules: {
      extractorCode: generateExtractorCode(monthsPattern, separatorsPattern, monthsMapping),
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
      userPromptTemplate: `Extract date of birth from: "{text}". Sub-data structure: ${JSON.stringify(Object.values(subDataMapping).map(m => `${m.canonicalKey}: ${m.label}`).join(', '))}. Return JSON with optional keys: day, month, year.`,
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

function generateExtractorCode(monthsPattern, separatorsPattern, monthsMapping) {
  return `
// Date extractor with normalization
// Generated from DB constants - do not edit manually

const MONTHS_MAPPING = ${JSON.stringify(monthsMapping, null, 2)};

function normalizeDate(components) {
  const result = {};

  if (components.day !== undefined && components.day !== null) {
    const day = typeof components.day === 'string' ? parseInt(components.day, 10) : components.day;
    if (isNaN(day) || day < 1 || day > 31) return null;
    result.day = day;
  }

  if (components.month !== undefined && components.month !== null) {
    let month;
    if (typeof components.month === 'string') {
      const monthNum = parseInt(components.month, 10);
      if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
        month = monthNum;
      } else {
        const monthLower = components.month.toLowerCase().replace(/\\.$/, '');
        month = MONTHS_MAPPING[monthLower];
        if (!month) return null;
      }
    } else {
      month = components.month;
    }
    if (month < 1 || month > 12) return null;
    result.month = month;
  }

  if (components.year !== undefined && components.year !== null) {
    let year = typeof components.year === 'string' ? parseInt(components.year, 10) : components.year;
    if (isNaN(year)) return null;
    if (year < 100) {
      year = year < 50 ? 2000 + year : 1900 + year;
    }
    if (year < 1900 || year > 2100) return null;
    result.year = year;
  }

  return Object.keys(result).length > 0 ? result : null;
}

export function extractDate(text) {
  const patterns = [
    new RegExp(\`(?<day>\\\\d{1,2})?${separatorsPattern.replace(/[\\[\\]]/g, '')}(?<month>\\\\d{1,2}|${monthsPattern})${separatorsPattern.replace(/[\\[\\]]/g, '')}(?<year>\\\\d{2,4})?\`, 'i'),
    new RegExp(\`(?<month>${monthsPattern})${separatorsPattern.replace(/[\\[\\]]/g, '')}(?<day>\\\\d{1,2})?${separatorsPattern.replace(/[\\[\\]]/g, '')}(?<year>\\\\d{2,4})?\`, 'i'),
    new RegExp(\`(?<day>\\\\d{1,2})?${separatorsPattern.replace(/[\\[\\]]/g, '')}(?<month>${monthsPattern})${separatorsPattern.replace(/[\\[\\]]/g, '')}(?<year>\\\\d{2,4})?\`, 'i'),
    new RegExp(\`(?<month>${monthsPattern})${separatorsPattern.replace(/[\\[\\]]/g, '')}(?<year>\\\\d{2,4})?\`, 'i'),
    new RegExp(\`(?<day>\\\\d{1,2})${separatorsPattern.replace(/[\\[\\]]/g, '')}(?<month>${monthsPattern})\`, 'i')
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
      if (normalized) return normalized;
    }
  }

  return null;
}
`.trim();
}

generateContracts().catch(console.error);



