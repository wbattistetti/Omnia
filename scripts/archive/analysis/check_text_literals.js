/**
 * Script per verificare se nei task ci sono testi letterali invece di GUID nei parametri
 * Verifica: steps -> escalations -> tasks -> parameters[parameterId='text'].value
 */

import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const projectId = 'proj_843f7a4e71'; // ✅ Sostituisci con il tuo projectId

// Regex per validare GUID
const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function checkTextLiteralsInParameters() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(projectId);
    const coll = db.collection('tasks');

    // Trova tutti i task del progetto
    const tasks = await coll.find({ projectId }).toArray();

    // ✅ DEBUG: Verifica se la collection esiste e ha documenti
    const collectionExists = await db.listCollections({ name: 'tasks' }).hasNext();
    const totalDocs = await coll.countDocuments({});
    console.log(`🔍 DEBUG: Collection 'tasks' exists: ${collectionExists}, Total documents: ${totalDocs}`);

    // ✅ DEBUG: Verifica anche senza filtro projectId
    const allTasks = await coll.find({}).limit(5).toArray();
    console.log(`🔍 DEBUG: Sample tasks (first 5):`, allTasks.map(t => ({ id: t.id, projectId: t.projectId, hasSteps: !!t.steps })));

    console.log(`\n📊 Found ${tasks.length} tasks in project ${projectId}\n`);

    let totalTasksWithTextParams = 0;
    let totalTextParams = 0;
    let totalGUIDParams = 0;
    let totalLiteralTextParams = 0;
    const literalTexts = [];

    tasks.forEach((task) => {
      if (!task.steps) return;

      // Itera attraverso steps (può essere dictionary o array)
      const stepsEntries = Array.isArray(task.steps)
        ? task.steps.map((s, idx) => [idx.toString(), s])
        : Object.entries(task.steps);

      stepsEntries.forEach(([stepKey, step]) => {
        if (!step || !step.escalations) return;

        const escalations = Array.isArray(step.escalations) ? step.escalations : [step.escalations];

        escalations.forEach((esc, escIdx) => {
          if (!esc || !esc.tasks) return;

          const taskItems = Array.isArray(esc.tasks) ? esc.tasks : [esc.tasks];

          taskItems.forEach((taskItem, taskIdx) => {
            if (!taskItem || !taskItem.parameters) return;

            const textParam = taskItem.parameters.find((p) =>
              (p.parameterId === 'text' || p.key === 'text')
            );

            if (!textParam || !textParam.value) return;

            totalTextParams++;
            const value = String(textParam.value);
            const isGUID = GUID_REGEX.test(value);

            if (isGUID) {
              totalGUIDParams++;
            } else {
              totalLiteralTextParams++;
              literalTexts.push({
                taskId: task.id,
                stepKey,
                escalationIdx: escIdx,
                taskIdx,
                text: value.substring(0, 100) + (value.length > 100 ? '...' : '')
              });
            }
          });
        });
      });

      if (totalTextParams > 0) {
        totalTasksWithTextParams++;
      }
    });

    console.log('📊 SUMMARY:');
    console.log(`  Tasks with text parameters: ${totalTasksWithTextParams}`);
    console.log(`  Total text parameters found: ${totalTextParams}`);
    console.log(`  GUID parameters: ${totalGUIDParams} ✅`);
    console.log(`  Literal text parameters: ${totalLiteralTextParams} ❌`);

    if (literalTexts.length > 0) {
      console.log(`\n❌ FOUND ${literalTexts.length} TASKS WITH LITERAL TEXT INSTEAD OF GUID:\n`);

      literalTexts.forEach((item, idx) => {
        console.log(`${idx + 1}. Task: ${item.taskId}`);
        console.log(`   Step: ${item.stepKey}, Escalation: ${item.escalationIdx}, Task: ${item.taskIdx}`);
        console.log(`   Text: "${item.text}"`);
        console.log('');
      });
    } else {
      console.log('\n✅ All text parameters are GUIDs!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

checkTextLiteralsInParameters();
