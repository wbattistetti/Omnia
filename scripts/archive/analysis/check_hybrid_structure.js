/**
 * Verifica se i task nel database hanno già la struttura ibrida (dialogueSteps)
 * o se hanno ancora la struttura annidata (mainData[].steps)
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function checkStructure() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(dbFactory);
    const collection = db.collection('Tasks');

    // Find all DataRequest tasks (type: 3) or tasks with mainData
    const query = {
      $or: [
        { type: 3 }, // DataRequest
        { mainData: { $exists: true, $ne: null } }
      ]
    };

    const tasks = await collection.find(query).toArray();
    console.log(`📋 Found ${tasks.length} tasks to analyze\n`);

    if (tasks.length === 0) {
      console.log('⚠️  No tasks found\n');
      return;
    }

    let hasHybridStructure = 0;      // Has dialogueSteps, no nested steps
    let hasNestedStructure = 0;      // Has mainData[].steps
    let hasBoth = 0;                  // Has both (migration incomplete)
    let hasNeither = 0;              // No steps at all
    let hasMainDataNoSteps = 0;      // Has mainData but no steps

    const examples = {
      hybrid: null,
      nested: null,
      both: null,
      neither: null
    };

    for (const task of tasks) {
      // Check for hybrid structure (dialogueSteps)
      const hasDialogueSteps = task.dialogueSteps &&
                               Array.isArray(task.dialogueSteps) &&
                               task.dialogueSteps.length > 0;

      // Check for nested structure (mainData[].steps)
      let hasNestedSteps = false;
      if (task.mainData && Array.isArray(task.mainData)) {
        hasNestedSteps = task.mainData.some(main => {
          if (main.steps) return true;
          if (main.subData && Array.isArray(main.subData)) {
            return main.subData.some(sub => sub.steps);
          }
          return false;
        });
      }

      // Check if has mainData
      const hasMainData = task.mainData &&
                         Array.isArray(task.mainData) &&
                         task.mainData.length > 0;

      // Classify
      if (hasDialogueSteps && !hasNestedSteps) {
        hasHybridStructure++;
        if (!examples.hybrid) examples.hybrid = task;
      } else if (!hasDialogueSteps && hasNestedSteps) {
        hasNestedStructure++;
        if (!examples.nested) examples.nested = task;
      } else if (hasDialogueSteps && hasNestedSteps) {
        hasBoth++;
        if (!examples.both) examples.both = task;
      } else if (hasMainData && !hasDialogueSteps && !hasNestedSteps) {
        hasMainDataNoSteps++;
      } else {
        hasNeither++;
        if (!examples.neither) examples.neither = task;
      }
    }

    // Print summary
    console.log('='.repeat(70));
    console.log('📊 STRUCTURE ANALYSIS SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Hybrid structure (dialogueSteps, no nested): ${hasHybridStructure}`);
    console.log(`❌ Nested structure (mainData[].steps): ${hasNestedStructure}`);
    console.log(`⚠️  Both structures (migration incomplete): ${hasBoth}`);
    console.log(`📋 Has mainData but no steps: ${hasMainDataNoSteps}`);
    console.log(`❓ No steps at all: ${hasNeither}`);
    console.log('='.repeat(70));

    // Print examples
    if (examples.hybrid) {
      console.log('\n✅ EXAMPLE: Hybrid structure (already migrated)');
      console.log(`   Task ID: ${examples.hybrid.id || examples.hybrid._id}`);
      console.log(`   Label: ${examples.hybrid.label || 'N/A'}`);
      console.log(`   dialogueSteps count: ${examples.hybrid.dialogueSteps?.length || 0}`);
      console.log(`   mainData nodes: ${examples.hybrid.mainData?.length || 0}`);
      if (examples.hybrid.mainData && examples.hybrid.mainData.length > 0) {
        const firstMain = examples.hybrid.mainData[0];
        console.log(`   mainData[0] has steps: ${firstMain.steps ? 'YES ❌' : 'NO ✅'}`);
      }
    }

    if (examples.nested) {
      console.log('\n❌ EXAMPLE: Nested structure (needs migration)');
      console.log(`   Task ID: ${examples.nested.id || examples.nested._id}`);
      console.log(`   Label: ${examples.nested.label || 'N/A'}`);
      console.log(`   dialogueSteps: ${examples.nested.dialogueSteps ? 'YES' : 'NO'}`);
      console.log(`   mainData nodes: ${examples.nested.mainData?.length || 0}`);
      if (examples.nested.mainData && examples.nested.mainData.length > 0) {
        const firstMain = examples.nested.mainData[0];
        console.log(`   mainData[0] has steps: ${firstMain.steps ? 'YES ❌' : 'NO ✅'}`);
        if (firstMain.steps) {
          const stepsType = Array.isArray(firstMain.steps) ? 'array' : typeof firstMain.steps;
          console.log(`   mainData[0].steps type: ${stepsType}`);
          if (Array.isArray(firstMain.steps)) {
            console.log(`   mainData[0].steps count: ${firstMain.steps.length}`);
          } else if (typeof firstMain.steps === 'object') {
            console.log(`   mainData[0].steps keys: ${Object.keys(firstMain.steps).join(', ')}`);
          }
        }
      }
    }

    if (examples.both) {
      console.log('\n⚠️  EXAMPLE: Both structures (migration incomplete)');
      console.log(`   Task ID: ${examples.both.id || examples.both._id}`);
      console.log(`   Label: ${examples.both.label || 'N/A'}`);
      console.log(`   dialogueSteps count: ${examples.both.dialogueSteps?.length || 0}`);
      console.log(`   mainData[0] has steps: ${examples.both.mainData?.[0]?.steps ? 'YES ❌' : 'NO ✅'}`);
    }

    if (examples.neither) {
      console.log('\n❓ EXAMPLE: No steps structure');
      console.log(`   Task ID: ${examples.neither.id || examples.neither._id}`);
      console.log(`   Label: ${examples.neither.label || 'N/A'}`);
      console.log(`   Has mainData: ${examples.neither.mainData ? 'YES' : 'NO'}`);
      console.log(`   Has dialogueSteps: ${examples.neither.dialogueSteps ? 'YES' : 'NO'}`);
    }

    // Conclusion
    console.log('\n' + '='.repeat(70));
    console.log('💡 CONCLUSION:');
    console.log('='.repeat(70));

    if (hasNestedStructure > 0) {
      console.log(`❌ ${hasNestedStructure} tasks need migration (have nested steps)`);
    }

    if (hasBoth > 0) {
      console.log(`⚠️  ${hasBoth} tasks have both structures (migration incomplete)`);
    }

    if (hasHybridStructure > 0) {
      console.log(`✅ ${hasHybridStructure} tasks already have hybrid structure`);
    }

    if (hasHybridStructure === tasks.length && hasNestedStructure === 0 && hasBoth === 0) {
      console.log('\n🎉 All tasks are already in hybrid structure! No migration needed.');
    } else if (hasNestedStructure > 0 || hasBoth > 0) {
      console.log('\n⚠️  Migration is needed for some tasks.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

if (require.main === module) {
  checkStructure().catch(console.error);
}

module.exports = { checkStructure };

