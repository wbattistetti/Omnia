/**
 * Migration: Convert steps to steps format in database
 *
 * Converts:
 * - steps (legacy): { start: ['key1', 'key2'], noMatch: ['key3'], ... }
 * - steps (new): { "nodeId": { start: { type: 'start', escalations: [...] }, noMatch: {...}, ... } }
 *
 * This migration:
 * - Converts steps → steps for all templates in factory database
 * - Converts steps → steps for all templates in project databases
 * - Removes steps field after conversion
 *
 * Usage:
 *   node backend/migrations/convert_steps_to_steps.js --dry-run
 *   node backend/migrations/convert_steps_to_steps.js --confirm
 */

const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

/**
 * Converts steps (legacy) to steps (new format)
 *
 * @param {Object} steps - Legacy format: { start: ['key1', 'key2'], noMatch: ['key3'], ... }
 * @param {string} nodeId - Template ID to use as key in steps format
 * @returns {Object|undefined} New format: { "nodeId": { start: {...}, noMatch: {...}, ... } }
 */
function convertstepsToSteps(steps, nodeId) {
  if (!steps || typeof steps !== 'object' || !nodeId) {
    return undefined;
  }

  const steps = {};
  const stepTypes = ['start', 'noMatch', 'noInput', 'confirmation', 'notConfirmed', 'success', 'introduction'];

  for (const stepType of stepTypes) {
    const stepsArray = steps[stepType];

    if (Array.isArray(stepsArray) && stepsArray.length > 0) {
      // Create escalations based on number of keys in steps
      const escalations = stepsArray.map((translationKey) => {
        // Generate a GUID for each escalation
        const taskId = uuidv4();

        return {
          tasks: [{
            id: taskId,
            type: 1, // SayMessage
            text: translationKey // Translation key will be resolved at runtime
          }]
        };
      });

      steps[stepType] = {
        type: stepType,
        escalations
      };
    }
  }

  // If no steps, return undefined
  if (Object.keys(steps).length === 0) {
    return undefined;
  }

  // Return in steps format: { "nodeId": { start: {...}, noMatch: {...}, ... } }
  return {
    [nodeId]: steps
  };
}

async function convertstepsToStepsInDatabase(dryRun = true) {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    // Get all database names
    const adminDb = client.db('admin');
    const allDbs = await adminDb.admin().listDatabases();

    let totalTasks = 0;
    let totalConverted = 0;
    const stats = {
      projects: 0,
      factory: 0,
      templatesWithsteps: 0,
      templatesConverted: 0
    };

    // Process factory database
    const factoryDb = client.db(dbFactory);
    const factoryTasksCollection = factoryDb.collection('tasks');
    const factoryTaskCount = await factoryTasksCollection.countDocuments();

    if (factoryTaskCount > 0) {
      console.log(`\n📁 Processing factory database (${factoryTaskCount} tasks)`);
      stats.factory++;

      const factoryTasks = await factoryTasksCollection.find({}).toArray();
      totalTasks += factoryTasks.length;

      for (const task of factoryTasks) {
        if (task.steps && typeof task.steps === 'object') {
          stats.templatesWithsteps++;

          const nodeId = task.id || task._id;
          if (!nodeId) {
            console.warn(`  ⚠️  Task without ID, skipping:`, task);
            continue;
          }

          const convertedSteps = convertstepsToSteps(task.steps, String(nodeId));

          if (convertedSteps) {
            if (dryRun) {
              console.log(`  🔍 [DRY-RUN] Would convert steps to steps for template: ${nodeId}`, {
                stepsKeys: Object.keys(task.steps),
                stepsKeys: Object.keys(convertedSteps)
              });
            } else {
              // Merge with existing steps if present
              const existingSteps = task.steps || {};
              const mergedSteps = {
                ...existingSteps,
                ...convertedSteps
              };

              await factoryTasksCollection.updateOne(
                { _id: task._id },
                {
                  $set: { steps: mergedSteps },
                  $unset: { steps: '' }
                }
              );
              totalConverted++;
              stats.templatesConverted++;
              console.log(`  ✅ Converted steps to steps for template: ${nodeId}`);
            }
          }
        }
      }
    }

    // Process project databases
    for (const dbInfo of allDbs.databases) {
      const dbName = dbInfo.name;

      // Skip system databases and factory
      if (dbName === 'admin' || dbName === 'local' || dbName === 'config' || dbName === dbFactory) {
        continue;
      }

      // Check if this is a project database (has 'tasks' collection)
      const projectDb = client.db(dbName);
      const collections = await projectDb.listCollections({ name: 'tasks' }).toArray();

      if (collections.length === 0) {
        continue; // Skip if no 'tasks' collection
      }

      const tasksCollection = projectDb.collection('tasks');
      const taskCount = await tasksCollection.countDocuments();

      if (taskCount === 0) {
        continue;
      }

      console.log(`\n📁 Processing database: ${dbName} (${taskCount} tasks)`);
      stats.projects++;

      const tasks = await tasksCollection.find({}).toArray();
      totalTasks += tasks.length;

      for (const task of tasks) {
        // ✅ Convert only templates (templateId === null or templateId === id)
        // Instances should not have steps (already removed by previous migration)
        const isTemplate = !task.templateId || task.templateId === task.id || task.templateId === task._id;

        if (isTemplate && task.steps && typeof task.steps === 'object') {
          stats.templatesWithsteps++;

          const nodeId = task.id || task._id;
          if (!nodeId) {
            console.warn(`  ⚠️  Task without ID, skipping:`, task);
            continue;
          }

          const convertedSteps = convertstepsToSteps(task.steps, String(nodeId));

          if (convertedSteps) {
            if (dryRun) {
              console.log(`  🔍 [DRY-RUN] Would convert steps to steps for template: ${nodeId}`, {
                stepsKeys: Object.keys(task.steps),
                stepsKeys: Object.keys(convertedSteps)
              });
            } else {
              // Merge with existing steps if present
              const existingSteps = task.steps || {};
              const mergedSteps = {
                ...existingSteps,
                ...convertedSteps
              };

              await tasksCollection.updateOne(
                { _id: task._id },
                {
                  $set: { steps: mergedSteps },
                  $unset: { steps: '' }
                }
              );
              totalConverted++;
              stats.templatesConverted++;
              console.log(`  ✅ Converted steps to steps for template: ${nodeId}`);
            }
          }
        }
      }
    }

    // Summary
    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('📊 MIGRATION SUMMARY');
    console.log('════════════════════════════════════════════════════════════════');
    console.log(`Total tasks processed: ${totalTasks}`);
    console.log(`Templates with steps: ${stats.templatesWithsteps}`);
    console.log(`Projects processed: ${stats.projects}`);
    console.log(`Factory database processed: ${stats.factory > 0 ? 'Yes' : 'No'}`);

    if (dryRun) {
      console.log('\n⚠️  DRY-RUN MODE: No changes were made');
      console.log('   Run with --confirm to apply changes');
    } else {
      console.log(`\n✅ Converted ${totalConverted} templates (steps → steps)`);
    }
    console.log('════════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Main execution wrapper
async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--confirm');

  if (dryRun) {
    console.log('🔍 Running in DRY-RUN mode (no changes will be made)');
    console.log('   Add --confirm to apply changes\n');
  } else {
    console.log('⚠️  CONFIRM MODE: Changes will be applied to the database');
    console.log('   Press Ctrl+C within 5 seconds to cancel...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  await convertstepsToStepsInDatabase(dryRun);
  console.log('✅ Migration completed successfully');
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
