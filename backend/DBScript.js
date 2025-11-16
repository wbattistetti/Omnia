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

async function checkTranslationGuid() {
    const { MongoClient } = require('mongodb');
    const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
    const DB_NAME = 'factory';
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB\n');

        const db = client.db(DB_NAME);
        const translationsCollection = db.collection('Translations');

        const guid = '3fde2e6e-2b5d-43c2-9c37-16f42e84abcf';

        console.log(`🔍 Cercando GUID: ${guid}\n`);

        // Cerca per guid
        const found = await translationsCollection.find({ guid: guid }).toArray();

        if (found.length > 0) {
            console.log(`✅ Trovate ${found.length} traduzioni per GUID ${guid}:\n`);
            found.forEach((doc, idx) => {
                console.log(`[${idx + 1}]`, {
                    _id: String(doc._id),
                    guid: doc.guid,
                    language: doc.language,
                    type: doc.type,
                    text: doc.text ? doc.text.substring(0, 100) : 'NO TEXT',
                    projectId: doc.projectId,
                    createdAt: doc.createdAt,
                    updatedAt: doc.updatedAt,
                    allKeys: Object.keys(doc)
                });
            });
        } else {
            console.log(`❌ Nessuna traduzione trovata per GUID ${guid}\n`);

            // Verifica se esiste come _id
            const foundById = await translationsCollection.findOne({ _id: guid });
            if (foundById) {
                console.log(`⚠️ Trovato come _id invece di guid:`, {
                    _id: foundById._id,
                    guid: foundById.guid,
                    language: foundById.language,
                    type: foundById.type,
                    text: foundById.text ? foundById.text.substring(0, 100) : 'NO TEXT'
                });
            } else {
                console.log(`❌ Non trovato né come guid né come _id\n`);
            }
        }

        // Mostra alcuni esempi di traduzioni per capire la struttura
        console.log('\n🔍 Esempi di traduzioni nel database (primi 5):\n');
        const samples = await translationsCollection.find({ type: 'Template' }).limit(5).toArray();
        samples.forEach((doc, idx) => {
            console.log(`[Sample ${idx + 1}]`, {
                _id: String(doc._id),
                guid: doc.guid || 'NO GUID',
                language: doc.language,
                type: doc.type,
                text: doc.text ? doc.text.substring(0, 50) : 'NO TEXT',
                hasGuid: !!doc.guid,
                hasId: !!doc._id
            });
        });

    } catch (error) {
        console.error('❌ Error:', error);
        console.error(error.stack);
    } finally {
        await client.close();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

async function checkTemplateGuids() {
    const { MongoClient, ObjectId } = require('mongodb');
    const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
    const DB_NAME = 'factory';
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB\n');

        const db = client.db(DB_NAME);
        const templatesCollection = db.collection('Task_Templates');
        const translationsCollection = db.collection('Translations');

        // Cerca il template "Date"
        const dateTemplate = await templatesCollection.findOne({
            $or: [
                { label: 'Date' },
                { label: /date/i },
                { name: 'Date' },
                { name: /date/i }
            ]
        });

        if (!dateTemplate) {
            console.log('❌ Template Date non trovato\n');
            return;
        }

        console.log('✅ Template Date trovato:', {
            _id: String(dateTemplate._id),
            label: dateTemplate.label,
            hasStepPrompts: !!dateTemplate.stepPrompts
        });

        // Estrai tutti i GUID dai stepPrompts
        const templateGuids = [];
        if (dateTemplate.stepPrompts) {
            console.log('\n🔍 GUID nei stepPrompts del template Date:\n');
            Object.entries(dateTemplate.stepPrompts).forEach(([stepKey, guids]) => {
                if (Array.isArray(guids)) {
                    guids.forEach(guid => {
                        if (typeof guid === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(guid)) {
                            templateGuids.push(guid);
                            console.log(`  [${stepKey}] ${guid}`);
                        }
                    });
                }
            });
        }

        // Verifica quali GUID esistono nel database
        console.log(`\n🔍 Verificando quali GUID esistono nel database (${templateGuids.length} totali):\n`);
        const uniqueGuids = [...new Set(templateGuids)];
        const foundGuids = [];
        const missingGuids = [];

        for (const guid of uniqueGuids) {
            const found = await translationsCollection.findOne({ guid: guid, type: 'Template' });
            if (found) {
                foundGuids.push(guid);
                console.log(`  ✅ ${guid} - Trovato (${found.language})`);
            } else {
                missingGuids.push(guid);
                console.log(`  ❌ ${guid} - NON trovato`);
            }
        }

        console.log(`\n📊 Riepilogo:`);
        console.log(`  Total GUID nei template: ${uniqueGuids.length}`);
        console.log(`  GUID trovati nel DB: ${foundGuids.length}`);
        console.log(`  GUID mancanti nel DB: ${missingGuids.length}`);

        if (missingGuids.length > 0) {
            console.log(`\n❌ GUID mancanti:\n`);
            missingGuids.forEach(guid => console.log(`  - ${guid}`));
        }

        // Verifica anche i subData
        if (dateTemplate.subDataIds && dateTemplate.subDataIds.length > 0) {
            console.log(`\n🔍 Verificando subData templates (${dateTemplate.subDataIds.length}):\n`);
            for (const subId of dateTemplate.subDataIds) {
                // Prova come ObjectId se è un ObjectId valido
                let subTemplate = null;
                try {
                    if (ObjectId.isValid(subId)) {
                        subTemplate = await templatesCollection.findOne({ _id: new ObjectId(subId) });
                    }
                } catch (e) {
                    // Ignora errori di conversione
                }

                // Se non trovato, prova come stringa o label/name
                if (!subTemplate) {
                    subTemplate = await templatesCollection.findOne({
                        $or: [
                            { _id: subId },
                            { label: subId },
                            { name: subId }
                        ]
                    });
                }

                if (subTemplate) {
                    console.log(`\n  📄 Sub-template: ${subTemplate.label || subTemplate.name}`);
                    if (subTemplate.stepPrompts) {
                        for (const [stepKey, guids] of Object.entries(subTemplate.stepPrompts)) {
                            if (Array.isArray(guids)) {
                                for (const guid of guids) {
                                    if (typeof guid === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(guid)) {
                                        const found = await translationsCollection.findOne({ guid: guid, type: 'Template' });
                                        console.log(`    [${stepKey}] ${guid} - ${found ? '✅ Trovato' : '❌ Mancante'}`);
                                    }
                                }
                            }
                        }
                    }
                } else {
                    console.log(`  ❌ Sub-template non trovato per ID: ${subId}`);
                }
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
        console.error(error.stack);
    } finally {
        await client.close();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Esegui la query
checkTemplateGuids().catch(console.error);