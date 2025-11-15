const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';

(async () => {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('factory');

        // Template principali da verificare
        const mainTemplates = [
            { name: 'Address', type: 'address' },
            { name: 'Indirizzo', type: 'address' },
            { name: 'Date', type: 'date' },
            { name: 'Full Name', type: 'name' },
            { name: 'Phone Number', type: 'phone' },
            { name: 'Phone', type: 'phone' }
        ];

        console.log(`\n=== VERIFICA TEMPLATE PRINCIPALI COMPLESSI ===\n`);

        for (const searchTemplate of mainTemplates) {
            const template = await db.collection('Task_Templates').findOne({
                $or: [
                    { name: searchTemplate.name },
                    { label: searchTemplate.name },
                    { name: new RegExp(`^${searchTemplate.name}$`, 'i') },
                    { label: new RegExp(`^${searchTemplate.name}$`, 'i') }
                ],
                $or: [
                    { type: 'REQUEST_DATA' },
                    { dataType: searchTemplate.type },
                    { type: searchTemplate.type }
                ]
            });

            if (template) {
                console.log(`\n✓ ${searchTemplate.name} (ID: ${template._id})`);
                console.log(`  Type: ${template.type || template.dataType}`);

                const hasMainData = template.mainData && Array.isArray(template.mainData) && template.mainData.length > 0;
                console.log(`  MainData: ${hasMainData ? 'PRESENTE' : 'ASSENTE'}`);

                if (hasMainData) {
                    template.mainData.forEach((md, i) => {
                        console.log(`    MainData[${i}]: ${md.label || md.name || 'N/A'}`);
                        const hasSubData = md.subData && Array.isArray(md.subData) && md.subData.length > 0;
                        console.log(`      SubData: ${hasSubData ? `${md.subData.length} elementi` : 'ASSENTE'}`);
                        if (hasSubData) {
                            md.subData.forEach((sd, j) => {
                                console.log(`        - ${sd.label || sd.name || 'N/A'}`);
                            });
                        }
                    });
                } else {
                    console.log(`  ❌ MANCA mainData con subData!`);
                }
            } else {
                console.log(`\n❌ ${searchTemplate.name} NON TROVATO`);
            }
        }

        // Cerca anche tutti i template con type address, date, name, phone
        console.log(`\n\n=== TUTTI I TEMPLATE PER TIPO ===\n`);

        const types = ['address', 'date', 'name', 'phone'];
        for (const type of types) {
            const templates = await db.collection('Task_Templates').find({
                $or: [
                    { dataType: type },
                    { type: type }
                ]
            }).toArray();

            console.log(`\n${type.toUpperCase()} (${templates.length} template):`);
            templates.forEach(t => {
                const hasMainData = t.mainData && Array.isArray(t.mainData) && t.mainData.length > 0;
                const hasSubData = hasMainData && t.mainData.some(m =>
                    m.subData && Array.isArray(m.subData) && m.subData.length > 0
                );
                console.log(`  - ${t.name || t.label} (${hasMainData ? 'mainData' : 'no mainData'}, ${hasSubData ? 'subData' : 'no subData'})`);
            });
        }

    } catch (error) {
        console.error('Errore:', error);
    } finally {
        await client.close();
    }
})();

