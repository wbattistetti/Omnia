/**
 * Script: Aggiorna task esistenti con nlpContract da factory_types
 *
 * Per ogni estrattore in factory_types:
 * 1. Cerca task corrispondente in Tasks (per nome o label)
 * 2. Se trovato: aggiorna nlpContract con dati estrattore
 * 3. NON crea nuovi task (solo aggiorna esistenti)
 *
 * Esegui con: node backend/migrations/update_tasks_with_nlpcontract.js
 */

const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

const TaskType = {
  DataRequest: 3
};

/**
 * Costruisce nlpContract da factory_type
 */
function buildNlpContractFromFactoryType(factoryType, taskId) {
  return {
    templateName: factoryType.name || factoryType.id,
    templateId: taskId,
    subDataMapping: {}, // Vuoto per task elementari
    regex: {
      patterns: factoryType.regexPatterns || [],
      examples: factoryType.examples || [],
      testCases: []
    },
    rules: {
      extractorCode: factoryType.extractorCode || '',
      validators: factoryType.validators || [],
      testCases: []
    },
    llm: {
      systemPrompt: factoryType.llmPrompt || '',
      userPromptTemplate: '',
      responseSchema: {},
      enabled: !!factoryType.llmPrompt
    },
    ner: factoryType.nerRules ? {
      entityTypes: [factoryType.name || factoryType.id],
      confidence: 0.8,
      enabled: true
    } : undefined
  };
}

/**
 * Cerca task corrispondente con ricerca flessibile
 */
async function findMatchingTask(db, extractorName) {
  const extractorNameLower = extractorName.toLowerCase();

  // Pattern di ricerca per ogni estrattore
  const searchPatterns = {
    'email': ['email', 'e-mail', 'mail'],
    'phone': ['phone', 'telefono', 'tel'],
    'date': ['date', 'data'],
    'dateofbirth': ['dateofbirth', 'date of birth', 'birth', 'nascita', 'data di nascita'],
    'number': ['number', 'numero', 'numeric']
  };

  const patterns = searchPatterns[extractorNameLower] || [extractorNameLower];

  // Cerca per name esatto
  let task = await db.collection('Tasks').findOne({
    type: TaskType.DataRequest,
    name: { $in: patterns }
  });

  if (task) return task;

  // Cerca per label (case-insensitive)
  task = await db.collection('Tasks').findOne({
    type: TaskType.DataRequest,
    label: { $regex: new RegExp(`^(${patterns.join('|')})$`, 'i') }
  });

  if (task) return task;

  // Cerca per label che contiene il pattern
  for (const pattern of patterns) {
    task = await db.collection('Tasks').findOne({
      type: TaskType.DataRequest,
      label: { $regex: new RegExp(pattern, 'i') }
    });
    if (task) return task;
  }

  return null;
}

async function update() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');
    console.log('='.repeat(80));
    console.log('🔄 AGGIORNAMENTO TASK CON NLP CONTRACT');
    console.log('='.repeat(80));
    console.log();

    const db = client.db(dbFactory);

    // 1. Carica estrattori da factory_types
    const allFactoryTypes = await db.collection('factory_types').find({}).toArray();
    const extractors = allFactoryTypes.filter(ft => {
      const name = (ft.name || ft.id || '').toLowerCase();
      return !name.includes('configuration') &&
             !name.includes('registry') &&
             !name.includes('prompt') &&
             !name.includes('template');
    });

    console.log(`📋 Trovati ${extractors.length} estrattori in factory_types:\n`);
    extractors.forEach(ext => {
      console.log(`   - ${ext.name || ext.id}`);
    });

    // 2. Per ogni estrattore, cerca e aggiorna task
    console.log('\n📋 Aggiornamento task esistenti:\n');
    console.log('-'.repeat(80));

    let updated = 0;
    let notFound = [];

    for (const extractor of extractors) {
      const extractorName = extractor.name || extractor.id;

      // Cerca task corrispondente con ricerca flessibile
      const existingTask = await findMatchingTask(db, extractorName);

      if (existingTask) {
        console.log(`   ✅ ${extractorName}: Task trovato (${existingTask.id || existingTask._id})`);
        console.log(`      Label: ${existingTask.label || 'N/A'}`);

        const taskId = existingTask.id || existingTask._id;
        const nlpContract = buildNlpContractFromFactoryType(extractor, taskId);

        const update = {
          $set: {
            nlpContract: nlpContract,
            updatedAt: new Date()
          }
        };

        // Aggiorna anche mainData[0].nlpContract se esiste
        if (existingTask.mainData && existingTask.mainData.length > 0) {
          update.$set['mainData.0.nlpContract'] = nlpContract;
        } else {
          // Se non ha mainData, crea struttura minima
          update.$set.mainData = [{
            id: taskId,
            label: existingTask.label || extractorName,
            type: (extractorName || 'generic').toLowerCase(),
            nlpContract: nlpContract,
            subData: []
          }];
        }

        await db.collection('Tasks').updateOne(
          { _id: existingTask._id },
          update
        );

        console.log(`      → nlpContract aggiornato`);
        updated++;
      } else {
        console.log(`   ❌ ${extractorName}: Task NON trovato`);
        notFound.push({
          extractor: extractorName,
          id: extractor.id,
          hasExtractorCode: !!extractor.extractorCode,
          hasRegexPatterns: !!(extractor.regexPatterns && extractor.regexPatterns.length > 0)
        });
      }
    }

    // 3. Riepilogo
    console.log('\n📋 Riepilogo');
    console.log('-'.repeat(80));
    console.log(`   ✅ Task aggiornati: ${updated}`);
    console.log(`   ❌ Estrattori senza corrispondenza: ${notFound.length}`);

    if (notFound.length > 0) {
      console.log(`\n   📝 ESTRATTORI PER CUI NON ESISTE TASK CORRISPONDENTE:`);
      console.log(`   (Questi estrattori non hanno task corrispondenti in Tasks)\n`);
      notFound.forEach(item => {
        console.log(`   - ${item.extractor}`);
        console.log(`     ID: ${item.id}`);
        console.log(`     extractorCode: ${item.hasExtractorCode ? '✅' : '❌'}`);
        console.log(`     regexPatterns: ${item.hasRegexPatterns ? '✅' : '❌'}`);
        console.log();
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Aggiornamento completato');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Errore:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connessione chiusa');
  }
}

if (require.main === module) {
  update().catch(console.error);
}

module.exports = { update };

