/**
 * Migrazione: Converti steps da Dictionary a MaterializedStep[]
 *
 * Questa migrazione converte tutti i task che hanno steps come dictionary
 * (es: { start: {...}, noMatch: {...} }) in array MaterializedStep[]
 *
 * Esegui con:
 *   node backend/migrations/migrate_steps_to_array.js (dry-run)
 *   node backend/migrations/migrate_steps_to_array.js --confirm
 */

const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbProjects = process.env.MONGODB_DB_PROJECTS || 'Projects';
const dbFactory = process.env.MONGODB_DB_FACTORY || 'factory';

async function migrateStepsToArray(dryRun = true) {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    // Step 1: Migra Factory templates
    console.log('📋 FASE 1: Migrazione Factory templates...');
    const factoryDb = client.db(dbFactory);
    const factoryTasks = factoryDb.collection('tasks');

    // Trova tutti i task con steps che sono oggetti (non array)
    const factoryTasksWithDictSteps = await factoryTasks.find({
      steps: { $exists: true }
    }).toArray();

    // Filtra quelli che sono dictionary (non array)
    const tasksToConvert = factoryTasksWithDictSteps.filter(task => {
      if (!task.steps || Array.isArray(task.steps)) return false;
      if (typeof task.steps !== 'object') return false;
      const keys = Object.keys(task.steps);
      const stepTypeKeys = ['start', 'noMatch', 'noInput', 'confirmation', 'notConfirmed', 'success', 'introduction'];
      return keys.some(key => stepTypeKeys.includes(key));
    });

    console.log(`   Trovati ${tasksToConvert.length} template con steps dictionary (su ${factoryTasksWithDictSteps.length} totali)`);

    let factoryConverted = 0;
    for (const task of tasksToConvert) {
      const stepsDict = task.steps;
      const stepsKeys = Object.keys(stepsDict);

      const materializedSteps = [];
      for (const [stepType, stepData] of Object.entries(stepsDict)) {
        if (stepData && typeof stepData === 'object') {
          // ✅ Per template Factory: templateStepId è sempre presente (derivato dal template stesso)
          materializedSteps.push({
            id: stepData.id || uuidv4(),
            templateStepId: stepData.templateStepId || stepData.id || `${task.id}:${stepType}`,
            type: stepType,
            escalations: stepData.escalations || [],
            ...(stepData.edited !== undefined ? { edited: stepData.edited } : {})
          });
        }
      }

      if (dryRun) {
        console.log(`  🔍 [DRY-RUN] Convertirei template: ${task.id}`, {
          oldStepsKeys: stepsKeys,
          newStepsCount: materializedSteps.length
        });
      } else {
        await factoryTasks.updateOne(
          { _id: task._id },
          { $set: { steps: materializedSteps } }
        );
        factoryConverted++;
        console.log(`  ✅ Convertito template: ${task.id} (${materializedSteps.length} steps)`);
      }
    }

    // Step 2: Migra Project tasks
    console.log('\n📋 FASE 2: Migrazione Project tasks...');
    const catalogDb = client.db(dbProjects);
    const catalogColl = catalogDb.collection('projects_catalog');
    const projects = await catalogColl.find({}).toArray();

    let totalProjectConverted = 0;
    for (const project of projects) {
      if (!project.dbName) continue;

      try {
        const projectDb = client.db(project.dbName);
        const projectTasks = projectDb.collection('tasks');

        // Trova tutti i task con steps
        const projectTasksWithSteps = await projectTasks.find({
          steps: { $exists: true }
        }).toArray();

        // Filtra quelli che sono dictionary (non array)
        const tasksToConvert = projectTasksWithSteps.filter(task => {
          if (!task.steps || Array.isArray(task.steps)) return false;
          if (typeof task.steps !== 'object') return false;
          const keys = Object.keys(task.steps);
          const stepTypeKeys = ['start', 'noMatch', 'noInput', 'confirmation', 'notConfirmed', 'success', 'introduction'];
          return keys.some(key => stepTypeKeys.includes(key));
        });

        if (tasksToConvert.length > 0) {
          console.log(`   Progetto ${project.name} (${project.dbName}): ${tasksToConvert.length} task da convertire`);

          for (const task of tasksToConvert) {
            const stepsDict = task.steps;
            const stepsKeys = Object.keys(stepsDict);

            const materializedSteps = [];
            for (const [stepType, stepData] of Object.entries(stepsDict)) {
              if (stepData && typeof stepData === 'object') {
                // ✅ Per task instance: templateStepId solo se step derivato dal template
                materializedSteps.push({
                  id: stepData.id || uuidv4(),
                  templateStepId: stepData.templateStepId || undefined, // ✅ Solo se step derivato
                  escalations: stepData.escalations || []
                });
              }
            }

            if (dryRun) {
              console.log(`    🔍 [DRY-RUN] Convertirei task: ${task.id}`, {
                oldStepsKeys: stepsKeys,
                newStepsCount: materializedSteps.length
              });
            } else {
              await projectTasks.updateOne(
                { _id: task._id },
                { $set: { steps: materializedSteps } }
              );
              totalProjectConverted++;
            }
          }

          if (!dryRun) {
            console.log(`  ✅ Progetto ${project.name}: ${tasksToConvert.length} task convertiti`);
          }
        }
      } catch (projectError) {
        console.warn(`  ⚠️  Errore nel progetto ${project.name}: ${projectError.message}`);
        // Continua con il prossimo progetto
      }
    }

    console.log('\n📊 Riepilogo:');
    console.log(`   Factory templates: ${factoryConverted} convertiti`);
    console.log(`   Project tasks: ${totalProjectConverted} convertiti`);

    if (dryRun) {
      console.log('\n⚠️  DRY-RUN: Nessuna modifica effettuata');
      console.log('   Esegui con --confirm per applicare le modifiche');
    } else {
      console.log('\n✅ Migrazione completata!');
    }

  } catch (error) {
    console.error('❌ Errore durante la migrazione:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connessione chiusa');
  }
}

// Main
const args = process.argv.slice(2);
const dryRun = !args.includes('--confirm');

console.log('═══════════════════════════════════════════════════════════════');
console.log('🔄 Migrazione: Steps Dictionary → MaterializedStep[]');
console.log(`   Modalità: ${dryRun ? 'DRY-RUN (nessuna modifica)' : 'CONFERMA (modifiche applicate)'}`);
console.log('═══════════════════════════════════════════════════════════════\n');

migrateStepsToArray(dryRun)
  .then(() => {
    console.log('\n✅ Script completato');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Script fallito:', error);
    process.exit(1);
  });
