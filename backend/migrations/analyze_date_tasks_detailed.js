/**
 * Analisi dettagliata dei task "Date" e "Personal Data"
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function analyzeDateTasks() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbFactory);

    const dateTaskIds = [
      '723a1aa9-a904-4b55-82f3-a501dfbe0351',
      'e37700b9-a437-4337-993f-79073614dbd6',
      '2a254f5c-7afc-466f-9427-866466dfc632'
    ];

    console.log('='.repeat(80));
    console.log('ANALISI DETTAGLIATA TASK DATE');
    console.log('='.repeat(80));
    console.log();

    for (const taskId of dateTaskIds) {
      const task = await db.collection('Tasks').findOne({ id: taskId });

      if (!task) {
        console.log(`❌ Task ${taskId} non trovato\n`);
        continue;
      }

      console.log(`Task ID: ${task.id}`);
      console.log(`Label: ${task.label || 'N/A'}`);
      console.log(`Type: ${task.type}`);
      console.log(`TemplateId: ${task.templateId || 'null'}`);
      console.log(`MainData: ${task.mainData ? 'YES' : 'NO'}`);

      if (task.mainData && Array.isArray(task.mainData)) {
        console.log(`MainData count: ${task.mainData.length}`);
        task.mainData.forEach((main, idx) => {
          console.log(`  MainData[${idx}]:`);
          console.log(`    Label: ${main.label || main.name || 'N/A'}`);
          console.log(`    SubData count: ${main.subData?.length || 0}`);
          if (main.subData && main.subData.length > 0) {
            main.subData.forEach((sub, sIdx) => {
              console.log(`      SubData[${sIdx}]: ${sub.id || 'N/A'} - ${sub.label || sub.name || 'N/A'}`);
            });
          }
        });
      }

      // Check subDataIds
      if (task.subDataIds && Array.isArray(task.subDataIds)) {
        console.log(`SubDataIds: ${task.subDataIds.length}`);
        task.subDataIds.forEach((id, idx) => {
          console.log(`  [${idx}]: ${id}`);
        });
      }

      // Check steps
      if (task.steps) {
        console.log(`Steps: ${typeof task.steps === 'object' ? Object.keys(task.steps).length + ' keys' : 'present'}`);
      }

      // Check dialogueSteps
      if (task.dialogueSteps) {
        console.log(`DialogueSteps: ${Array.isArray(task.dialogueSteps) ? task.dialogueSteps.length + ' items' : 'present'}`);
      }

      // Check nlpContract
      if (task.nlpContract) {
        console.log(`NlpContract: YES`);
      }

      console.log();
      console.log('---');
      console.log();
    }

    await client.close();
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

if (require.main === module) {
  analyzeDateTasks().catch(console.error);
}

module.exports = { analyzeDateTasks };
