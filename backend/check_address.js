const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';

(async () => {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('factory');

        // Cerca tutti i template address-related
        const allAddress = await db.collection('Task_Templates').find({
            $or: [
                { name: /address/i },
                { label: /address/i },
                { name: /indirizzo/i },
                { label: /indirizzo/i },
                { dataType: 'address' },
                { type: 'address' }
            ]
        }).toArray();

        console.log(`\n=== TROVATI ${allAddress.length} TEMPLATE ADDRESS-RELATED ===\n`);

        allAddress.forEach((t, idx) => {
            console.log(`\n${idx + 1}. ${t.name || t.label} (ID: ${t._id})`);
            console.log(`   Type: ${t.type || t.dataType || 'N/A'}`);
            console.log(`   MainData: ${t.mainData ? `PRESENTE (${Array.isArray(t.mainData) ? t.mainData.length : 'non-array'})` : 'ASSENTE'}`);
            if (t.mainData && Array.isArray(t.mainData)) {
                t.mainData.forEach((md, i) => {
                    console.log(`     MainData[${i}]: ${md.label || md.name || 'N/A'}`);
                    console.log(`       SubData: ${md.subData ? `${md.subData.length} elementi` : 'ASSENTE'}`);
                    if (md.subData && Array.isArray(md.subData)) {
                        md.subData.forEach((sd, j) => {
                            console.log(`         - ${sd.label || sd.name || 'N/A'}`);
                        });
                    }
                });
            }
            console.log(`   SubDataIds: ${t.subDataIds ? `${t.subDataIds.length} IDs: ${JSON.stringify(t.subDataIds)}` : 'ASSENTE'}`);
            console.log(`   Metadata.isMainData: ${t.metadata?.isMainData || false}`);
            console.log(`   Metadata.isSubData: ${t.metadata?.isSubData || false}`);
        });

        // Cerca il template principale Address
        const mainAddress = allAddress.find(t =>
            !t.metadata?.isSubData &&
            (t.name?.toLowerCase() === 'address' ||
             t.label?.toLowerCase() === 'address' ||
             t.name?.toLowerCase() === 'indirizzo' ||
             t.label?.toLowerCase() === 'indirizzo')
        );

        if (mainAddress) {
            console.log('\n\n=== TEMPLATE PRINCIPALE ADDRESS ===');
            console.log(JSON.stringify(mainAddress, null, 2));
        } else {
            console.log('\n\n❌ Template principale Address non trovato!');
            console.log('   Serve creare/aggiornare il template principale Address con mainData e subData.');
        }

    } catch (error) {
        console.error('Errore:', error);
    } finally {
        await client.close();
    }
})();

