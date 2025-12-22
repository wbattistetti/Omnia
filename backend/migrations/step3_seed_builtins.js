/**
 * STEP 3: Seed Built-in Templates
 *
 * Crea i 4 TaskTemplate built-in (executor base)
 * Questi corrispondono ai 4 CASE nel TaskExecutor.vb
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbName = 'factory';

// ✅ REFACTORED: Usa enum numerati e GUID invece di id semantici
const { v4: uuidv4 } = require('uuid');

// GUID fissi per i built-in (per consistenza tra run)
const BUILTIN_IDS = {
    SayMessage: '00000000-0000-0000-0000-000000000001',
    GetData: '00000000-0000-0000-0000-000000000002',
    ClassifyProblem: '00000000-0000-0000-0000-000000000003',
    callBackend: '00000000-0000-0000-0000-000000000004',
    CloseSession: '00000000-0000-0000-0000-000000000005',
    Transfer: '00000000-0000-0000-0000-000000000006'
};

// TaskType enum (allineato con VB.NET e TypeScript)
const TaskType = {
    SayMessage: 0,
    CloseSession: 1,
    Transfer: 2,
    GetData: 3,
    BackendCall: 4,
    ClassifyProblem: 5
};

/**
 * Definizione dei 6 TaskTemplate built-in
 * ✅ REFACTORED:
 * - id: GUID fisso (non semantico)
 * - name: nome semantico (per backward compatibility)
 * - type: enum numerato (non stringa)
 * - valueSchema: senza editor (derivabile da type)
 */
const BUILTIN_TEMPLATES = [
    {
        id: BUILTIN_IDS.GetData,
        name: "GetData",
        label: "Get Data",
        description: "Request data from user using DDT (Data Dialogue Template)",
        scope: "general",
        type: TaskType.GetData,
        isBuiltIn: true,
        contexts: ["NodeRow", "DDTResponse"],
        valueSchema: {
            keys: {
                ddtId: {
                    type: 'string',
                    required: true,
                    description: 'Reference to DDT in ddt_library',
                    ideMapping: {
                        control: 'ddt-editor',
                        label: 'DDT Structure',
                        placeholder: 'Select or create DDT...'
                    }
                }
            }
        },
        icon: 'Ear',
        color: '#3b82f6',
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        id: BUILTIN_IDS.SayMessage,
        name: "SayMessage",
        label: "Say Message",
        description: "Send a text message to the user",
        scope: "general",
        type: TaskType.SayMessage,
        isBuiltIn: true,
        contexts: ["NodeRow", "DDTResponse"],
        valueSchema: {
            keys: {
                text: {
                    type: 'string',
                    required: true,
                    description: 'Message text to send',
                    ideMapping: {
                        control: 'textarea',
                        label: 'Message Text',
                        placeholder: 'Enter your message...'
                    }
                }
            }
        },
        icon: 'Megaphone',
        color: '#22c55e',
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        id: BUILTIN_IDS.ClassifyProblem,
        name: "ClassifyProblem",
        label: "Classify Problem",
        description: "Classify user intent/problem into predefined categories",
        scope: "general",
        type: TaskType.ClassifyProblem,
        isBuiltIn: true,
        contexts: ["NodeRow"],
        valueSchema: {
            keys: {
                intents: {
                    type: 'array',
                    required: true,
                    description: 'List of possible intents',
                    ideMapping: {
                        control: 'problem-editor',
                        label: 'Intent Classification',
                        placeholder: 'Define intents...'
                    }
                }
            }
        },
        icon: 'GitBranch',
        color: '#f59e0b',
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        id: BUILTIN_IDS.callBackend,
        name: "callBackend",
        label: "Call Backend",
        description: "Execute a backend API call",
        scope: "general",
        type: TaskType.BackendCall,
        isBuiltIn: true,
        contexts: ["NodeRow", "DDTResponse"],
        valueSchema: {
            keys: {
                endpoint: {
                    type: 'string',
                    required: true,
                    description: 'API endpoint URL',
                    ideMapping: {
                        control: 'text',
                        label: 'Endpoint URL',
                        placeholder: '/api/...'
                    }
                },
                method: {
                    type: 'string',
                    required: false,
                    description: 'HTTP method (GET, POST, etc.)',
                    ideMapping: {
                        control: 'text',
                        label: 'HTTP Method',
                        placeholder: 'POST'
                    }
                }
            }
        },
        icon: 'Server',
        color: '#94a3b8',
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        id: BUILTIN_IDS.CloseSession,
        name: "CloseSession",
        label: "Close Session",
        description: "Close the current conversation session",
        scope: "general",
        type: TaskType.CloseSession,
        isBuiltIn: true,
        contexts: ["NodeRow", "DDTResponse"],
        valueSchema: {
            keys: {}
        },
        icon: 'XCircle',
        color: '#ef4444',
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        id: BUILTIN_IDS.Transfer,
        name: "Transfer",
        label: "Transfer",
        description: "Transfer conversation to another agent or system",
        scope: "general",
        type: TaskType.Transfer,
        isBuiltIn: true,
        contexts: ["NodeRow", "DDTResponse"],
        valueSchema: {
            keys: {
                target: {
                    type: 'string',
                    required: true,
                    description: 'Transfer target',
                    ideMapping: {
                        control: 'text',
                        label: 'Transfer Target',
                        placeholder: 'agent_name or system_id'
                    }
                }
            }
        },
        icon: 'ArrowRight',
        color: '#8b5cf6',
        createdAt: new Date(),
        updatedAt: new Date()
    }
];

async function step3_seedBuiltIns() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('✅ Connesso a MongoDB');

        const db = client.db(dbName);

        console.log('\n🌱 Seeding built-in templates...\n');

        let seededCount = 0;
        let updatedCount = 0;

        for (const template of BUILTIN_TEMPLATES) {
            const existing = await db.collection('task_templates').findOne({ id: template.id });

            if (existing) {
                // Aggiorna se esiste (preserva _id)
                await db.collection('task_templates').updateOne(
                    { id: template.id },
                    { $set: { ...template, updatedAt: new Date() } }
                );
                updatedCount++;
                console.log(`  ♻️ Aggiornato: ${template.id} - ${template.label}`);
            } else {
                // Inserisci se non esiste
                await db.collection('task_templates').insertOne(template);
                seededCount++;
                console.log(`  ✅ Creato: ${template.id} - ${template.label}`);
            }
        }

        // Verifica
        const builtInCount = await db.collection('task_templates')
            .countDocuments({ isBuiltIn: true });

        console.log('\n📊 Riepilogo:');
        console.log(`   Built-in creati: ${seededCount}`);
        console.log(`   Built-in aggiornati: ${updatedCount}`);
        console.log(`   Built-in totali: ${builtInCount}`);

        if (builtInCount !== BUILTIN_TEMPLATES.length) {
            console.warn(`\n⚠️ ATTENZIONE: Previsti ${BUILTIN_TEMPLATES.length} built-in, trovati ${builtInCount}`);
        }

        console.log('\n🎉 STEP 3 completato con successo');
        console.log('\n📋 Built-in templates disponibili:');
        BUILTIN_TEMPLATES.forEach(t => {
            console.log(`   - ${t.name} [${t.id}] (type=${t.type}): ${t.description}`);
        });

    } catch (error) {
        console.error('❌ Errore durante STEP 3:', error);
        throw error;
    } finally {
        await client.close();
        console.log('\n✅ Connessione chiusa');
    }
}

// Esegui se chiamato direttamente
if (require.main === module) {
    step3_seedBuiltIns()
        .then(() => {
            console.log('\n✅ Script completato');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Script fallito:', error);
            process.exit(1);
        });
}

module.exports = { step3_seedBuiltIns };

