/**
 * Script: Elimina collections vuote e obsolete
 *
 * Elimina:
 * - BackendCalls (vuota)
 * - ddt_library (vuota, endpoint legacy)
 *
 * Verifica prima di eliminare
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

const COLLECTIONS_TO_REMOVE = [
  'BackendCalls',    // ✅ VUOTA - può essere eliminata
  'ddt_library'      // ✅ VUOTA - endpoint legacy, non usata
];

async function removeEmptyCollections() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');
    console.log('='.repeat(80));
    console.log('🗑️  RIMOZIONE COLLEZIONI VUOTE');
    console.log('='.repeat(80));
    console.log();

    const db = client.db(dbFactory);

    for (const collName of COLLECTIONS_TO_REMOVE) {
      try {
        const count = await db.collection(collName).countDocuments();

        if (count === 0) {
          await db.collection(collName).drop();
          console.log(`✅ Eliminata ${collName} (vuota)`);
        } else {
          console.log(`⚠️  ${collName} ha ${count} documenti - SKIP (non vuota)`);
        }
      } catch (error) {
        if (error.codeName === 'NamespaceNotFound') {
          console.log(`✅ ${collName} già eliminata`);
        } else {
          console.log(`❌ Errore eliminando ${collName}: ${error.message}`);
        }
      }
    }

    console.log('\n✅ Rimozione completata');
  } catch (error) {
    console.error('❌ Errore:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connessione chiusa');
  }
}

if (require.main === module) {
  removeEmptyCollections().catch(console.error);
}

module.exports = { removeEmptyCollections };

