/**
 * Script: Rimuove factory_types dopo migrazione a Tasks
 *
 * PREREQUISITI:
 * - Tutti gli estrattori sono stati migrati in Tasks con nlpContract
 * - Backend Python è stato aggiornato per usare Tasks
 *
 * Esegui con: node backend/migrations/remove_factory_types.js
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function removeFactoryTypes() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');
    console.log('='.repeat(80));
    console.log('🗑️  RIMOZIONE factory_types (migrata a Tasks)');
    console.log('='.repeat(80));
    console.log();

    const db = client.db(dbFactory);

    // 1. Verifica che Tasks abbia estrattori con nlpContract
    console.log('📋 1. VERIFICA: Tasks con nlpContract');
    console.log('-'.repeat(80));

    const tasksWithNlpContract = await db.collection('Tasks').find({
      type: 3, // DataRequest
      $or: [
        { nlpContract: { $exists: true, $ne: null } },
        { 'mainData.0.nlpContract': { $exists: true, $ne: null } }
      ]
    }).toArray();

    console.log(`   ✅ Trovati ${tasksWithNlpContract.length} task con nlpContract in Tasks`);
    tasksWithNlpContract.forEach(t => {
      const name = t.name || t.label || t.id;
      console.log(`   - ${name}`);
    });

    // 2. Verifica factory_types
    console.log('\n📋 2. VERIFICA: factory_types');
    console.log('-'.repeat(80));

    const factoryTypes = await db.collection('factory_types').find({}).toArray();
    console.log(`   factory_types: ${factoryTypes.length} documenti`);

    if (factoryTypes.length > 0) {
      console.log('   Documenti:');
      factoryTypes.forEach(ft => {
        console.log(`   - ${ft.name || ft.id}`);
      });
    }

    // 3. Confronto
    console.log('\n📋 3. CONFRONTO');
    console.log('-'.repeat(80));

    if (tasksWithNlpContract.length >= factoryTypes.length) {
      console.log(`   ✅ Tasks ha ${tasksWithNlpContract.length} estrattori >= factory_types (${factoryTypes.length})`);
      console.log('   💡 factory_types può essere eliminata');
    } else {
      console.log(`   ⚠️  Tasks ha ${tasksWithNlpContract.length} estrattori < factory_types (${factoryTypes.length})`);
      console.log('   ⚠️  Verificare se tutti gli estrattori sono stati migrati');
    }

    // 4. Rimozione (solo se confermato)
    console.log('\n📋 4. RIMOZIONE');
    console.log('-'.repeat(80));

    if (factoryTypes.length === 0) {
      console.log('   ✅ factory_types è già vuota');
    } else {
      console.log('   ⚠️  ATTENZIONE: factory_types ha documenti');
      console.log('   ⚠️  Per eliminare, decommentare il codice seguente:');
      console.log('   // await db.collection("factory_types").drop();');
      console.log('   // console.log("✅ factory_types eliminata");');
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Verifica completata');
    console.log('='.repeat(80));
    console.log('\n💡 Per eliminare factory_types, decommentare il codice di rimozione');

  } catch (error) {
    console.error('❌ Errore:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connessione chiusa');
  }
}

if (require.main === module) {
  removeFactoryTypes().catch(console.error);
}

module.exports = { removeFactoryTypes };

