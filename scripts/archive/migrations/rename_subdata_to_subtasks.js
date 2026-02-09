/**
 * Script: Rinomina subData → subTasks e subDataIds → subTasksIds nel database
 *
 * ATTENZIONE: Questo script rinomina i campi nel database per allineare
 * con la nuova nomenclatura subTasks.
 *
 * Migra:
 * - task.subDataIds → task.subTasksIds (root level)
 * - task.data[].subData → task.data[].subTasks (nested in data array)
 * - task.mainData[].subData → task.mainData[].subTasks (nested in mainData array)
 *
 * Esegui con: node backend/migrations/rename_subdata_to_subtasks.js
 * Per confermare: node backend/migrations/rename_subdata_to_subtasks.js --confirm
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function renameSubDataToSubTasks() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    const db = client.db(dbFactory);
    const tasksCollection = db.collection('tasks');

    // ===================================
    // 1. VERIFICA: Conta task con subData/subDataIds
    // ===================================
    console.log('🔍 Step 1: Verifica task con subData/subDataIds...\n');

    const tasksWithSubDataIds = await tasksCollection.countDocuments({
      $or: [
        { subDataIds: { $exists: true } },
        { 'data.subData': { $exists: true } },
        { 'mainData.subData': { $exists: true } }
      ]
    });

    console.log(`   Task con subData/subDataIds: ${tasksWithSubDataIds}\n`);

    if (tasksWithSubDataIds === 0) {
      console.log('   ✅ Nessun task da migrare - già completato!\n');
      return;
    }

    // ===================================
    // 2. MIGRAZIONE
    // ===================================
    console.log('='.repeat(70));
    console.log('📊 RIEPILOGO');
    console.log('='.repeat(70));
    console.log(`Task da migrare: ${tasksWithSubDataIds}`);
    console.log('='.repeat(70));

    if (!process.argv.includes('--confirm')) {
      console.log('\n⚠️  ATTENZIONE: Questo script rinomina subData → subTasks nel database.');
      console.log('   Per procedere, esegui:');
      console.log('   node backend/migrations/rename_subdata_to_subtasks.js --confirm\n');
      return;
    }

    console.log('\n🔄 Migrazione subData → subTasks...\n');

    let migrated = 0;
    let errors = 0;

    // Trova tutti i task che hanno subData o subDataIds
    const tasks = await tasksCollection.find({
      $or: [
        { subDataIds: { $exists: true } },
        { 'data.subData': { $exists: true } },
        { 'mainData.subData': { $exists: true } }
      ]
    }).toArray();

    for (const task of tasks) {
      try {
        const updateOps = {};
        const unsetOps = {};

        // 1. Migra subDataIds → subTasksIds (root level)
        if (task.subDataIds !== undefined) {
          updateOps.subTasksIds = task.subDataIds;
          unsetOps.subDataIds = '';
        }

        // 2. Migra data[].subData → data[].subTasks (ricorsivo)
        if (task.data && Array.isArray(task.data)) {
          const migrateNode = (node) => {
            const migrated = { ...node };
            if (node.subData !== undefined) {
              migrated.subTasks = node.subData;
              delete migrated.subData;
            }
            // Ricorsivo per subTasks annidati
            if (migrated.subTasks && Array.isArray(migrated.subTasks)) {
              migrated.subTasks = migrated.subTasks.map(migrateNode);
            }
            return migrated;
          };
          updateOps.data = task.data.map(migrateNode);
        }

        // 3. Migra mainData[].subData → mainData[].subTasks (ricorsivo)
        if (task.mainData && Array.isArray(task.mainData)) {
          const migrateNode = (node) => {
            const migrated = { ...node };
            if (node.subData !== undefined) {
              migrated.subTasks = node.subData;
              delete migrated.subData;
            }
            // Ricorsivo per subTasks annidati
            if (migrated.subTasks && Array.isArray(migrated.subTasks)) {
              migrated.subTasks = migrated.subTasks.map(migrateNode);
            }
            return migrated;
          };
          updateOps.mainData = task.mainData.map(migrateNode);
        }

        // Esegui update solo se ci sono modifiche
        if (Object.keys(updateOps).length > 0 || Object.keys(unsetOps).length > 0) {
          const update = {};
          if (Object.keys(updateOps).length > 0) {
            update.$set = updateOps;
          }
          if (Object.keys(unsetOps).length > 0) {
            update.$unset = unsetOps;
          }

          await tasksCollection.updateOne(
            { _id: task._id },
            update
          );

          migrated++;
          console.log(`   ✅ Migrato task: ${task.id || task._id} (${task.label || 'N/A'})`);
        }
      } catch (error) {
        errors++;
        console.error(`   ❌ Errore migrando task ${task.id || task._id}:`, error.message);
      }
    }

    // ===================================
    // 3. VERIFICA: Migrazione completata
    // ===================================
    console.log('\n🔍 Step 3: Verifica migrazione...\n');

    const remainingSubData = await tasksCollection.countDocuments({
      $or: [
        { subDataIds: { $exists: true } },
        { 'data.subData': { $exists: true } },
        { 'mainData.subData': { $exists: true } }
      ]
    });

    const tasksWithSubTasks = await tasksCollection.countDocuments({
      $or: [
        { subTasksIds: { $exists: true } },
        { 'data.subTasks': { $exists: true } },
        { 'mainData.subTasks': { $exists: true } }
      ]
    });

    console.log(`   Task con subData rimanenti: ${remainingSubData}`);
    console.log(`   Task con subTasks: ${tasksWithSubTasks}`);

    console.log('\n' + '='.repeat(70));
    console.log('📊 RIEPILOGO MIGRAZIONE');
    console.log('='.repeat(70));
    console.log(`Task migrati: ${migrated}`);
    console.log(`Errori: ${errors}`);
    console.log(`Rimanenti subData: ${remainingSubData}`);
    console.log(`Task con subTasks: ${tasksWithSubTasks}`);
    console.log('='.repeat(70));

    if (remainingSubData === 0 && tasksWithSubTasks > 0) {
      console.log('\n🎉 Migrazione completata con successo!');
      console.log('✅ Tutti i campi subData → subTasks migrati.');
    } else if (remainingSubData > 0) {
      console.warn('\n⚠️  Migrazione parziale: alcuni task hanno ancora subData');
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
  renameSubDataToSubTasks().catch(console.error);
}

module.exports = { renameSubDataToSubTasks };
