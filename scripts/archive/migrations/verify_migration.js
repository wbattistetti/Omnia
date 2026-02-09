/**
 * Verify Migration - Controllo completo
 *
 * Verifica che la migrazione sia andata a buon fine
 * Confronta AgentActs con task_templates e ddt_library
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbName = 'factory';

async function verifyMigration() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('✅ Connesso a MongoDB\n');

        const db = client.db(dbName);

        // === VERIFICA 1: Collezioni esistono ===
        console.log('📋 VERIFICA 1: Collezioni');
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);

        const requiredCollections = ['AgentActs', 'task_templates', 'ddt_library'];
        let allCollectionsExist = true;

        requiredCollections.forEach(name => {
            const exists = collectionNames.includes(name);
            console.log(`   ${exists ? '✅' : '❌'} ${name}`);
            if (!exists) allCollectionsExist = false;
        });

        if (!allCollectionsExist) {
            console.log('\n❌ Alcune collezioni mancanti. Esegui STEP 1.');
            return false;
        }

        // === VERIFICA 2: AgentActs preservati ===
        console.log('\n📋 VERIFICA 2: AgentActs originali preservati');
        const agentActsCount = await db.collection('AgentActs').countDocuments();
        console.log(`   AgentActs count: ${agentActsCount}`);

        if (agentActsCount === 0) {
            console.log('   ⚠️ Nessun AgentAct trovato (DB vuoto o già migrato?)');
        } else {
            console.log('   ✅ AgentActs presenti');
        }

        // === VERIFICA 3: TaskTemplates copiati ===
        console.log('\n📋 VERIFICA 3: TaskTemplates');
        const totalTemplates = await db.collection('task_templates').countDocuments();
        const migratedTemplates = await db.collection('task_templates').countDocuments({
            _migrationSource: "AgentActs"
        });
        const builtInTemplates = await db.collection('task_templates').countDocuments({
            isBuiltIn: true
        });

        console.log(`   Totali: ${totalTemplates}`);
        console.log(`   Migrati da AgentActs: ${migratedTemplates}`);
        console.log(`   Built-in: ${builtInTemplates}`);

        if (builtInTemplates !== 4) {
            console.log('   ⚠️ Previsti 4 built-in, esegui STEP 3');
        } else {
            console.log('   ✅ Built-in corretti');
        }

        if (agentActsCount > 0 && migratedTemplates === 0) {
            console.log('   ❌ Nessun template migrato. Esegui STEP 2.');
            return false;
        }

        // === VERIFICA 4: DDT Library ===
        console.log('\n📋 VERIFICA 4: DDT Library');
        const totalDDTs = await db.collection('ddt_library').countDocuments();
        const migratedDDTs = await db.collection('ddt_library').countDocuments({
            _migrationSource: "AgentActs"
        });

        console.log(`   Totali: ${totalDDTs}`);
        console.log(`   Migrati da AgentActs: ${migratedDDTs}`);

        // Conta AgentActs con DDT
        const agentActsWithDDT = await db.collection('AgentActs').countDocuments({
            $or: [
                { ddtSnapshot: { $exists: true, $ne: null } },
                { ddt: { $exists: true, $ne: null } }
            ]
        });

        console.log(`   AgentActs con DDT: ${agentActsWithDDT}`);

        if (agentActsWithDDT > 0 && migratedDDTs === 0) {
            console.log('   ⚠️ AgentActs hanno DDT ma nessuno migrato. Verifica STEP 2.');
        } else if (agentActsWithDDT === migratedDDTs) {
            console.log('   ✅ Tutti i DDT migrati');
        } else {
            console.log(`   ⚠️ Discrepanza: ${agentActsWithDDT} AgentActs con DDT, ${migratedDDTs} DDT migrati`);
        }

        // === VERIFICA 5: Mapping corretto ===
        console.log('\n📋 VERIFICA 5: Mapping templateId');
        const templates = await db.collection('task_templates')
            .find({ _migrationSource: "AgentActs" })
            .limit(5)
            .toArray();

        const mappingErrors = [];

        for (const tmpl of templates) {
            const validTemplateIds = ['GetData', 'SayMessage', 'ClassifyProblem', 'callBackend'];
            if (!validTemplateIds.includes(tmpl.templateId)) {
                mappingErrors.push({
                    id: tmpl.id,
                    templateId: tmpl.templateId,
                    originalMode: tmpl._originalMode
                });
            }
        }

        if (mappingErrors.length > 0) {
            console.log('   ❌ Alcuni mapping errati:');
            mappingErrors.forEach(e => {
                console.log(`      - ${e.id}: ${e.originalMode} → ${e.templateId}`);
            });
        } else {
            console.log('   ✅ Mapping corretto (campione di 5)');
        }

        // === VERIFICA 6: Integrità DDT references ===
        console.log('\n📋 VERIFICA 6: Integrità riferimenti DDT');
        const templatesWithDDT = await db.collection('task_templates')
            .find({
                "defaultValue.ddtId": { $exists: true }
            })
            .toArray();

        let brokenReferences = 0;

        for (const tmpl of templatesWithDDT) {
            const ddtId = tmpl.defaultValue.ddtId;
            const ddtExists = await db.collection('ddt_library').findOne({ id: ddtId });
            if (!ddtExists) {
                brokenReferences++;
                console.log(`   ⚠️ Riferimento rotto: ${tmpl.id} → ${ddtId}`);
            }
        }

        if (brokenReferences === 0) {
            console.log(`   ✅ Tutti i riferimenti DDT validi (${templatesWithDDT.length} controllati)`);
        } else {
            console.log(`   ❌ ${brokenReferences} riferimenti DDT rotti`);
        }

        // === RIEPILOGO FINALE ===
        console.log('\n' + '='.repeat(60));
        console.log('📊 RIEPILOGO FINALE');
        console.log('='.repeat(60));
        console.log(`AgentActs originali:      ${agentActsCount}`);
        console.log(`TaskTemplates totali:     ${totalTemplates}`);
        console.log(`  ├─ Built-in:            ${builtInTemplates}`);
        console.log(`  └─ Migrati:             ${migratedTemplates}`);
        console.log(`DDT Library totali:       ${totalDDTs}`);
        console.log(`  └─ Migrati:             ${migratedDDTs}`);
        console.log(`Riferimenti DDT rotti:    ${brokenReferences}`);
        console.log('='.repeat(60));

        // Verifica finale
        const allGood =
            allCollectionsExist &&
            builtInTemplates === 4 &&
            mappingErrors.length === 0 &&
            brokenReferences === 0;

        if (allGood) {
            console.log('\n🎉 MIGRAZIONE VERIFICATA CON SUCCESSO');
            console.log('✅ Tutto OK, puoi procedere con STEP 4-8');
        } else {
            console.log('\n⚠️ MIGRAZIONE PARZIALE O CON ERRORI');
            console.log('📝 Rivedi i log sopra e correggi i problemi');
        }

        return allGood;

    } catch (error) {
        console.error('❌ Errore durante verifica:', error);
        return false;
    } finally {
        await client.close();
        console.log('\n✅ Connessione chiusa');
    }
}

// Esegui se chiamato direttamente
if (require.main === module) {
    verifyMigration()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('\n❌ Script fallito:', error);
            process.exit(1);
        });
}

module.exports = { verifyMigration };

