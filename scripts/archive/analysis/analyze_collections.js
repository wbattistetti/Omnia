/**
 * Script: Analizza tutte le collection per capire quali sono obsolete
 *
 * Analizza:
 * - task_templates (lowercase) vs Task_Templates (uppercase) - già eliminata
 * - Factory Types (factory_types)
 * - DDT_library (ddt_library)
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';
const dbProjects = 'Projects';

async function analyze() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    const db = client.db(dbFactory);

    // ===================================
    // 1. ANALIZZA COLLECTIONS IN FACTORY
    // ===================================
    console.log('📋 Step 1: Collections in factory database...\n');

    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name).sort();

    console.log(`Trovate ${collectionNames.length} collections:\n`);
    collectionNames.forEach(name => {
      console.log(`   - ${name}`);
    });

    // ===================================
    // 2. ANALIZZA task_templates (lowercase)
    // ===================================
    console.log('\n' + '='.repeat(70));
    console.log('🔍 Step 2: Analizza task_templates (lowercase)...\n');

    try {
      const taskTemplatesLower = await db.collection('task_templates').find({}).toArray();
      console.log(`   task_templates (lowercase): ${taskTemplatesLower.length} documenti`);

      if (taskTemplatesLower.length > 0) {
        const sample = taskTemplatesLower[0];
        console.log(`   Campi: ${Object.keys(sample).join(', ')}`);
        console.log(`   ⚠️  Collection ancora presente con ${taskTemplatesLower.length} documenti`);
        console.log(`   💡 Verifica se è ancora usata o può essere eliminata`);
      } else {
        console.log(`   ✅ Collection vuota - può essere eliminata`);
      }
    } catch (error) {
      if (error.codeName === 'NamespaceNotFound') {
        console.log(`   ✅ Collection non esiste - già eliminata`);
      } else {
        console.log(`   ❌ Errore: ${error.message}`);
      }
    }

    // ===================================
    // 3. ANALIZZA Task_Templates (uppercase)
    // ===================================
    console.log('\n' + '='.repeat(70));
    console.log('🔍 Step 3: Analizza Task_Templates (uppercase)...\n');

    try {
      const taskTemplatesUpper = await db.collection('Task_Templates').find({}).toArray();
      console.log(`   Task_Templates (uppercase): ${taskTemplatesUpper.length} documenti`);

      if (taskTemplatesUpper.length > 0) {
        console.log(`   ⚠️  Collection ancora presente con ${taskTemplatesUpper.length} documenti`);
        console.log(`   💡 Dovrebbe essere stata eliminata - verifica`);
      } else {
        console.log(`   ✅ Collection vuota o non esiste - OK`);
      }
    } catch (error) {
      if (error.codeName === 'NamespaceNotFound') {
        console.log(`   ✅ Collection non esiste - già eliminata (OK)`);
      } else {
        console.log(`   ❌ Errore: ${error.message}`);
      }
    }

    // ===================================
    // 4. ANALIZZA Factory Types (factory_types)
    // ===================================
    console.log('\n' + '='.repeat(70));
    console.log('🔍 Step 4: Analizza Factory Types (factory_types)...\n');

    try {
      const factoryTypes = await db.collection('factory_types').find({}).toArray();
      console.log(`   factory_types: ${factoryTypes.length} documenti`);

      if (factoryTypes.length > 0) {
        const sample = factoryTypes[0];
        console.log(`   Campi: ${Object.keys(sample).join(', ')}`);
        console.log(`   Esempio tipo: ${sample.name || sample.id || 'N/A'}`);
        console.log(`   ✅ Collection attiva - usata per NLP extractors`);
        console.log(`   💡 Serve per definire tipi di estrazione (email, phone, date, ecc.)`);
      } else {
        console.log(`   ⚠️  Collection vuota - verifica se è ancora usata`);
      }
    } catch (error) {
      if (error.codeName === 'NamespaceNotFound') {
        console.log(`   ⚠️  Collection non esiste - verifica se è necessaria`);
      } else {
        console.log(`   ❌ Errore: ${error.message}`);
      }
    }

    // ===================================
    // 5. ANALIZZA DDT_library (ddt_library)
    // ===================================
    console.log('\n' + '='.repeat(70));
    console.log('🔍 Step 5: Analizza DDT_library (ddt_library)...\n');

    try {
      const ddtLibrary = await db.collection('ddt_library').find({}).toArray();
      console.log(`   ddt_library: ${ddtLibrary.length} documenti`);

      if (ddtLibrary.length > 0) {
        const sample = ddtLibrary[0];
        console.log(`   Campi: ${Object.keys(sample).join(', ')}`);
        console.log(`   Esempio scope: ${sample.scope || 'N/A'}`);
        console.log(`   Esempio label: ${sample.label || 'N/A'}`);
        console.log(`   ✅ Collection attiva - usata per DDT Library V2`);
        console.log(`   💡 Serve per template DDT riutilizzabili con scope filtering`);

        // Analizza scope
        const scopes = {};
        ddtLibrary.forEach(ddt => {
          const scope = ddt.scope || 'unknown';
          scopes[scope] = (scopes[scope] || 0) + 1;
        });
        console.log(`\n   Scope distribution:`);
        Object.entries(scopes).forEach(([scope, count]) => {
          console.log(`      - ${scope}: ${count} DDT`);
        });
      } else {
        console.log(`   ⚠️  Collection vuota - verifica se è ancora usata`);
      }
    } catch (error) {
      if (error.codeName === 'NamespaceNotFound') {
        console.log(`   ⚠️  Collection non esiste - verifica se è necessaria`);
      } else {
        console.log(`   ❌ Errore: ${error.message}`);
      }
    }

    // ===================================
    // 6. RIEPILOGO
    // ===================================
    console.log('\n' + '='.repeat(70));
    console.log('📊 RIEPILOGO');
    console.log('='.repeat(70));

    const summary = {
      'task_templates (lowercase)': 'Da verificare se ancora usata',
      'Task_Templates (uppercase)': 'Eliminata (migrata a Tasks)',
      'factory_types': 'Attiva - NLP extractors',
      'ddt_library': 'Attiva - DDT Library V2'
    };

    Object.entries(summary).forEach(([name, status]) => {
      console.log(`${name}: ${status}`);
    });

    console.log('='.repeat(70));

    console.log('\n💡 RACCOMANDAZIONI:');
    console.log('   1. task_templates (lowercase) - Verifica se ancora referenziata nel codice');
    console.log('   2. Task_Templates (uppercase) - ✅ Già eliminata');
    console.log('   3. factory_types - ✅ Mantieni (usata per NLP)');
    console.log('   4. ddt_library - ✅ Mantieni (usata per DDT Library V2)');

  } catch (error) {
    console.error('❌ Errore:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connessione chiusa');
  }
}

if (require.main === module) {
  analyze().catch(console.error);
}

module.exports = { analyze };

