/**
 * Analizza il contenuto effettivo di ddt_library per capire cosa contengono
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function analyze() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    const db = client.db(dbFactory);

    const ddtLibrary = await db.collection('ddt_library').find({}).toArray();
    console.log(`📋 Analizzando ${ddtLibrary.length} DDT in ddt_library...\n`);

    for (const ddt of ddtLibrary) {
      console.log('='.repeat(70));
      console.log(`DDT: ${ddt.id}`);
      console.log(`Label: ${ddt.label || 'N/A'}`);
      console.log(`Scope: ${ddt.scope || 'N/A'}`);
      console.log(`Migration Source: ${ddt._migrationSource || 'N/A'}`);
      console.log(`Original Act ID: ${ddt._originalActId || 'N/A'}`);
      console.log(`Original Project: ${ddt._originalProject || 'N/A'}`);
      console.log();

      console.log('Campi presenti:');
      console.log(`  - id: ${!!ddt.id}`);
      console.log(`  - label: ${!!ddt.label}`);
      console.log(`  - scope: ${!!ddt.scope}`);
      console.log(`  - ddt: ${!!ddt.ddt}`);
      console.log(`  - composition: ${!!ddt.composition}`);
      console.log(`  - _migrationSource: ${!!ddt._migrationSource}`);
      console.log(`  - _originalActId: ${!!ddt._originalActId}`);
      console.log();

      if (ddt.ddt) {
        console.log('Contenuto ddt:');
        console.log(`  - Tipo: ${typeof ddt.ddt}`);
        if (typeof ddt.ddt === 'object') {
          console.log(`  - Keys: ${Object.keys(ddt.ddt).join(', ')}`);
          console.log(`  - mainData: ${ddt.ddt.mainData ? (Array.isArray(ddt.ddt.mainData) ? `${ddt.ddt.mainData.length} elementi` : 'presente (non array)') : 'assente'}`);
          console.log(`  - steps: ${ddt.ddt.steps ? (typeof ddt.ddt.steps === 'object' ? `${Object.keys(ddt.ddt.steps).length} keys` : 'presente') : 'assente'}`);
          console.log(`  - label: ${ddt.ddt.label || 'assente'}`);

          // Mostra un sample del contenuto se presente
          if (ddt.ddt.mainData && Array.isArray(ddt.ddt.mainData) && ddt.ddt.mainData.length > 0) {
            console.log(`  - Sample mainData[0]:`, JSON.stringify(ddt.ddt.mainData[0], null, 2).substring(0, 200));
          }
        } else {
          console.log(`  - Valore: ${String(ddt.ddt).substring(0, 100)}`);
        }
        console.log();
      } else {
        console.log('⚠️  Campo ddt è assente o null');
        console.log();
      }

      if (ddt.composition) {
        console.log('Composition:');
        console.log(`  - Tipo: ${typeof ddt.composition}`);
        if (typeof ddt.composition === 'object') {
          console.log(`  - Keys: ${Object.keys(ddt.composition).join(', ')}`);
          if (ddt.composition.includes) {
            console.log(`  - includes: ${Array.isArray(ddt.composition.includes) ? ddt.composition.includes.join(', ') : ddt.composition.includes}`);
          }
          if (ddt.composition.extends) {
            console.log(`  - extends: presente`);
          }
        }
        console.log();
      }

      // Verifica se è un placeholder vuoto
      const isEmpty = !ddt.ddt ||
                     (ddt.ddt && typeof ddt.ddt === 'object' &&
                      (!ddt.ddt.mainData || (Array.isArray(ddt.ddt.mainData) && ddt.ddt.mainData.length === 0)) &&
                      (!ddt.ddt.steps || (typeof ddt.ddt.steps === 'object' && Object.keys(ddt.ddt.steps).length === 0)));

      if (isEmpty) {
        console.log('⚠️  Questo DDT è VUOTO (placeholder da migrazione?)');
      } else {
        console.log('✅ Questo DDT ha contenuto');
      }
      console.log();
    }

    // Riepilogo
    console.log('='.repeat(70));
    console.log('📊 RIEPILOGO');
    console.log('='.repeat(70));

    const emptyDDTs = ddtLibrary.filter(ddt =>
      !ddt.ddt ||
      (ddt.ddt && typeof ddt.ddt === 'object' &&
       (!ddt.ddt.mainData || (Array.isArray(ddt.ddt.mainData) && ddt.ddt.mainData.length === 0)) &&
       (!ddt.ddt.steps || (typeof ddt.ddt.steps === 'object' && Object.keys(ddt.ddt.steps).length === 0)))
    );

    console.log(`\nDDT vuoti: ${emptyDDTs.length}/${ddtLibrary.length}`);
    console.log(`DDT con contenuto: ${ddtLibrary.length - emptyDDTs.length}/${ddtLibrary.length}`);

    if (emptyDDTs.length === ddtLibrary.length) {
      console.log('\n⚠️  TUTTI i DDT in ddt_library sono VUOTI!');
      console.log('💡 Probabilmente sono placeholder da una migrazione incompleta');
      console.log('💡 ddt_library potrebbe essere eliminata se non serve più');
    }

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

