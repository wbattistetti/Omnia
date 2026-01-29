/**
 * Script: Rimuove il campo 'examples' dal database
 *
 * ATTENZIONE: Questo script rimuove il campo 'examples' da tutti i documenti
 * nelle collezioni 'tasks' (sia factory che progetti).
 *
 * Rimuove:
 * - task.examples (root level)
 * - task.data[].examples (nested in data array)
 * - task.data[].nlpProfile.examples (nested in nlpProfile)
 * - nlpContract.regex.examples (nested in nlpContract)
 *
 * Esegui con: node backend/migrations/remove_examples_field.js
 * Per confermare: node backend/migrations/remove_examples_field.js --confirm
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function removeExamplesField() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    const dbFactoryInstance = client.db(dbFactory);
    const tasksFactoryCollection = dbFactoryInstance.collection('tasks');

    // ===================================
    // 1. VERIFICA: Conta task con examples
    // ===================================
    console.log('🔍 Step 1: Verifica task con examples...\n');

    const tasksWithExamples = await tasksFactoryCollection.countDocuments({
      $or: [
        { examples: { $exists: true } },
        { 'data.examples': { $exists: true } },
        { 'data.nlpProfile.examples': { $exists: true } },
        { 'nlpContract.regex.examples': { $exists: true } }
      ]
    });

    console.log(`   Task con examples in factory: ${tasksWithExamples}\n`);

    // Verifica anche nei database progetti
    const dbNames = await client.db().admin().listDatabases();
    const projectDbs = dbNames.databases.filter(db => db.name !== 'factory' && db.name !== 'admin' && db.name !== 'local');

    let totalProjectTasksWithExamples = 0;
    for (const dbInfo of projectDbs) {
      const projectDb = client.db(dbInfo.name);
      const projectTasksCollection = projectDb.collection('tasks');
      const count = await projectTasksCollection.countDocuments({
        $or: [
          { examples: { $exists: true } },
          { 'data.examples': { $exists: true } },
          { 'data.nlpProfile.examples': { $exists: true } },
          { 'nlpContract.regex.examples': { $exists: true } }
        ]
      });
      if (count > 0) {
        console.log(`   Task con examples in ${dbInfo.name}: ${count}`);
        totalProjectTasksWithExamples += count;
      }
    }

    const totalTasks = tasksWithExamples + totalProjectTasksWithExamples;
    console.log(`\n   Totale task con examples: ${totalTasks}\n`);

    if (totalTasks === 0) {
      console.log('   ✅ Nessun task con examples - già completato!\n');
      return;
    }

    // ===================================
    // 2. MIGRAZIONE
    // ===================================
    console.log('='.repeat(70));
    console.log('📊 RIEPILOGO');
    console.log('='.repeat(70));
    console.log(`Task factory con examples: ${tasksWithExamples}`);
    console.log(`Task progetti con examples: ${totalProjectTasksWithExamples}`);
    console.log(`Totale: ${totalTasks}`);
    console.log('='.repeat(70));

    if (!process.argv.includes('--confirm')) {
      console.log('\n⚠️  ATTENZIONE: Questo script rimuove il campo examples dal database.');
      console.log('   Per procedere, esegui:');
      console.log('   node backend/migrations/remove_examples_field.js --confirm\n');
      return;
    }

    console.log('\n🔄 Rimozione campo examples...\n');

    let migratedFactory = 0;
    let migratedProjects = 0;
    let errors = 0;

    // ===================================
    // 2.1. Factory database
    // ===================================
    if (tasksWithExamples > 0) {
      console.log('📦 Factory database...\n');

      const factoryTasks = await tasksFactoryCollection.find({
        $or: [
          { examples: { $exists: true } },
          { 'data.examples': { $exists: true } },
          { 'data.nlpProfile.examples': { $exists: true } },
          { 'nlpContract.regex.examples': { $exists: true } }
        ]
      }).toArray();

      for (const task of factoryTasks) {
        try {
          const updateOps = { $unset: {} };

          // Rimuovi examples root level
          if (task.examples !== undefined) {
            updateOps.$unset.examples = '';
          }

          // Rimuovi examples da data array
          if (task.data && Array.isArray(task.data)) {
            const updatedData = task.data.map((node) => {
              const cleaned = { ...node };
              delete cleaned.examples;

              // Rimuovi examples da nlpProfile
              if (cleaned.nlpProfile && cleaned.nlpProfile.examples !== undefined) {
                cleaned.nlpProfile = { ...cleaned.nlpProfile };
                delete cleaned.nlpProfile.examples;
                // Se nlpProfile è vuoto, rimuovilo
                if (Object.keys(cleaned.nlpProfile).length === 0) {
                  delete cleaned.nlpProfile;
                }
              }

              return cleaned;
            });
            updateOps.$set = { data: updatedData };
          }

          // Rimuovi examples da nlpContract.regex
          if (task.nlpContract && task.nlpContract.regex && task.nlpContract.regex.examples !== undefined) {
            if (!updateOps.$set) updateOps.$set = {};
            updateOps.$set['nlpContract.regex.examples'] = [];
            // Rimuovi anche il campo
            const updatedNlpContract = { ...task.nlpContract };
            if (updatedNlpContract.regex) {
              updatedNlpContract.regex = { ...updatedNlpContract.regex };
              delete updatedNlpContract.regex.examples;
            }
            updateOps.$set.nlpContract = updatedNlpContract;
          }

          if (Object.keys(updateOps.$unset).length > 0 || updateOps.$set) {
            await tasksFactoryCollection.updateOne(
              { _id: task._id },
              updateOps
            );
            migratedFactory++;
            console.log(`   ✅ Rimossi examples da task factory: ${task.id || task._id} (${task.label || 'N/A'})`);
          }
        } catch (error) {
          errors++;
          console.error(`   ❌ Errore rimuovendo examples da task factory ${task.id || task._id}:`, error.message);
        }
      }
    }

    // ===================================
    // 2.2. Project databases
    // ===================================
    for (const dbInfo of projectDbs) {
      const projectDb = client.db(dbInfo.name);
      const projectTasksCollection = projectDb.collection('tasks');

      const projectTasks = await projectTasksCollection.find({
        $or: [
          { examples: { $exists: true } },
          { 'data.examples': { $exists: true } },
          { 'data.nlpProfile.examples': { $exists: true } },
          { 'nlpContract.regex.examples': { $exists: true } }
        ]
      }).toArray();

      if (projectTasks.length > 0) {
        console.log(`\n📦 Database progetto: ${dbInfo.name} (${projectTasks.length} task)...\n`);
      }

      for (const task of projectTasks) {
        try {
          const updateOps = { $unset: {} };

          // Rimuovi examples root level
          if (task.examples !== undefined) {
            updateOps.$unset.examples = '';
          }

          // Rimuovi examples da data array
          if (task.data && Array.isArray(task.data)) {
            const updatedData = task.data.map((node) => {
              const cleaned = { ...node };
              delete cleaned.examples;

              // Rimuovi examples da nlpProfile
              if (cleaned.nlpProfile && cleaned.nlpProfile.examples !== undefined) {
                cleaned.nlpProfile = { ...cleaned.nlpProfile };
                delete cleaned.nlpProfile.examples;
                // Se nlpProfile è vuoto, rimuovilo
                if (Object.keys(cleaned.nlpProfile).length === 0) {
                  delete cleaned.nlpProfile;
                }
              }

              return cleaned;
            });
            updateOps.$set = { data: updatedData };
          }

          // Rimuovi examples da nlpContract.regex
          if (task.nlpContract && task.nlpContract.regex && task.nlpContract.regex.examples !== undefined) {
            if (!updateOps.$set) updateOps.$set = {};
            const updatedNlpContract = { ...task.nlpContract };
            if (updatedNlpContract.regex) {
              updatedNlpContract.regex = { ...updatedNlpContract.regex };
              delete updatedNlpContract.regex.examples;
            }
            updateOps.$set.nlpContract = updatedNlpContract;
          }

          if (Object.keys(updateOps.$unset).length > 0 || updateOps.$set) {
            await projectTasksCollection.updateOne(
              { _id: task._id },
              updateOps
            );
            migratedProjects++;
            if (migratedProjects % 10 === 0) {
              console.log(`   ✅ Migrati ${migratedProjects} task progetti...`);
            }
          }
        } catch (error) {
          errors++;
          console.error(`   ❌ Errore rimuovendo examples da task progetto ${task.id || task._id}:`, error.message);
        }
      }
    }

    // ===================================
    // 3. VERIFICA: Migrazione completata
    // ===================================
    console.log('\n🔍 Step 3: Verifica migrazione...\n');

    const remainingFactory = await tasksFactoryCollection.countDocuments({
      $or: [
        { examples: { $exists: true } },
        { 'data.examples': { $exists: true } },
        { 'data.nlpProfile.examples': { $exists: true } },
        { 'nlpContract.regex.examples': { $exists: true } }
      ]
    });

    let remainingProjects = 0;
    for (const dbInfo of projectDbs) {
      const projectDb = client.db(dbInfo.name);
      const projectTasksCollection = projectDb.collection('tasks');
      const count = await projectTasksCollection.countDocuments({
        $or: [
          { examples: { $exists: true } },
          { 'data.examples': { $exists: true } },
          { 'data.nlpProfile.examples': { $exists: true } },
          { 'nlpContract.regex.examples': { $exists: true } }
        ]
      });
      remainingProjects += count;
    }

    console.log(`   Task factory con examples rimanenti: ${remainingFactory}`);
    console.log(`   Task progetti con examples rimanenti: ${remainingProjects}`);

    console.log('\n' + '='.repeat(70));
    console.log('📊 RIEPILOGO MIGRAZIONE');
    console.log('='.repeat(70));
    console.log(`Task factory migrati: ${migratedFactory}`);
    console.log(`Task progetti migrati: ${migratedProjects}`);
    console.log(`Totale migrati: ${migratedFactory + migratedProjects}`);
    console.log(`Errori: ${errors}`);
    console.log(`Rimanenti factory: ${remainingFactory}`);
    console.log(`Rimanenti progetti: ${remainingProjects}`);
    console.log('='.repeat(70));

    if (remainingFactory === 0 && remainingProjects === 0) {
      console.log('\n🎉 Migrazione completata con successo!');
      console.log('✅ Tutti i campi examples sono stati rimossi.');
    } else {
      console.warn('\n⚠️  Migrazione parziale: alcuni task hanno ancora examples');
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
  removeExamplesField().catch(console.error);
}

module.exports = { removeExamplesField };
