const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const DB_FACTORY = 'factory';

async function main() {
    const client = new MongoClient(MONGODB_URI);
    try {
        await client.connect();
        const db = client.db(DB_FACTORY);
        // Template di dati DDT sono in Task_Templates, non type_templates
        const templates = await db.collection('Task_Templates').find({}).toArray();

        console.log(`Found ${templates.length} templates\n`);

        let subDataWithStart = 0;
        let subDataWithoutStart = 0;

        templates.forEach(template => {
            // Check subData at root level
            if (Array.isArray(template.subData)) {
                template.subData.forEach(sub => {
                    if (sub.stepPrompts) {
                        if (sub.stepPrompts.start) {
                            subDataWithStart++;
                            console.log(`✅ Template "${template.label || template.name}" → SubData "${sub.label}" HAS start:`, sub.stepPrompts.start);
                        } else {
                            subDataWithoutStart++;
                            console.log(`❌ Template "${template.label || template.name}" → SubData "${sub.label}" MISSING start. Has:`, Object.keys(sub.stepPrompts));
                        }
                    }
                });
            }

            // Check subData within mainData
            if (Array.isArray(template.mainData)) {
                template.mainData.forEach(main => {
                    if (Array.isArray(main.subData)) {
                        main.subData.forEach(sub => {
                            if (sub.stepPrompts) {
                                if (sub.stepPrompts.start) {
                                    subDataWithStart++;
                                    console.log(`✅ Template "${template.label || template.name}" → Main "${main.label}" → SubData "${sub.label}" HAS start:`, sub.stepPrompts.start);
                                } else {
                                    subDataWithoutStart++;
                                    console.log(`❌ Template "${template.label || template.name}" → Main "${main.label}" → SubData "${sub.label}" MISSING start. Has:`, Object.keys(sub.stepPrompts));
                                }
                            }
                        });
                    }
                });
            }
        });

        console.log(`\n📊 Summary:`);
        console.log(`  SubData WITH start: ${subDataWithStart}`);
        console.log(`  SubData WITHOUT start: ${subDataWithoutStart}`);

    } finally {
        await client.close();
    }
}

main().catch(console.error);







