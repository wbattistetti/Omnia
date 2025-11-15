const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';

// Definizione Address completa
const addressDefinition = {
    mainData: [{
        label: 'Indirizzo',
        type: 'address',
        icon: 'MapPin',
        subData: [
            { label: 'Tipo di via', type: 'text', icon: 'MapPin', constraints: [{ type: 'required' }] },
            { label: 'Nome della via', type: 'text', icon: 'MapPin', constraints: [{ type: 'required' }] },
            { label: 'Numero civico', type: 'text', icon: 'Hash', constraints: [{ type: 'required' }] },
            { label: 'Codice postale', type: 'postalCode', icon: 'Hash', constraints: [{ type: 'required' }] },
            { label: 'Città', type: 'text', icon: 'Building', constraints: [{ type: 'required' }] },
            { label: 'Regione', type: 'text', icon: 'Map', constraints: [] },
            { label: 'Stato/Provincia', type: 'text', icon: 'Map', constraints: [] },
            { label: 'Paese', type: 'text', icon: 'Globe', constraints: [{ type: 'required' }] }
        ]
    }]
};

// Mapping Address subData -> template atomici
const addressSubDataMapping = {
    'Tipo di via': 'Street',
    'Nome della via': 'Street Name',
    'Numero civico': 'Civic number',
    'Codice postale': 'Postal code',
    'Città': 'City',
    'Regione': 'Region',
    'Stato/Provincia': 'Region', // Usa Region anche per Stato/Provincia
    'Paese': 'Country'
};

async function fixAddress(dryRun = true) {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('factory');
        const taskTemplatesColl = db.collection('Task_Templates');

        // Trova il template Address
        const address = await taskTemplatesColl.findOne({
            $or: [
                { name: 'address' },
                { label: 'Address' },
                { name: 'Address' },
                { label: 'address' }
            ]
        });

        if (!address) {
            console.log('❌ Template Address non trovato!');
            return;
        }

        console.log(`\n=== TEMPLATE ADDRESS TROVATO ===`);
        console.log(`Name: ${address.name || address.label}`);
        console.log(`Type: ${address.type || address.dataType}`);
        console.log(`MainData: ${address.mainData ? 'PRESENTE' : 'ASSENTE'}`);
        console.log(`SubDataIds: ${address.subDataIds ? `${address.subDataIds.length} IDs` : 'ASSENTE'}`);

        // Trova tutti i template atomici
        const allTemplates = await taskTemplatesColl.find({}).toArray();
        const atomicMap = new Map();
        allTemplates.forEach(t => {
            const hasMainData = t.mainData && Array.isArray(t.mainData) && t.mainData.length > 0;
            const isSubData = t.metadata?.isSubData;
            if (isSubData || !hasMainData) {
                const name = (t.name || t.label || '').toLowerCase().trim();
                atomicMap.set(name, t);
                if (t.name) atomicMap.set(t.name.toLowerCase(), t);
                if (t.label) atomicMap.set(t.label.toLowerCase(), t);
            }
        });

        // Trova i template atomici per i subData di Address
        const subDataIds = [];
        const missing = [];

        for (const subData of addressDefinition.mainData[0].subData) {
            const subDataLabel = subData.label;
            const atomicName = addressSubDataMapping[subDataLabel];

            if (atomicName) {
                const atomicTemplate = atomicMap.get(atomicName.toLowerCase());
                if (atomicTemplate) {
                    subDataIds.push(atomicTemplate._id.toString());
                    console.log(`✓ ${subDataLabel} -> trovato "${atomicTemplate.name || atomicTemplate.label}" (${atomicTemplate._id})`);
                } else {
                    missing.push(subDataLabel);
                    console.log(`❌ ${subDataLabel} -> template atomico "${atomicName}" NON TROVATO`);
                }
            } else {
                missing.push(subDataLabel);
                console.log(`❌ ${subDataLabel} -> mapping non definito`);
            }
        }

        if (dryRun) {
            console.log(`\n\n=== DRY RUN ===`);
            console.log(`MainData da aggiungere: ${address.mainData ? 'NO (già presente)' : 'SI'}`);
            console.log(`SubDataIds da aggiungere: ${subDataIds.length}`);
            console.log(`IDs: ${subDataIds.join(', ')}`);
            if (missing.length > 0) {
                console.log(`⚠️  SubData senza template atomico: ${missing.join(', ')}`);
            }
        } else {
            console.log(`\n\n=== AGGIORNAMENTO ===`);
            const update = {};

            if (!address.mainData) {
                update.mainData = addressDefinition.mainData;
                console.log(`✓ Aggiunto mainData`);
            }

            if (subDataIds.length > 0) {
                update.subDataIds = subDataIds;
                console.log(`✓ Aggiunto ${subDataIds.length} subDataIds`);
            }

            if (Object.keys(update).length > 0) {
                await taskTemplatesColl.updateOne(
                    { _id: address._id },
                    { $set: update }
                );
                console.log(`✓ Template Address aggiornato`);
            } else {
                console.log(`ℹ️  Nessun aggiornamento necessario`);
            }
        }

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
    fixAddress(dryRun).then(() => {
        console.log(`\n✓ ${dryRun ? 'Dry run' : 'Aggiornamento'} completato`);
        process.exit(0);
    }).catch(err => {
        console.error('Errore:', err);
        process.exit(1);
    });
}

module.exports = { fixAddress };

