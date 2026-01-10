/**
 * Migrazione Completa: Struttura Ibrida DDT
 * 
 * Trasforma struttura annidata in struttura ibrida:
 * - mainData/subData: Rimangono annidati (senza steps, constraints, nlpContract, label)
 * - dialogueSteps: Lista piatta con dataId
 * - nlpContracts: Lista piatta con dataId
 * - constraints: Lista piatta con dataId
 * - labels: Spostate in ProjectTranslations globale
 * 
 * REGOLE:
 * - Template (templateId = null): Clona tutto, estrae in struttura piatta
 * - Istanza (templateId != null):
 *   - Se struttura identica: Rimuove mainData/nlpContracts/constraints, mantiene solo dialogueSteps
 *   - Se struttura modificata: Clona tutto, rimuove templateId (diventa standalone)
 */

const { MongoClient, ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');

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
 * Extract nlpContracts from nested structure
 */
function extractNlpContractsFromNested(mainData) {
  if (!mainData || !Array.isArray(mainData)) {
    return [];
  }

  const nlpContracts = [];

  function extractFromNode(node, dataId) {
    if (node && node.nlpContract && typeof node.nlpContract === 'object') {
      nlpContracts.push({
        id: uuidv4(),
        dataId: dataId,
        ...node.nlpContract
      });
    }
  }

  for (const mainNode of mainData) {
    if (mainNode.id) {
      extractFromNode(mainNode, mainNode.id);
    }

    if (mainNode.subData && Array.isArray(mainNode.subData)) {
      for (const subNode of mainNode.subData) {
        if (subNode.id) {
          extractFromNode(subNode, subNode.id);
        }
      }
    }
  }

  return nlpContracts;
}

/**
 * Extract constraints from nested structure
 */
function extractConstraintsFromNested(mainData) {
  if (!mainData || !Array.isArray(mainData)) {
    return [];
  }

  const constraints = [];

  function extractFromNode(node, dataId) {
    if (node && node.constraints && Array.isArray(node.constraints)) {
      for (const constraint of node.constraints) {
        constraints.push({
          id: constraint.id || uuidv4(),
          dataId: dataId,
          ...constraint
        });
      }
    }
  }

  for (const mainNode of mainData) {
    if (mainNode.id) {
      extractFromNode(mainNode, mainNode.id);
    }

    if (mainNode.subData && Array.isArray(mainNode.subData)) {
      for (const subNode of mainNode.subData) {
        if (subNode.id) {
          extractFromNode(subNode, subNode.id);
        }
      }
    }
  }

  return constraints;
}

/**
 * Extract labels from nested structure (for ProjectTranslations)
 */
function extractLabelsFromNested(mainData) {
  if (!mainData || !Array.isArray(mainData)) {
    return {};
  }

  const labels = {};

  function extractFromNode(node) {
    if (node && node.id && node.label) {
      labels[node.id] = node.label;
    }
  }

  for (const mainNode of mainData) {
    extractFromNode(mainNode);

    if (mainNode.subData && Array.isArray(mainNode.subData)) {
      for (const subNode of mainNode.subData) {
        extractFromNode(subNode);
      }
    }
  }

  return labels;
}

/**
 * Remove steps, constraints, nlpContract, label from nested structure
 */
function cleanNestedStructure(mainData) {
  if (!mainData || !Array.isArray(mainData)) {
    return mainData;
  }

  return mainData.map(mainNode => {
    const cleaned = { ...mainNode };
    delete cleaned.steps;
    delete cleaned.constraints;
    delete cleaned.nlpContract;
    delete cleaned.label;

    if (mainNode.subData && Array.isArray(mainNode.subData)) {
      cleaned.subData = mainNode.subData.map(subNode => {
        const cleanedSub = { ...subNode };
        delete cleanedSub.steps;
        delete cleanedSub.constraints;
        delete cleanedSub.nlpContract;
        delete cleanedSub.label;
        return cleanedSub;
      });
    }

    return cleaned;
  });
}

/**
 * Compare structure (only id, type, subData structure, ignore steps/constraints/label)
 */
function compareStructure(localMainData, templateMainData) {
  function extractStructure(mainData) {
    if (!mainData || !Array.isArray(mainData)) {
      return [];
    }
    return mainData.map(main => ({
      id: main.id,
      type: main.type,
      templateId: main.templateId,
      subData: (main.subData || []).map(sub => ({
        id: sub.id,
        type: sub.type,
        templateId: sub.templateId
      }))
    }));
  }

  const localStruct = extractStructure(localMainData);
  const templateStruct = extractStructure(templateMainData);
  
  return JSON.stringify(localStruct) === JSON.stringify(templateStruct);
}

/**
 * Clone full structure from template with modifications
 */
function cloneFullStructureFromTemplate(template, localDDT) {
  // Extract all dataIds from template and local
  const templateDataIds = new Set();
  const localDataIds = new Set();

  function collectDataIds(mainData, targetSet) {
    if (!mainData || !Array.isArray(mainData)) return;
    for (const main of mainData) {
      if (main.id) targetSet.add(main.id);
      if (main.subData && Array.isArray(main.subData)) {
        for (const sub of main.subData) {
          if (sub.id) targetSet.add(sub.id);
        }
      }
    }
  }

  collectDataIds(template.mainData, templateDataIds);
  collectDataIds(localDDT.mainData, localDataIds);

  const maintainedIds = [...templateDataIds].filter(id => localDataIds.has(id));
  const removedIds = [...templateDataIds].filter(id => !localDataIds.has(id));
  const addedIds = [...localDataIds].filter(id => !templateDataIds.has(id));

  // Clone mainData (only maintained + added)
  const clonedMainData = [
    ...(template.mainData || [])
      .filter(m => maintainedIds.includes(m.id))
      .map(m => cleanNestedStructure([m])[0]),
    ...(localDDT.mainData || [])
      .filter(m => addedIds.includes(m.id))
      .map(m => cleanNestedStructure([m])[0])
  ];

  // Clone dialogueSteps (only for maintained dataIds)
  const clonedDialogueSteps = (template.dialogueSteps || [])
    .filter(s => maintainedIds.includes(s.dataId))
    .map(s => ({ ...s, id: s.id || uuidv4() }));

  // Add default dialogueSteps for new dataIds
  const defaultSteps = ['start', 'noMatch', 'noInput', 'confirmation', 'success'];
  for (const dataId of addedIds) {
    for (const stepType of defaultSteps) {
      clonedDialogueSteps.push({
        id: uuidv4(),
        dataId: dataId,
        type: stepType,
        escalations: []
      });
    }
  }

  // Clone nlpContracts (only for maintained dataIds)
  const clonedNlpContracts = (template.nlpContracts || [])
    .filter(c => maintainedIds.includes(c.dataId))
    .map(c => ({ ...c, id: c.id || uuidv4() }));

  // Clone constraints (only for maintained dataIds)
  const clonedConstraints = (template.constraints || [])
    .filter(c => maintainedIds.includes(c.dataId))
    .map(c => ({ ...c, id: c.id || uuidv4() }));

  return {
    mainData: clonedMainData,
    dialogueSteps: clonedDialogueSteps,
    nlpContracts: clonedNlpContracts,
    constraints: clonedConstraints
  };
}

/**
 * Transform a single task to hybrid structure
 */
function transformTaskToHybrid(task, template = null) {
  // Only transform DataRequest tasks (type: 3)
  if (task.type !== 3) {
    return null;
  }

  // Must have mainData to transform
  if (!task.mainData || !Array.isArray(task.mainData) || task.mainData.length === 0) {
    return null;
  }

  const isTemplate = !task.templateId || task.templateId === 'UNDEFINED';

  if (isTemplate) {
    // ✅ TEMPLATE: Extract everything to flat structure
    const dialogueSteps = extractStepsFromNested(task.mainData);
    const nlpContracts = extractNlpContractsFromNested(task.mainData);
    const constraints = extractConstraintsFromNested(task.mainData);
    const labels = extractLabelsFromNested(task.mainData);
    const cleanedMainData = cleanNestedStructure(task.mainData);

    return {
      ...task,
      mainData: cleanedMainData,
      dialogueSteps: dialogueSteps,
      nlpContracts: nlpContracts,
      constraints: constraints,
      _migrationLabels: labels  // Temporary, will be saved to Translations collection
    };
  } else {
    // ✅ INSTANCE: Check if structure is identical to template
    if (!template || !template.mainData) {
      // Template not found, clone everything (become standalone)
      const dialogueSteps = extractStepsFromNested(task.mainData);
      const nlpContracts = extractNlpContractsFromNested(task.mainData);
      const constraints = extractConstraintsFromNested(task.mainData);
      const labels = extractLabelsFromNested(task.mainData);
      const cleanedMainData = cleanNestedStructure(task.mainData);

      return {
        ...task,
        templateId: null,  // ✅ Remove templateId (become standalone)
        mainData: cleanedMainData,
        dialogueSteps: dialogueSteps,
        nlpContracts: nlpContracts,
        constraints: constraints,
        _migrationLabels: labels
      };
    }

    // Check if structure is identical
    const structureIdentical = compareStructure(task.mainData, template.mainData);

    if (structureIdentical) {
      // ✅ Structure identical: Remove mainData/nlpContracts/constraints, keep only dialogueSteps
      const dialogueSteps = extractStepsFromNested(task.mainData);
      
      return {
        ...task,
        mainData: undefined,  // ✅ Remove (comes from template)
        dialogueSteps: dialogueSteps,
        nlpContracts: undefined,  // ✅ Remove (comes from template)
        constraints: undefined  // ✅ Remove (comes from template)
      };
    } else {
      // ✅ Structure modified: Clone everything, remove templateId
      const cloned = cloneFullStructureFromTemplate(template, { mainData: task.mainData });
      const labels = extractLabelsFromNested(task.mainData);

      return {
        ...task,
        templateId: null,  // ✅ Remove templateId (become standalone)
        mainData: cloned.mainData,
        dialogueSteps: cloned.dialogueSteps,
        nlpContracts: cloned.nlpContracts,
        constraints: cloned.constraints,
        _migrationLabels: labels
      };
    }
  }
}

/**
 * Save labels to ProjectTranslations collection
 */
async function saveLabelsToTranslations(client, db, labels, projectId = null, locale = 'pt') {
  if (!labels || Object.keys(labels).length === 0) {
    return;
  }

  const translationsCollection = projectId 
    ? db.collection('Translations')  // Project database
    : client.db(dbFactory).collection('Translations');  // Factory database

  const now = new Date();
  const bulkOps = Object.entries(labels)
    .filter(([guid, text]) => guid && text)
    .map(([guid, text]) => ({
      updateOne: {
        filter: { guid, language: locale },
        update: {
          $set: {
            guid,
            language: locale,
            text: String(text),
            updatedAt: now
          },
          $setOnInsert: {
            createdAt: now
          }
        },
        upsert: true
      }
    }));

  if (bulkOps.length > 0) {
    await translationsCollection.bulkWrite(bulkOps, { ordered: false });
  }
}

/**
 * Count items before migration (for validation)
 */
function countItemsBefore(task) {
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

  if (task.mainData && Array.isArray(task.mainData)) {
    for (const main of task.mainData) {
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
 * Count items after migration (for validation)
 */
function countItemsAfter(transformed) {
  return {
    stepsCount: transformed.dialogueSteps?.length || 0,
    constraintsCount: transformed.constraints?.length || 0,
    contractsCount: transformed.nlpContracts?.length || 0,
    labelsCount: transformed._migrationLabels ? Object.keys(transformed._migrationLabels).length : 0
  };
}

/**
 * Migrate a single collection
 */
async function migrateCollection(client, db, collectionName, dryRun = true) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📦 Migrating collection: ${collectionName}`);
  console.log(`${'='.repeat(70)}`);

  const collection = db.collection(collectionName);

  // Find all DataRequest tasks (type: 3) with mainData
  const query = {
    type: 3, // DataRequest
    mainData: { $exists: true, $ne: null }
  };

  const tasks = await collection.find(query).toArray();
  console.log(`📋 Found ${tasks.length} DataRequest tasks to process`);

  if (tasks.length === 0) {
    console.log('✅ No tasks to migrate\n');
    return { processed: 0, migrated: 0, skipped: 0, errors: 0, validationErrors: 0 };
  }

  // Load all templates for structure comparison
  const factoryDb = client.db(dbFactory);
  const templatesCollection = factoryDb.collection('Tasks');
  const templates = await templatesCollection.find({ type: 3, templateId: null }).toArray();
  const templatesMap = new Map(templates.map(t => [t.id || t._id?.toString(), t]));

  let processed = 0;
  let migrated = 0;
  let skipped = 0;
  let errors = 0;
  let validationErrors = 0;
  const allLabels = {};  // Collect all labels for batch save

  for (const task of tasks) {
    try {
      // Check if already migrated
      const hasDialogueSteps = task.dialogueSteps && Array.isArray(task.dialogueSteps) && task.dialogueSteps.length > 0;
      const hasNestedSteps = task.mainData?.some(main => {
        if (main.steps) return true;
        if (main.subData && Array.isArray(main.subData)) {
          return main.subData.some(sub => sub.steps);
        }
        return false;
      });
      const hasRootSteps = task.steps && typeof task.steps === 'object' && Object.keys(task.steps).length > 0;

      // Already migrated if has dialogueSteps and no nested/root steps
      if (hasDialogueSteps && !hasNestedSteps && !hasRootSteps) {
        skipped++;
        continue;
      }

      // Get template if instance
      const template = task.templateId ? templatesMap.get(task.templateId) : null;

      // Count before
      const before = countItemsBefore(task);

      // Transform
      const transformed = transformTaskToHybrid(task, template);

      if (!transformed) {
        skipped++;
        continue;
      }

      // Count after
      const after = countItemsAfter(transformed);

      // Validation: Check if counts match
      const validationPassed = 
        before.stepsCount === after.stepsCount &&
        before.constraintsCount === after.constraintsCount &&
        before.contractsCount === after.contractsCount &&
        before.labelsCount === after.labelsCount;

      if (!validationPassed) {
        console.warn(`⚠️  Validation failed for task ${task.id || task._id}:`, {
          before,
          after
        });
        validationErrors++;
      }

      processed++;

      // Collect labels
      if (transformed._migrationLabels) {
        Object.assign(allLabels, transformed._migrationLabels);
        delete transformed._migrationLabels;  // Remove temporary field
      }

      if (dryRun) {
        console.log(`\n[DRY-RUN] Would migrate task: ${task.id || task._id}`);
        console.log(`  - Is template: ${!task.templateId}`);
        console.log(`  - MainData nodes: ${task.mainData?.length || 0}`);
        console.log(`  - Steps: ${before.stepsCount} → ${after.stepsCount} dialogueSteps`);
        console.log(`  - Constraints: ${before.constraintsCount} → ${after.constraintsCount}`);
        console.log(`  - Contracts: ${before.contractsCount} → ${after.contractsCount}`);
        console.log(`  - Labels: ${before.labelsCount} → ${after.labelsCount}`);
        console.log(`  - Validation: ${validationPassed ? '✅ PASSED' : '❌ FAILED'}`);
      } else {
        // Actually update the task
        const filter = { _id: task._id };
        const update = { $set: {} };

      // Build update object (only set defined fields)
      if (transformed.mainData !== undefined) {
        update.$set.mainData = transformed.mainData;
      } else {
        update.$unset = { ...(update.$unset || {}), mainData: '' };
      }
      if (transformed.dialogueSteps !== undefined) {
        update.$set.dialogueSteps = transformed.dialogueSteps;
      }
      if (transformed.nlpContracts !== undefined) {
        update.$set.nlpContracts = transformed.nlpContracts;
      } else {
        update.$unset = { ...(update.$unset || {}), nlpContracts: '' };
      }
      if (transformed.constraints !== undefined) {
        update.$set.constraints = transformed.constraints;
      } else {
        update.$unset = { ...(update.$unset || {}), constraints: '' };
      }
      if (transformed.templateId !== undefined) {
        update.$set.templateId = transformed.templateId;
      }
      // Remove root steps if legacy format
      if (transformed._removeRootSteps) {
        update.$unset = { ...(update.$unset || {}), steps: '' };
      }

        await collection.updateOne(filter, update);
        migrated++;
        console.log(`✅ Migrated task: ${task.id || task._id} (${after.stepsCount} dialogueSteps, ${after.constraintsCount} constraints, ${after.contractsCount} contracts)`);
      }
    } catch (error) {
      errors++;
      console.error(`❌ Error migrating task ${task.id || task._id}:`, error.message);
    }
  }

  // Save labels to Translations collection
  if (!dryRun && Object.keys(allLabels).length > 0) {
    const projectId = collectionName === 'Tasks' ? null : db.databaseName.replace('project_', '');
    await saveLabelsToTranslations(client, db, allLabels, projectId);
    console.log(`✅ Saved ${Object.keys(allLabels).length} labels to Translations collection`);
  }

  console.log(`\n📊 Summary for ${collectionName}:`);
  console.log(`  - Processed: ${processed}`);
  console.log(`  - Migrated: ${migrated}`);
  console.log(`  - Skipped: ${skipped}`);
  console.log(`  - Errors: ${errors}`);
  console.log(`  - Validation Errors: ${validationErrors}`);

  return { processed, migrated, skipped, errors, validationErrors };
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
      totalErrors: 0,
      totalValidationErrors: 0
    };

    // 1. Migrate factory.Tasks collection
    console.log('\n' + '='.repeat(70));
    console.log('🏭 Migrating factory.Tasks');
    console.log('='.repeat(70));
    const factoryDb = client.db(dbFactory);
    const factoryStats = await migrateCollection(client, factoryDb, 'Tasks', dryRun);
    stats.totalProcessed += factoryStats.processed;
    stats.totalMigrated += factoryStats.migrated;
    stats.totalSkipped += factoryStats.skipped;
    stats.totalErrors += factoryStats.errors;
    stats.totalValidationErrors += factoryStats.validationErrors;

    // 2. Migrate all project_*.tasks collections
    const projectDbs = await getAllProjectDatabases(client);
    console.log(`\n📁 Found ${projectDbs.length} project databases`);

    for (const dbName of projectDbs) {
      const projectDb = client.db(dbName);
      const projectStats = await migrateCollection(client, projectDb, 'tasks', dryRun);
      stats.totalProcessed += projectStats.processed;
      stats.totalMigrated += projectStats.migrated;
      stats.totalSkipped += projectStats.skipped;
      stats.totalErrors += projectStats.errors;
      stats.totalValidationErrors += projectStats.validationErrors;
    }

    // Final summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 FINAL SUMMARY');
    console.log('='.repeat(70));
    console.log(`  - Total Processed: ${stats.totalProcessed}`);
    console.log(`  - Total Migrated: ${stats.totalMigrated}`);
    console.log(`  - Total Skipped: ${stats.totalSkipped}`);
    console.log(`  - Total Errors: ${stats.totalErrors}`);
    console.log(`  - Total Validation Errors: ${stats.totalValidationErrors}`);
    console.log(`  - Mode: ${dryRun ? 'DRY-RUN' : 'LIVE'}`);
    console.log('='.repeat(70));

    if (stats.totalValidationErrors > 0) {
      console.log('\n⚠️  WARNING: Some tasks had validation errors. Please review the output above.');
    }

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

module.exports = { migrateDatabase, transformTaskToHybrid };

