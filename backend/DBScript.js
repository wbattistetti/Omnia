// backend/analyze_and_complete_templates.js
const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';

// Definizioni complete dei template con subData
const templateDefinitions = {
    'date': {
        mainData: [{
            label: 'Data',
            type: 'date',
            icon: 'Calendar',
            subData: [
                { label: 'Giorno', type: 'number', icon: 'Hash', constraints: [{ type: 'required' }, { type: 'min', value: 1 }, { type: 'max', value: 31 }] },
                { label: 'Mese', type: 'number', icon: 'Calendar', constraints: [{ type: 'required' }, { type: 'min', value: 1 }, { type: 'max', value: 12 }] },
                { label: 'Anno', type: 'number', icon: 'Hash', constraints: [{ type: 'required' }, { type: 'min', value: 1900 }, { type: 'max', value: 2100 }] }
            ]
        }]
    },
    'address': {
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
    },
    'name': {
        mainData: [{
            label: 'Nome',
            type: 'name',
            icon: 'User',
            subData: [
                { label: 'Nome', type: 'text', icon: 'User', constraints: [{ type: 'required' }] },
                { label: 'Cognome', type: 'text', icon: 'User', constraints: [{ type: 'required' }] }
            ]
        }]
    },
    'phone': {
        mainData: [{
            label: 'Telefono',
            type: 'phone',
            icon: 'Phone',
            subData: [
                { label: 'Prefisso', type: 'number', icon: 'Globe', constraints: [{ type: 'required' }] },
                { label: 'Numero', type: 'number', icon: 'Phone', constraints: [{ type: 'required' }] }
            ]
        }]
    }
};

// Nomi da escludere (sub-componenti, non template principali)
const excludedNames = [
    'street information',
    'location details',
    'street',
    'city',
    'postal code',
    'country',
    'region',
    'day',
    'month',
    'year',
    'first name',
    'last name',
    'country code',
    'number'
];

// Mapping di nomi alternativi ai nomi principali
const nameAliases = {
    'phone number': 'phone',
    'full name': 'name',
    'date of birth': 'date',
    'birth date': 'date',
    'address': 'address',
    'indirizzo': 'address',
    'nome': 'name',
    'telefono': 'phone',
    'data': 'date'
};

async function analyzeAndCompleteTemplates() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('factory');
        const taskTemplatesColl = db.collection('Task_Templates');

        // Trova tutti i template che hanno type='REQUEST_DATA' o che sono template di dati
        const allTemplates = await taskTemplatesColl.find({
            $or: [
                { type: 'REQUEST_DATA' },
                { dataType: { $exists: true } },
                { 'valueSchema.editor': 'ddt' }
            ]
        }).toArray();

        console.log(`\n=== ANALISI TEMPLATE ===`);
        console.log(`Trovati ${allTemplates.length} template da analizzare\n`);

        const issues = [];
        const toUpdate = [];

        for (const template of allTemplates) {
            const name = template.name || template.label || template._id;
            const type = template.dataType || template.type || '';
            const hasMainData = template.mainData && Array.isArray(template.mainData) && template.mainData.length > 0;
            const hasSubData = hasMainData && template.mainData.some(m => m.subData && Array.isArray(m.subData) && m.subData.length > 0);

            // Normalizza il nome per il matching
            const normalizedName = (name || '').toLowerCase().trim();

            // Escludi sub-componenti
            if (excludedNames.some(excluded => normalizedName.includes(excluded))) {
                continue; // Salta questo template, è un sub-componente
            }

            // Applica alias se necessario
            const mappedName = nameAliases[normalizedName] || normalizedName;

            // Verifica se questo template dovrebbe avere subData
            // Prima prova con il nome mappato, poi con il type
            const expectedDef = templateDefinitions[mappedName] ||
                templateDefinitions[normalizedName] ||
                templateDefinitions[type?.toLowerCase()];

            if (expectedDef && !hasSubData) {
                issues.push({
                    _id: template._id,
                    name: name,
                    type: type,
                    issue: 'Manca mainData con subData',
                    expected: expectedDef.mainData.length + ' mainData con ' +
                        expectedDef.mainData[0].subData.length + ' subData'
                });
                toUpdate.push({ template, definition: expectedDef });
            } else if (!hasMainData && (type || name)) {
                // Template senza mainData ma che potrebbe averne bisogno
                const normalizedType = (type || name || '').toLowerCase();
                const mappedType = nameAliases[normalizedType] || normalizedType;
                if (templateDefinitions[mappedType] && !excludedNames.some(excluded => normalizedType.includes(excluded))) {
                    issues.push({
                        _id: template._id,
                        name: name,
                        type: type,
                        issue: 'Manca completamente mainData',
                        expected: 'Dovrebbe avere mainData con subData'
                    });
                    toUpdate.push({ template, definition: templateDefinitions[mappedType] });
                }
            }
        }

        // Report
        console.log('=== TEMPLATE CON PROBLEMI ===');
        issues.forEach(issue => {
            console.log(`\n- ${issue.name} (${issue.type || 'N/A'})`);
            console.log(`  Problema: ${issue.issue}`);
            console.log(`  Atteso: ${issue.expected}`);
        });

        console.log(`\n\n=== RIEPILOGO ===`);
        console.log(`Template analizzati: ${allTemplates.length}`);
        console.log(`Template con problemi: ${issues.length}`);
        console.log(`Template da aggiornare: ${toUpdate.length}`);

        if (toUpdate.length > 0) {
            console.log(`\n\nVuoi procedere con l'aggiornamento? (s/n)`);
            // In un ambiente reale, qui chiederesti conferma
            // Per ora mostriamo cosa verrebbe aggiornato

            console.log(`\n=== TEMPLATE DA AGGIORNARE ===`);
            for (const { template, definition } of toUpdate) {
                console.log(`\n${template.name || template.label}:`);
                console.log(`  Aggiungeremo mainData con ${definition.mainData[0].subData.length} subData`);
            }
        }

        return { analyzed: allTemplates.length, issues: issues.length, toUpdate: toUpdate.length };

    } catch (error) {
        console.error('Errore:', error);
        throw error;
    } finally {
        await client.close();
    }
}

// Funzione per completare i template
async function completeTemplates(dryRun = true) {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('factory');
        const taskTemplatesColl = db.collection('Task_Templates');

        const allTemplates = await taskTemplatesColl.find({
            $or: [
                { type: 'REQUEST_DATA' },
                { dataType: { $exists: true } },
                { 'valueSchema.editor': 'ddt' }
            ]
        }).toArray();

        const updates = [];

        for (const template of allTemplates) {
            const name = template.name || template.label || '';
            const type = template.dataType || template.type || '';

            // Normalizza il nome per il matching
            const normalizedName = (name || '').toLowerCase().trim();

            // Escludi sub-componenti
            if (excludedNames.some(excluded => normalizedName.includes(excluded))) {
                continue; // Salta questo template, è un sub-componente
            }

            // Applica alias se necessario
            const mappedName = nameAliases[normalizedName] || normalizedName;

            // Verifica se questo template dovrebbe avere subData
            // Prima prova con il nome mappato, poi con il type
            const definition = templateDefinitions[mappedName] ||
                templateDefinitions[normalizedName] ||
                templateDefinitions[(type || '').toLowerCase()];

            if (definition) {
                const hasMainData = template.mainData && Array.isArray(template.mainData) && template.mainData.length > 0;
                const hasSubData = hasMainData && template.mainData.some(m => m.subData && Array.isArray(m.subData) && m.subData.length > 0);

                if (!hasSubData) {
                    updates.push({
                        _id: template._id,
                        name: name,
                        update: { $set: { mainData: definition.mainData } }
                    });
                }
            }
        }

        if (dryRun) {
            console.log(`\n=== DRY RUN: ${updates.length} template verrebbero aggiornati ===`);
            updates.forEach(u => {
                console.log(`- ${u.name} (${u._id})`);
            });
        } else {
            console.log(`\n=== Aggiornamento di ${updates.length} template ===`);
            for (const update of updates) {
                await taskTemplatesColl.updateOne(
                    { _id: update._id },
                    update.update
                );
                console.log(`✓ Aggiornato: ${update.name}`);
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
    const command = process.argv[2] || 'analyze';

    if (command === 'analyze') {
        analyzeAndCompleteTemplates().then(result => {
            console.log('\n✓ Analisi completata');
            process.exit(0);
        }).catch(err => {
            console.error('Errore:', err);
            process.exit(1);
        });
    } else if (command === 'complete') {
        const dryRun = process.argv[3] !== '--execute';
        completeTemplates(dryRun).then(count => {
            console.log(`\n✓ ${dryRun ? 'Dry run' : 'Aggiornamento'} completato: ${count} template`);
            process.exit(0);
        }).catch(err => {
            console.error('Errore:', err);
            process.exit(1);
        });
    }
}

module.exports = { analyzeAndCompleteTemplates, completeTemplates };