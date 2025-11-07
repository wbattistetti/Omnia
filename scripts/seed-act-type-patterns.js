const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

// Mapping da HeuristicType a InternalType
const typeMapping = {
    'AI_AGENT': 'AIAgent',
    'MESSAGE': 'Message',
    'REQUEST_DATA': 'DataRequest',
    'PROBLEM_SPEC_DIRECT': 'ProblemClassification',
    'PROBLEM_REASON': 'ProblemClassification',
    'PROBLEM': 'ProblemClassification',
    'SUMMARY': 'Summarizer',
    'BACKEND_CALL': 'BackendCall',
    'NEGOTIATION': 'Negotiation'
};

// Pattern estratti dai file .disabled
const patterns = {
    IT: {
        AI_AGENT: [
            '^AI\\s*:'
        ],
        MESSAGE: [
            '^(di|comunica|informa|mostra|avvisa|spiega|annuncia)\\b',
            '^(dice|comunica|informa|mostra|avvisa|spiega|annuncia)\\b',
            '^(mostragli|mostrale|spiegagli|spiegale|raccontagli|raccontale)\\b',
            '^(dice che|comunica che|informa che)\\b',
        ],
        REQUEST_DATA: [
            '^(chiedi|richiedi|domanda|acquisisci|raccogli|invita)\\b',
            '^(chiede|richiede|domanda|acquisisce|raccoglie)\\b',
            '^(chiedigli|chiedile|chiedimi|richiedigli|richiedile)\\b',
            '^(interroga|interroga su|acquisisci da)\\b',
        ],
        PROBLEM: '\\b(problema|errore|guasto|bug|sintom[oi])\\b',
        PROBLEM_SPEC_DIRECT: [
            '^(descrivi|spiega|indica|racconta)\\s+(il\\s+)?(problema|errore|guasto|bug|sintom[oi])\\b',
            '^(descrive|spiega|indica|racconta)\\s+(il\\s+)?(problema|errore|guasto|bug|sintom[oi])\\b',
            '^(raccontami|descrivimi|spiegami)\\s+(il\\s+)?(problema|errore|guasto|bug|sintom[oi])\\b',
            '^(mi racconta|mi descrive|mi spiega)\\s+(il\\s+)?(problema|errore|guasto|bug|sintom[oi])\\b',
        ],
        PROBLEM_REASON: [
            '^(chiedi|richiedi|domanda)\\s+(il\\s+)?(motivo|perch[eéè])\\b',
            '^(chiede|richiede|domanda)\\s+(il\\s+)?(motivo|perch[eéè])\\b',
            '^(chiedi|richiedi|domanda)\\s+(il\\s+)?(problema|motivo\\s+della\\s+(chiamata|telefonata|richiesta|segnalazione))\\b',
            '^(chiede|richiede|domanda)\\s+(il\\s+)?(problema|motivo\\s+della\\s+(chiamata|telefonata|richiesta|segnalazione))\\b',
            '^(chiedigli|chiedile)\\s+(perch[eéè]|il\\s+motivo)\\b',
            '^(domandagli|domandale)\\s+(perch[eéè]|il\\s+motivo)\\b',
        ],
        SUMMARY: [
            '^(riassumi|riepiloga|ricapitola|recap)\\b',
            '^(riassume|riepiloga|ricapitola)\\b',
            '\\b(in sintesi|in breve|per riassumere|in parole povere)\\b',
            '^(fammi\\s+un\\s+riassunto|dammi\\s+un\\s+riepilogo)\\b',
        ],
        BACKEND_CALL: [
            '\\b(api|webhook|endpoint|crm|erp|token)\\b',
            '\\b(get|post|put|patch|delete)\\b',
            '^(chiama|invoca|esegui|effettua|recupera|aggiorna|elimina|crea)\\b',
            '^(chiama|invoca|esegue|recupera|aggiorna|elimina|crea)\\b',
            '^(controlla|verifica|guarda)\\b',
            '^(controlla|verifica|guarda)\\s+se\\b',
            '^(interroga\\s+l\'api|manda\\s+una\\s+richiesta|recupera\\s+dal\\s+crm)\\b',
            '^(esegui\\s+una\\s+chiamata|effettua\\s+una\\s+query)\\b',
        ],
        NEGOTIATION: [
            '^(negozia|tratta|gestisci|concorda|valuta)\\b',
            '^(si negozia|si tratta|si concorda)\\b',
            '^(proponi|suggerisci|offri|indica)\\s+(un\'altra|una nuova|un\'alternativa)\\b',
            '^(puoi\\s+proporre|hai\\s+altre)\\b',
        ],
    },
    EN: {
        AI_AGENT: [
            '^AI\\s*:'
        ],
        MESSAGE: [
            '^(say|tell|notify|display|announce|explain)\\b',
            '^(says|tells|notifies|displays|announces|explains)\\b',
        ],
        REQUEST_DATA: [
            '^(ask(\\s+for)?|request|collect|prompt(\\s+for)?|capture)\\b',
            '^(asks(\\s+for)?|requests|collects|prompts(\\s+for)?|captures)\\b',
        ],
        PROBLEM: '\\b(issue|problem|error|failure|bug|symptom[s]?)\\b',
        PROBLEM_SPEC_DIRECT: [
            '^(describe|explain|detail|list)\\s+(the\\s+)?(issue|problem|error|failure|bug|symptom[s]?)\\b',
            '^(describes|explains|details|lists)\\s+(the\\s+)?(issue|problem|error|failure|bug|symptom[s]?)\\b',
        ],
        PROBLEM_REASON: [
            '^(ask(\\s+for)?|request)\\s+(the\\s+)?(reason|why)\\b',
            '^(asks(\\s+for)?|requests)\\s+(the\\s+)?(reason|why)\\b',
            '^(ask|asks)\\s+why\\b',
        ],
        SUMMARY: [
            '^(summari[sz]e|recap|provide\\s+a\\s+summary)\\b',
            '^(summari[sz]es|recaps|provides\\s+a\\s+summary)\\b',
            '\\b(in summary|in short)\\b',
        ],
        BACKEND_CALL: [
            '\\b(api|webhook|endpoint|crm|erp|token)\\b',
            '\\b(get|post|put|patch|delete)\\b',
            '^(call|invoke|execute|fetch|update|delete|create)\\b',
            '^(calls|invokes|executes|fetches|updates|deletes|creates)\\b',
            '^(check|verify|look\\s*up)\\b',
            '^(checks|verifies|looks\\s*up)\\b',
        ],
        NEGOTIATION: [
            '^(negotiate|handle|manage|agree|evaluate)\\b',
            '^(is negotiated|is handled|is agreed)\\b',
            '^(propose|suggest|offer|indicate)\\s+(another|a new|an alternative)\\b',
            '^(can you propose|do you have other)\\b',
        ],
    },
    PT: {
        AI_AGENT: [
            '^AI\\s*:'
        ],
        MESSAGE: [
            '^(diga|informe|mostre|avise|explique|anuncie)\\b',
            '^(diz|informa|mostra|avisa|explica|anuncia)\\b',
        ],
        REQUEST_DATA: [
            '^(pe[çc]a|solicite|pergunte|colete)\\b',
            '^(pede|solicita|pergunta|coleta)\\b',
        ],
        PROBLEM: '\\b(problema|erro|falha|bug|sintoma[s]?)\\b',
        PROBLEM_SPEC_DIRECT: [
            '^(descreva|explique|liste|relate)\\s+(o\\s+)?(problema|erro|falha|bug|sintoma[s]?)\\b',
            '^(descreve|explica|lista|relata)\\s+(o\\s+)?(problema|erro|falha|bug|sintoma[s]?)\\b',
        ],
        PROBLEM_REASON: [
            '^(pergunte|solicite|pe[çc]a)\\s+(o\\s+)?(motivo|por\\s+que)\\b',
            '^(pergunta|solicita|pede)\\s+(o\\s+)?(motivo|por\\s+que)\\b',
        ],
        SUMMARY: [
            '^(resuma|fa[çc]a\\s+um\\s+resumo|recapitule)\\b',
            '^(resume|fornece\\s+um\\s+resumo|recapitula)\\b',
            '\\b(em resumo|em s[ií]ntese)\\b',
        ],
        BACKEND_CALL: [
            '\\b(api|webhook|endpoint|crm|erp|token)\\b',
            '\\b(get|post|put|patch|delete)\\b',
            '^(chame|invoque|execute|busque|atualize|exclua|crie)\\b',
            '^(chama|invoca|executa|busca|atualiza|exclui|cria)\\b',
            '^(verifique|confira|veja|consulte|cheque)\\b',
            '^(verifica|confere|v[eê]|consulta|checa)\\b',
        ],
        NEGOTIATION: [
            '^(negocie|trate|gerencie|concorde|avalie)\\b',
            '^(se negocia|se trata|se concorda)\\b',
            '^(proponha|sugira|ofere[çc]a|indique)\\s+(outra|uma nova|uma alternativa)\\b',
            '^(pode propor|tem outras)\\b',
        ],
    },
};

async function seedActTypePatterns() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('[SEED] Connected to MongoDB');

        const db = client.db(dbFactory);
        const collection = db.collection('act_type_patterns');

        // Rimuovi documenti esistenti (opzionale - commenta se vuoi mantenere)
        // await collection.deleteMany({});
        // console.log('[SEED] Cleared existing patterns');

        const documents = [];

        // Crea documenti per ogni tipo e lingua
        for (const lang of ['IT', 'EN', 'PT']) {
            const langPatterns = patterns[lang];

            for (const [type, patternData] of Object.entries(langPatterns)) {
                const _id = `${type}_${lang}`;
                const internalType = typeMapping[type] || type;

                // PROBLEM è un singolo pattern, gli altri sono array
                const patternsArray = Array.isArray(patternData)
                    ? patternData
                    : [patternData];

                const doc = {
                    _id,
                    type,
                    internalType,
                    language: lang,
                    patterns: patternsArray,
                    version: '1.0.0',
                    updatedAt: new Date().toISOString(),
                };

                documents.push(doc);
            }
        }

        // Inserisci o aggiorna documenti
        let inserted = 0;
        let updated = 0;

        for (const doc of documents) {
            const result = await collection.updateOne(
                { _id: doc._id },
                { $set: doc },
                { upsert: true }
            );

            if (result.upsertedCount > 0) {
                inserted++;
            } else if (result.modifiedCount > 0) {
                updated++;
            }
        }

        console.log(`[SEED] ✅ Completed:`);
        console.log(`  - Inserted: ${inserted} documents`);
        console.log(`  - Updated: ${updated} documents`);
        console.log(`  - Total: ${documents.length} documents`);

        // Verifica
        const count = await collection.countDocuments();
        console.log(`[SEED] Total documents in collection: ${count}`);

    } catch (error) {
        console.error('[SEED] ❌ Error:', error);
        throw error;
    } finally {
        await client.close();
        console.log('[SEED] Connection closed');
    }
}

// Esegui lo script
seedActTypePatterns()
    .then(() => {
        console.log('[SEED] ✅ Script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('[SEED] ❌ Script failed:', error);
        process.exit(1);
    });

