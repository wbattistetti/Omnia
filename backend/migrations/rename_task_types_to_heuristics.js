/**
 * Migration: Rename Task_Types → Heuristics
 *
 * Questo script:
 * 1. Rinomina la collection Task_Types in Heuristics nella factory
 * 2. Rinomina Task_Types in Heuristics in tutti i database progetto
 * 3. Verifica che tutti i pattern siano stati migrati
 *
 * Esegui con: node backend/migrations/rename_task_types_to_heuristics.js
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';
const dbProjects = 'Projects';

async function renameCollection(db, oldName, newName) {
  try {
    const collections = await db.listCollections({ name: oldName }).toArray();
    if (collections.length === 0) {
      console.log(`   ⚠️  Collection "${oldName}" non trovata, skip`);
      return false;
    }

    // Verifica se la nuova collection esiste già
    const newCollections = await db.listCollections({ name: newName }).toArray();
    if (newCollections.length > 0) {
      console.log(`   ⚠️  Collection "${newName}" esiste già, skip`);
      return false;
    }

    // Rinomina la collection
    await db.collection(oldName).rename(newName);
    console.log(`   ✅ Rinominata: ${oldName} → ${newName}`);
    return true;
  } catch (error) {
    console.error(`   ❌ Errore rinominando ${oldName}:`, error.message);
    return false;
  }
}

async function migrateFactory() {
  console.log('\n📦 Migrazione Factory Database...\n');
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbFactory);

    const renamed = await renameCollection(db, 'Task_Types', 'Heuristics');

    if (renamed) {
      // Verifica che i pattern siano presenti
      const heuristics = await db.collection('Heuristics').find({}).toArray();
      console.log(`   📋 Trovati ${heuristics.length} documenti in Heuristics`);

      heuristics.forEach(h => {
        const patternCount = h.patterns ? Object.keys(h.patterns).length : 0;
        console.log(`      - ${h._id}: ${patternCount} lingue`);
      });
    }

    return renamed;
  } finally {
    await client.close();
  }
}

async function migrateProjects() {
  console.log('\n📦 Migrazione Project Databases...\n');
  const client = new MongoClient(uri);

  try {
    await client.connect();

    // Ottieni lista database progetto dal catalogo
    const catalogDb = client.db(dbProjects);
    const catalog = catalogDb.collection('projects_catalog');
    const projects = await catalog.find({}).toArray();

    console.log(`📋 Trovati ${projects.length} progetti nel catalogo\n`);

    let totalRenamed = 0;
    let totalSkipped = 0;

    for (const project of projects) {
      if (!project.dbName) {
        console.log(`   ⚠️  Progetto ${project.projectName} (${project.projectId}) non ha dbName, skip`);
        continue;
      }

      try {
        const projDb = client.db(project.dbName);
        const renamed = await renameCollection(projDb, 'Task_Types', 'Heuristics');

        if (renamed) {
          totalRenamed++;
          // Verifica pattern
          const heuristics = await projDb.collection('Heuristics').find({}).toArray();
          console.log(`      📋 ${heuristics.length} documenti migrati`);
        } else {
          totalSkipped++;
        }
      } catch (error) {
        console.error(`   ❌ Errore nel progetto ${project.dbName}:`, error.message);
        totalSkipped++;
      }
    }

    console.log(`\n✅ Migrazione progetti completata:`);
    console.log(`   - Rinominati: ${totalRenamed}`);
    console.log(`   - Saltati: ${totalSkipped}`);

  } finally {
    await client.close();
  }
}

async function main() {
  console.log('🚀 Starting Task_Types → Heuristics Migration...\n');

  try {
    // 1. Migra factory
    const factoryRenamed = await migrateFactory();

    // 2. Migra progetti
    await migrateProjects();

    console.log('\n' + '='.repeat(70));
    console.log('📊 RIEPILOGO');
    console.log('='.repeat(70));
    console.log(`Factory: ${factoryRenamed ? '✅ Rinominata' : '⚠️  Saltata'}`);
    console.log('='.repeat(70));

    console.log('\n🎉 Migrazione completata!');
    console.log('\n⚠️  PROSSIMO PASSO: Aggiorna il codice backend per usare "Heuristics" invece di "Task_Types"');

  } catch (error) {
    console.error('❌ Errore durante la migrazione:', error);
    throw error;
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };

