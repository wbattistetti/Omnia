/**
 * Analisi: Verifica struttura steps nel database Factory
 *
 * Verifica se ci sono ancora task con steps come dictionary invece che array
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = process.env.MONGODB_DB_FACTORY || 'factory';

async function analyzeFactoryStepsStructure() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    const factoryDb = client.db(dbFactory);
    const factoryTasks = factoryDb.collection('tasks');

    // Trova tutti i task con steps
    const allTasks = await factoryTasks.find({
      steps: { $exists: true }
    }).toArray();

    console.log(`📋 Analisi database Factory: ${allTasks.length} task con steps\n`);

    let arrayCount = 0;
    let dictionaryCount = 0;
    let emptyCount = 0;
    let invalidCount = 0;

    const dictionaryTasks = [];
    const arrayTasks = [];

    for (const task of allTasks) {
      if (!task.steps) {
        emptyCount++;
        continue;
      }

      if (Array.isArray(task.steps)) {
        arrayCount++;
        if (arrayCount <= 5) {
          arrayTasks.push({
            id: task.id,
            stepsCount: task.steps.length,
            firstStep: task.steps[0] || null
          });
        }
      } else if (typeof task.steps === 'object') {
        const keys = Object.keys(task.steps);
        const stepTypeKeys = ['start', 'noMatch', 'noInput', 'confirmation', 'notConfirmed', 'success', 'introduction'];
        const isOldStructure = keys.some(key => stepTypeKeys.includes(key));

        if (isOldStructure) {
          dictionaryCount++;
          if (dictionaryCount <= 10) {
            dictionaryTasks.push({
              id: task.id,
              label: task.label || task.name || 'N/A',
              stepsKeys: keys,
              stepsKeysCount: keys.length
            });
          }
        } else {
          // Potrebbe essere un dictionary organizzato per templateId (nuovo formato corretto)
          invalidCount++;
          console.log(`⚠️  Task con steps dictionary non riconosciuto: ${task.id}`, {
            keys: keys,
            keysCount: keys.length
          });
        }
      } else {
        invalidCount++;
        console.log(`❌ Task con steps tipo non valido: ${task.id}`, {
          stepsType: typeof task.steps,
          stepsValue: task.steps
        });
      }
    }

    console.log('\n📊 Riepilogo:');
    console.log(`   ✅ Array (corretto): ${arrayCount}`);
    console.log(`   ❌ Dictionary vecchio formato: ${dictionaryCount}`);
    console.log(`   ⚠️  Dictionary nuovo formato (templateId keyed): ${invalidCount}`);
    console.log(`   📭 Senza steps: ${emptyCount}`);

    if (dictionaryCount > 0) {
      console.log('\n❌ Task con struttura vecchia (dictionary):');
      dictionaryTasks.forEach(t => {
        console.log(`   - ${t.id}: ${t.label}`);
        console.log(`     Steps keys: ${t.stepsKeys.join(', ')}`);
      });
    }

    if (arrayCount > 0 && arrayCount <= 5) {
      console.log('\n✅ Esempi task con struttura corretta (array):');
      arrayTasks.forEach(t => {
        console.log(`   - ${t.id}: ${t.stepsCount} steps`);
        if (t.firstStep) {
          console.log(`     First step: id=${t.firstStep.id}, templateStepId=${t.firstStep.templateStepId || 'N/A'}, type=${t.firstStep.type || 'N/A'}`);
        }
      });
    }

    console.log('\n🔍 Verifica struttura steps nei task array:');
    let validArrayCount = 0;
    let invalidArrayCount = 0;

    for (const task of allTasks) {
      if (Array.isArray(task.steps) && task.steps.length > 0) {
        const firstStep = task.steps[0];
        const hasId = firstStep && firstStep.id;
        const hasEscalations = firstStep && Array.isArray(firstStep.escalations);

        if (hasId && hasEscalations) {
          validArrayCount++;
        } else {
          invalidArrayCount++;
          if (invalidArrayCount <= 5) {
            console.log(`   ⚠️  Task ${task.id}: array ma struttura step non valida`, {
              hasId: hasId,
              hasEscalations: hasEscalations,
              firstStep: firstStep
            });
          }
        }
      }
    }

    console.log(`\n   ✅ Array con struttura valida: ${validArrayCount}`);
    console.log(`   ⚠️  Array con struttura non valida: ${invalidArrayCount}`);

  } catch (error) {
    console.error('❌ Errore durante l\'analisi:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connessione chiusa');
  }
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('🔍 Analisi struttura steps nel database Factory');
console.log('═══════════════════════════════════════════════════════════════\n');

analyzeFactoryStepsStructure()
  .then(() => {
    console.log('\n✅ Analisi completata');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Analisi fallita:', error);
    process.exit(1);
  });
