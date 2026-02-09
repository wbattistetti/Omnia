/**
 * Script per migrare i sinonimi da template.synonyms a Translations collection
 *
 * Struttura Translations per sinonimi:
 * {
 *   guid: "uuid-del-template",
 *   language: "it" | "en" | "pt",
 *   synonyms: ["chiedi", "domanda", "richiedi"],  // Array di sinonimi
 *   type: "Synonyms",
 *   category: "TaskTemplate" | "TypeTemplate",
 *   projectId: null,  // null per factory
 *   createdAt: Date,
 *   updatedAt: Date
 * }
 */

const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const DB_FACTORY = 'factory';
const LANGUAGES = ['it', 'en', 'pt'];

async function migrateSynonyms() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(DB_FACTORY);
    const typeTemplatesCollection = db.collection('type_templates');
    const taskTemplatesCollection = db.collection('Task_Templates'); // Se esiste
    const translationsCollection = db.collection('Translations');

    const synonymsToInsert = [];

    // STEP 1: Migra TypeTemplates (DDT templates)
    console.log('📚 STEP 1: Migrating TypeTemplates synonyms...\n');
    const typeTemplates = await typeTemplatesCollection.find({}).toArray();
    console.log(`Found ${typeTemplates.length} TypeTemplates\n`);

    for (const template of typeTemplates) {
      const templateId = template.id || template._id?.toString();
      if (!templateId) {
        console.log(`⚠️  Skipping template without ID:`, template.label || template.name);
        continue;
      }

      // Cerca prima in patterns, poi in synonyms (backward compatibility)
      const patternsRaw = template.patterns;
      const synonymsRaw = template.synonyms;

      if (!patternsRaw && (!synonymsRaw || (Array.isArray(synonymsRaw) && synonymsRaw.length === 0))) {
        continue; // No patterns/synonyms to migrate
      }

      console.log(`  Processing: ${template.label || template.name} (ID: ${templateId})`);

      // Estrai sinonimi per ogni lingua (da patterns o synonyms)
      const synonymsByLang = patternsRaw
        ? extractSynonymsFromPatterns(patternsRaw)
        : extractSynonymsByLanguage(synonymsRaw);

      // Crea documenti Translations per ogni lingua
      for (const lang of LANGUAGES) {
        const synonyms = synonymsByLang[lang] || [];
        if (synonyms.length === 0) continue;

        synonymsToInsert.push({
          guid: templateId,
          language: lang,
          synonyms: synonyms, // Array di sinonimi
          type: 'Synonyms',
          category: 'TypeTemplate',
          projectId: null,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        console.log(`    ✅ ${lang}: ${synonyms.length} synonyms`);
      }
    }

    // STEP 2: Migra TaskTemplates (se esistono)
    console.log('\n📚 STEP 2: Migrating TaskTemplates synonyms...\n');
    let taskTemplates = [];
    try {
      taskTemplates = await taskTemplatesCollection.find({}).toArray();
      console.log(`Found ${taskTemplates.length} TaskTemplates\n`);
    } catch (error) {
      console.log('⚠️  TaskTemplates collection not found or empty, skipping...\n');
    }

    for (const template of taskTemplates) {
      const templateId = template.id || template._id?.toString();
      if (!templateId) {
        console.log(`⚠️  Skipping template without ID:`, template.label || template.name);
        continue;
      }

      // Cerca prima in patterns, poi in synonyms (backward compatibility)
      const patternsRaw = template.patterns;
      const synonymsRaw = template.synonyms;

      if (!patternsRaw && (!synonymsRaw || (Array.isArray(synonymsRaw) && synonymsRaw.length === 0))) {
        continue; // No patterns/synonyms to migrate
      }

      console.log(`  Processing: ${template.label || template.name} (ID: ${templateId})`);

      // Estrai sinonimi per ogni lingua (da patterns o synonyms)
      const synonymsByLang = patternsRaw
        ? extractSynonymsFromPatterns(patternsRaw)
        : extractSynonymsByLanguage(synonymsRaw);

      // Crea documenti Translations per ogni lingua
      for (const lang of LANGUAGES) {
        const synonyms = synonymsByLang[lang] || [];
        if (synonyms.length === 0) continue;

        synonymsToInsert.push({
          guid: templateId,
          language: lang,
          synonyms: synonyms,
          type: 'Synonyms',
          category: 'TaskTemplate',
          projectId: null,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        console.log(`    ✅ ${lang}: ${synonyms.length} synonyms`);
      }
    }

    // STEP 3: Inserisci in Translations (upsert per evitare duplicati)
    console.log(`\n💾 STEP 3: Inserting ${synonymsToInsert.length} synonym documents into Translations...\n`);

    if (synonymsToInsert.length > 0) {
      const bulkOps = synonymsToInsert.map(doc => ({
        updateOne: {
          filter: {
            guid: doc.guid,
            language: doc.language,
            type: 'Synonyms',
            category: doc.category,
            projectId: doc.projectId
          },
          update: { $set: doc },
          upsert: true
        }
      }));

      const result = await translationsCollection.bulkWrite(bulkOps, { ordered: false });
      console.log(`✅ Inserted/Updated ${result.upsertedCount + result.modifiedCount} synonym documents`);
      console.log(`   Upserted: ${result.upsertedCount}`);
      console.log(`   Modified: ${result.modifiedCount}`);
    } else {
      console.log('⚠️  No synonyms to migrate');
    }

    // STEP 4: Statistiche finali
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 MIGRATION COMPLETE');
    console.log(`${'='.repeat(60)}`);
    console.log(`TypeTemplates processed: ${typeTemplates.length}`);
    console.log(`TaskTemplates processed: ${taskTemplates.length}`);
    console.log(`Synonym documents created: ${synonymsToInsert.length}`);

    // Verifica finale
    const totalSynonyms = await translationsCollection.countDocuments({ type: 'Synonyms' });
    console.log(`Total Synonyms in Translations: ${totalSynonyms}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n🔌 Connection closed');
  }
}

/**
 * Estrae sinonimi da patterns (regex) convertendoli in sinonimi semplici
 * Supporta formato: {IT: [...], EN: [...], PT: [...]} con regex patterns
 */
function extractSynonymsFromPatterns(patternsRaw) {
  const result = {
    it: [],
    en: [],
    pt: []
  };

  if (!patternsRaw || typeof patternsRaw !== 'object') return result;

  // Mappa lingue (supporta sia uppercase che lowercase)
  const langMap = {
    'it': 'it',
    'IT': 'it',
    'en': 'en',
    'EN': 'en',
    'pt': 'pt',
    'PT': 'pt'
  };

  for (const [key, patterns] of Object.entries(patternsRaw)) {
    const normalizedLang = langMap[key];
    if (!normalizedLang || !Array.isArray(patterns)) continue;

    // Converti ogni pattern regex in sinonimo semplice
    const synonyms = patterns.map(pattern => {
      // Rimuovi regex speciali: \b, ^, $, escape characters
      let synonym = String(pattern)
        .replace(/\\b/g, '')           // Rimuovi word boundaries
        .replace(/\\/g, '')            // Rimuovi escape characters
        .replace(/^\^/, '')            // Rimuovi inizio stringa
        .replace(/\$$/, '')            // Rimuovi fine stringa
        .replace(/[.*+?^${}()|[\]\\]/g, '') // Rimuovi altri caratteri regex
        .trim();

      return synonym;
    }).filter(s => s.length > 0); // Rimuovi vuoti

    result[normalizedLang] = synonyms;
  }

  return result;
}

/**
 * Estrae sinonimi per lingua da formato legacy
 * Supporta: array semplice, oggetto multilingua {it: [...], en: [...], pt: [...]}
 */
function extractSynonymsByLanguage(synonymsRaw) {
  const result = {
    it: [],
    en: [],
    pt: []
  };

  if (!synonymsRaw) return result;

  if (Array.isArray(synonymsRaw)) {
    // Array semplice: applica a tutte le lingue
    const normalized = synonymsRaw.map(s => String(s).trim()).filter(s => s);
    result.it = [...normalized];
    result.en = [...normalized];
    result.pt = [...normalized];
  } else if (typeof synonymsRaw === 'object' && synonymsRaw !== null) {
    // Oggetto multilingua: {it: [...], en: [...], pt: [...]}
    // Supporta sia lowercase che uppercase
    const langMap = {
      'it': 'it',
      'IT': 'it',
      'en': 'en',
      'EN': 'en',
      'pt': 'pt',
      'PT': 'pt'
    };

    for (const [key, value] of Object.entries(synonymsRaw)) {
      const normalizedLang = langMap[key];
      if (normalizedLang && Array.isArray(value)) {
        result[normalizedLang] = value.map(s => String(s).trim()).filter(s => s);
      }
    }
  }

  return result;
}

// Esegui migrazione
migrateSynonyms().catch(console.error);

