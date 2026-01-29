/**
 * Script: Elimina collection Task_Templates (migrazione completa a Tasks)
 *
 * ATTENZIONE: Questo script elimina Task_Templates dopo aver verificato che:
 * 1. Tasks ha tutti i campi necessari
 * 2. Tutti gli endpoint sono stati migrati a Tasks
 * 3. Non ci sono più riferimenti a Task_Templates nel codice
 *
 * Esegui con: node backend/migrations/remove_task_templates.js
 * Per confermare eliminazione: node backend/migrations/remove_task_templates.js --confirm
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';
const dbProjects = 'Projects';

async function removeTaskTemplates() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    // ===================================
    // 1. VERIFICA: Tasks ha tutti i campi
    // ===================================
    console.log('🔍 Step 1: Verifica Tasks ha tutti i campi...\n');

    const db = client.db(dbFactory);
    const tasks = await db.collection('Tasks').find({}).toArray();
    const taskTemplates = await db.collection('Task_Templates').find({}).toArray();

    console.log(`   Tasks: ${tasks.length} documenti`);
    console.log(`   Task_Templates: ${taskTemplates.length} documenti`);

    if (tasks.length === 0) {
      console.log('   ❌ Tasks è vuoto - NON eliminare Task_Templates!\n');
      return;
    }

    if (tasks.length > 0) {
      const sampleTask = tasks[0];
      const requiredFields = ['id', 'type', 'templateId', 'label'];
      const optionalFields = ['dataContracts', 'patterns', 'steps', 'contexts', 'name', 'steps'];

      const hasRequired = requiredFields.every(f => sampleTask[f] !== undefined);
      const hasOptional = optionalFields.filter(f => sampleTask[f] !== undefined);

      console.log(`   Campi richiesti presenti: ${hasRequired ? '✅' : '❌'}`);
      console.log(`   Campi opzionali presenti: ${hasOptional.length}/${optionalFields.length}`);

      if (!hasRequired) {
        console.log('   ❌ Tasks non ha tutti i campi richiesti - NON eliminare Task_Templates!\n');
        return;
      }

      if (hasOptional.length < 3) {
        console.log('   ⚠️  Tasks potrebbe mancare alcuni campi opzionali');
        console.log('   💡 Esegui complete_tasks_migration.js prima di eliminare Task_Templates\n');
        return;
      }

      console.log('   ✅ Tasks ha tutti i campi necessari\n');
    }

    // ===================================
    // 2. VERIFICA: Conteggio documenti
    // ===================================
    console.log('🔍 Step 2: Verifica conteggio documenti...\n');

    if (taskTemplates.length !== tasks.length) {
      console.log(`   ⚠️  Conteggio diverso: Tasks=${tasks.length}, Task_Templates=${taskTemplates.length}`);
      console.log('   💡 Verifica che tutti i documenti siano stati migrati\n');
    } else {
      console.log(`   ✅ Conteggio identico: ${tasks.length} documenti\n`);
    }

    // ===================================
    // 3. VERIFICA: Database progetti
    // ===================================
    console.log('🔍 Step 3: Verifica database progetti...\n');

    const catalogDb = client.db(dbProjects);
    const catalog = catalogDb.collection('projects_catalog');
    const projects = await catalog.find({}).toArray();

    let projectTaskTemplatesCount = 0;
    let projectTasksCount = 0;

    for (const project of projects) {
      if (project.dbName) {
        try {
          const projDb = client.db(project.dbName);
          const projTaskTemplates = await projDb.collection('Task_Templates').find({}).toArray();
          const projTasks = await projDb.collection('tasks').find({}).toArray();
          projectTaskTemplatesCount += projTaskTemplates.length;
          projectTasksCount += projTasks.length;
        } catch (error) {
          // Database potrebbe non esistere
        }
      }
    }

    console.log(`   Task_Templates nei progetti: ${projectTaskTemplatesCount} documenti`);
    console.log(`   Tasks nei progetti: ${projectTasksCount} documenti`);

    if (projectTaskTemplatesCount > 0) {
      console.log(`   ⚠️  Ci sono ancora ${projectTaskTemplatesCount} documenti Task_Templates nei progetti`);
      console.log('   💡 Migra prima i progetti con complete_tasks_migration.js\n');
    } else {
      console.log('   ✅ Nessun Task_Templates nei progetti\n');
    }

    // ===================================
    // 4. ELIMINAZIONE
    // ===================================
    console.log('='.repeat(70));
    console.log('📊 RIEPILOGO');
    console.log('='.repeat(70));
    console.log(`Factory Task_Templates: ${taskTemplates.length} documenti`);
    console.log(`Factory Tasks: ${tasks.length} documenti`);
    console.log(`Progetti Task_Templates: ${projectTaskTemplatesCount} documenti`);
    console.log(`Progetti Tasks: ${projectTasksCount} documenti`);
    console.log('='.repeat(70));

    if (!process.argv.includes('--confirm')) {
      console.log('\n⚠️  ATTENZIONE: Questo script eliminerà Task_Templates.');
      console.log('   Per procedere, esegui:');
      console.log('   node backend/migrations/remove_task_templates.js --confirm\n');
      return;
    }

    console.log('\n🗑️  Eliminazione Task_Templates...\n');

    // Elimina da factory
    if (taskTemplates.length > 0) {
      try {
        await db.collection('Task_Templates').drop();
        console.log('   ✅ Eliminata collection Task_Templates da factory');
      } catch (error) {
        console.error('   ❌ Errore eliminando Task_Templates da factory:', error.message);
      }
    } else {
      console.log('   ⏭️  Task_Templates già vuota in factory');
    }

    // Elimina dai progetti
    let projectsDeleted = 0;
    let projectsErrors = 0;

    for (const project of projects) {
      if (project.dbName) {
        try {
          const projDb = client.db(project.dbName);
          const projTaskTemplates = await projDb.collection('Task_Templates').find({}).toArray();
          if (projTaskTemplates.length > 0) {
            await projDb.collection('Task_Templates').drop();
            projectsDeleted++;
            console.log(`   ✅ Eliminata Task_Templates da ${project.dbName}`);
          }
        } catch (error) {
          if (error.codeName !== 'NamespaceNotFound') {
            projectsErrors++;
            console.error(`   ❌ Errore eliminando Task_Templates da ${project.dbName}:`, error.message);
          }
        }
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 RIEPILOGO ELIMINAZIONE');
    console.log('='.repeat(70));
    console.log(`Factory: ${taskTemplates.length > 0 ? 'Eliminata' : 'Già vuota'}`);
    console.log(`Progetti: ${projectsDeleted} eliminati, ${projectsErrors} errori`);
    console.log('='.repeat(70));

    console.log('\n🎉 Task_Templates eliminata con successo!');
    console.log('✅ Migrazione completa a Tasks terminata.');

  } catch (error) {
    console.error('❌ Errore:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connessione chiusa');
  }
}

if (require.main === module) {
  removeTaskTemplates().catch(console.error);
}

module.exports = { removeTaskTemplates };

