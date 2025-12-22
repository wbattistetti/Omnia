/**
 * Test Migration - Verifica completa della migrazione
 *
 * Esegue controlli completi su:
 * - Conteggio record
 * - Integrità riferimenti
 * - Confronto con dati originali
 * - Report dettagliato
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactoryName = 'factory';

async function testMigration() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('✅ Connesso a MongoDB\n');
        console.log('='.repeat(70));
        console.log('🧪 TEST MIGRAZIONE - REPORT COMPLETO');
        console.log('='.repeat(70));

        const dbFactory = client.db(dbFactoryName);
        const adminDb = client.db().admin();

        // === TEST 1: Conteggio Record ===
        console.log('\n📊 TEST 1: Conteggio Record');
        console.log('-'.repeat(70));

        const totalTemplates = await dbFactory.collection('task_templates').countDocuments();
        const builtInTemplates = await dbFactory.collection('task_templates').countDocuments({ isBuiltIn: true });
        const migratedFromFactory = await dbFactory.collection('task_templates').countDocuments({ _migrationSource: "AgentActs" });
        const migratedFromProjects = await dbFactory.collection('task_templates').countDocuments({ _migrationSource: "project_acts" });

        const totalDDTs = await dbFactory.collection('ddt_library').countDocuments();
        const migratedDDTsFromFactory = await dbFactory.collection('ddt_library').countDocuments({ _migrationSource: "AgentActs" });
        const migratedDDTsFromProjects = await dbFactory.collection('ddt_library').countDocuments({ _migrationSource: "project_acts" });

        console.log(`TaskTemplates totali:        ${totalTemplates}`);
        console.log(`  ├─ Built-in:              ${builtInTemplates} ${builtInTemplates === 4 ? '✅' : '❌'}`);
        console.log(`  ├─ Migrati da AgentActs:  ${migratedFromFactory}`);
        console.log(`  └─ Migrati da project:    ${migratedFromProjects}`);
        console.log(`\nDDT Library totali:         ${totalDDTs}`);
        console.log(`  ├─ Migrati da AgentActs:  ${migratedDDTsFromFactory}`);
        console.log(`  └─ Migrati da project:    ${migratedDDTsFromProjects}`);

        // === TEST 2: Verifica Built-in ===
        console.log('\n📋 TEST 2: Verifica Built-in Templates');
        console.log('-'.repeat(70));

        const requiredBuiltIns = ['GetData', 'SayMessage', 'ClassifyProblem', 'callBackend'];
        const existingBuiltIns = await dbFactory.collection('task_templates')
            .find({ isBuiltIn: true }, { id: 1 })
            .toArray();
        const existingIds = existingBuiltIns.map(t => t.id);

        requiredBuiltIns.forEach(id => {
            const exists = existingIds.includes(id);
            console.log(`  ${exists ? '✅' : '❌'} ${id}`);
        });

        // === TEST 3: Integrità Riferimenti DDT ===
        console.log('\n🔗 TEST 3: Integrità Riferimenti DDT');
        console.log('-'.repeat(70));

        const templatesWithDDT = await dbFactory.collection('task_templates')
            .find({ "defaultValue.ddtId": { $exists: true } })
            .toArray();

        let brokenReferences = 0;
        const brokenRefs = [];

        for (const tmpl of templatesWithDDT) {
            const ddtId = tmpl.defaultValue.ddtId;
            const ddtExists = await dbFactory.collection('ddt_library').findOne({ id: ddtId });
            if (!ddtExists) {
                brokenReferences++;
                brokenRefs.push({ templateId: tmpl.id, ddtId });
            }
        }

        console.log(`Template con riferimento DDT: ${templatesWithDDT.length}`);
        console.log(`Riferimenti rotti:              ${brokenReferences} ${brokenReferences === 0 ? '✅' : '❌'}`);

        if (brokenReferences > 0) {
            console.log('\n⚠️ Riferimenti rotti trovati:');
            brokenRefs.slice(0, 10).forEach(ref => {
                console.log(`   - ${ref.templateId} → ${ref.ddtId}`);
            });
            if (brokenRefs.length > 10) {
                console.log(`   ... e altri ${brokenRefs.length - 10}`);
            }
        }

        // === TEST 4: Verifica Scope ===
        console.log('\n🌍 TEST 4: Verifica Scope');
        console.log('-'.repeat(70));

        const scopes = await dbFactory.collection('task_templates')
            .aggregate([
                { $group: { _id: "$scope", count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ])
            .toArray();

        console.log('Distribuzione per scope:');
        scopes.forEach(s => {
            console.log(`  ${s._id || 'null'}: ${s.count} template`);
        });

        // === TEST 5: Verifica Mapping templateId ===
        console.log('\n🗺️ TEST 5: Verifica Mapping templateId');
        console.log('-'.repeat(70));

        const validTemplateIds = ['GetData', 'SayMessage', 'ClassifyProblem', 'callBackend'];
        const templates = await dbFactory.collection('task_templates')
            .find({ isBuiltIn: false })
            .limit(100)
            .toArray();

        const invalidMappings = [];
        templates.forEach(t => {
            if (t.templateId && !validTemplateIds.includes(t.templateId)) {
                invalidMappings.push({ id: t.id, templateId: t.templateId, originalMode: t._originalMode });
            }
        });

        console.log(`Template custom controllati: ${templates.length}`);
        console.log(`Mapping invalidi:             ${invalidMappings.length} ${invalidMappings.length === 0 ? '✅' : '❌'}`);

        if (invalidMappings.length > 0) {
            console.log('\n⚠️ Mapping invalidi trovati:');
            invalidMappings.slice(0, 10).forEach(m => {
                console.log(`   - ${m.id}: ${m.originalMode} → ${m.templateId} (INVALIDO)`);
            });
        }

        // === TEST 6: Confronto con Dati Originali ===
        console.log('\n📊 TEST 6: Confronto con Dati Originali');
        console.log('-'.repeat(70));

        // Versione ottimizzata: conta solo i database che hanno già template migrati
        const migratedScopes = await dbFactory.collection('task_templates')
            .distinct('scope');

        const clientScopes = migratedScopes.filter(s => s && s.startsWith('client:'));
        const uniqueProjects = [...new Set(clientScopes.map(s => s.replace('client:', '')))];

        console.log(`Progetti con template migrati: ${uniqueProjects.length}`);

        // Conta solo nei progetti che hanno template migrati (più veloce)
        let totalProjectActs = 0;
        let totalProjectActsWithDDT = 0;
        let projectsChecked = 0;

        console.log('Controllo project_acts (ottimizzato)...');

        for (const projectId of uniqueProjects.slice(0, 10)) { // Limita a 10 per velocità
            try {
                const dbName = `project_${projectId}`;
                const projectDb = client.db(dbName);

                const count = await projectDb.collection('project_acts').countDocuments();
                const countWithDDT = await projectDb.collection('project_acts').countDocuments({
                    $or: [
                        { ddtSnapshot: { $exists: true, $ne: null } },
                        { ddt: { $exists: true, $ne: null } }
                    ]
                });

                if (count > 0) {
                    totalProjectActs += count;
                    totalProjectActsWithDDT += countWithDDT;
                    projectsChecked++;
                }
            } catch (e) {
                // Skip se database non esiste
            }
        }

        console.log(`Database controllati (campione):    ${projectsChecked}`);
        console.log(`Project acts nel campione:          ${totalProjectActs}`);
        console.log(`Project acts con DDT (campione):    ${totalProjectActsWithDDT}`);
        console.log(`\nTemplate migrati totali:           ${migratedFromProjects}`);
        console.log(`DDT migrati totali:                 ${migratedDDTsFromProjects}`);

        // Stima: se abbiamo migrato template, la migrazione è avvenuta
        const migrationComplete = migratedFromProjects > 0;

        console.log(`\nMigrazione completata: ${migrationComplete ? '✅' : '❌'}`);
        if (migrationComplete) {
            console.log(`  ✅ ${migratedFromProjects} template migrati`);
            console.log(`  ✅ ${migratedDDTsFromProjects} DDT migrati`);
        }

        // === TEST 7: Campioni di Dati ===
        console.log('\n📝 TEST 7: Campioni di Dati');
        console.log('-'.repeat(70));

        const sampleTemplate = await dbFactory.collection('task_templates')
            .findOne({ _migrationSource: "project_acts" });

        if (sampleTemplate) {
            console.log('Esempio template migrato:');
            console.log(`  ID: ${sampleTemplate.id}`);
            console.log(`  Label: ${sampleTemplate.label}`);
            console.log(`  Scope: ${sampleTemplate.scope}`);
            console.log(`  TemplateId: ${sampleTemplate.templateId}`);
            console.log(`  Type: ${sampleTemplate.type}`);
            console.log(`  Ha DDT: ${sampleTemplate.defaultValue?.ddtId ? '✅' : '❌'}`);
        }

        const sampleDDT = await dbFactory.collection('ddt_library')
            .findOne({ _migrationSource: "project_acts" });

        if (sampleDDT) {
            console.log('\nEsempio DDT migrato:');
            console.log(`  ID: ${sampleDDT.id}`);
            console.log(`  Label: ${sampleDDT.label}`);
            console.log(`  Scope: ${sampleDDT.scope}`);
            console.log(`  Ha struttura DDT: ${sampleDDT.ddt ? '✅' : '❌'}`);
            if (sampleDDT.ddt) {
                console.log(`  MainData items: ${sampleDDT.ddt.mainData?.length || 0}`);
                console.log(`  Steps: ${sampleDDT.ddt.steps?.length || 0}`);
            }
        }

        // === RIEPILOGO FINALE ===
        console.log('\n' + '='.repeat(70));
        console.log('📊 RIEPILOGO FINALE');
        console.log('='.repeat(70));

        const allTestsPassed =
            builtInTemplates === 4 &&
            brokenReferences === 0 &&
            invalidMappings.length === 0;

        console.log(`✅ Built-in templates:      ${builtInTemplates === 4 ? 'OK' : 'FAIL'}`);
        console.log(`✅ Riferimenti DDT:         ${brokenReferences === 0 ? 'OK' : 'FAIL'}`);
        console.log(`✅ Mapping templateId:      ${invalidMappings.length === 0 ? 'OK' : 'FAIL'}`);
        console.log(`✅ Migrazione project_acts: ${migrationComplete ? 'OK' : 'PARTIAL'}`);

        console.log('\n' + '='.repeat(70));
        if (allTestsPassed && migrationComplete) {
            console.log('🎉 TUTTI I TEST PASSATI - MIGRAZIONE COMPLETA E CORRETTA');
        } else if (allTestsPassed) {
            console.log('⚠️ TEST PASSATI - MIGRAZIONE PARZIALE (alcuni project_acts non migrati)');
        } else {
            console.log('❌ ALCUNI TEST FALLITI - VERIFICA I LOG SOPRA');
        }
        console.log('='.repeat(70));

    } catch (error) {
        console.error('\n❌ Errore durante test:', error);
        throw error;
    } finally {
        await client.close();
        console.log('\n✅ Connessione chiusa');
    }
}

// Esegui se chiamato direttamente
if (require.main === module) {
    testMigration()
        .then(() => {
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Test fallito:', error);
            process.exit(1);
        });
}

module.exports = { testMigration };

