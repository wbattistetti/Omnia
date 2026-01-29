/**
 * Migration: Move steps from mainData[].steps to task.steps (root level)
 *
 * This migration:
 * 1. Finds all tasks with mainData containing steps
 * 2. Extracts steps from mainData and subData
 * 3. Creates task.steps object with nodeId as keys
 * 4. Removes steps from mainData/subData
 * 5. Also migrates steps if present (legacy format)
 *
 * Structure:
 * - OLD: mainData[].steps = { start: {...}, noMatch: {...} }
 * - NEW: task.steps = { "nodeId": { start: {...}, noMatch: {...} } }
 */

const { MongoClient } = require('mongodb');

// ✅ Usa le stesse variabili d'ambiente o default del server
const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbName = process.env.MONGODB_DB || 'omnia';
const factoryDbName = 'factory'; // ✅ Database Factory per i template

async function migrateStepsToRootLevel() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(dbName);
    const factoryDb = client.db(factoryDbName);

    // ✅ Collections nel database principale (progetti)
    const tasksCollection = db.collection('tasks');

    // ✅ Collections nel database Factory (template)
    const templatesCollection = factoryDb.collection('tasks');

    let tasksMigrated = 0;
    let templatesMigrated = 0;
    let tasksSkipped = 0;
    let templatesSkipped = 0;

    // Function to extract steps from a node (reusable)
    const extractSteps = (node, nodeId, rootSteps, needsUpdateRef) => {
      if (!nodeId) return;

      // Extract from node.steps (new format)
      if (node.steps && typeof node.steps === 'object' && Object.keys(node.steps).length > 0) {
        rootSteps[nodeId] = node.steps;
        delete node.steps;
        needsUpdateRef.value = true;
      }

      // Extract from node.steps (legacy format) - convert to steps structure
      if (node.steps && typeof node.steps === 'object' && Object.keys(node.steps).length > 0) {
        const convertedSteps = {};
        for (const [stepKey, stepValue] of Object.entries(node.steps)) {
          if (Array.isArray(stepValue) && stepValue.length > 0) {
            // steps format: { start: ['guid1', 'guid2'], noMatch: [...] }
            // Convert to steps format: { start: { type: 'start', escalations: [{ tasks: [...] }] } }
            convertedSteps[stepKey] = {
              type: stepKey,
              escalations: [{
                tasks: stepValue.map(guid => ({
                  id: guid,
                  type: 1, // SayMessage
                  text: guid // Will be resolved from translations
                }))
              }]
            };
          }
        }
        if (Object.keys(convertedSteps).length > 0) {
          rootSteps[nodeId] = convertedSteps;
          delete node.steps;
          needsUpdateRef.value = true;
        }
      }

      // Recursive for subData
      if (node.subData && Array.isArray(node.subData)) {
        node.subData.forEach(sub => {
          if (sub.id) {
            extractSteps(sub, sub.id, rootSteps, needsUpdateRef);
          }
        });
      }
    };

    // ✅ Migrate Tasks (database principale)
    console.log('\n📦 Migrating Tasks from database:', dbName);
    const tasks = await tasksCollection.find({}).toArray();
    console.log(`   Found ${tasks.length} tasks`);

    for (const task of tasks) {
      const needsUpdateRef = { value: false };
      const updatedTask = JSON.parse(JSON.stringify(task)); // Deep clone per sicurezza

      // Skip if already has steps at root level
      if (updatedTask.steps && typeof updatedTask.steps === 'object' && Object.keys(updatedTask.steps).length > 0) {
        tasksSkipped++;
        continue;
      }

      const rootSteps = {};

      // Extract steps from mainData
      if (updatedTask.mainData && Array.isArray(updatedTask.mainData)) {
        updatedTask.mainData.forEach(main => {
          if (main.id) {
            extractSteps(main, main.id, rootSteps, needsUpdateRef);
          }
        });
      }

      // Update task if steps were extracted
      if (needsUpdateRef.value && Object.keys(rootSteps).length > 0) {
        updatedTask.steps = rootSteps;
        updatedTask.mainData = updatedTask.mainData; // Already modified in place

        await tasksCollection.updateOne(
          { _id: task._id },
          { $set: updatedTask }
        );

        tasksMigrated++;
        console.log(`  ✅ Migrated task: ${task._id} (${task.label || 'no label'})`);
      } else {
        tasksSkipped++;
      }
    }

    // ✅ Migrate Templates (database Factory)
    console.log('\n📦 Migrating Templates from database:', factoryDbName);

    // Try both collection names
    let templates = [];
    let collectionToUse = templatesCollection;
    try {
      templates = await templatesCollection.find({}).toArray();
      console.log(`   Found ${templates.length} templates in Tasks`);
    } catch (err) {
      console.log(`   ⚠️ Tasks collection not found, skipping templates migration`);
      templates = [];
    }

    for (const template of templates) {
      const needsUpdateRef = { value: false };
      const updatedTemplate = JSON.parse(JSON.stringify(template)); // Deep clone per sicurezza

      // Skip if already has steps at root level
      if (updatedTemplate.steps && typeof updatedTemplate.steps === 'object' && Object.keys(updatedTemplate.steps).length > 0) {
        templatesSkipped++;
        continue;
      }

      const rootSteps = {};

      // Extract steps from mainData (usa la funzione globale extractSteps)
      if (updatedTemplate.mainData && Array.isArray(updatedTemplate.mainData)) {
        updatedTemplate.mainData.forEach(main => {
          if (main.id) {
            extractSteps(main, main.id, rootSteps, needsUpdateRef);
          }
        });
      }

      // Also check root level steps (legacy)
      if (updatedTemplate.steps && typeof updatedTemplate.steps === 'object' && Object.keys(updatedTemplate.steps).length > 0) {
        // Root level steps - need to find corresponding mainData nodeId
        if (updatedTemplate.mainData && Array.isArray(updatedTemplate.mainData) && updatedTemplate.mainData.length > 0) {
          const firstMainId = updatedTemplate.mainData[0]?.id;
          if (firstMainId) {
            const convertedSteps = {};
            for (const [stepKey, stepValue] of Object.entries(updatedTemplate.steps)) {
              if (Array.isArray(stepValue) && stepValue.length > 0) {
                convertedSteps[stepKey] = {
                  type: stepKey,
                  escalations: [{
                    tasks: stepValue.map(guid => ({
                      id: guid,
                      type: 1, // SayMessage
                      text: guid
                    }))
                  }]
                };
              }
            }
            if (Object.keys(convertedSteps).length > 0) {
              rootSteps[firstMainId] = convertedSteps;
              delete updatedTemplate.steps;
              needsUpdateRef.value = true;
            }
          }
        }
      }

      // Update template if steps were extracted
      if (needsUpdateRef.value && Object.keys(rootSteps).length > 0) {
        updatedTemplate.steps = rootSteps;
        // ✅ mainData è già stato modificato in place (steps rimossi)

        await collectionToUse.updateOne(
          { _id: template._id },
          { $set: updatedTemplate }
        );

        templatesMigrated++;
        console.log(`  ✅ Migrated template: ${template._id} (${template.label || template.name || 'no label'})`);
      } else {
        templatesSkipped++;
      }
    }

    console.log('\n✅ Migration completed!');
    console.log(`📊 Summary:`);
    console.log(`  Tasks migrated: ${tasksMigrated}`);
    console.log(`  Tasks skipped: ${tasksSkipped}`);
    console.log(`  Templates migrated: ${templatesMigrated}`);
    console.log(`  Templates skipped: ${templatesSkipped}`);

  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ MongoDB connection closed');
  }
}

// Run migration
if (require.main === module) {
  migrateStepsToRootLevel()
    .then(() => {
      console.log('\n🎉 Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateStepsToRootLevel };
