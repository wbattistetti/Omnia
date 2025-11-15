/**
 * Check Task_Templates documents with taskType='Action'
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

async function checkActions() {
    const client = new MongoClient(MONGO_URI, CONNECTION_OPTIONS);

    try {
        await client.connect();
        console.log('[CHECK] Connected to MongoDB\n');

        const db = client.db('factory');
        const coll = db.collection('Task_Templates');

        // Find all documents with taskType='Action'
        const actions = await coll.find({ taskType: 'Action' }).toArray();
        console.log(`[CHECK] Found ${actions.length} documents with taskType='Action'\n`);

        if (actions.length > 0) {
            console.log('[CHECK] Sample action document:');
            const sample = actions[0];
            console.log(JSON.stringify(sample, null, 2));

            console.log('\n[CHECK] All action IDs:');
            actions.forEach((action, idx) => {
                console.log(`  ${idx + 1}. ${action.id || action._id} - label: ${action.label || 'N/A'}`);
            });
        } else {
            // Check if taskType field exists with different values
            const allTaskTypes = await coll.distinct('taskType');
            console.log(`[CHECK] All distinct taskType values: ${allTaskTypes.join(', ')}`);

            // Check if there are documents without taskType
            const withoutTaskType = await coll.countDocuments({ taskType: { $exists: false } });
            console.log(`[CHECK] Documents without taskType field: ${withoutTaskType}`);
        }

    } catch (error) {
        console.error('[CHECK] Error:', error);
    } finally {
        await client.close();
        console.log('\n[CHECK] Connection closed');
    }
}

if (require.main === module) {
    checkActions()
        .then(() => {
            console.log('\n[CHECK] ✅ Check completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n[CHECK] ❌ Check failed:', error);
            process.exit(1);
        });
}

module.exports = { checkActions };

