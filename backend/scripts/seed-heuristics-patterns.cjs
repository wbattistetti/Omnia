const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

// Pattern per ogni tipo di task
const patterns = {
  DataRequest: {
    IT: [
      '^(chiedi|richiedi|domanda|acquisisci|raccogli|invita)\\b',
      '^(chiede|richiede|domanda|acquisisce|raccoglie)\\b',
      '^(chiedigli|chiedile|chiedimi|richiedigli|richiedile)\\b',
      '^(interroga|interroga su|acquisisci da)\\b',
    ],
    EN: [
      '^(ask(\\s+for)?|request|collect|prompt(\\s+for)?|capture)\\b',
      '^(asks(\\s+for)?|requests|collects|prompts(\\s+for)?|captures)\\b',
    ],
    PT: [
      '^(pe[çc]a|solicite|pergunte|colete)\\b',
      '^(pede|solicita|pergunta|coleta)\\b',
    ],
  },
  Message: {
    IT: [
      '^(di|comunica|informa|mostra|avvisa|spiega|annuncia)\\b',
      '^(dice|comunica|informa|mostra|avvisa|spiega|annuncia)\\b',
      '^(mostragli|mostrale|spiegagli|spiegale|raccontagli|raccontale)\\b',
      '^(dice che|comunica che|informa che)\\b',
    ],
    EN: [
      '^(say|tell|notify|display|announce|explain)\\b',
      '^(says|tells|notifies|displays|announces|explains)\\b',
    ],
    PT: [
      '^(diga|informe|mostre|avise|explique|anuncie)\\b',
      '^(diz|informa|mostra|avisa|explica|anuncia)\\b',
    ],
  },
  ProblemClassification: {
    IT: [
      '^(descrivi|spiega|indica|racconta)\\s+(il\\s+)?(problema|errore|guasto|bug|sintom[oi])\\b',
      '^(descrive|spiega|indica|racconta)\\s+(il\\s+)?(problema|errore|guasto|bug|sintom[oi])\\b',
      '^(raccontami|descrivimi|spiegami)\\s+(il\\s+)?(problema|errore|guasto|bug|sintom[oi])\\b',
      '^(mi racconta|mi descrive|mi spiega)\\s+(il\\s+)?(problema|errore|guasto|bug|sintom[oi])\\b',
    ],
    EN: [
      '^(describe|explain|detail|list)\\s+(the\\s+)?(issue|problem|error|failure|bug|symptom[s]?)\\b',
      '^(describes|explains|details|lists)\\s+(the\\s+)?(issue|problem|error|failure|bug|symptom[s]?)\\b',
    ],
    PT: [
      '^(descreva|explique|liste|relate)\\s+(o\\s+)?(problema|erro|falha|bug|sintoma[s]?)\\b',
      '^(descreve|explica|lista|relata)\\s+(o\\s+)?(problema|erro|falha|bug|sintoma[s]?)\\b',
    ],
  },
  AIAgent: {
    IT: ['^AI\\s*:'],
    EN: ['^AI\\s*:'],
    PT: ['^AI\\s*:'],
  },
  Summary: {
    IT: [
      '^(riassumi|riepiloga|ricapitola|recap)\\b',
      '^(riassume|riepiloga|ricapitola)\\b',
      '\\b(in sintesi|in breve|per riassumere|in parole povere)\\b',
      '^(fammi\\s+un\\s+riassunto|dammi\\s+un\\s+riepilogo)\\b',
    ],
    EN: [
      '^(summari[sz]e|recap|provide\\s+a\\s+summary)\\b',
      '^(summari[sz]es|recaps|provides\\s+a\\s+summary)\\b',
      '\\b(in summary|in short)\\b',
    ],
    PT: [
      '^(resuma|fa[çc]a\\s+um\\s+resumo|recapitule)\\b',
      '^(resume|fornece\\s+um\\s+resumo|recapitula)\\b',
      '\\b(em resumo|em s[ií]ntese)\\b',
    ],
  },
  BackendCall: {
    IT: [
      '\\b(api|webhook|endpoint|crm|erp|token)\\b',
      '\\b(get|post|put|patch|delete)\\b',
      '^(chiama|invoca|esegui|effettua|recupera|aggiorna|elimina|crea)\\b',
      '^(chiama|invoca|esegue|recupera|aggiorna|elimina|crea)\\b',
      '^(controlla|verifica|guarda)\\b',
      '^(controlla|verifica|guarda)\\s+se\\b',
    ],
    EN: [
      '\\b(api|webhook|endpoint|crm|erp|token)\\b',
      '\\b(get|post|put|patch|delete)\\b',
      '^(call|invoke|execute|fetch|update|delete|create)\\b',
      '^(calls|invokes|executes|fetches|updates|deletes|creates)\\b',
      '^(check|verify|look\\s*up)\\b',
      '^(checks|verifies|looks\\s*up)\\b',
    ],
    PT: [
      '\\b(api|webhook|endpoint|crm|erp|token)\\b',
      '\\b(get|post|put|patch|delete)\\b',
      '^(chame|invoque|execute|busque|atualize|exclua|crie)\\b',
      '^(chama|invoca|executa|busca|atualiza|exclui|cria)\\b',
      '^(verifique|confira|veja|consulte|cheque)\\b',
      '^(verifica|confere|v[eê]|consulta|checa)\\b',
    ],
  },
  Negotiation: {
    IT: [
      '^(negozia|tratta|gestisci|concorda|valuta)\\b',
      '^(si negozia|si tratta|si concorda)\\b',
      '^(proponi|suggerisci|offri|indica)\\s+(un\'altra|una nuova|un\'alternativa)\\b',
    ],
    EN: [
      '^(negotiate|handle|manage|agree|evaluate)\\b',
      '^(is negotiated|is handled|is agreed)\\b',
      '^(propose|suggest|offer|indicate)\\s+(another|a new|an alternative)\\b',
    ],
    PT: [
      '^(negocie|trate|gerencie|concorde|avalie)\\b',
      '^(se negocia|se trata|se concorda)\\b',
      '^(proponha|sugira|ofere[çc]a|indique)\\s+(outra|uma nova|uma alternativa)\\b',
    ],
  },
};

// PROBLEM è un pattern singolo (non array)
const problemPattern = {
  IT: '\\b(problema|errore|guasto|bug|sintom[oi])\\b',
  EN: '\\b(issue|problem|error|failure|bug|symptom[s]?)\\b',
  PT: '\\b(problema|erro|falha|bug|sintoma[s]?)\\b',
};

async function seedHeuristicsPatterns() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('[SEED] ✅ Connected to MongoDB');

    const db = client.db(dbFactory);
    const collection = db.collection('Heuristics');

    const now = new Date();

    // Popola pattern per ogni tipo
    for (const [typeId, langPatterns] of Object.entries(patterns)) {
      const patternsObj = {};

      for (const [lang, patternArray] of Object.entries(langPatterns)) {
        patternsObj[lang] = patternArray;
      }

      const result = await collection.updateOne(
        { _id: typeId },
        {
          $set: {
            patterns: patternsObj,
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true }
      );

      if (result.upsertedCount > 0) {
        console.log(`[SEED] ✅ Created ${typeId} with ${Object.keys(patternsObj).length} languages`);
      } else if (result.modifiedCount > 0) {
        console.log(`[SEED] ✅ Updated ${typeId}`);
      }
    }

    // Aggiungi PROBLEM_REASON a ProblemClassification (per "chiedi il motivo della chiamata")
    const problemReasonPatterns = {
      IT: [
        '^(chiedi|richiedi|domanda)\\s+(il\\s+)?(motivo|perch[eéè])\\b',
        '^(chiede|richiede|domanda)\\s+(il\\s+)?(motivo|perch[eéè])\\b',
        '^(chiedi|richiedi|domanda)\\s+(il\\s+)?(problema|motivo\\s+della\\s+(chiamata|telefonata|richiesta|segnalazione))\\b',
        '^(chiede|richiede|domanda)\\s+(il\\s+)?(problema|motivo\\s+della\\s+(chiamata|telefonata|richiesta|segnalazione))\\b',
        '^(chiedigli|chiedile)\\s+(perch[eéè]|il\\s+motivo)\\b',
        '^(domandagli|domandale)\\s+(perch[eéè]|il\\s+motivo)\\b',
      ],
      EN: [
        '^(ask(\\s+for)?|request)\\s+(the\\s+)?(reason|why)\\b',
        '^(asks(\\s+for)?|requests)\\s+(the\\s+)?(reason|why)\\b',
        '^(ask|asks)\\s+why\\b',
      ],
      PT: [
        '^(pergunte|solicite|pe[çc]a)\\s+(o\\s+)?(motivo|por\\s+que)\\b',
        '^(pergunta|solicita|pede)\\s+(o\\s+)?(motivo|por\\s+que)\\b',
      ],
    };

    // Aggiorna ProblemClassification con PROBLEM_REASON
    const existingProblem = await collection.findOne({ _id: 'ProblemClassification' });
    const existingPatterns = existingProblem?.patterns || {};

    // Aggiungi PROBLEM_REASON mantenendo gli altri pattern
    const updatedProblemPatterns = {
      ...existingPatterns,
      PROBLEM_REASON: problemReasonPatterns,
    };

    const problemReasonResult = await collection.updateOne(
      { _id: 'ProblemClassification' },
      {
        $set: {
          'patterns.PROBLEM_REASON': problemReasonPatterns,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true }
    );

    if (problemReasonResult.upsertedCount > 0 || problemReasonResult.modifiedCount > 0) {
      console.log(`[SEED] ✅ Updated ProblemClassification with PROBLEM_REASON patterns`);
    }

    // Verifica
    const count = await collection.countDocuments({ patterns: { $exists: true } });
    console.log(`[SEED] ✅ Total documents with patterns: ${count}`);

  } catch (error) {
    console.error('[SEED] ❌ Error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('[SEED] ✅ Connection closed');
  }
}

// Esegui lo script
seedHeuristicsPatterns()
  .then(() => {
    console.log('[SEED] ✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[SEED] ❌ Script failed:', error);
    process.exit(1);
  });
