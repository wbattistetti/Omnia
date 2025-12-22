/**
 * STEP 2: Copy Data (NO migration)
 *
 * Copia AgentActs in task_templates e ddt_library
 * NON cancella AgentActs originali
 *
 * Preserva tutti i DDT senza perdite
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbName = 'factory';

/**
 * Mappa mode a built-in templateId
 */
function mapModeToBuiltIn(mode) {
    const mapping = {
        'DataRequest': 'GetData',
        'Message': 'SayMessage',
        'ProblemClassification': 'ClassifyProblem',
        'BackendCall': 'callBackend'
    };
    return mapping[mode] || 'SayMessage';
}

/**
 * Determina type da mode
 */
function mapModeToType(mode) {
    const mapping = {
        'DataRequest': 'DataRequest',
        'Message': 'Message',
        'ProblemClassification': 'ProblemClassification',
        'BackendCall': 'BackendCall'
    };
    return mapping[mode] || 'Message';
}

async function step2_copyData() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('✅ Connesso a MongoDB');

        const db = client.db(dbName);

        // Conta documenti prima
        const agentActsCountBefore = await db.collection('AgentActs').countDocuments();
        console.log(`\n📋 AgentActs da copiare: ${agentActsCountBefore}`);

        if (agentActsCountBefore === 0) {
            console.log('⚠️ Nessun AgentAct trovato, niente da copiare');
            return;
        }

        // Carica tutti gli AgentActs
        const agentActs = await db.collection('AgentActs').find({}).toArray();

        let ddtCount = 0;
        let templateCount = 0;
        const errors = [];

        console.log('\n🔄 Inizio copia...\n');

        for (const act of agentActs) {
            try {
                const actId = act._id || act.id;

                // 1. Se ha DDT, copia in ddt_library
                if (act.ddtSnapshot || act.ddt) {
                    const ddtId = `ddt_${actId}`;
                    const ddtData = act.ddtSnapshot || act.ddt;

                    await db.collection('ddt_library').updateOne(
                        { id: ddtId },
                        {
                            $set: {
                                id: ddtId,
                                label: `DDT: ${act.label || act.name || actId}`,
                                scope: "general",
                                ddt: ddtData,
                                // Metadata per tracciamento
                                _originalActId: actId,
                                _migrationDate: new Date(),
                                _migrationSource: 'AgentActs'
                            }
                        },
                        { upsert: true }
                    );

                    ddtCount++;
                    console.log(`  ✅ DDT copiato: ${ddtId}`);
                }

                // 2. Copia AgentAct come TaskTemplate
                const mode = act.mode || 'Message';
                const templateId = mapModeToBuiltIn(mode);
                const type = mapModeToType(mode);

                const taskTemplate = {
                    id: actId,
                    label: act.label || act.name || actId,
                    description: act.description || '',
                    scope: "general",
                    type: type,
                    templateId: templateId,
                    category: act.category || null,
                    isBuiltIn: false,

                    // Default value
                    defaultValue: (act.ddtSnapshot || act.ddt)
                        ? { ddtId: `ddt_${actId}` }
                        : {},

                    // Metadata per tracciamento
                    _originalActId: actId,
                    _migrationDate: new Date(),
                    _migrationSource: 'AgentActs',
                    _originalMode: mode
                };

                await db.collection('task_templates').updateOne(
                    { id: actId },
                    { $set: taskTemplate },
                    { upsert: true }
                );

                templateCount++;
                console.log(`  ✅ Template copiato: ${actId} (${mode} → ${templateId})`);

            } catch (error) {
                console.error(`  ❌ Errore copiando ${act._id || act.id}:`, error.message);
                errors.push({ actId: act._id || act.id, error: error.message });
            }
        }

        // Verifica conteggi
        const agentActsCountAfter = await db.collection('AgentActs').countDocuments();
        const taskTemplatesCount = await db.collection('task_templates').countDocuments();
        const ddtLibraryCount = await db.collection('ddt_library').countDocuments();

        console.log('\n📊 Riepilogo:');
        console.log(`   AgentActs originali: ${agentActsCountBefore} (prima)`);
        console.log(`   AgentActs originali: ${agentActsCountAfter} (dopo) ✅ INVARIATO`);
        console.log(`   TaskTemplates copiati: ${templateCount}`);
        console.log(`   TaskTemplates totali: ${taskTemplatesCount}`);
        console.log(`   DDT copiati: ${ddtCount}`);
        console.log(`   DDT totali: ${ddtLibraryCount}`);

        if (errors.length > 0) {
            console.log(`\n⚠️ Errori durante copia: ${errors.length}`);
            errors.forEach(e => console.log(`   - ${e.actId}: ${e.error}`));
        }

        if (agentActsCountBefore !== agentActsCountAfter) {
            throw new Error('❌ ATTENZIONE: AgentActs modificati! Rollback necessario');
        }

        console.log('\n🎉 STEP 2 completato con successo');
        console.log('⚠️ AgentActs originali PRESERVATI');

    } catch (error) {
        console.error('❌ Errore durante STEP 2:', error);
        throw error;
    } finally {
        await client.close();
        console.log('\n✅ Connessione chiusa');
    }
}

// Esegui se chiamato direttamente
if (require.main === module) {
    step2_copyData()
        .then(() => {
            console.log('\n✅ Script completato');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Script fallito:', error);
            process.exit(1);
        });
}

module.exports = { step2_copyData };

