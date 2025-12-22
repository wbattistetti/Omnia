/**
 * STEP 4: Migrate TaskTemplates to use enum and GUID
 *
 * Migrazione che:
 * 1. Converte id semantico → GUID (mantiene name con il vecchio id)
 * 2. Converte type stringa → enum numerato
 * 3. Rimuove valueSchema.editor (derivabile da type)
 * 4. Aggiorna tutti i Tasks che referenziano i vecchi templateId
 */

const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

// Mapping: type string → enum numerato (allineato con VB.NET TaskTypes)
// ✅ CASE-INSENSITIVE: tutte le chiavi sono lowercase per matching case-insensitive
const TYPE_STRING_TO_ENUM = {
    // Tipi principali (normalizzati a lowercase)
    'message': 0,              // TaskTypes.SayMessage
    'saymessage': 0,
    'closesession': 1,         // TaskTypes.CloseSession
    'transfer': 2,             // TaskTypes.Transfer
    'datarequest': 3,          // TaskTypes.GetData
    'getdata': 3,
    'backendcall': 4,          // TaskTypes.BackendCall
    'callbackend': 4,
    'problemclassification': 5, // TaskTypes.ClassifyProblem
    'classifyproblem': 5,
    // Varianti comuni
    'data': 3,                  // Abbreviazione comune
    'request': 3,               // Abbreviazione comune
    'backend': 4,              // Abbreviazione comune
    'problem': 5,              // Abbreviazione comune
    'classify': 5,             // Abbreviazione comune
    // Tipi generici mappati
    'action': 0,               // Generic action → SayMessage
    'say': 0,                  // Abbreviazione
    'close': 1,                // Abbreviazione
    'end': 1                   // Abbreviazione
};

// ✅ IMPORTANTE: Usa gli stessi GUID fissi di step3_seed_builtins.js
//    Questo garantisce che i built-in abbiano sempre lo stesso ID
const BUILTIN_IDS = {
    SayMessage: '00000000-0000-0000-0000-000000000001',
    GetData: '00000000-0000-0000-0000-000000000002',
    ClassifyProblem: '00000000-0000-0000-0000-000000000003',
    callBackend: '00000000-0000-0000-0000-000000000004',
    CloseSession: '00000000-0000-0000-0000-000000000005',
    Transfer: '00000000-0000-0000-0000-000000000006'
};

// Mapping: vecchi id semantici → nuovi GUID (per built-in)
// ✅ CASE-INSENSITIVE: tutte le chiavi sono lowercase per matching case-insensitive
// ✅ Usa GUID fissi invece di UUID casuali per garantire consistenza
const BUILTIN_ID_MAPPING = {
    'saymessage': BUILTIN_IDS.SayMessage,
    'getdata': BUILTIN_IDS.GetData,
    'datarequest': BUILTIN_IDS.GetData,  // Alias comune
    'classifyproblem': BUILTIN_IDS.ClassifyProblem,
    'problemclassification': BUILTIN_IDS.ClassifyProblem,  // Alias comune
    'callbackend': BUILTIN_IDS.callBackend,
    'backendcall': BUILTIN_IDS.callBackend,  // Alias comune
    'closesession': BUILTIN_IDS.CloseSession,
    'transfer': BUILTIN_IDS.Transfer
};

// Helper per normalizzare chiavi case-insensitive
function normalizeKey(key) {
    return key ? key.toLowerCase().trim() : '';
}

console.log('\n📋 Built-in ID mapping:');
Object.entries(BUILTIN_ID_MAPPING).forEach(([oldId, newId]) => {
    console.log(`   ${oldId} → ${newId}`);
});

/**
 * Converte type stringa in enum numerato (CASE-INSENSITIVE)
 */
function convertTypeToEnum(typeString) {
    if (!typeString || typeof typeString !== 'string') {
        console.warn(`⚠️ Invalid type string: "${typeString}", defaulting to 0 (SayMessage)`);
        return 0;
    }
    // ✅ Normalizza a lowercase per case-insensitive matching
    const normalized = typeString.toLowerCase().trim();
    const enumValue = TYPE_STRING_TO_ENUM[normalized];
    if (enumValue === undefined) {
        // Prova anche varianti comuni
        const variants = [
            typeString, // originale
            typeString.toLowerCase(),
            typeString.toUpperCase(),
            typeString.charAt(0).toUpperCase() + typeString.slice(1).toLowerCase()
        ];
        for (const variant of variants) {
            if (TYPE_STRING_TO_ENUM[variant] !== undefined) {
                return TYPE_STRING_TO_ENUM[variant];
            }
        }
        console.warn(`⚠️ Unknown type string: "${typeString}", defaulting to 0 (SayMessage)`);
        return 0;
    }
    return enumValue;
}

/**
 * Migra un singolo template
 */
function migrateTemplate(template, idMapping) {
    const oldId = template.id;

    // 1. Determina nuovo id (CASE-INSENSITIVE)
    let newId;
    const normalizedOldId = normalizeKey(oldId);
    if (normalizedOldId && idMapping[normalizedOldId]) {
        // Built-in: usa GUID predefinito
        newId = idMapping[normalizedOldId];
    } else if (oldId && oldId.length > 20 && oldId.includes('-')) {
        // Già un GUID, mantienilo
        newId = oldId;
    } else {
        // Non è un GUID, generane uno nuovo
        newId = uuidv4();
    }

    // 2. Converti type stringa → enum
    const oldType = template.type;
    const newType = convertTypeToEnum(oldType);

    // 3. Rimuovi editor da valueSchema
    const newValueSchema = { ...template.valueSchema };
    delete newValueSchema.editor;

    // 4. Costruisci template migrato
    const migratedTemplate = {
        ...template,
        id: newId,
        name: oldId,  // Salva il vecchio id semantico come name
        type: newType,
        valueSchema: newValueSchema,
        _migrated: true,
        _migratedAt: new Date(),
        _oldId: oldId,
        _oldType: oldType
    };

    return {
        oldId,
        newId,
        oldType,
        newType,
        template: migratedTemplate
    };
}

/**
 * Aggiorna tutti i Tasks che referenziano un vecchio templateId
 */
async function updateTasksWithNewTemplateId(db, oldId, newId) {
    const result = await db.collection('Tasks').updateMany(
        { templateId: oldId },
        { $set: { templateId: newId, _migratedTemplateId: true } }
    );
    return result.modifiedCount;
}

/**
 * Migra TaskTemplates in un database (factory o project)
 */
async function migrateTaskTemplatesInDb(client, dbName, idMapping) {
    const db = client.db(dbName);
    const coll = db.collection('Task_Templates');

    console.log(`\n📦 Migrando database: ${dbName}`);

    // 1. Trova tutti i template
    const templates = await coll.find({}).toArray();
    console.log(`   Trovati ${templates.length} template`);

    if (templates.length === 0) {
        console.log('   ⏭️ Nessun template da migrare');
        return { migrated: 0, updated: 0, tasksUpdated: 0 };
    }

    let migratedCount = 0;
    let updatedCount = 0;
    let totalTasksUpdated = 0;

    for (const template of templates) {
        // Skip se già migrato
        if (template._migrated) {
            console.log(`   ⏭️ Skip: ${template.id} (già migrato)`);
            continue;
        }

        const { oldId, newId, oldType, newType, template: migratedTemplate } = migrateTemplate(template, idMapping);

        console.log(`   🔄 Migrando: ${oldId} → ${newId}`);
        console.log(`      Type: "${oldType}" → ${newType}`);

        // 2. Aggiorna il template
        await coll.updateOne(
            { _id: template._id },
            { $set: migratedTemplate }
        );

        // 3. Aggiorna tutti i Tasks che referenziano questo template
        const tasksUpdated = await updateTasksWithNewTemplateId(db, oldId, newId);
        if (tasksUpdated > 0) {
            console.log(`      ✅ Aggiornati ${tasksUpdated} tasks`);
            totalTasksUpdated += tasksUpdated;
        }

        if (template._id) {
            updatedCount++;
        } else {
            migratedCount++;
        }
    }

    console.log(`\n   📊 Riepilogo ${dbName}:`);
    console.log(`      Template migrati: ${migratedCount + updatedCount}`);
    console.log(`      Tasks aggiornati: ${totalTasksUpdated}`);

    return { migrated: migratedCount, updated: updatedCount, tasksUpdated: totalTasksUpdated };
}

/**
 * Trova tutti i database dei progetti
 */
async function findProjectDatabases(client) {
    const adminDb = client.db().admin();
    const { databases } = await adminDb.listDatabases();

    return databases
        .map(db => db.name)
        .filter(name => name.startsWith('project_'));
}

async function step4_migrateTaskTemplates() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('✅ Connesso a MongoDB');

        let totalMigrated = 0;
        let totalUpdated = 0;
        let totalTasksUpdated = 0;

        // 1. Migra factory database
        console.log('\n🏭 MIGRAZIONE FACTORY DATABASE');
        const factoryResult = await migrateTaskTemplatesInDb(client, dbFactory, BUILTIN_ID_MAPPING);
        totalMigrated += factoryResult.migrated;
        totalUpdated += factoryResult.updated;
        totalTasksUpdated += factoryResult.tasksUpdated;

        // 2. Trova e migra tutti i database dei progetti
        console.log('\n📁 RICERCA DATABASE PROGETTI');
        const projectDbs = await findProjectDatabases(client);
        console.log(`   Trovati ${projectDbs.length} database progetti`);

        for (const projectDb of projectDbs) {
            const projectResult = await migrateTaskTemplatesInDb(client, projectDb, BUILTIN_ID_MAPPING);
            totalMigrated += projectResult.migrated;
            totalUpdated += projectResult.updated;
            totalTasksUpdated += projectResult.tasksUpdated;
        }

        // 3. Riepilogo finale
        console.log('\n' + '='.repeat(60));
        console.log('📊 RIEPILOGO FINALE MIGRAZIONE');
        console.log('='.repeat(60));
        console.log(`   Template migrati: ${totalMigrated + totalUpdated}`);
        console.log(`   Tasks aggiornati: ${totalTasksUpdated}`);
        console.log(`   Database processati: ${1 + projectDbs.length}`);
        console.log('='.repeat(60));
        console.log('\n🎉 MIGRAZIONE COMPLETATA CON SUCCESSO');

    } catch (error) {
        console.error('\n❌ Errore durante la migrazione:', error);
        throw error;
    } finally {
        await client.close();
        console.log('\n✅ Connessione chiusa');
    }
}

// Esegui se chiamato direttamente
if (require.main === module) {
    step4_migrateTaskTemplates()
        .then(() => {
            console.log('\n✅ Script completato');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Script fallito:', error);
            process.exit(1);
        });
}

module.exports = { step4_migrateTaskTemplates, BUILTIN_ID_MAPPING };

