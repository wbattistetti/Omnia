/**
 * Script: Distribuisce factory_types in Tasks elementari
 *
 * Per ogni estrattore in factory_types:
 * 1. Cerca task elementare corrispondente in Tasks
 * 2. Se trovato: aggiorna nlpContract con dati estrattore
 * 3. Se NON trovato: CREA nuovo task elementare con nlpContract completo
 *
 * Esegui con: node backend/migrations/distribute_factory_types_to_tasks.js
 */

const { MongoClient, ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

// ✅ TaskType enum
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

async function distribute() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');
    console.log('='.repeat(80));
    console.log('🔄 DISTRIBUZIONE factory_types → Tasks');
    console.log('='.repeat(80));
    console.log();

    const db = client.db(dbFactory);

    // 1. Carica estrattori da factory_types (escludi Configuration/Registry/Prompt)
    console.log('📋 1. Caricamento estrattori da factory_types');
    console.log('-'.repeat(80));

    const allFactoryTypes = await db.collection('factory_types').find({}).toArray();
    const extractors = allFactoryTypes.filter(ft => {
      const name = (ft.name || ft.id || '').toLowerCase();
      return !name.includes('configuration') &&
             !name.includes('registry') &&
             !name.includes('prompt') &&
             !name.includes('template');
    });

    console.log(`   Trovati ${extractors.length} estrattori (esclusi config/metadata):\n`);
    extractors.forEach(ext => {
      console.log(`   - ${ext.name || ext.id}`);
    });

    // 2. Per ogni estrattore, cerca o crea task
    console.log('\n📋 2. Distribuzione estrattori in Tasks');
    console.log('-'.repeat(80));

    let updated = 0;
    let created = 0;
    const notFound = [];

    for (const extractor of extractors) {
      const extractorName = extractor.name || extractor.id;
      const extractorNameLower = extractorName.toLowerCase();

      // Cerca task corrispondente
      const existingTask = await db.collection('Tasks').findOne({
        type: TaskType.DataRequest,
        $or: [
          { name: extractorNameLower },
          { name: extractorName },
          { label: { $regex: new RegExp(`^${extractorName}$`, 'i') } }
        ]
      });

      const nlpContract = buildNlpContractFromFactoryType(extractor, existingTask?.id || extractor.id || uuidv4());

      if (existingTask) {
        // ✅ Task esistente: aggiorna nlpContract
        console.log(`   ✅ ${extractorName}: Task esistente trovato (${existingTask.id || existingTask._id})`);

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
            id: existingTask.id || existingTask._id,
            label: extractorName,
            type: extractorNameLower,
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
        // ❌ Task NON trovato: CREA nuovo task elementare
        console.log(`   ⚠️  ${extractorName}: Task NON trovato → CREA nuovo task elementare`);

        const newTaskId = extractor.id || uuidv4();
        const newTask = {
          id: newTaskId,
          type: TaskType.DataRequest,
          templateId: null, // Standalone
          name: extractorNameLower,
          label: extractorName.charAt(0).toUpperCase() + extractorName.slice(1),
          nlpContract: nlpContract,
          mainData: [{
            id: newTaskId,
            label: extractorName.charAt(0).toUpperCase() + extractorName.slice(1),
            type: extractorNameLower,
            nlpContract: nlpContract,
            subData: []
          }],
          // Copia campi estrattore per compatibilità backend Python
          extractorCode: extractor.extractorCode,
          regexPatterns: extractor.regexPatterns,
          llmPrompt: extractor.llmPrompt,
          nerRules: extractor.nerRules,
          validators: extractor.validators,
          examples: extractor.examples,
          metadata: extractor.metadata || {},
          permissions: extractor.permissions || {},
          auditLog: extractor.auditLog || false,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await db.collection('Tasks').insertOne(newTask);
        console.log(`      → Task creato: ${newTaskId}`);
        created++;
        notFound.push(extractorName);
      }
    }

    // 3. Riepilogo
    console.log('\n📋 3. Riepilogo');
    console.log('-'.repeat(80));
    console.log(`   ✅ Task aggiornati: ${updated}`);
    console.log(`   ✅ Task creati: ${created}`);

    if (notFound.length > 0) {
      console.log(`\n   📝 Estrattori per cui è stato creato un nuovo task:`);
      notFound.forEach(name => {
        console.log(`      - ${name}`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Distribuzione completata');
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
  distribute().catch(console.error);
}

module.exports = { distribute };

