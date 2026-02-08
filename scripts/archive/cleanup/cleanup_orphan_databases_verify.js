/**
 * Script di verifica e pulizia database orfani
 *
 * Verifica se ci sono database MongoDB che non sono referenziati nel catalogo progetti
 * e li elimina se trovati.
 */

const { MongoClient } = require('mongodb');

// ✅ Usa la stessa URI del server (hardcoded come in server.js)
const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbProjects = 'Projects';
const dbFactory = 'factory';

async function cleanupOrphanDatabases() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB');

    // 1) Leggi tutti i progetti dal catalogo
    const catalogDb = client.db(dbProjects);
    const catalogColl = catalogDb.collection('projects_catalog');
    const projects = await catalogColl.find({}).toArray();

    console.log(`\n📋 Progetti nel catalogo: ${projects.length}`);
    const catalogDbNames = new Set(projects.map(p => p.dbName).filter(Boolean));
    console.log(`📋 Database referenziati nel catalogo: ${catalogDbNames.size}`);

    // 2) Lista tutti i database MongoDB
    const adminDb = client.db().admin();
    const dbList = await adminDb.listDatabases();

    console.log(`\n🗄️  Database totali in MongoDB: ${dbList.databases.length}`);

    // 3) Filtra database di progetto (escludi system, factory, projects catalog)
    const systemDbs = new Set(['admin', 'config', 'local', dbProjects, dbFactory]);
    const projectDatabases = dbList.databases.filter(db => {
      // Escludi database di sistema e factory
      if (systemDbs.has(db.name)) return false;
      // Include solo database che sembrano essere di progetto (pattern: t_*__p_*)
      return db.name.startsWith('t_') && db.name.includes('__p_');
    });

    console.log(`\n🔍 Database di progetto trovati: ${projectDatabases.length}`);

    // 4) Identifica database orfani (esistono ma non sono nel catalogo)
    const orphanDatabases = projectDatabases.filter(db => !catalogDbNames.has(db.name));

    console.log(`\n⚠️  Database orfani trovati: ${orphanDatabases.length}`);

    if (orphanDatabases.length === 0) {
      console.log('\n✅ Nessun database orfano trovato. Tutto pulito!');
      return;
    }

    // 5) Mostra dettagli dei database orfani
    console.log('\n📋 Database orfani da eliminare:');
    for (const orphan of orphanDatabases) {
      console.log(`  - ${orphan.name} (size: ${(orphan.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
    }

    // 6) Elimina database orfani
    console.log('\n🗑️  Eliminazione database orfani...');
    let deleted = 0;
    let errors = 0;

    for (const orphan of orphanDatabases) {
      try {
        const orphanDb = client.db(orphan.name);
        await orphanDb.dropDatabase();
        deleted++;
        console.log(`  ✅ Eliminato: ${orphan.name}`);
      } catch (error) {
        errors++;
        console.error(`  ❌ Errore eliminando ${orphan.name}:`, error.message);
      }
    }

    console.log(`\n✅ Pulizia completata:`);
    console.log(`   - Database eliminati: ${deleted}`);
    console.log(`   - Errori: ${errors}`);

    // 7) Verifica finale
    const finalDbList = await adminDb.listDatabases();
    const finalProjectDbs = finalDbList.databases.filter(db => {
      if (systemDbs.has(db.name)) return false;
      return db.name.startsWith('t_') && db.name.includes('__p_');
    });

    console.log(`\n📊 Stato finale:`);
    console.log(`   - Database di progetto rimasti: ${finalProjectDbs.length}`);
    console.log(`   - Progetti nel catalogo: ${projects.length}`);

    if (finalProjectDbs.length === projects.length) {
      console.log(`\n✅ Perfetto! Tutti i database corrispondono ai progetti nel catalogo.`);
    } else {
      console.log(`\n⚠️  Discrepanza: ${Math.abs(finalProjectDbs.length - projects.length)} database/progetti non corrispondono.`);
    }

  } catch (error) {
    console.error('\n❌ Errore durante la pulizia:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connessione chiusa');
  }
}

// Esegui lo script
if (require.main === module) {
  cleanupOrphanDatabases()
    .then(() => {
      console.log('\n✅ Script completato con successo');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script fallito:', error);
      process.exit(1);
    });
}

module.exports = { cleanupOrphanDatabases };
