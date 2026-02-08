/**
 * Script: Elimina database orfani (progetti eliminati ma database ancora presenti)
 *
 * Esegui con: node backend/migrations/cleanup_orphan_databases.js
 *
 * ATTENZIONE: Questo script elimina database che non sono nel catalogo.
 * Assicurati di aver verificato che questi database non contengano dati importanti.
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbProjects = 'Projects';

async function cleanup() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    // 1. Leggi tutti i progetti dal catalogo
    const catalogDb = client.db(dbProjects);
    const catalog = catalogDb.collection('projects_catalog');
    const projects = await catalog.find({}).toArray();
    const projectDbNames = new Set(projects.map(p => p.dbName).filter(Boolean));

    console.log(`📋 Trovati ${projects.length} progetti nel catalogo`);
    console.log(`   Database nel catalogo: ${projectDbNames.size}\n`);

    // 2. Trova tutti i database progetto
    const adminDb = client.db().admin();
    const dbList = await adminDb.listDatabases();

    const projectDatabases = dbList.databases
      .filter(db =>
        (db.name.startsWith('t_') || db.name.startsWith('project_')) &&
        !['admin', 'local', 'config', 'factory', 'Projects', 'sample_mflix'].includes(db.name) &&
        !db.name.startsWith('system')
      )
      .map(db => db.name);

    console.log(`📋 Trovati ${projectDatabases.length} database progetto totali\n`);

    // 3. Identifica database orfani
    const orphanDatabases = projectDatabases.filter(db => !projectDbNames.has(db));

    if (orphanDatabases.length === 0) {
      console.log('✅ Nessun database orfano trovato!\n');
      return;
    }

    console.log(`⚠️  Trovati ${orphanDatabases.length} database orfani:\n`);
    orphanDatabases.forEach((db, idx) => {
      console.log(`   ${idx + 1}. ${db}`);
    });

    console.log('\n' + '='.repeat(70));
    console.log('⚠️  ATTENZIONE: Questo script eliminerà i database sopra elencati.');
    console.log('='.repeat(70));
    console.log('\nPer procedere, esegui:');
    console.log('   node backend/migrations/cleanup_orphan_databases.js --confirm\n');

    // 4. Elimina solo se --confirm è passato
    if (process.argv.includes('--confirm')) {
      console.log('🗑️  Eliminazione database orfani...\n');

      let deleted = 0;
      let errors = 0;

      for (const dbName of orphanDatabases) {
        try {
          const db = client.db(dbName);
          const collections = await db.listCollections().toArray();

          if (collections.length > 0) {
            await db.dropDatabase();
            deleted++;
            console.log(`   ✅ Eliminato: ${dbName} (${collections.length} collezioni)`);
          } else {
            console.log(`   ⏭️  Saltato: ${dbName} (vuoto)`);
          }
        } catch (error) {
          errors++;
          console.error(`   ❌ Errore eliminando ${dbName}:`, error.message);
        }
      }

      console.log('\n' + '='.repeat(70));
      console.log('📊 RIEPILOGO');
      console.log('='.repeat(70));
      console.log(`Database eliminati: ${deleted}`);
      console.log(`Errori: ${errors}`);
      console.log('='.repeat(70));

    } else {
      console.log('💡 Per eliminare i database orfani, esegui:');
      console.log('   node backend/migrations/cleanup_orphan_databases.js --confirm\n');
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
  cleanup().catch(console.error);
}

module.exports = { cleanup };

