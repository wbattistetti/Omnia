// Migration script: Remove invalid step types (disambiguation, violation, notAcquired)
// from task_templates in Factory database and from tasks in project databases
// Run this script once to clean up the database

const { MongoClient } = require('mongodb');

// MongoDB connection string (use environment variable in production)
const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'Factory';

// Step types to remove
const INVALID_STEP_TYPES = ['disambiguation', 'violation', 'notAcquired'];

/**
 * Remove invalid step types from a steps object
 */
function cleanSteps(steps) {
  if (!steps || typeof steps !== 'object') {
    return steps;
  }

  // Handle dictionary format: { nodeId: { stepType: {...}, ... }, ... }
  if (!Array.isArray(steps)) {
    const cleaned = {};
    for (const [nodeId, nodeSteps] of Object.entries(steps)) {
      if (nodeSteps && typeof nodeSteps === 'object') {
        const cleanedNodeSteps = {};
        for (const [stepType, stepData] of Object.entries(nodeSteps)) {
          if (!INVALID_STEP_TYPES.includes(stepType)) {
            cleanedNodeSteps[stepType] = stepData;
          }
        }
        if (Object.keys(cleanedNodeSteps).length > 0) {
          cleaned[nodeId] = cleanedNodeSteps;
        }
      }
    }
    return cleaned;
  }

  // Handle array format: [{ type: 'start', ... }, ...]
  return steps.filter(step => {
    const stepType = step.type || step.stepType;
    return stepType && !INVALID_STEP_TYPES.includes(stepType);
  });
}

/**
 * Clean task_templates in Factory database
 */
async function cleanFactoryTemplates(client) {
  const db = client.db(dbFactory);
  const coll = db.collection('task_templates');

  console.log('\n📋 Cleaning task_templates in Factory database...');

  // Find all templates with invalid step types
  const templates = await coll.find({}).toArray();
  let cleanedCount = 0;
  let totalStepsRemoved = 0;

  for (const template of templates) {
    let modified = false;
    const updateOps = {};

    // Clean steps if present
    if (template.steps) {
      const cleanedSteps = cleanSteps(template.steps);
      if (JSON.stringify(cleanedSteps) !== JSON.stringify(template.steps)) {
        updateOps.steps = cleanedSteps;
        modified = true;

        // Count removed steps
        const originalStepCount = Object.keys(template.steps || {}).length;
        const cleanedStepCount = Object.keys(cleanedSteps || {}).length;
        totalStepsRemoved += (originalStepCount - cleanedStepCount);
      }
    }

    // Clean nodes if present (nodes can have steps too)
    if (template.nodes && Array.isArray(template.nodes)) {
      const cleanedNodes = template.nodes.map(node => {
        if (node.steps) {
          const cleanedNodeSteps = cleanSteps(node.steps);
          if (JSON.stringify(cleanedNodeSteps) !== JSON.stringify(node.steps)) {
            modified = true;
            return { ...node, steps: cleanedNodeSteps };
          }
        }
        return node;
      });
      if (modified) {
        updateOps.nodes = cleanedNodes;
      }
    }

    if (modified) {
      await coll.updateOne(
        { _id: template._id },
        { $set: updateOps }
      );
      cleanedCount++;
      console.log(`  ✅ Cleaned template: ${template.id || template._id} (${template.label || 'no label'})`);
    }
  }

  console.log(`\n✅ Factory templates cleaned:`);
  console.log(`   - Templates modified: ${cleanedCount}`);
  console.log(`   - Total steps removed: ${totalStepsRemoved}`);
}

/**
 * Clean tasks in project databases
 */
async function cleanProjectTasks(client) {
  console.log('\n📋 Cleaning tasks in project databases...');

  // List all databases
  const adminDb = client.db().admin();
  const dbList = await adminDb.listDatabases();

  let totalProjectsCleaned = 0;
  let totalTasksCleaned = 0;
  let totalStepsRemoved = 0;

  for (const dbInfo of dbList.databases) {
    const dbName = dbInfo.name;

    // Skip system databases and Factory
    if (dbName === 'admin' || dbName === 'local' || dbName === 'config' || dbName === dbFactory) {
      continue;
    }

    // Check if this is a project database (has 'tasks' collection)
    const db = client.db(dbName);
    const collections = await db.listCollections().toArray();
    const hasTasks = collections.some(c => c.name === 'tasks');

    if (!hasTasks) {
      continue;
    }

    console.log(`\n  🔍 Processing project database: ${dbName}`);

    const tasksColl = db.collection('tasks');
    const tasks = await tasksColl.find({}).toArray();
    let projectTasksCleaned = 0;
    let projectStepsRemoved = 0;

    for (const task of tasks) {
      let modified = false;
      const updateOps = {};

      // Clean steps if present
      if (task.steps) {
        const cleanedSteps = cleanSteps(task.steps);
        if (JSON.stringify(cleanedSteps) !== JSON.stringify(task.steps)) {
          updateOps.steps = cleanedSteps;
          modified = true;

          // Count removed steps
          const originalStepCount = Object.keys(task.steps || {}).length;
          const cleanedStepCount = Object.keys(cleanedSteps || {}).length;
          projectStepsRemoved += (originalStepCount - cleanedStepCount);
        }
      }

      // Clean nodes if present
      if (task.nodes && Array.isArray(task.nodes)) {
        const cleanedNodes = task.nodes.map(node => {
          if (node.steps) {
            const cleanedNodeSteps = cleanSteps(node.steps);
            if (JSON.stringify(cleanedNodeSteps) !== JSON.stringify(node.steps)) {
              modified = true;
              return { ...node, steps: cleanedNodeSteps };
            }
          }
          return node;
        });
        if (modified) {
          updateOps.nodes = cleanedNodes;
        }
      }

      if (modified) {
        await tasksColl.updateOne(
          { _id: task._id },
          { $set: updateOps }
        );
        projectTasksCleaned++;
      }
    }

    if (projectTasksCleaned > 0) {
      totalProjectsCleaned++;
      totalTasksCleaned += projectTasksCleaned;
      totalStepsRemoved += projectStepsRemoved;
      console.log(`    ✅ Cleaned ${projectTasksCleaned} tasks (${projectStepsRemoved} steps removed)`);
    } else {
      console.log(`    ℹ️  No tasks to clean`);
    }
  }

  console.log(`\n✅ Project tasks cleaned:`);
  console.log(`   - Projects modified: ${totalProjectsCleaned}`);
  console.log(`   - Tasks modified: ${totalTasksCleaned}`);
  console.log(`   - Total steps removed: ${totalStepsRemoved}`);
}

/**
 * Main cleanup function
 */
async function cleanupInvalidStepTypes() {
  const client = new MongoClient(uri);

  try {
    console.log('🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected to MongoDB');

    // Clean Factory database
    await cleanFactoryTemplates(client);

    // Clean project databases
    await cleanProjectTasks(client);

    console.log('\n✅ Cleanup completed successfully!');
    console.log(`\n📝 Removed step types: ${INVALID_STEP_TYPES.join(', ')}`);

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run cleanup
if (require.main === module) {
  cleanupInvalidStepTypes()
    .then(() => {
      console.log('✅ Cleanup script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Cleanup script failed:', error);
      process.exit(1);
    });
}

module.exports = { cleanupInvalidStepTypes, cleanSteps };
