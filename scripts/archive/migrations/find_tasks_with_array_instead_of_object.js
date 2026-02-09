/**
 * Script: Trova task con steps/value come array invece che oggetto
 *
 * Questo script trova tutti i task (Factory e Project) che hanno:
 * - steps come array invece che Dictionary<string, object>
 * - value come array invece che Dictionary<string, object>
 *
 * Questi task causano JsonSerializationException durante la deserializzazione
 * perché il modello Compiler.Task si aspetta Dictionary ma trova array.
 *
 * Esegui con: node backend/migrations/find_tasks_with_array_instead_of_object.js
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';
const dbProjects = process.env.MONGODB_DB_PROJECTS || 'Projects';

async function findTasksWithArrayInsteadOfObject() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    // ===================================
    // 1. VERIFICA DATABASE FACTORY
    // ===================================
    console.log('🔍 FASE 1: Analisi database Factory...\n');
    const factoryDb = client.db(dbFactory);
    const factoryTasks = factoryDb.collection('tasks');

    // Trova task con steps come array
    const factoryTasksWithStepsArray = await factoryTasks.find({
      steps: { $exists: true, $type: 'array' }
    }).toArray();

    // Trova task con value come array
    const factoryTasksWithValueArray = await factoryTasks.find({
      value: { $exists: true, $type: 'array' }
    }).toArray();

    console.log(`   Task Factory con steps come array: ${factoryTasksWithStepsArray.length}`);
    if (factoryTasksWithStepsArray.length > 0) {
      console.log('   Template ID con steps come array:');
      factoryTasksWithStepsArray.forEach(task => {
        console.log(`     - ${task.id || task._id} (steps length: ${task.steps?.length || 0})`);
      });
    }

    console.log(`\n   Task Factory con value come array: ${factoryTasksWithValueArray.length}`);
    if (factoryTasksWithValueArray.length > 0) {
      console.log('   Template ID con value come array:');
      factoryTasksWithValueArray.forEach(task => {
        console.log(`     - ${task.id || task._id} (value length: ${task.value?.length || 0})`);
      });
    }

    // ===================================
    // 2. VERIFICA DATABASE PROGETTI
    // ===================================
    console.log('\n🔍 FASE 2: Analisi database Progetti...\n');
    const dbNames = await client.db().admin().listDatabases();
    const projectDbs = dbNames.databases.filter(db =>
      db.name !== 'factory' &&
      db.name !== 'admin' &&
      db.name !== 'local' &&
      db.name !== 'config'
    );

    let totalProjectTasksWithStepsArray = 0;
    let totalProjectTasksWithValueArray = 0;
    const projectTasksWithStepsArray = [];
    const projectTasksWithValueArray = [];

    for (const dbInfo of projectDbs) {
      try {
        const projectDb = client.db(dbInfo.name);
        const projectTasks = projectDb.collection('tasks');

        // Trova task con steps come array
        const tasksWithStepsArray = await projectTasks.find({
          steps: { $exists: true, $type: 'array' }
        }).toArray();

        // Trova task con value come array
        const tasksWithValueArray = await projectTasks.find({
          value: { $exists: true, $type: 'array' }
        }).toArray();

        if (tasksWithStepsArray.length > 0 || tasksWithValueArray.length > 0) {
          console.log(`   Database: ${dbInfo.name}`);
          if (tasksWithStepsArray.length > 0) {
            console.log(`     Task con steps come array: ${tasksWithStepsArray.length}`);
            tasksWithStepsArray.forEach(task => {
              const taskInfo = {
                db: dbInfo.name,
                id: task.id || task._id,
                stepsLength: task.steps?.length || 0
              };
              projectTasksWithStepsArray.push(taskInfo);
              console.log(`       - ${taskInfo.id} (steps length: ${taskInfo.stepsLength})`);
            });
            totalProjectTasksWithStepsArray += tasksWithStepsArray.length;
          }
          if (tasksWithValueArray.length > 0) {
            console.log(`     Task con value come array: ${tasksWithValueArray.length}`);
            tasksWithValueArray.forEach(task => {
              const taskInfo = {
                db: dbInfo.name,
                id: task.id || task._id,
                valueLength: task.value?.length || 0
              };
              projectTasksWithValueArray.push(taskInfo);
              console.log(`       - ${taskInfo.id} (value length: ${taskInfo.valueLength})`);
            });
            totalProjectTasksWithValueArray += tasksWithValueArray.length;
          }
        }
      } catch (error) {
        console.log(`   ⚠️ Errore analizzando database ${dbInfo.name}: ${error.message}`);
      }
    }

    // ===================================
    // 3. RIEPILOGO
    // ===================================
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📊 RIEPILOGO');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log(`Factory:`);
    console.log(`  - Task con steps come array: ${factoryTasksWithStepsArray.length}`);
    console.log(`  - Task con value come array: ${factoryTasksWithValueArray.length}`);

    console.log(`\nProgetti:`);
    console.log(`  - Task con steps come array: ${totalProjectTasksWithStepsArray}`);
    console.log(`  - Task con value come array: ${totalProjectTasksWithValueArray}`);

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('🎯 PROSSIMI PASSI');
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (factoryTasksWithStepsArray.length > 0 || factoryTasksWithValueArray.length > 0) {
      console.log('1. Correggi i template Factory trovati');
      console.log('2. Per ogni template, converti:');
      console.log('   - steps: da array a oggetto { "templateId": { start: {...}, noMatch: {...} } }');
      console.log('   - value: da array a oggetto { "key": value }');
    }

    if (totalProjectTasksWithStepsArray > 0 || totalProjectTasksWithValueArray > 0) {
      console.log('\n3. Correggi i task dei progetti trovati');
      console.log('4. Stessa conversione: array → oggetto');
    }

    if (factoryTasksWithStepsArray.length === 0 &&
        factoryTasksWithValueArray.length === 0 &&
        totalProjectTasksWithStepsArray === 0 &&
        totalProjectTasksWithValueArray === 0) {
      console.log('✅ Nessun task trovato con steps/value come array!');
      console.log('Il problema potrebbe essere in un altro campo.');
    }

    await client.close();
    console.log('\n✅ Analisi completata');

  } catch (error) {
    console.error('❌ Errore:', error);
    throw error;
  }
}

// Esegui lo script
findTasksWithArrayInsteadOfObject().catch(console.error);
