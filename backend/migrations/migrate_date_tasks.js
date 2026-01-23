/**
 * Migrazione task "Date" in dBFactory
 * Corregge solo i task Date che devono avere Day, Month, Year come sub-data
 */

const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

// Trova task atomici Day, Month, Year nel database
async function findDateAtomicTasks(collection) {
  console.log('🔍 Searching for atomic tasks: Day, Month, Year...\n');

  const atomicTasks = {
    day: null,
    month: null,
    year: null
  };

  // Cerca Day
  const dayTask = await collection.findOne({
    type: 3,
    $or: [
      { label: { $regex: /^(day|giorno)$/i } },
      { name: { $regex: /^(day|giorno)$/i } }
    ]
  });

  if (dayTask) {
    atomicTasks.day = dayTask.id || dayTask._id?.toString();
    console.log(`  ✅ Found Day: "${dayTask.label || dayTask.name}" (${atomicTasks.day})`);
  } else {
    console.log(`  ❌ Day task not found`);
  }

  // Cerca Month
  const monthTask = await collection.findOne({
    type: 3,
    $or: [
      { label: { $regex: /^(month|mese)$/i } },
      { name: { $regex: /^(month|mese)$/i } }
    ]
  });

  if (monthTask) {
    atomicTasks.month = monthTask.id || monthTask._id?.toString();
    console.log(`  ✅ Found Month: "${monthTask.label || monthTask.name}" (${atomicTasks.month})`);
  } else {
    console.log(`  ❌ Month task not found`);
  }

  // Cerca Year
  const yearTask = await collection.findOne({
    type: 3,
    $or: [
      { label: { $regex: /^(year|anno)$/i } },
      { name: { $regex: /^(year|anno)$/i } }
    ]
  });

  if (yearTask) {
    atomicTasks.year = yearTask.id || yearTask._id?.toString();
    console.log(`  ✅ Found Year: "${yearTask.label || yearTask.name}" (${atomicTasks.year})`);
  } else {
    console.log(`  ❌ Year task not found`);
  }

  console.log();
  return atomicTasks;
}

// Verifica se è un task Date
function isDateTask(task) {
  const label = (task.label || task.name || '').toLowerCase();
  return label.includes('date') ||
         label.includes('data') ||
         label.includes('birth') ||
         label.includes('nascita');
}

// Migra un task Date
async function migrateDateTask(task, collection, atomicTasks, dryRun = true) {
  const taskId = task.id || task._id;
  const label = task.label || task.name || 'N/A';

  // Verifica che abbiamo tutti i task atomici
  if (!atomicTasks.day || !atomicTasks.month || !atomicTasks.year) {
    return {
      migrated: false,
      reason: 'Missing atomic tasks (Day, Month, or Year not found)',
      missing: {
        day: !atomicTasks.day,
        month: !atomicTasks.month,
        year: !atomicTasks.year
      }
    };
  }

  const updates = {};
  let needsUpdate = false;

  // 1. Crea struttura 'data' per Date
  const dataId = task.id || uuidv4();
  const subDataIds = [atomicTasks.day, atomicTasks.month, atomicTasks.year];

  updates.data = [{
    id: dataId,
    type: 'date',
    subData: subDataIds.map(id => ({ id })) // Solo ID, niente label
  }];
  needsUpdate = true;

  // 2. Rimuovi subDataIds se esiste (sostituito da data[0].subData)
  if (task.subDataIds && Array.isArray(task.subDataIds) && task.subDataIds.length > 0) {
    if (!updates.$unset) updates.$unset = {};
    updates.$unset.subDataIds = '';
    needsUpdate = true;
  }

  // 3. Rimuovi mainData se esiste (sostituito da data)
  if (task.mainData) {
    if (!updates.$unset) updates.$unset = {};
    updates.$unset.mainData = '';
    needsUpdate = true;
  }

  if (!needsUpdate) {
    return { migrated: false, reason: 'No changes needed' };
  }

  if (dryRun) {
    // Costruisci task completo DOPO la migrazione
    const taskAfter = {
      id: task.id || task._id,
      type: task.type,
      label: task.label || task.name || null,
      templateId: task.templateId || null,
      data: updates.data,
      // Mantieni tutti gli altri campi esistenti
      steps: task.steps || undefined,
      dialogueSteps: task.dialogueSteps || undefined,
      constraints: task.constraints || undefined,
      examples: task.examples || undefined,
      nlpContract: task.nlpContract || undefined,
      // Rimuovi mainData e subDataIds
    };

    // Rimuovi campi undefined per pulizia
    Object.keys(taskAfter).forEach(key => {
      if (taskAfter[key] === undefined) {
        delete taskAfter[key];
      }
    });

    return {
      migrated: true,
      dryRun: true,
      taskId: taskId,
      label: label,
      updates: updates,
      before: {
        // Task completo PRIMA
        task: {
          id: task.id || task._id,
          type: task.type,
          label: task.label || task.name || null,
          templateId: task.templateId || null,
          mainData: task.mainData || null,
          subDataIds: task.subDataIds || null,
          steps: task.steps ? Object.keys(task.steps).length + ' keys' : null,
          dialogueSteps: task.dialogueSteps ? task.dialogueSteps.length + ' items' : null,
          constraints: task.constraints ? task.constraints.length + ' items' : null,
          examples: task.examples ? task.examples.length + ' items' : null,
          nlpContract: task.nlpContract ? 'exists' : null
        }
      },
      after: {
        // Task completo DOPO
        task: taskAfter
      }
    };
  }

  // Applica aggiornamenti
  const updateQuery = { $set: updates };
  if (updates.$unset) {
    updateQuery.$unset = updates.$unset;
    delete updates.$unset;
  }

  await collection.updateOne(
    { _id: task._id },
    updateQuery
  );

  return {
    migrated: true,
    dryRun: false,
    taskId: taskId,
    label: label
  };
}

// Migrazione principale - solo task Date
async function migrateDateTasks(dryRun = true) {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const factoryDb = client.db(dbFactory);
    const collection = factoryDb.collection('Tasks');

    // Trova task atomici Day, Month, Year
    const atomicTasks = await findDateAtomicTasks(collection);

    // Verifica che abbiamo tutti i task atomici
    if (!atomicTasks.day || !atomicTasks.month || !atomicTasks.year) {
      console.error('❌ ERROR: Cannot proceed - missing atomic tasks!');
      console.error('   Please ensure Day, Month, and Year tasks exist in the database.');
      return;
    }

    // Trova tutti i task Date
    const allDataRequest = await collection.find({ type: 3 }).toArray();
    const dateTasks = allDataRequest.filter(isDateTask);

    console.log(`📋 Found ${dateTasks.length} Date task(s)\n`);

    if (dateTasks.length === 0) {
      console.log('⚠️  No Date tasks found to migrate');
      return;
    }

    // Mostra task Date trovati
    dateTasks.forEach((task, idx) => {
      console.log(`${idx + 1}. "${task.label || task.name || 'N/A'}" (${task.id || task._id})`);
      console.log(`   MainData: ${task.mainData ? 'YES' : 'NO'}`);
      console.log(`   SubDataIds: ${task.subDataIds ? `${task.subDataIds.length} (${JSON.stringify(task.subDataIds)})` : 'NO'}`);
      console.log();
    });

    if (dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be applied\n');
      console.log('='.repeat(80));
    } else {
      console.log('⚠️  LIVE MODE - Changes will be applied!\n');
      console.log('='.repeat(80));
    }

    const results = {
      total: dateTasks.length,
      migrated: 0,
      skipped: 0,
      errors: []
    };

    for (const task of dateTasks) {
      try {
        const result = await migrateDateTask(task, collection, atomicTasks, dryRun);

        if (result.migrated) {
          results.migrated++;

          if (dryRun) {
            console.log(`\n✅ Would migrate: "${result.label}" (${result.taskId})`);
            console.log(`\n   📋 TASK COMPLETO PRIMA:`);
            console.log(JSON.stringify(result.before.task, null, 2));
            console.log(`\n   📋 TASK COMPLETO DOPO:`);
            console.log(JSON.stringify(result.after.task, null, 2));
            console.log(`\n   🔧 UPDATE QUERY (solo modifiche):`);
            console.log(JSON.stringify(result.updates, null, 2));
          } else {
            console.log(`✅ Migrated: "${result.label}" (${result.taskId})`);
          }
        } else {
          results.skipped++;
          console.log(`⏭️  Skipped: "${task.label || task.name || 'N/A'}" - ${result.reason}`);
          if (result.missing) {
            console.log(`   Missing:`, result.missing);
          }
        }
      } catch (error) {
        results.errors.push({
          taskId: task.id || task._id,
          label: task.label || task.name || 'N/A',
          error: error.message
        });
        console.error(`❌ Error migrating "${task.label || 'N/A'}":`, error.message);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Date tasks: ${results.total}`);
    console.log(`Migrated: ${results.migrated}`);
    console.log(`Skipped: ${results.skipped}`);
    console.log(`Errors: ${results.errors.length}`);

    if (results.errors.length > 0) {
      console.log('\n❌ Errors:');
      results.errors.forEach(err => {
        console.log(`  - ${err.label} (${err.taskId}): ${err.error}`);
      });
    }

    if (dryRun) {
      console.log('\n💡 Review the changes above, then run with --live to apply');
    } else {
      console.log('\n✅ Migration completed!');
    }

  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

// Esegui migrazione
if (require.main === module) {
  const dryRun = process.argv.includes('--live') ? false : true;
  migrateDateTasks(dryRun).catch(console.error);
}

module.exports = { migrateDateTasks, migrateDateTask, findDateAtomicTasks };
