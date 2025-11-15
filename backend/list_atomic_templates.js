const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';

(async () => {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('factory');
        const taskTemplatesColl = db.collection('Task_Templates');

        // Trova tutti i template
        const allTemplates = await taskTemplatesColl.find({}).toArray();

        console.log(`\n=== TUTTI I TEMPLATE: ${allTemplates.length} ===\n`);

        // Cerca template atomici (senza mainData o con metadata.isSubData)
        const atomicTemplates = allTemplates.filter(t => {
            const hasMainData = t.mainData && Array.isArray(t.mainData) && t.mainData.length > 0;
            const isSubData = t.metadata?.isSubData;
            const isMainData = t.metadata?.isMainData;

            // Template atomico: non ha mainData OPPURE è marcato come subData
            return !hasMainData || isSubData;
        });

        console.log(`\n=== TEMPLATE ATOMICI/POTENZIALI: ${atomicTemplates.length} ===\n`);

        // Raggruppa per tipo
        const byType = {};
        atomicTemplates.forEach(t => {
            const type = t.dataType || t.type || 'unknown';
            if (!byType[type]) byType[type] = [];
            byType[type].push(t);
        });

        Object.keys(byType).sort().forEach(type => {
            console.log(`\n${type}:`);
            byType[type].forEach(t => {
                const name = t.name || t.label || 'N/A';
                const hasMainData = t.mainData && Array.isArray(t.mainData) && t.mainData.length > 0;
                const isSubData = t.metadata?.isSubData;
                console.log(`  - ${name} (ID: ${t._id})`);
                console.log(`    mainData: ${hasMainData ? 'SI' : 'NO'}`);
                console.log(`    isSubData: ${isSubData || false}`);
                console.log(`    subDataIds: ${t.subDataIds ? t.subDataIds.length : 'NO'}`);
            });
        });

        // Cerca specificamente i template che potrebbero essere atomici per Date
        console.log(`\n\n=== CERCA TEMPLATE PER DATE (Giorno, Mese, Anno) ===`);
        const dateRelated = allTemplates.filter(t => {
            const name = (t.name || t.label || '').toLowerCase();
            return name.includes('day') || name.includes('giorno') ||
                   name.includes('month') || name.includes('mese') ||
                   name.includes('year') || name.includes('anno');
        });

        dateRelated.forEach(t => {
            console.log(`- ${t.name || t.label} (ID: ${t._id}, type: ${t.type || t.dataType})`);
        });

        // Cerca template per Name
        console.log(`\n\n=== CERCA TEMPLATE PER NAME (Nome, Cognome) ===`);
        const nameRelated = allTemplates.filter(t => {
            const name = (t.name || t.label || '').toLowerCase();
            return name.includes('first') || name.includes('nome') ||
                   name.includes('last') || name.includes('cognome') ||
                   name.includes('surname');
        });

        nameRelated.forEach(t => {
            console.log(`- ${t.name || t.label} (ID: ${t._id}, type: ${t.type || t.dataType})`);
        });

    } catch (error) {
        console.error('Errore:', error);
    } finally {
        await client.close();
    }
})();

