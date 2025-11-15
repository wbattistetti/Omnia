const { MongoClient, ObjectId } = require('mongodb');
const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';

// Mapping diretto dei subData ai template atomici trovati nel DB
// Formato: 'label subData': 'nome template atomico'
const subDataToAtomicTemplateName = {
    // Date subData
    'Giorno': 'Day',
    'Mese': 'Month',
    'Anno': 'Year',

    // Name subData
    'Nome': 'First name',
    'Cognome': 'Last name',

    // Phone subData
    'Prefisso': 'Country code',
    'Numero': 'Number',

    // Address subData
    'Tipo di via': 'Street', // Da verificare se esiste
    'Nome della via': 'Street Name',
    'Numero civico': 'Civic number',
    'Codice postale': 'Postal code',
    'Città': 'City',
    'Regione': 'Region',
    'Stato/Provincia': 'Region', // Da verificare
    'Paese': 'Country'
};

async function findAtomicTemplates(db) {
    const allTemplates = await db.collection('Task_Templates').find({}).toArray();
    const atomicMap = new Map();

        // Crea una mappa di tutti i template atomici per nome/label
        // Template atomici: hanno metadata.isSubData=true OPPURE non hanno mainData
        allTemplates.forEach(t => {
            const hasMainData = t.mainData && Array.isArray(t.mainData) && t.mainData.length > 0;
            const isSubData = t.metadata?.isSubData;

            // Template atomico: è marcato come subData OPPURE non ha mainData
            if (isSubData || !hasMainData) {
                const name = (t.name || t.label || '').toLowerCase().trim();
                atomicMap.set(name, t);
                if (t.name) atomicMap.set(t.name.toLowerCase(), t);
                if (t.label) atomicMap.set(t.label.toLowerCase(), t);
            }
        });

    return atomicMap;
}

async function findAtomicTemplateForSubData(subDataLabel, atomicMap) {
    // Usa il mapping diretto
    const templateName = subDataToAtomicTemplateName[subDataLabel];
    if (templateName) {
        const normalized = templateName.toLowerCase().trim();
        if (atomicMap.has(normalized)) {
            return atomicMap.get(normalized);
        }
    }

    // Prova anche con il nome diretto del subData
    const normalized = subDataLabel.toLowerCase().trim();
    if (atomicMap.has(normalized)) {
        return atomicMap.get(normalized);
    }

    return null;
}

async function fixSubDataIds(dryRun = true) {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('factory');
        const taskTemplatesColl = db.collection('Task_Templates');

        // Trova tutti i template complessi
        const complexTemplates = await taskTemplatesColl.find({
            $or: [
                { type: 'REQUEST_DATA' },
                { dataType: { $exists: true } },
                { 'valueSchema.editor': 'ddt' }
            ]
        }).toArray();

        // Trova tutti i template atomici
        const atomicMap = await findAtomicTemplates(db);

        console.log(`\n=== TROVATI ${atomicMap.size} TEMPLATE ATOMICI ===`);
        console.log(`=== TROVATI ${complexTemplates.length} TEMPLATE COMPLESSI ===\n`);

        const updates = [];

        for (const template of complexTemplates) {
            const name = template.name || template.label || '';
            const hasMainData = template.mainData && Array.isArray(template.mainData) && template.mainData.length > 0;

            if (!hasMainData) continue;

            // Per ogni mainData con subData, trova i template atomici corrispondenti
            for (const mainData of template.mainData) {
                if (mainData.subData && Array.isArray(mainData.subData) && mainData.subData.length > 0) {
                    const subDataIds = [];
                    const missing = [];

                    for (const subData of mainData.subData) {
                        const subDataLabel = subData.label || subData.name || '';
                        const atomicTemplate = await findAtomicTemplateForSubData(subDataLabel, atomicMap);

                        if (atomicTemplate) {
                            subDataIds.push(atomicTemplate._id.toString());
                            console.log(`✓ ${name} -> ${subDataLabel}: trovato template atomico "${atomicTemplate.name || atomicTemplate.label}" (${atomicTemplate._id})`);
                        } else {
                            missing.push(subDataLabel);
                            console.log(`❌ ${name} -> ${subDataLabel}: template atomico NON TROVATO`);
                        }
                    }

                    if (subDataIds.length > 0) {
                        updates.push({
                            _id: template._id,
                            name: name,
                            subDataIds: subDataIds,
                            missing: missing
                        });
                    }
                }
            }
        }

        if (dryRun) {
            console.log(`\n\n=== DRY RUN: ${updates.length} template verrebbero aggiornati ===`);
            updates.forEach(u => {
                console.log(`\n- ${u.name}`);
                console.log(`  SubDataIds da aggiungere: ${u.subDataIds.length}`);
                console.log(`  IDs: ${u.subDataIds.join(', ')}`);
                if (u.missing.length > 0) {
                    console.log(`  ⚠️  SubData senza template atomico: ${u.missing.join(', ')}`);
                }
            });
        } else {
            console.log(`\n\n=== Aggiornamento di ${updates.length} template ===`);
            for (const update of updates) {
                await taskTemplatesColl.updateOne(
                    { _id: update._id },
                    { $set: { subDataIds: update.subDataIds } }
                );
                console.log(`✓ Aggiornato: ${update.name} (${update.subDataIds.length} subDataIds)`);
            }
        }

        return updates.length;

    } catch (error) {
        console.error('Errore:', error);
        throw error;
    } finally {
        await client.close();
    }
}

// Esegui
if (require.main === module) {
    const dryRun = process.argv[2] !== '--execute';
    fixSubDataIds(dryRun).then(count => {
        console.log(`\n✓ ${dryRun ? 'Dry run' : 'Aggiornamento'} completato: ${count} template`);
        process.exit(0);
    }).catch(err => {
        console.error('Errore:', err);
        process.exit(1);
    });
}

module.exports = { fixSubDataIds };

