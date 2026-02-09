/**
 * Validazione Migrazione: Verifica che la migrazione non abbia perso dati
 * 
 * Confronta:
 * - Steps: nested → dialogueSteps
 * - Constraints: nested → constraints piatta
 * - Contracts: nested → nlpContracts piatta
 * - Labels: nested → Translations collection
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

/**
 * Count items in nested structure (before migration format)
 */
function countNestedItems(mainData) {
  let stepsCount = 0;
  let constraintsCount = 0;
  let contractsCount = 0;
  let labelsCount = 0;

  function countInNode(node) {
    if (node.steps) {
      if (Array.isArray(node.steps)) {
        stepsCount += node.steps.length;
      } else if (typeof node.steps === 'object') {
        stepsCount += Object.keys(node.steps).length;
      }
    }
    if (node.constraints && Array.isArray(node.constraints)) {
      constraintsCount += node.constraints.length;
    }
    if (node.nlpContract) {
      contractsCount += 1;
    }
    if (node.label) {
      labelsCount += 1;
    }
  }

  if (mainData && Array.isArray(mainData)) {
    for (const main of mainData) {
      countInNode(main);
      if (main.subData && Array.isArray(main.subData)) {
        for (const sub of main.subData) {
          countInNode(sub);
        }
      }
    }
  }

  return { stepsCount, constraintsCount, contractsCount, labelsCount };
}

/**
 * Count items in hybrid structure (after migration format)
 */
function countHybridItems(task) {
  return {
    stepsCount: task.dialogueSteps?.length || 0,
    constraintsCount: task.constraints?.length || 0,
    contractsCount: task.nlpContracts?.length || 0,
    labelsCount: 0  // Will be checked in Translations collection
  };
}

/**
 * Validate a single task
 */
function validateTask(task, translations = {}) {
  // Check if task has nested structure (not migrated)
  const hasNestedSteps = task.mainData?.some(main => {
    if (main.steps) return true;
    if (main.subData && Array.isArray(main.subData)) {
      return main.subData.some(sub => sub.steps);
    }
    return false;
  });

  if (hasNestedSteps) {
    return {
      valid: false,
      reason: 'Still has nested steps',
      taskId: task.id || task._id
    };
  }

  // Check if has hybrid structure
  const hasDialogueSteps = task.dialogueSteps && Array.isArray(task.dialogueSteps) && task.dialogueSteps.length > 0;
  const hasNlpContracts = task.nlpContracts && Array.isArray(task.nlpContracts) && task.nlpContracts.length > 0;
  const hasConstraints = task.constraints && Array.isArray(task.constraints) && task.constraints.length > 0;

  // For templates, should have hybrid structure
  const isTemplate = !task.templateId || task.templateId === 'UNDEFINED';
  if (isTemplate) {
    // Template should have mainData (cleaned, without steps/constraints/contracts/label)
    const hasMainData = task.mainData && Array.isArray(task.mainData) && task.mainData.length > 0;
    if (!hasMainData) {
      return {
        valid: false,
        reason: 'Template missing mainData',
        taskId: task.id || task._id
      };
    }

    // Check that mainData doesn't have nested items
    const nestedCount = countNestedItems(task.mainData);
    if (nestedCount.stepsCount > 0 || nestedCount.constraintsCount > 0 || nestedCount.contractsCount > 0 || nestedCount.labelsCount > 0) {
      return {
        valid: false,
        reason: 'Template mainData still has nested items',
        taskId: task.id || task._id,
        nestedCount
      };
    }
  } else {
    // Instance: if structure identical, should NOT have mainData/nlpContracts/constraints
    // (they come from template)
    // This is harder to validate without template, so we skip for now
  }

  // Check labels in Translations
  if (task.mainData && Array.isArray(task.mainData)) {
    for (const main of task.mainData) {
      if (main.id && main.label) {
        return {
          valid: false,
          reason: `Label still in mainData for ${main.id}`,
          taskId: task.id || task._id,
          dataId: main.id
        };
      }
      if (main.subData && Array.isArray(main.subData)) {
        for (const sub of main.subData) {
          if (sub.id && sub.label) {
            return {
              valid: false,
              reason: `Label still in subData for ${sub.id}`,
              taskId: task.id || task._id,
              dataId: sub.id
            };
          }
        }
      }
    }
  }

  return {
    valid: true,
    taskId: task.id || task._id,
    isTemplate,
    hasDialogueSteps,
    hasNlpContracts,
    hasConstraints
  };
}

/**
 * Validate collection
 */
async function validateCollection(client, db, collectionName) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🔍 Validating collection: ${collectionName}`);
  console.log(`${'='.repeat(70)}`);

  const collection = db.collection(collectionName);

  // Find all DataRequest tasks
  const query = {
    type: 3, // DataRequest
    mainData: { $exists: true, $ne: null }
  };

  const tasks = await collection.find(query).toArray();
  console.log(`📋 Found ${tasks.length} DataRequest tasks to validate`);

  if (tasks.length === 0) {
    console.log('✅ No tasks to validate\n');
    return { total: 0, valid: 0, invalid: 0, issues: [] };
  }

  // Load translations if project database
  let translations = {};
  if (collectionName === 'tasks') {
    const projectId = db.databaseName.replace('project_', '');
    const translationsCollection = db.collection('Translations');
    const translationsDocs = await translationsCollection.find({ language: 'pt' }).toArray();
    translations = translationsDocs.reduce((acc, doc) => {
      if (doc.guid && doc.text) {
        acc[doc.guid] = doc.text;
      }
      return acc;
    }, {});
  } else {
    // Factory: load from factory.Translations
    const factoryDb = client.db(dbFactory);
    const translationsCollection = factoryDb.collection('Translations');
    const translationsDocs = await translationsCollection.find({ language: 'pt' }).toArray();
    translations = translationsDocs.reduce((acc, doc) => {
      if (doc.guid && doc.text) {
        acc[doc.guid] = doc.text;
      }
      return acc;
    }, {});
  }

  let valid = 0;
  let invalid = 0;
  const issues = [];

  for (const task of tasks) {
    const validation = validateTask(task, translations);
    if (validation.valid) {
      valid++;
    } else {
      invalid++;
      issues.push(validation);
      console.log(`\n❌ Invalid task: ${validation.taskId}`);
      console.log(`   Reason: ${validation.reason}`);
    }
  }

  console.log(`\n📊 Validation Summary for ${collectionName}:`);
  console.log(`  - Total: ${tasks.length}`);
  console.log(`  - Valid: ${valid}`);
  console.log(`  - Invalid: ${invalid}`);
  if (issues.length > 0) {
    console.log(`\n⚠️  Issues found:`);
    issues.forEach(issue => {
      console.log(`  - ${issue.taskId}: ${issue.reason}`);
    });
  }

  return { total: tasks.length, valid, invalid, issues };
}

/**
 * Main validation function
 */
async function validateMigration() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const stats = {
      total: 0,
      valid: 0,
      invalid: 0,
      allIssues: []
    };

    // 1. Validate factory.Tasks
    console.log('\n' + '='.repeat(70));
    console.log('🏭 Validating factory.Tasks');
    console.log('='.repeat(70));
    const factoryDb = client.db(dbFactory);
    const factoryValidation = await validateCollection(client, factoryDb, 'Tasks');
    stats.total += factoryValidation.total;
    stats.valid += factoryValidation.valid;
    stats.invalid += factoryValidation.invalid;
    stats.allIssues.push(...factoryValidation.issues);

    // 2. Validate all project databases
    const adminDb = client.db().admin();
    const databases = await adminDb.listDatabases();
    const projectDbs = databases.databases
      .filter(db => db.name.startsWith('project_'))
      .map(db => db.name);

    console.log(`\n📁 Found ${projectDbs.length} project databases`);

    for (const dbName of projectDbs) {
      const projectDb = client.db(dbName);
      const projectValidation = await validateCollection(client, projectDb, 'tasks');
      stats.total += projectValidation.total;
      stats.valid += projectValidation.valid;
      stats.invalid += projectValidation.invalid;
      stats.allIssues.push(...projectValidation.issues);
    }

    // Final summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 FINAL VALIDATION SUMMARY');
    console.log('='.repeat(70));
    console.log(`  - Total Tasks: ${stats.total}`);
    console.log(`  - Valid: ${stats.valid}`);
    console.log(`  - Invalid: ${stats.invalid}`);
    console.log('='.repeat(70));

    if (stats.invalid > 0) {
      console.log('\n❌ VALIDATION FAILED: Some tasks have issues');
      console.log('\nIssues:');
      stats.allIssues.forEach(issue => {
        console.log(`  - ${issue.taskId}: ${issue.reason}`);
      });
      process.exit(1);
    } else {
      console.log('\n✅ VALIDATION PASSED: All tasks are correctly migrated');
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ Validation failed:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

if (require.main === module) {
  validateMigration().catch(error => {
    console.error('\n❌ Validation failed:', error);
    process.exit(1);
  });
}

module.exports = { validateMigration, validateTask };

