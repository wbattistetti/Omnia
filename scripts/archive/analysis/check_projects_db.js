// Script per verificare progetti nel database
const { MongoClient } = require('mongodb');

// Usa la stessa URI del server
const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbProjects = 'Projects';

async function checkProjects() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('✅ Connesso al database\n');

    const db = client.db(dbProjects);

    // 1. Controlla projects_catalog
    console.log('📋 Controllo projects_catalog:');
    const catalog = db.collection('projects_catalog');
    const catalogCount = await catalog.countDocuments();
    console.log(`   Totale progetti nel catalogo: ${catalogCount}`);

    if (catalogCount > 0) {
      const catalogProjects = await catalog.find({}).toArray();
      console.log('\n   Progetti trovati:');
      catalogProjects.forEach((p, i) => {
        console.log(`   ${i + 1}. ID: ${p._id || p.projectId}`);
        console.log(`      Nome: ${p.projectName || 'N/A'}`);
        console.log(`      Cliente: ${p.clientName || 'N/A'}`);
        console.log(`      DB Name: ${p.dbName || 'N/A'}`);
        console.log(`      Status: ${p.status || 'N/A'}`);
        console.log(`      Creato: ${p.createdAt || 'N/A'}`);
        console.log('');
      });
    }

    // 2. Cerca progetti con nome "Nuovo"
    console.log('\n🔍 Cerca progetti con nome "Nuovo":');
    const nuovoProjects = await catalog.find({
      projectName: { $regex: /nuovo/i }
    }).toArray();
    console.log(`   Trovati ${nuovoProjects.length} progetti con nome contenente "Nuovo"`);
    nuovoProjects.forEach((p, i) => {
      console.log(`   ${i + 1}. ID: ${p._id || p.projectId}, Nome: ${p.projectName}, DB: ${p.dbName}`);
    });

    // 3. Controlla database dei progetti
    console.log('\n📁 Controllo database dei progetti:');
    const adminDb = client.db().admin();
    const databases = await adminDb.listDatabases();
    const projectDbs = databases.databases.filter(db => db.name.startsWith('t_'));
    console.log(`   Trovati ${projectDbs.length} database di progetto (iniziano con "t_")`);
    if (projectDbs.length > 0) {
      console.log('   Database trovati:');
      projectDbs.slice(0, 10).forEach((db, i) => {
        console.log(`   ${i + 1}. ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
      });
      if (projectDbs.length > 10) {
        console.log(`   ... e altri ${projectDbs.length - 10} database`);
      }
    }

    // 4. Verifica se esiste un database con nome simile a "Nuovo"
    console.log('\n🔍 Cerca database con nome simile a "Nuovo":');
    const nuovoDbs = projectDbs.filter(db => db.name.toLowerCase().includes('nuovo'));
    console.log(`   Trovati ${nuovoDbs.length} database con nome contenente "nuovo"`);
    nuovoDbs.forEach((db, i) => {
      console.log(`   ${i + 1}. ${db.name}`);
    });

  } catch (error) {
    console.error('❌ Errore:', error.message);
    console.error(error.stack);
  } finally {
    await client.close();
    console.log('\n✅ Connessione chiusa');
  }
}

checkProjects().catch(console.error);
