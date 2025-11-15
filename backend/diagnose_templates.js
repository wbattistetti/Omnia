/**
 * Diagnostic script to check what's in Task_Types and Task_Templates collections
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

async function diagnoseTemplates() {
    const client = new MongoClient(MONGO_URI, CONNECTION_OPTIONS);

    try {
        await client.connect();
        console.log('[DIAGNOSE] Connected to MongoDB');

        const db = client.db('factory');

        // Check Task_Types
        console.log('\n[DIAGNOSE] ===== Task_Types Collection =====');
        const taskTypesColl = db.collection('Task_Types');
        const taskTypesCount = await taskTypesColl.countDocuments();
        console.log(`[DIAGNOSE] Total documents: ${taskTypesCount}`);

        if (taskTypesCount > 0) {
            const taskTypes = await taskTypesColl.find({}).limit(5).toArray();
            console.log('\n[DIAGNOSE] Sample documents:');
            taskTypes.forEach((doc, idx) => {
                console.log(`\n[DIAGNOSE] Document ${idx + 1}:`);
                console.log(`  _id: ${doc._id}`);
                console.log(`  Has 'name' field: ${doc.name ? 'YES' : 'NO'}`);
                console.log(`  Has 'type' field: ${doc.type ? 'YES' : 'NO'}`);
                console.log(`  Has 'label' field: ${doc.label ? 'YES' : 'NO'}`);
                if (doc.name) console.log(`  name: ${doc.name}`);
                if (doc.type) console.log(`  type: ${doc.type}`);
                if (doc.label) console.log(`  label: ${doc.label}`);
                console.log(`  Fields: ${Object.keys(doc).join(', ')}`);
            });

            // Count by type
            const withName = await taskTypesColl.countDocuments({ name: { $exists: true, $ne: null } });
            const withType = await taskTypesColl.countDocuments({ type: { $exists: true, $ne: null } });
            console.log(`\n[DIAGNOSE] Documents with 'name' field: ${withName}`);
            console.log(`[DIAGNOSE] Documents with 'type' field: ${withType}`);
        }

        // Check Task_Templates
        console.log('\n[DIAGNOSE] ===== Task_Templates Collection =====');
        const taskTemplatesColl = db.collection('Task_Templates');
        const taskTemplatesCount = await taskTemplatesColl.countDocuments();
        console.log(`[DIAGNOSE] Total documents: ${taskTemplatesCount}`);

        if (taskTemplatesCount > 0) {
            const taskTemplates = await taskTemplatesColl.find({}).limit(5).toArray();
            console.log('\n[DIAGNOSE] Sample documents:');
            taskTemplates.forEach((doc, idx) => {
                console.log(`\n[DIAGNOSE] Document ${idx + 1}:`);
                console.log(`  _id: ${doc._id}`);
                console.log(`  Has 'name' field: ${doc.name ? 'YES' : 'NO'}`);
                console.log(`  Has 'taskType' field: ${doc.taskType ? 'YES' : 'NO'}`);
                if (doc.name) console.log(`  name: ${doc.name}`);
                if (doc.taskType) console.log(`  taskType: ${doc.taskType}`);
                console.log(`  Fields: ${Object.keys(doc).join(', ')}`);
            });

            // Count by taskType
            const withName = await taskTemplatesColl.countDocuments({ name: { $exists: true, $ne: null } });
            const withTaskType = await taskTemplatesColl.countDocuments({ taskType: { $exists: true, $ne: null } });
            console.log(`\n[DIAGNOSE] Documents with 'name' field: ${withName}`);
            console.log(`[DIAGNOSE] Documents with 'taskType' field: ${withTaskType}`);
        }

        // Check old collections (if they still exist)
        console.log('\n[DIAGNOSE] ===== Old Collections (if exist) =====');
        const collections = await db.listCollections().toArray();
        const relevantCollections = collections.filter(c =>
            c.name.includes('template') ||
            c.name.includes('Template') ||
            c.name.includes('type') ||
            c.name.includes('Type')
        );

        for (const coll of relevantCollections) {
            const count = await db.collection(coll.name).countDocuments();
            console.log(`[DIAGNOSE] ${coll.name}: ${count} documents`);
        }

    } catch (error) {
        console.error('[DIAGNOSE] Error:', error);
    } finally {
        await client.close();
        console.log('\n[DIAGNOSE] Connection closed');
    }
}

if (require.main === module) {
    diagnoseTemplates()
        .then(() => {
            console.log('\n[DIAGNOSE] ✅ Diagnosis completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n[DIAGNOSE] ❌ Diagnosis failed:', error);
            process.exit(1);
        });
}

module.exports = { diagnoseTemplates };

