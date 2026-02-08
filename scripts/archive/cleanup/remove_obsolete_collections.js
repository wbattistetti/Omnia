/**
 * Script: Rimuove collezioni obsolete dal database
 *
 * ELIMINA:
 * - ddt_library (tutti i DDT sono vuoti)
 * - DataDialogueTranslations (obsoleta, migrata a Translations)
 * - AgentActs (vuota, endpoint deprecati)
 *
 * MANTIENE (per uso futuro):
 * - Flows (template di app complete)
 * - Variables (variabili globali/factory)
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';
const dbProjects = 'Projects';

const COLLECTIONS_TO_REMOVE = {
  factory: [
    'ddt_library',             // ✅ Tutti i DDT sono vuoti (placeholder)
    'DataDialogueTranslations', // ✅ Obsoleta (migrata a Translations)
    'AgentActs'                // ✅ VUOTA, endpoint deprecati
  ],
  Projects: [] // projects da verificare manualmente
};

async function removeObsolete() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');
    console.log('='.repeat(80));
    console.log('🗑️  RIMOZIONE COLLEZIONI OBSOLETE');
    console.log('='.repeat(80));
    console.log();

    // Elimina da factory
    const factoryDb = client.db(dbFactory);
    for (const collName of COLLECTIONS_TO_REMOVE.factory) {
      try {
        const count = await factoryDb.collection(collName).countDocuments();
        console.log(`📊 ${collName}: ${count} documenti`);

        if (count === 0) {
          await factoryDb.collection(collName).drop();
          console.log(`✅ Eliminata ${collName} (vuota)\n`);
        } else {
          // Per ddt_library, verifica se sono tutti vuoti
          if (collName === 'ddt_library') {
            const docs = await factoryDb.collection(collName).find({}).toArray();
            const emptyCount = docs.filter(ddt =>
              !ddt.ddt ||
              (ddt.ddt && typeof ddt.ddt === 'object' &&
               (!ddt.ddt.mainData || (Array.isArray(ddt.ddt.mainData) && ddt.ddt.mainData.length === 0)) &&
               (!ddt.ddt.steps || (typeof ddt.ddt.steps === 'object' && Object.keys(ddt.ddt.steps || {}).length === 0)))
            ).length;

            if (emptyCount === docs.length) {
              await factoryDb.collection(collName).drop();
              console.log(`✅ Eliminata ${collName} (tutti i ${count} documenti sono vuoti)\n`);
            } else {
              console.log(`⚠️  ${collName} ha ${count - emptyCount} documenti con contenuto - SKIP\n`);
            }
          } else {
            console.log(`⚠️  ${collName} ha ${count} documenti - SKIP (verifica manualmente)\n`);
          }
        }
      } catch (error) {
        if (error.codeName === 'NamespaceNotFound') {
          console.log(`✅ ${collName} già eliminata\n`);
        } else {
          console.log(`❌ Errore eliminando ${collName}: ${error.message}\n`);
        }
      }
    }

    console.log('='.repeat(80));
    console.log('✅ Rimozione completata');
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
  removeObsolete().catch(console.error);
}

module.exports = { removeObsolete };

