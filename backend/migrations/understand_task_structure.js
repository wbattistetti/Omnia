/**
 * Capire la struttura: questi task sono template base o task completi?
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function understandTaskStructure() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const factoryDb = client.db(dbFactory);
    const collection = factoryDb.collection('Tasks');

    // Get all type: 3 tasks
    const allDataRequest = await collection.find({ type: 3 }).toArray();

    // Categorize
    const withMainData = allDataRequest.filter(t => t.mainData && Array.isArray(t.mainData) && t.mainData.length > 0);
    const withoutMainData = allDataRequest.filter(t => !t.mainData || !Array.isArray(t.mainData) || t.mainData.length === 0);
    const withSubDataIds = withoutMainData.filter(t => t.subDataIds && Array.isArray(t.subDataIds) && t.subDataIds.length > 0);
    const withoutSubDataIds = withoutMainData.filter(t => !t.subDataIds || !Array.isArray(t.subDataIds) || t.subDataIds.length === 0);

    console.log('='.repeat(70));
    console.log('📊 CATEGORIZATION');
    console.log('='.repeat(70));
    console.log(`  Total type: 3 tasks: ${allDataRequest.length}`);
    console.log(`  With mainData: ${withMainData.length}`);
    console.log(`  Without mainData: ${withoutMainData.length}`);
    console.log(`    - With subDataIds (sub-data nodes): ${withSubDataIds.length}`);
    console.log(`    - Without subDataIds (standalone?): ${withoutSubDataIds.length}`);

    // Check if tasks with mainData reference sub-data nodes
    console.log(`\n` + '='.repeat(70));
    console.log('🔍 CHECKING TASKS WITH mainData');
    console.log('='.repeat(70));

    for (const task of withMainData) {
      console.log(`\n  Task: ${task.id || task._id}`);
      console.log(`    Label: ${task.label || 'N/A'}`);
      console.log(`    MainData nodes: ${task.mainData?.length || 0}`);

      if (task.mainData && task.mainData.length > 0) {
        const firstMain = task.mainData[0];
        console.log(`    MainData[0]:`);
        console.log(`      ID: ${firstMain.id || 'N/A'}`);
        console.log(`      Label: ${firstMain.label || 'N/A'}`);
        console.log(`      Has subData: ${firstMain.subData ? 'YES' : 'NO'}`);

        if (firstMain.subData && Array.isArray(firstMain.subData)) {
          console.log(`      SubData count: ${firstMain.subData.length}`);
          console.log(`      SubData IDs: ${firstMain.subData.map(s => s.id || 'N/A').join(', ')}`);

          // Check if these subData IDs match any of the tasks without mainData
          const subDataIds = firstMain.subData.map(s => s.id).filter(Boolean);
          const matchingTasks = withoutMainData.filter(t => subDataIds.includes(t.id || t._id?.toString()));

          if (matchingTasks.length > 0) {
            console.log(`      ✅ Found ${matchingTasks.length} matching sub-data tasks in DB`);
            console.log(`         These sub-data tasks have steps at root level`);
            console.log(`         They should be migrated to dialogueSteps with dataId = ${firstMain.id}`);
          }
        }
      }
    }

    // Check standalone tasks (without mainData and without subDataIds)
    console.log(`\n` + '='.repeat(70));
    console.log('🔍 CHECKING STANDALONE TASKS (no mainData, no subDataIds)');
    console.log('='.repeat(70));

    if (withoutSubDataIds.length > 0) {
      console.log(`\n  Found ${withoutSubDataIds.length} standalone tasks:`);

      for (let i = 0; i < Math.min(5, withoutSubDataIds.length); i++) {
        const task = withoutSubDataIds[i];
        console.log(`\n    ${i + 1}. ${task.id || task._id}`);
        console.log(`       Label: ${task.label || 'N/A'}`);
        console.log(`       Has steps: ${task.steps ? 'YES' : 'NO'}`);
        console.log(`       Has dialogueSteps: ${task.dialogueSteps ? 'YES' : 'NO'}`);

        // These might be incomplete templates or need to be migrated differently
        if (task.steps) {
          console.log(`       ⚠️  This task has steps at root but no mainData`);
          console.log(`          It might be a template base that needs to be assembled into a complete task`);
          console.log(`          OR it needs to be migrated to create a mainData structure`);
        }
      }
    }

    // Final analysis
    console.log(`\n` + '='.repeat(70));
    console.log('💡 MIGRATION STRATEGY');
    console.log('='.repeat(70));
    console.log(`\n  1. Tasks WITH mainData (${withMainData.length}):`);
    console.log(`     - Extract steps from mainData[].steps and mainData[].subData[].steps`);
    console.log(`     - Create dialogueSteps[] with correct dataId references`);
    console.log(`     - Remove steps from nested structure`);

    console.log(`\n  2. Sub-data nodes (${withSubDataIds.length}):`);
    console.log(`     - These are referenced by parent tasks via mainData[].subData[]`);
    console.log(`     - Their steps should be migrated to dialogueSteps with dataId = parent mainData.id`);
    console.log(`     - But they are separate tasks in DB, so we need to find their parent`);
    console.log(`     - OR: These steps should be merged into the parent task's dialogueSteps`);

    console.log(`\n  3. Standalone tasks (${withoutSubDataIds.length}):`);
    console.log(`     - These have steps at root but no mainData`);
    console.log(`     - They might be template bases or incomplete tasks`);
    console.log(`     - Need to create mainData structure from root steps`);
    console.log(`     - Then migrate to dialogueSteps with dataId = task.id`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

if (require.main === module) {
  understandTaskStructure().catch(console.error);
}

module.exports = { understandTaskStructure };

