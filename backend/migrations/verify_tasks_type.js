/**
 * Script: Verifica che tutti i Task nel progetto "nuovo" abbiano la proprietà Type definita
 *
 * Questo script:
 * 1. Si connette al database MongoDB
 * 2. Trova il progetto "nuovo"
 * 3. Verifica tutti i Task nel progetto
 * 4. Controlla se hanno la proprietà Type definita
 * 5. Reporta i task senza Type o con Type invalido
 *
 * Esegui con: node backend/migrations/verify_tasks_type.js
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';

// ✅ TaskType enum (allineato con frontend)
const TaskType = {
  UNDEFINED: -1,
  SayMessage: 0,
  CloseSession: 1,
  Transfer: 2,
  DataRequest: 3,
  BackendCall: 4,
  ClassifyProblem: 5,
  SendSMS: 6,
  SendEmail: 7,
  EscalateToHuman: 8,
  EscalateToGuardVR: 9,
  ReadFromBackend: 10,
  WriteToBackend: 11,
  LogData: 12,
  LogLabel: 13,
  PlayJingle: 14,
  Jump: 15,
  HangUp: 16,
  Assign: 17,
  Clear: 18,
  WaitForAgent: 19
};

// Valid TaskType values
const VALID_TASK_TYPES = Object.values(TaskType);

async function verifyTasksType() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    // Find database "nuovo" or project databases
    const adminDb = client.db().admin();
    const databases = await adminDb.listDatabases();

    // Look for database named "nuovo" or starting with "proj_" or "t_no-client__p_nuovo__"
    const projectDbs = databases.databases.filter(db =>
      db.name === 'nuovo' ||
      db.name.startsWith('proj_') ||
      db.name.startsWith('t_no-client__p_nuovo__')
    );

    if (projectDbs.length === 0) {
      console.log('❌ No project databases found');
      console.log('Available databases:');
      databases.databases.forEach(db => {
        console.log(`  - ${db.name}`);
      });
      return;
    }

    // Process all "nuovo" databases
    const nuovoDbs = projectDbs.filter(db =>
      db.name === 'nuovo' || db.name.includes('nuovo')
    );

    if (nuovoDbs.length === 0) {
      console.log('❌ No "nuovo" databases found');
      return;
    }

    console.log(`\n📊 Found ${nuovoDbs.length} "nuovo" database(s):`);
    nuovoDbs.forEach(db => console.log(`  - ${db.name}`));

    // Process each database
    for (const dbInfo of nuovoDbs) {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`🔍 Processing database: ${dbInfo.name}`);
      console.log('='.repeat(70));

      const db = client.db(dbInfo.name);

    // Get all tasks from this database
    const tasksCollection = db.collection('Tasks');
    const tasks = await tasksCollection.find({}).toArray();

    console.log(`\n📊 Total tasks in database "${dbInfo.name}": ${tasks.length}`);

    // Analyze tasks
    let tasksWithType = 0;
    let tasksWithoutType = 0;
    let tasksWithInvalidType = 0;
    const tasksWithoutTypeList = [];
    const tasksWithInvalidTypeList = [];

    for (const task of tasks) {
      if (task.type === undefined || task.type === null) {
        tasksWithoutType++;
        tasksWithoutTypeList.push({
          id: task.id || task._id,
          templateId: task.templateId || null,
          hasMainData: !!(task.mainData && task.mainData.length > 0),
          hasText: !!task.text
        });
      } else if (!VALID_TASK_TYPES.includes(task.type)) {
        tasksWithInvalidType++;
        tasksWithInvalidTypeList.push({
          id: task.id || task._id,
          type: task.type,
          templateId: task.templateId || null,
          hasMainData: !!(task.mainData && task.mainData.length > 0),
          hasText: !!task.text
        });
      } else {
        tasksWithType++;
      }
    }

    // Print report
    console.log('\n═══════════════════════════════════════════════════════════════════════════');
    console.log('📋 VERIFICATION REPORT');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log(`✅ Tasks with valid Type: ${tasksWithType}`);
    console.log(`❌ Tasks without Type: ${tasksWithoutType}`);
    console.log(`⚠️  Tasks with invalid Type: ${tasksWithInvalidType}`);
    console.log('═══════════════════════════════════════════════════════════════════════════');

    if (tasksWithoutType > 0) {
      console.log('\n❌ TASKS WITHOUT TYPE:');
      tasksWithoutTypeList.forEach((task, idx) => {
        console.log(`  ${idx + 1}. Task ID: ${task.id}`);
        console.log(`     - templateId: ${task.templateId || 'null'}`);
        console.log(`     - hasMainData: ${task.hasMainData}`);
        console.log(`     - hasText: ${task.hasText}`);
      });
    }

    if (tasksWithInvalidType > 0) {
      console.log('\n⚠️  TASKS WITH INVALID TYPE:');
      tasksWithInvalidTypeList.forEach((task, idx) => {
        console.log(`  ${idx + 1}. Task ID: ${task.id}`);
        console.log(`     - type: ${task.type} (INVALID)`);
        console.log(`     - templateId: ${task.templateId || 'null'}`);
        console.log(`     - hasMainData: ${task.hasMainData}`);
        console.log(`     - hasText: ${task.hasText}`);
      });
    }

    // Check tasks in DDT escalations
    console.log('\n═══════════════════════════════════════════════════════════════════════════');
    console.log('🔍 CHECKING TASKS IN DDT ESCALATIONS');
    console.log('═══════════════════════════════════════════════════════════════════════════');

    // Find all DDTs in the database
    const ddtsCollection = db.collection('DDTs');
    const ddts = await ddtsCollection.find({}).toArray();

    console.log(`📦 Found ${ddts.length} DDTs in project`);

    let escalationTasksWithoutType = 0;
    const escalationTasksWithoutTypeList = [];

    for (const ddt of ddts) {
      if (!ddt.mainData || !Array.isArray(ddt.mainData)) continue;

      for (const mainDataNode of ddt.mainData) {
        if (!mainDataNode.steps || !Array.isArray(mainDataNode.steps)) continue;

        for (const step of mainDataNode.steps) {
          if (!step.escalations || !Array.isArray(step.escalations)) continue;

          for (const escalation of step.escalations) {
            if (!escalation.tasks || !Array.isArray(escalation.tasks)) continue;

            for (const taskRef of escalation.tasks) {
              // Check if taskRef has type
              if (taskRef.type === undefined || taskRef.type === null) {
                escalationTasksWithoutType++;
                escalationTasksWithoutTypeList.push({
                  ddtId: ddt.id || ddt._id,
                  stepType: step.type,
                  escalationId: escalation.escalationId,
                  taskId: taskRef.id || taskRef.taskId,
                  templateId: taskRef.templateId || null,
                  hasParameters: !!(taskRef.parameters && taskRef.parameters.length > 0)
                });
              }
            }
          }
        }
      }
    }

    console.log(`\n❌ Tasks in escalations without Type: ${escalationTasksWithoutType}`);

    if (escalationTasksWithoutType > 0) {
      console.log('\n❌ ESCALATION TASKS WITHOUT TYPE:');
      escalationTasksWithoutTypeList.forEach((task, idx) => {
        console.log(`  ${idx + 1}. DDT ID: ${task.ddtId}`);
        console.log(`     - Step Type: ${task.stepType}`);
        console.log(`     - Escalation ID: ${task.escalationId}`);
        console.log(`     - Task ID: ${task.taskId}`);
        console.log(`     - templateId: ${task.templateId || 'null'}`);
        console.log(`     - hasParameters: ${task.hasParameters}`);
      });
    }

    console.log(`\n✅ Verification complete for database: ${dbInfo.name}`);
    } // End for loop

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

// Run verification
verifyTasksType()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

