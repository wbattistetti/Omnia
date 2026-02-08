/**
 * Migration: Rimuove askQuestion e sostituisce con DataRequest
 *
 * Questo script:
 * 1. Cerca tutti i task con templateId = 'askQuestion' o actionId = 'askQuestion'
 * 2. Li sostituisce con 'DataRequest'
 * 3. Verifica anche nelle escalation DDT
 * 4. Reporta tutti i cambiamenti
 *
 * Esegui con: node backend/migrations/remove_askquestion.js
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function removeAskQuestion() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    // 1. Verifica e migra Tasks nella factory
    console.log('\n📦 Checking Factory Tasks...');
    const factoryDb = client.db(dbFactory);
    const tasksCollection = factoryDb.collection('Tasks');

    const tasksWithAskQuestion = await tasksCollection.find({
      $or: [
        { templateId: 'askQuestion' },
        { actionId: 'askQuestion' },
        { 'value.actionId': 'askQuestion' }
      ]
    }).toArray();

    console.log(`   Found ${tasksWithAskQuestion.length} tasks with askQuestion in factory`);

    let factoryUpdated = 0;
    for (const task of tasksWithAskQuestion) {
      const updates = {};

      if (task.templateId === 'askQuestion') {
        updates.templateId = 'DataRequest';
      }
      if (task.actionId === 'askQuestion') {
        updates.actionId = 'DataRequest';
      }
      if (task.value && task.value.actionId === 'askQuestion') {
        updates['value.actionId'] = 'DataRequest';
      }

      if (Object.keys(updates).length > 0) {
        await tasksCollection.updateOne(
          { _id: task._id },
          { $set: updates }
        );
        factoryUpdated++;
        console.log(`   ✅ Updated task ${task.id || task._id}: askQuestion → DataRequest`);
      }
    }

    // 2. Verifica e migra DDTs nella factory
    console.log('\n📦 Checking Factory DDTs...');
    const ddtsCollection = factoryDb.collection('DDTs');

    const allDDTs = await ddtsCollection.find({}).toArray();
    let factoryDDTsUpdated = 0;

    for (const ddt of allDDTs) {
      let modified = false;
      const updatedDDT = JSON.parse(JSON.stringify(ddt)); // Deep clone

      // Cerca e sostituisci in mainData
      if (updatedDDT.mainData && Array.isArray(updatedDDT.mainData)) {
        for (const mainNode of updatedDDT.mainData) {
          if (mainNode.steps && Array.isArray(mainNode.steps)) {
            for (const step of mainNode.steps) {
              if (step.escalations && Array.isArray(step.escalations)) {
                for (const escalation of step.escalations) {
                  // Tasks
                  if (escalation.tasks && Array.isArray(escalation.tasks)) {
                    for (const task of escalation.tasks) {
                      if (task.templateId === 'askQuestion') {
                        task.templateId = 'DataRequest';
                        modified = true;
                      }
                      if (task.actionId === 'askQuestion') {
                        task.actionId = 'DataRequest';
                        modified = true;
                      }
                    }
                  }
                  // Actions (legacy)
                  if (escalation.actions && Array.isArray(escalation.actions)) {
                    for (const action of escalation.actions) {
                      if (action.actionId === 'askQuestion') {
                        action.actionId = 'DataRequest';
                        modified = true;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      if (modified) {
        await ddtsCollection.updateOne(
          { _id: ddt._id },
          { $set: updatedDDT }
        );
        factoryDDTsUpdated++;
        console.log(`   ✅ Updated DDT ${ddt.id || ddt._id}: askQuestion → DataRequest`);
      }
    }

    // 3. Verifica e migra nei database progetto
    console.log('\n📦 Checking Project Databases...');
    const adminDb = client.db().admin();
    const databases = await adminDb.listDatabases();

    const projectDbs = databases.databases.filter(db =>
      (db.name.startsWith('proj_') || db.name.startsWith('t_')) &&
      db.name !== 'admin' && db.name !== 'local' && db.name !== 'config' && db.name !== dbFactory
    );

    console.log(`   Found ${projectDbs.length} project databases`);

    let totalProjectTasksUpdated = 0;
    let totalProjectDDTsUpdated = 0;

    for (const dbInfo of projectDbs) {
      const dbName = dbInfo.name;
      const projectDb = client.db(dbName);

      // Tasks
      const projectTasksCollection = projectDb.collection('Tasks');
      const projectTasks = await projectTasksCollection.find({
        $or: [
          { templateId: 'askQuestion' },
          { actionId: 'askQuestion' },
          { 'value.actionId': 'askQuestion' }
        ]
      }).toArray();

      let projectTasksUpdated = 0;
      for (const task of projectTasks) {
        const updates = {};
        if (task.templateId === 'askQuestion') updates.templateId = 'DataRequest';
        if (task.actionId === 'askQuestion') updates.actionId = 'DataRequest';
        if (task.value && task.value.actionId === 'askQuestion') {
          updates['value.actionId'] = 'DataRequest';
        }

        if (Object.keys(updates).length > 0) {
          await projectTasksCollection.updateOne(
            { _id: task._id },
            { $set: updates }
          );
          projectTasksUpdated++;
        }
      }

      // DDTs
      const projectDDTsCollection = projectDb.collection('DDTs');
      const allProjectDDTs = await projectDDTsCollection.find({}).toArray();

      let projectDDTsUpdated = 0;
      for (const ddt of allProjectDDTs) {
        let modified = false;
        const updatedDDT = JSON.parse(JSON.stringify(ddt));

        if (updatedDDT.mainData && Array.isArray(updatedDDT.mainData)) {
          for (const mainNode of updatedDDT.mainData) {
            if (mainNode.steps && Array.isArray(mainNode.steps)) {
              for (const step of mainNode.steps) {
                if (step.escalations && Array.isArray(step.escalations)) {
                  for (const escalation of step.escalations) {
                    if (escalation.tasks && Array.isArray(escalation.tasks)) {
                      for (const task of escalation.tasks) {
                        if (task.templateId === 'askQuestion') {
                          task.templateId = 'DataRequest';
                          modified = true;
                        }
                        if (task.actionId === 'askQuestion') {
                          task.actionId = 'DataRequest';
                          modified = true;
                        }
                      }
                    }
                    if (escalation.actions && Array.isArray(escalation.actions)) {
                      for (const action of escalation.actions) {
                        if (action.actionId === 'askQuestion') {
                          action.actionId = 'DataRequest';
                          modified = true;
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }

        if (modified) {
          await projectDDTsCollection.updateOne(
            { _id: ddt._id },
            { $set: updatedDDT }
          );
          projectDDTsUpdated++;
        }
      }

      if (projectTasksUpdated > 0 || projectDDTsUpdated > 0) {
        console.log(`   📁 ${dbName}: ${projectTasksUpdated} tasks, ${projectDDTsUpdated} DDTs updated`);
        totalProjectTasksUpdated += projectTasksUpdated;
        totalProjectDDTsUpdated += projectDDTsUpdated;
      }
    }

    // Report finale
    console.log('\n═══════════════════════════════════════════════════════════════════════════');
    console.log('📋 MIGRATION REPORT');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log(`✅ Factory Tasks updated: ${factoryUpdated}`);
    console.log(`✅ Factory DDTs updated: ${factoryDDTsUpdated}`);
    console.log(`✅ Project Tasks updated: ${totalProjectTasksUpdated}`);
    console.log(`✅ Project DDTs updated: ${totalProjectDDTsUpdated}`);
    console.log(`\n📊 Total: ${factoryUpdated + factoryDDTsUpdated + totalProjectTasksUpdated + totalProjectDDTsUpdated} documents updated`);
    console.log('═══════════════════════════════════════════════════════════════════════════');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

// Run migration
removeAskQuestion()
  .then(() => {
    console.log('\n✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });

