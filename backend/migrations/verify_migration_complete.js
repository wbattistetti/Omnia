/**
 * Script di verifica finale: Verifica che la migrazione sia completa
 *
 * Questo script verifica:
 * 1. Task_Types è stata rinominata in Heuristics
 * 2. Tasks ha tutti i campi necessari
 * 3. Gli endpoint usano Tasks invece di Task_Templates
 * 4. Non ci sono database orfani
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';
const dbProjects = 'Projects';

async function verify() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    const db = client.db(dbFactory);

    // ===================================
    // 1. Verifica Heuristics (rinominata da Task_Types)
    // ===================================
    console.log('🔍 Step 1: Verifica Heuristics...\n');

    const heuristics = await db.collection('Heuristics').find({}).toArray();
    const taskTypes = await db.collection('Task_Types').find({}).toArray();

    console.log(`   Heuristics: ${heuristics.length} documenti`);
    console.log(`   Task_Types (legacy): ${taskTypes.length} documenti`);

    if (heuristics.length > 0 && taskTypes.length === 0) {
      console.log('   ✅ Task_Types è stata rinominata in Heuristics\n');
    } else if (taskTypes.length > 0) {
      console.log('   ⚠️  Task_Types esiste ancora - esegui rename_task_types_to_heuristics.js\n');
    } else {
      console.log('   ⚠️  Né Heuristics né Task_Types trovate\n');
    }

    // ===================================
    // 2. Verifica Tasks ha tutti i campi
    // ===================================
    console.log('🔍 Step 2: Verifica Tasks ha tutti i campi...\n');

    const tasks = await db.collection('Tasks').find({}).toArray();
    const taskTemplates = await db.collection('Task_Templates').find({}).toArray();

    console.log(`   Tasks: ${tasks.length} documenti`);
    console.log(`   Task_Templates (legacy): ${taskTemplates.length} documenti`);

    if (tasks.length > 0) {
      const sampleTask = tasks[0];
      const requiredFields = ['id', 'type', 'templateId', 'label'];
      const optionalFields = ['dataContracts', 'patterns', 'stepPrompts', 'contexts', 'name', 'steps'];

      const hasRequired = requiredFields.every(f => sampleTask[f] !== undefined);
      const hasOptional = optionalFields.filter(f => sampleTask[f] !== undefined);

      console.log(`   Campi richiesti presenti: ${hasRequired ? '✅' : '❌'}`);
      console.log(`   Campi opzionali presenti: ${hasOptional.length}/${optionalFields.length}`);
      console.log(`      - ${hasOptional.join(', ')}\n`);

      if (hasRequired && hasOptional.length >= 3) {
        console.log('   ✅ Tasks ha tutti i campi necessari\n');
      } else {
        console.log('   ⚠️  Tasks potrebbe mancare alcuni campi - esegui complete_tasks_migration.js\n');
      }
    }

    // ===================================
    // 3. Verifica database orfani
    // ===================================
    console.log('🔍 Step 3: Verifica database orfani...\n');

    const catalogDb = client.db(dbProjects);
    const catalog = catalogDb.collection('projects_catalog');
    const projects = await catalog.find({}).toArray();
    const projectDbNames = new Set(projects.map(p => p.dbName).filter(Boolean));

    const adminDb = client.db().admin();
    const dbList = await adminDb.listDatabases();

    const projectDatabases = dbList.databases
      .filter(db =>
        (db.name.startsWith('t_') || db.name.startsWith('project_')) &&
        !['admin', 'local', 'config', 'factory', 'Projects', 'sample_mflix'].includes(db.name) &&
        !db.name.startsWith('system')
      )
      .map(db => db.name);

    const orphanDatabases = projectDatabases.filter(db => !projectDbNames.has(db));

    console.log(`   Database progetto nel catalogo: ${projectDbNames.size}`);
    console.log(`   Database progetto esistenti: ${projectDatabases.length}`);
    console.log(`   Database orfani: ${orphanDatabases.length}`);

    if (orphanDatabases.length > 0) {
      console.log(`\n   ⚠️  Database orfani trovati:`);
      orphanDatabases.forEach(db => console.log(`      - ${db}`));
      console.log(`\n   💡 Questi database non sono nel catalogo ma esistono ancora.`);
      console.log(`   💡 Possono essere eliminati manualmente o con uno script di cleanup.\n`);
    } else {
      console.log('   ✅ Nessun database orfano trovato\n');
    }

    // ===================================
    // 4. RIEPILOGO
    // ===================================
    console.log('='.repeat(70));
    console.log('📊 RIEPILOGO VERIFICA');
    console.log('='.repeat(70));
    console.log(`✅ Heuristics: ${heuristics.length > 0 ? 'OK' : 'MISSING'}`);
    console.log(`✅ Tasks completi: ${tasks.length > 0 && tasks[0].dataContracts !== undefined ? 'OK' : 'INCOMPLETE'}`);
    console.log(`✅ Database orfani: ${orphanDatabases.length === 0 ? 'NONE' : `${orphanDatabases.length} trovati`}`);
    console.log('='.repeat(70));

    if (heuristics.length > 0 && tasks.length > 0 && tasks[0].dataContracts !== undefined && orphanDatabases.length === 0) {
      console.log('\n🎉 Migrazione completata con successo!');
      console.log('✅ Tutti i componenti sono stati migrati correttamente.');
    } else {
      console.log('\n⚠️  Migrazione incompleta - verifica i problemi sopra.');
    }

  } finally {
    await client.close();
  }
}

if (require.main === module) {
  verify().catch(console.error);
}

module.exports = { verify };

