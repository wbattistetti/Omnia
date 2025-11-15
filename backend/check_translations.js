const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const DB_FACTORY = 'factory';

async function main() {
    const client = new MongoClient(MONGODB_URI);
    try {
        await client.connect();
        const db = client.db(DB_FACTORY);
        const coll = db.collection('Translations');

        const sample = await coll.find({ type: 'Template', language: { $in: ['it', 'pt'] } }).limit(10).toArray();

        console.log('Sample updated translations:\n');
        sample.forEach(t => {
            console.log(`  ${t.language.toUpperCase()}: ${t.text?.substring(0, 70)}`);
        });

        // Count by language
        const countIt = await coll.countDocuments({ type: 'Template', language: 'it' });
        const countPt = await coll.countDocuments({ type: 'Template', language: 'pt' });
        const countEn = await coll.countDocuments({ type: 'Template', language: 'en' });

        console.log(`\n📊 Counts:`);
        console.log(`  EN: ${countEn}`);
        console.log(`  IT: ${countIt}`);
        console.log(`  PT: ${countPt}`);

    } finally {
        await client.close();
    }
}

main().catch(console.error);







