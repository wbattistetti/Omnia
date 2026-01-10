/**
 * Migrazione: Flatten Dialogue Steps
 *
 * Trasforma struttura annidata (mainData[].steps) in struttura ibrida (dialogueSteps[] piatta)
 *
 * PRIMA (annidata):
 * {
 *   mainData: [
 *     {
 *       id: "guid-main",
 *       steps: [{ type: "start", escalations: [...] }]
 *       subData: [
 *         { id: "guid-sub", steps: [{ type: "start", escalations: [...] }] }
 *       ]
 *     }
 *   ]
 * }
 *
 * DOPO (ibrida):
 * {
 *   mainData: [
 *     {
 *       id: "guid-main",
 *       // ⚠️ NO steps qui
 *       subData: [
 *         { id: "guid-sub" }  // ⚠️ NO steps qui
 *       ]
 *     }
 *   ],
 *   dialogueSteps: [
 *     { id: "guid-step-1", dataId: "guid-main", type: "start", escalations: [...] },
 *     { id: "guid-step-2", dataId: "guid-sub", type: "start", escalations: [...] }
 *   ]
 * }
 */

const { MongoClient, ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

// ✅ DRY-RUN MODE: Set to false to actually perform migration
const DRY_RUN = process.env.DRY_RUN !== 'false'; // Default: true (safe)

/**
 * Extract steps from nested structure and convert to flat dialogueSteps
 */
function extractStepsFromNested(mainData) {
  if (!mainData || !Array.isArray(mainData)) {
    return [];
  }

  const dialogueSteps = [];

  function extractFromNode(node, dataId) {
    if (!node || !node.steps) return;

    // Handle array format: [{ type: 'start', escalations: [...] }]
    if (Array.isArray(node.steps)) {
      for (const step of node.steps) {
        if (step && step.type) {
          dialogueSteps.push({
            id: step.id || uuidv4(),
            dataId: dataId,
            type: step.type,
            escalations: step.escalations || []
          });
        }
      }
    }
    // Handle object format: { start: { escalations: [...] } }
    else if (typeof node.steps === 'object') {
      for (const [stepType, stepValue] of Object.entries(node.steps)) {
        if (stepValue && typeof stepValue === 'object') {
          const step = stepValue;
          dialogueSteps.push({
            id: step.id || uuidv4(),
            dataId: dataId,
            type: stepType,
            escalations: step.escalations || []
          });
        }
      }
    }
  }

  // Extract from mainData nodes
  for (const mainNode of mainData) {
    if (mainNode.id) {
      extractFromNode(mainNode, mainNode.id);
    }

    // Extract from subData nodes
    if (mainNode.subData && Array.isArray(mainNode.subData)) {
      for (const subNode of mainNode.subData) {
        if (subNode.id) {
          extractFromNode(subNode, subNode.id);
        }
      }
    }
  }

  return dialogueSteps;
}

/**
 * Remove steps from nested structure (cleanup)
 */
function removeStepsFromNested(mainData) {
  if (!mainData || !Array.isArray(mainData)) {
    return mainData;
  }

  return mainData.map(mainNode => {
    const cleanedMain = { ...mainNode };
    delete cleanedMain.steps;

    if (mainNode.subData && Array.isArray(mainNode.subData)) {
      cleanedMain.subData = mainNode.subData.map(subNode => {
        const cleanedSub = { ...subNode };
        delete cleanedSub.steps;
        return cleanedSub;
      });
    }

    return cleanedMain;
  });
}

/**
 * Transform a single task from nested to hybrid structure
 */
function transformTaskToHybrid(task) {
  if (!task.mainData || !Array.isArray(task.mainData) || task.mainData.length === 0) {
    // No mainData, nothing to transform
    return task;
  }

  // Check if already migrated (has dialogueSteps and no steps in mainData)
  const hasDialogueSteps = task.dialogueSteps && Array.isArray(task.dialogueSteps) && task.dialogueSteps.length > 0;
  const hasNestedSteps = task.mainData.some(main => {
    if (main.steps) return true;
    if (main.subData && Array.isArray(main.subData)) {
      return main.subData.some(sub => sub.steps);
    }
    return false;
  });

  if (hasDialogueSteps && !hasNestedSteps) {
    // Already migrated, skip
    return null;
  }

  // Extract steps from nested structure
  const dialogueSteps = extractStepsFromNested(task.mainData);

  // Remove steps from nested structure
  const cleanedMainData = removeStepsFromNested(task.mainData);

  // Build transformed task
  const transformed = {
    ...task,
    mainData: cleanedMainData,
    dialogueSteps: dialogueSteps
  };

  return transformed;
}

/**
 * Migrate a single collection
 */
async function migrateCollection(db, collectionName, dryRun = true) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📦 Migrating collection: ${collectionName}`);
  console.log(`${'='.repeat(70)}`);

  const collection = db.collection(collectionName);

  // Find all DataRequest tasks (type: 3) or tasks with mainData
  const query = {
    $or: [
      { type: 3 }, // DataRequest
      { mainData: { $exists: true, $ne: null } }
    ]
  };

  const tasks = await collection.find(query).toArray();
  console.log(`📋 Found ${tasks.length} tasks to process`);

  if (tasks.length === 0) {
    console.log('✅ No tasks to migrate\n');
    return { processed: 0, migrated: 0, skipped: 0, errors: 0 };
  }

  let processed = 0;
  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const task of tasks) {
    try {
      const transformed = transformTaskToHybrid(task);

      if (!transformed) {
        // Already migrated or no mainData
        skipped++;
        continue;
      }

      processed++;

      if (dryRun) {
        console.log(`\n[DRY-RUN] Would migrate task: ${task.id || task._id}`);
        console.log(`  - MainData nodes: ${task.mainData?.length || 0}`);
        console.log(`  - Extracted dialogueSteps: ${transformed.dialogueSteps?.length || 0}`);
        console.log(`  - Has nested steps: ${task.mainData?.some(m => m.steps) ? 'YES' : 'NO'}`);
      } else {
        // Actually update the task
        const filter = { _id: task._id };
        const update = {
          $set: {
            mainData: transformed.mainData,
            dialogueSteps: transformed.dialogueSteps
          }
        };

        await collection.updateOne(filter, update);
        migrated++;
        console.log(`✅ Migrated task: ${task.id || task._id} (${transformed.dialogueSteps?.length || 0} dialogueSteps)`);
      }
    } catch (error) {
      errors++;
      console.error(`❌ Error migrating task ${task.id || task._id}:`, error.message);
    }
  }

  console.log(`\n📊 Summary for ${collectionName}:`);
  console.log(`  - Processed: ${processed}`);
  console.log(`  - Migrated: ${migrated}`);
  console.log(`  - Skipped: ${skipped}`);
  console.log(`  - Errors: ${errors}`);

  return { processed, migrated, skipped, errors };
}

/**
 * Get all project databases
 */
async function getAllProjectDatabases(client) {
  const adminDb = client.db().admin();
  const databases = await adminDb.listDatabases();

  const projectDbs = databases.databases
    .filter(db => db.name.startsWith('project_'))
    .map(db => db.name);

  return projectDbs;
}

/**
 * Main migration function
 */
async function migrateDatabase(dryRun = true) {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    if (dryRun) {
      console.log('⚠️  DRY-RUN MODE: No changes will be made to the database\n');
    } else {
      console.log('🚨 LIVE MODE: Changes will be written to the database\n');
      const confirm = process.env.CONFIRM === 'true';
      if (!confirm) {
        console.log('⚠️  Set CONFIRM=true environment variable to proceed with live migration');
        return;
      }
    }

    const stats = {
      totalProcessed: 0,
      totalMigrated: 0,
      totalSkipped: 0,
      totalErrors: 0
    };

    // 1. Migrate factory.Tasks collection
    console.log('\n' + '='.repeat(70));
    console.log('🏭 Migrating factory.Tasks');
    console.log('='.repeat(70));
    const factoryDb = client.db(dbFactory);
    const factoryStats = await migrateCollection(factoryDb, 'Tasks', dryRun);
    stats.totalProcessed += factoryStats.processed;
    stats.totalMigrated += factoryStats.migrated;
    stats.totalSkipped += factoryStats.skipped;
    stats.totalErrors += factoryStats.errors;

    // 2. Migrate all project_*.tasks collections
    const projectDbs = await getAllProjectDatabases(client);
    console.log(`\n📁 Found ${projectDbs.length} project databases`);

    for (const dbName of projectDbs) {
      const projectDb = client.db(dbName);
      const projectStats = await migrateCollection(projectDb, 'tasks', dryRun);
      stats.totalProcessed += projectStats.processed;
      stats.totalMigrated += projectStats.migrated;
      stats.totalSkipped += projectStats.skipped;
      stats.totalErrors += projectStats.errors;
    }

    // Final summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 FINAL SUMMARY');
    console.log('='.repeat(70));
    console.log(`  - Total Processed: ${stats.totalProcessed}`);
    console.log(`  - Total Migrated: ${stats.totalMigrated}`);
    console.log(`  - Total Skipped: ${stats.totalSkipped}`);
    console.log(`  - Total Errors: ${stats.totalErrors}`);
    console.log(`  - Mode: ${dryRun ? 'DRY-RUN' : 'LIVE'}`);
    console.log('='.repeat(70));

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

// Run migration
if (require.main === module) {
  const dryRun = DRY_RUN;
  migrateDatabase(dryRun)
    .then(() => {
      console.log('\n✅ Migration completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateDatabase, transformTaskToHybrid, extractStepsFromNested, removeStepsFromNested };

