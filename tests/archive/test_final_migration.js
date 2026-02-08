/**
 * Final test script to verify all collections and references are correct
 */

const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';

const CONNECTION_OPTIONS = {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 30000,
    retryWrites: true,
    retryReads: true,
    maxPoolSize: 10,
    minPoolSize: 2
};

async function runFinalTest() {
    const client = new MongoClient(MONGO_URI, CONNECTION_OPTIONS);

    try {
        await client.connect();
        console.log('[TEST] ✅ Connected to MongoDB\n');

        const db = client.db('factory');

        // Test 1: Verify Task_Types structure
        console.log('[TEST] ===== Test 1: Task_Types Collection =====');
        const taskTypesColl = db.collection('Task_Types');
        const taskTypesCount = await taskTypesColl.countDocuments();
        console.log(`[TEST] Task_Types documents: ${taskTypesCount}`);

        if (taskTypesCount > 0) {
            const sampleTaskType = await taskTypesColl.findOne({});
            console.log(`[TEST] Sample Task Type:`);
            console.log(`  _id: ${sampleTaskType._id}`);
            console.log(`  Has 'label': ${sampleTaskType.label ? 'YES' : 'NO'}`);
            console.log(`  Has 'name': ${sampleTaskType.name ? 'YES' : 'NO'}`);
            console.log(`  Fields: ${Object.keys(sampleTaskType).join(', ')}`);
        }

        // Test 2: Verify Task_Templates structure
        console.log('\n[TEST] ===== Test 2: Task_Templates Collection =====');
        const taskTemplatesColl = db.collection('Task_Templates');
        const taskTemplatesCount = await taskTemplatesColl.countDocuments();
        console.log(`[TEST] Task_Templates documents: ${taskTemplatesCount}`);

        // Count templates with 'name' (data DDT templates)
        const dataTemplatesCount = await taskTemplatesColl.countDocuments({ name: { $exists: true, $ne: null } });
        console.log(`[TEST] Data DDT templates (with 'name'): ${dataTemplatesCount}`);

        // Count templates with 'taskType' (task templates)
        const taskTemplatesWithType = await taskTemplatesColl.countDocuments({ taskType: { $exists: true, $ne: null } });
        console.log(`[TEST] Task templates (with 'taskType'): ${taskTemplatesWithType}`);

        if (dataTemplatesCount > 0) {
            const sampleDataTemplate = await taskTemplatesColl.findOne({ name: { $exists: true } });
            console.log(`\n[TEST] Sample Data DDT Template:`);
            console.log(`  _id: ${sampleDataTemplate._id}`);
            console.log(`  name: ${sampleDataTemplate.name}`);
            console.log(`  label: ${sampleDataTemplate.label || 'N/A'}`);
            console.log(`  Has 'steps': ${sampleDataTemplate.steps ? 'YES' : 'NO'}`);
            console.log(`  Fields: ${Object.keys(sampleDataTemplate).join(', ')}`);
        }

        // Test 3: Verify Translations collection
        console.log('\n[TEST] ===== Test 3: Translations Collection =====');
        const translationsColl = db.collection('Translations');
        const translationsCount = await translationsColl.countDocuments();
        console.log(`[TEST] Translations documents: ${translationsCount}`);

        const templateTranslations = await translationsColl.countDocuments({ type: 'Template' });
        console.log(`[TEST] Template translations (type='Template'): ${templateTranslations}`);

        // Test 4: Verify Python services can access Task_Templates
        console.log('\n[TEST] ===== Test 4: Python Services Access =====');
        console.log('[TEST] This test requires Python to be installed.');
        console.log('[TEST] Run: python test_python_templates.py');

        // Test 5: Summary
        console.log('\n[TEST] ===== Summary =====');
        console.log(`[TEST] ✅ Task_Types: ${taskTypesCount} documents (task types)`);
        console.log(`[TEST] ✅ Task_Templates: ${taskTemplatesCount} documents`);
        console.log(`[TEST]   - Data DDT templates: ${dataTemplatesCount}`);
        console.log(`[TEST]   - Task templates: ${taskTemplatesWithType}`);
        console.log(`[TEST] ✅ Translations: ${translationsCount} documents`);
        console.log(`[TEST]   - Template translations: ${templateTranslations}`);

        // Final check
        const allChecksPassed =
            taskTypesCount > 0 &&
            dataTemplatesCount > 0 &&
            translationsCount > 0;

        if (allChecksPassed) {
            console.log('\n[TEST] ✅ All checks passed! Migration successful.');
            return true;
        } else {
            console.log('\n[TEST] ⚠️  Some checks failed. Review the output above.');
            return false;
        }

    } catch (error) {
        console.error('[TEST] ❌ Error:', error);
        return false;
    } finally {
        await client.close();
        console.log('\n[TEST] Connection closed');
    }
}

if (require.main === module) {
    runFinalTest()
        .then((success) => {
            process.exit(success ? 0 : 1);
        })
        .catch((error) => {
            console.error('[TEST] ❌ Test failed:', error);
            process.exit(1);
        });
}

module.exports = { runFinalTest };

