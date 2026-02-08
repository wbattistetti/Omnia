/**
 * Verifica i task referenziati dai subDataIds
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function checkSubDataReferences() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbFactory);

    // Task Date con 3 subDataIds
    const task1 = await db.collection('Tasks').findOne({
      id: '723a1aa9-a904-4b55-82f3-a501dfbe0351'
    });

    console.log('='.repeat(80));
    console.log('TASK DATE CON 3 SUB-DATA');
    console.log('='.repeat(80));
    console.log(`Task: ${task1.label} (${task1.id})`);
    console.log(`SubDataIds: ${task1.subDataIds?.length || 0}\n`);

    if (task1.subDataIds && Array.isArray(task1.subDataIds)) {
      for (const subId of task1.subDataIds) {
        // Try to find by id or _id
        const subTask = await db.collection('Tasks').findOne({
          $or: [
            { id: subId },
            { _id: subId }
          ]
        });

        if (subTask) {
          console.log(`  SubData ID: ${subId}`);
          console.log(`    Label: ${subTask.label || 'N/A'}`);
          console.log(`    Type: ${subTask.type || 'N/A'}`);
          console.log();
        } else {
          console.log(`  SubData ID: ${subId} - ❌ TASK NON TROVATO`);
          console.log();
        }
      }
    }

    // Task Date con 1 subDataId (PROBLEMA!)
    const task2 = await db.collection('Tasks').findOne({
      id: 'e37700b9-a437-4337-993f-79073614dbd6'
    });

    console.log('='.repeat(80));
    console.log('TASK DATE CON 1 SUB-DATA (PROBLEMA!)');
    console.log('='.repeat(80));
    console.log(`Task: ${task2.label} (${task2.id})`);
    console.log(`SubDataIds: ${task2.subDataIds?.length || 0}\n`);

    if (task2.subDataIds && Array.isArray(task2.subDataIds)) {
      for (const subId of task2.subDataIds) {
        console.log(`  SubData ID: ${subId}`);

        // Check if it's a string "atomic"
        if (subId === 'atomic') {
          console.log(`    ⚠️  PROBLEMA: subDataId è la stringa "atomic" invece di un ID di task!`);
          console.log(`    Questo task dovrebbe avere 3 sub-data (Day, Month, Year) ma ne ha solo 1`);
        } else {
          const subTask = await db.collection('Tasks').findOne({
            $or: [
              { id: subId },
              { _id: subId }
            ]
          });

          if (subTask) {
            console.log(`    Label: ${subTask.label || 'N/A'}`);
            console.log(`    Type: ${subTask.type || 'N/A'}`);
          } else {
            console.log(`    ❌ TASK NON TROVATO`);
          }
        }
        console.log();
      }
    }

    await client.close();
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

if (require.main === module) {
  checkSubDataReferences().catch(console.error);
}

module.exports = { checkSubDataReferences };
