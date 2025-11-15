const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';

(async () => {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('factory');
        const taskTemplatesColl = db.collection('Task_Templates');

        // Trova tutti i template complessi (con mainData e subData)
        const complexTemplates = await taskTemplatesColl.find({
            $or: [
                { type: 'REQUEST_DATA' },
                { dataType: { $exists: true } },
                { 'valueSchema.editor': 'ddt' }
            ]
        }).toArray();

        console.log(`\n=== TEMPLATE COMPLESSI TROVATI: ${complexTemplates.length} ===\n`);

        const issues = [];

        for (const template of complexTemplates) {
            const name = template.name || template.label || '';
            const type = template.dataType || template.type || '';
            const hasMainData = template.mainData && Array.isArray(template.mainData) && template.mainData.length > 0;

            if (!hasMainData) continue; // Salta se non ha mainData

            // Verifica se ha subData nei mainData
            const mainDataWithSubData = template.mainData.filter(md =>
                md.subData && Array.isArray(md.subData) && md.subData.length > 0
            );

            if (mainDataWithSubData.length > 0) {
                console.log(`\n✓ ${name} (${type})`);
                console.log(`  MainData: ${template.mainData.length} elementi`);

                template.mainData.forEach((md, idx) => {
                    if (md.subData && md.subData.length > 0) {
                        console.log(`    MainData[${idx}]: ${md.label || md.name || 'N/A'}`);
                        console.log(`      SubData: ${md.subData.length} elementi`);
                        console.log(`      SubDataIds: ${template.subDataIds ? `${template.subDataIds.length} IDs` : 'ASSENTE ❌'}`);

                        if (!template.subDataIds || template.subDataIds.length === 0) {
                            issues.push({
                                template: template,
                                mainDataIndex: idx,
                                subDataCount: md.subData.length,
                                missingSubDataIds: true
                            });
                        } else {
                            // Verifica che i subDataIds corrispondano ai subData
                            md.subData.forEach((sd, sdIdx) => {
                                const hasId = template.subDataIds && template.subDataIds[sdIdx];
                                console.log(`        - ${sd.label || sd.name || 'N/A'}: ${hasId ? `ID: ${hasId}` : 'SENZA ID ❌'}`);
                            });
                        }
                    }
                });
            }
        }

        if (issues.length > 0) {
            console.log(`\n\n=== PROBLEMI TROVATI: ${issues.length} ===`);
            issues.forEach(issue => {
                console.log(`\n- ${issue.template.name || issue.template.label}`);
                console.log(`  Manca subDataIds per ${issue.subDataCount} subData`);
            });
        } else {
            console.log(`\n\n✓ Tutti i template complessi hanno subDataIds configurati correttamente!`);
        }

    } catch (error) {
        console.error('Errore:', error);
    } finally {
        await client.close();
    }
})();
