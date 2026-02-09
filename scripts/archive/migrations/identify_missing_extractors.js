/**
 * Script: Identifica estrattori senza corrispondenza in Tasks
 *
 * SOLO IDENTIFICA e REPORT, NON crea task
 *
 * Esegui con: node backend/migrations/identify_missing_extractors.js
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

const TaskType = {
  DataRequest: 3
};

async function identify() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');
    console.log('='.repeat(80));
    console.log('🔍 IDENTIFICAZIONE ESTRATTORI SENZA CORRISPONDENZA');
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

    // 2. Per ogni estrattore, verifica se esiste task corrispondente
    console.log('\n📋 Verifica corrispondenza in Tasks:\n');
    console.log('-'.repeat(80));

    const found = [];
    const notFound = [];

    for (const extractor of extractors) {
      const extractorName = extractor.name || extractor.id;
      const extractorNameLower = extractorName.toLowerCase();

      const existingTask = await db.collection('Tasks').findOne({
        type: TaskType.DataRequest,
        $or: [
          { name: extractorNameLower },
          { name: extractorName },
          { label: { $regex: new RegExp(`^${extractorName}$`, 'i') } }
        ]
      });

      if (existingTask) {
        console.log(`   ✅ ${extractorName}: TROVATO (${existingTask.id || existingTask._id})`);
        found.push({
          extractor: extractorName,
          taskId: existingTask.id || existingTask._id,
          hasNlpContract: !!(existingTask.nlpContract || (existingTask.mainData && existingTask.mainData[0]?.nlpContract))
        });
      } else {
        console.log(`   ❌ ${extractorName}: NON TROVATO`);
        notFound.push({
          extractor: extractorName,
          id: extractor.id,
          hasExtractorCode: !!extractor.extractorCode,
          hasRegexPatterns: !!(extractor.regexPatterns && extractor.regexPatterns.length > 0)
        });
      }
    }

    // 3. Report finale
    console.log('\n' + '='.repeat(80));
    console.log('📊 RIEPILOGO');
    console.log('='.repeat(80));
    console.log(`\n   ✅ Estrattori con corrispondenza: ${found.length}`);
    console.log(`   ❌ Estrattori SENZA corrispondenza: ${notFound.length}`);

    if (notFound.length > 0) {
      console.log('\n   📝 ESTRATTORI PER CUI NON ESISTE TASK CORRISPONDENTE:');
      console.log('   (Questi sono gli estrattori che dovresti creare manualmente in Tasks)\n');
      notFound.forEach(item => {
        console.log(`   - ${item.extractor}`);
        console.log(`     ID: ${item.id}`);
        console.log(`     extractorCode: ${item.hasExtractorCode ? '✅' : '❌'}`);
        console.log(`     regexPatterns: ${item.hasRegexPatterns ? '✅' : '❌'}`);
        console.log();
      });
    }

    if (found.length > 0) {
      console.log('\n   ✅ ESTRATTORI CON CORRISPONDENZA:');
      found.forEach(item => {
        console.log(`   - ${item.extractor} → Task ${item.taskId} (nlpContract: ${item.hasNlpContract ? '✅' : '❌'})`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Identificazione completata');
    console.log('='.repeat(80));

    return { found, notFound };

  } catch (error) {
    console.error('❌ Errore:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connessione chiusa');
  }
}

if (require.main === module) {
  identify().catch(console.error);
}

module.exports = { identify };

