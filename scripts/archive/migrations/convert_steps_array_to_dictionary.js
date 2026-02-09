/**
 * Script: Converti steps da array a dictionary
 *
 * Questo script converte tutti i task che hanno steps come array
 * nel formato dictionary richiesto da Compiler.Task:
 *
 * DA (array):
 * steps: [
 *   { id: '...', templateStepId: 'templateId:start', type: 'start', escalations: [...] },
 *   { id: '...', templateStepId: 'templateId:noMatch', type: 'noMatch', escalations: [...] },
 *   ...
 * ]
 *
 * A (dictionary):
 * steps: {
 *   "templateId": {
 *     start: { type: 'start', escalations: [...] },
 *     noMatch: { type: 'noMatch', escalations: [...] },
 *     ...
 *   }
 * }
 *
 * Esegui con: node backend/migrations/convert_steps_array_to_dictionary.js (dry-run)
 * Per confermare: node backend/migrations/convert_steps_array_to_dictionary.js --confirm
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';
const dbProjects = process.env.MONGODB_DB_PROJECTS || 'Projects';

/**
 * Converte array di steps in dictionary organizzato per templateId
 */
function convertStepsArrayToDictionary(stepsArray, taskId) {
  if (!Array.isArray(stepsArray) || stepsArray.length === 0) {
    return {};
  }

  const stepsDict = {};

  for (const step of stepsArray) {
    if (!step || typeof step !== 'object') continue;

    // Estrai templateId da templateStepId (formato: "templateId:stepType" o solo "templateId")
    let templateId = taskId; // Default: usa taskId come templateId
    let stepType = step.type || 'start';

    if (step.templateStepId) {
      const parts = step.templateStepId.split(':');
      if (parts.length >= 2) {
        templateId = parts[0];
        stepType = parts[parts.length - 1];
      } else {
        templateId = parts[0] || taskId;
      }
    }

    // Se non abbiamo templateId, usa taskId
    if (!templateId) {
      templateId = taskId;
    }

    // Inizializza dictionary per questo templateId se non esiste
    if (!stepsDict[templateId]) {
      stepsDict[templateId] = {};
    }

    // Aggiungi step al dictionary
    stepsDict[templateId][stepType] = {
      type: stepType,
      escalations: step.escalations || []
    };

    // Preserva altri campi se presenti
    if (step.id) {
      stepsDict[templateId][stepType].id = step.id;
    }
    if (step.edited !== undefined) {
      stepsDict[templateId][stepType].edited = step.edited;
    }
  }

  return stepsDict;
}

async function convertStepsArrayToDictionaryInDatabase(dryRun = true) {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    // ===================================
    // 1. CONVERTI DATABASE FACTORY
    // ===================================
    console.log('🔍 FASE 1: Conversione database Factory...\n');
    const factoryDb = client.db(dbFactory);
    const factoryTasks = factoryDb.collection('tasks');

    const factoryTasksWithStepsArray = await factoryTasks.find({
      steps: { $exists: true, $type: 'array' }
    }).toArray();

    console.log(`   Trovati ${factoryTasksWithStepsArray.length} template con steps come array\n`);

    let factoryConverted = 0;
    for (const task of factoryTasksWithStepsArray) {
      const taskId = task.id || task._id?.toString();
      const stepsArray = task.steps;

      const stepsDict = convertStepsArrayToDictionary(stepsArray, taskId);

      if (dryRun) {
        console.log(`  🔍 [DRY-RUN] Convertirei template: ${taskId}`, {
          oldStepsCount: stepsArray.length,
          newStepsKeys: Object.keys(stepsDict),
          newStepsStructure: Object.keys(stepsDict).map(templateId => ({
            templateId,
            stepTypes: Object.keys(stepsDict[templateId])
          }))
        });
      } else {
        await factoryTasks.updateOne(
          { _id: task._id },
          { $set: { steps: stepsDict } }
        );
        factoryConverted++;
        console.log(`  ✅ Convertito template: ${taskId} (${Object.keys(stepsDict).length} templateId, ${stepsArray.length} steps totali)`);
      }
    }

    // ===================================
    // 2. CONVERTI DATABASE PROGETTI
    // ===================================
    console.log('\n🔍 FASE 2: Conversione database Progetti...\n');
    const dbNames = await client.db().admin().listDatabases();
    const projectDbs = dbNames.databases.filter(db =>
      db.name !== 'factory' &&
      db.name !== 'admin' &&
      db.name !== 'local' &&
      db.name !== 'config'
    );

    let totalProjectConverted = 0;
    for (const dbInfo of projectDbs) {
      try {
        const projectDb = client.db(dbInfo.name);
        const projectTasks = projectDb.collection('tasks');

        const tasksWithStepsArray = await projectTasks.find({
          steps: { $exists: true, $type: 'array' }
        }).toArray();

        if (tasksWithStepsArray.length > 0) {
          console.log(`   Database: ${dbInfo.name} (${tasksWithStepsArray.length} task)`);

          for (const task of tasksWithStepsArray) {
            const taskId = task.id || task._id?.toString();
            const stepsArray = task.steps;

            const stepsDict = convertStepsArrayToDictionary(stepsArray, taskId);

            if (dryRun) {
              console.log(`     🔍 [DRY-RUN] Convertirei task: ${taskId}`, {
                oldStepsCount: stepsArray.length,
                newStepsKeys: Object.keys(stepsDict)
              });
            } else {
              await projectTasks.updateOne(
                { _id: task._id },
                { $set: { steps: stepsDict } }
              );
              totalProjectConverted++;
              console.log(`     ✅ Convertito task: ${taskId}`);
            }
          }
        }
      } catch (error) {
        console.log(`   ⚠️ Errore convertendo database ${dbInfo.name}: ${error.message}`);
      }
    }

    // ===================================
    // 3. RIEPILOGO
    // ===================================
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📊 RIEPILOGO');
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (dryRun) {
      console.log('🔍 DRY-RUN: Nessuna modifica effettuata');
      console.log(`   Template Factory da convertire: ${factoryTasksWithStepsArray.length}`);
      console.log(`   Task Progetti da convertire: ${totalProjectConverted}`);
      console.log('\n   Per applicare le modifiche, esegui:');
      console.log('   node backend/migrations/convert_steps_array_to_dictionary.js --confirm');
    } else {
      console.log(`✅ Template Factory convertiti: ${factoryConverted}`);
      console.log(`✅ Task Progetti convertiti: ${totalProjectConverted}`);
    }

    await client.close();
    console.log('\n✅ Operazione completata');

  } catch (error) {
    console.error('❌ Errore:', error);
    throw error;
  }
}

// Esegui lo script
const dryRun = !process.argv.includes('--confirm');
console.log('═══════════════════════════════════════════════════════════════');
console.log('🔄 Conversione steps da array a dictionary');
console.log(`   Modalità: ${dryRun ? 'DRY-RUN (nessuna modifica)' : 'CONFERMA (modifiche applicate)'}`);
console.log('═══════════════════════════════════════════════════════════════\n');

convertStepsArrayToDictionaryInDatabase(dryRun).catch(console.error);
