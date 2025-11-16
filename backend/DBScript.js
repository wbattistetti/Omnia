// Aggiungi questa funzione a DBScript.js

const { ObjectId } = require('mongodb');

async function checkSubDataTemplates() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB\n');

        const db = client.db(DB_NAME);
        const templatesCollection = db.collection('Task_Templates');

        // ID cercati dal frontend
        const searchedIds = [
            '691708f082f0c8d95d05b706',
            '691708f082f0c8d95d05b707',
            '691708f082f0c8d95d05b708'
        ];

        console.log('🔍 Verificando template sottodato...\n');

        for (const idStr of searchedIds) {
            // Prova come ObjectId
            let found = await templatesCollection.findOne({ _id: new ObjectId(idStr) });

            if (!found) {
                // Prova come stringa
                found = await templatesCollection.findOne({ _id: idStr });
            }

            if (!found) {
                // Prova cercando per name o label che potrebbero corrispondere
                found = await templatesCollection.findOne({
                    $or: [
                        { name: /day|month|year/i },
                        { label: /day|month|year|giorno|mese|anno/i }
                    ]
                });
            }

            if (found) {
                console.log(`✅ Trovato per ID ${idStr}:`, {
                    _id: found._id,
                    _idString: String(found._id),
                    _idType: found._id?.constructor?.name,
                    name: found.name,
                    label: found.label
                });
            } else {
                console.log(`❌ NON trovato per ID ${idStr}`);
            }
        }

        // Mostra tutti i template con name Day, Month, Year
        console.log('\n🔍 Cercando template Day, Month, Year...\n');
        const dayMonthYear = await templatesCollection.find({
            $or: [
                { name: /day|month|year/i },
                { label: /day|month|year|giorno|mese|anno/i }
            ]
        }).toArray();

        console.log(`Trovati ${dayMonthYear.length} template:`);
        dayMonthYear.forEach(t => {
            console.log({
                _id: String(t._id),
                name: t.name,
                label: t.label
            });
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await client.close();
    }
}

// Sostituisci la chiamata finale con:
// checkSubDataTemplates().catch(console.error);