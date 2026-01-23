/**
 * ANALISI COMPLETA DATABASE FACTORY - Template Structure Analysis & Migration Plan
 *
 * Questo script analizza tutti i template nel database Factory e genera un report completo
 * con:
 * 1. Classificazione di ogni template (Atomic/CompositeData/Collection)
 * 2. Verifica coerenza (subDataIds referenziati esistono)
 * 3. Identificazione problemi (come "atomic" invece di ID corretti)
 * 4. Proposta struttura corretta
 * 5. Piano di migrazione dettagliato
 *
 * Uso: node backend/analyze_factory_templates.js > report_factory_analysis.md
 */

const { MongoClient, ObjectId } = require('mongodb');

const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';
const collectionName = 'Tasks';

// ============================================
// CLASSIFICATION LOGIC
// ============================================

/**
 * Classifica un template come Atomic, CompositeData, o Collection
 */
function classifyTemplate(template) {
  const hasSubDataIds = template.subDataIds && Array.isArray(template.subDataIds) && template.subDataIds.length > 0;
  const hasSubData = template.subData && (Array.isArray(template.subData) ? template.subData.length > 0 : Object.keys(template.subData || {}).length > 0);

  // Atomic: nessun subData
  if (!hasSubDataIds && !hasSubData) {
    return 'Atomic';
  }

  // CompositeData: ha subData (es. Date con day, month, year)
  if (hasSubDataIds || hasSubData) {
    return 'CompositeData';
  }

  // Collection: multipli mainData (non gestito in questo script, ma annotato)
  return 'Unknown';
}

/**
 * Verifica se un subDataId esiste nel database
 */
async function verifySubDataId(subDataId, allTemplates) {
  const subIdStr = String(subDataId);

  // Cerca per _id (ObjectId)
  const matchByObjectId = allTemplates.find(t => {
    if (t._id instanceof ObjectId) {
      return t._id.toString() === subIdStr;
    }
    return String(t._id) === subIdStr;
  });

  if (matchByObjectId) {
    return {
      found: true,
      template: matchByObjectId,
      matchType: '_id',
      isValid: true
    };
  }

  // Cerca per id (GUID string)
  const matchById = allTemplates.find(t => String(t.id || '') === subIdStr);
  if (matchById) {
    return {
      found: true,
      template: matchById,
      matchType: 'id',
      isValid: true
    };
  }

  // Cerca per name (es. "atomic", "Day", "Month", "Year")
  const matchByName = allTemplates.find(t =>
    String(t.name || '').toLowerCase() === subIdStr.toLowerCase()
  );
  if (matchByName) {
    return {
      found: true,
      template: matchByName,
      matchType: 'name',
      isValid: false, // Non è un riferimento valido, è un nome
      issue: `subDataId "${subIdStr}" è un nome, non un ID. Dovrebbe essere ${matchByName._id} o ${matchByName.id}`
    };
  }

  // Non trovato
  return {
    found: false,
    template: null,
    matchType: null,
    isValid: false,
    issue: `subDataId "${subIdStr}" non esiste nel database`
  };
}

// ============================================
// ANALYSIS FUNCTIONS
// ============================================

/**
 * Analizza tutti i template e genera report completo
 */
async function analyzeFactoryTemplates() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('# 📊 ANALISI COMPLETA DATABASE FACTORY - Template Structure\n');
    console.log('**Data analisi:**', new Date().toISOString());
    console.log('**Database:**', dbFactory);
    console.log('**Collection:**', collectionName);
    console.log('\n---\n');

    const db = client.db(dbFactory);
    const collection = db.collection(collectionName);

    // 1. Carica tutti i template
    console.log('## 🔍 STEP 1: Caricamento Template\n');
    const allTemplates = await collection.find({}).toArray();
    console.log(`**Totale template trovati:** ${allTemplates.length}\n`);

    // 2. Classifica tutti i template
    console.log('## 📋 STEP 2: Classificazione Template\n');
    const classified = {
      Atomic: [],
      CompositeData: [],
      Collection: [],
      Unknown: []
    };

    allTemplates.forEach(template => {
      const classification = classifyTemplate(template);
      classified[classification].push(template);
    });

    console.log('### Statistiche Classificazione:\n');
    console.log(`- **Atomic:** ${classified.Atomic.length} template`);
    console.log(`- **CompositeData:** ${classified.CompositeData.length} template`);
    console.log(`- **Collection:** ${classified.Collection.length} template`);
    console.log(`- **Unknown:** ${classified.Unknown.length} template\n`);

    // 3. Analisi dettagliata per ogni categoria
    console.log('## 🔬 STEP 3: Analisi Dettagliata\n');

    // 3.1 Atomic Templates
    console.log('### 3.1 Template Atomic\n');
    console.log('I template atomic sono dati semplici senza subData.\n');
    console.log('| Nome | ID | Label | Stato |');
    console.log('|------|----|----|--------|');
    classified.Atomic.forEach(t => {
      const id = t.id || t._id?.toString() || 'NO_ID';
      const name = t.name || 'NO_NAME';
      const label = t.label || 'NO_LABEL';
      console.log(`| ${name} | ${id.substring(0, 20)}... | ${label} | ✅ OK |`);
    });
    console.log('');

    // 3.2 CompositeData Templates
    console.log('### 3.2 Template CompositeData\n');
    console.log('I template CompositeData hanno subData che vengono composti in un unico valore.\n');
    console.log('**Esempio:** Date = composizione di day + month + year\n\n');

    const compositeIssues = [];

    for (const template of classified.CompositeData) {
      const name = template.name || 'NO_NAME';
      const id = template.id || template._id?.toString() || 'NO_ID';
      const label = template.label || 'NO_LABEL';
      const subDataIds = template.subDataIds || [];

      console.log(`#### Template: **${name}**\n`);
      console.log(`- **ID:** ${id}`);
      console.log(`- **Label:** ${label}`);
      console.log(`- **subDataIds count:** ${subDataIds.length}\n`);

      if (subDataIds.length === 0) {
        console.log('⚠️ **PROBLEMA:** Template CompositeData senza subDataIds!\n');
        compositeIssues.push({
          template: name,
          issue: 'CompositeData senza subDataIds',
          severity: 'HIGH'
        });
      } else {
        console.log('**SubData Referenziati:**\n');
        console.log('| Index | subDataId | Tipo | Trovato | Match Type | Template | Problema |');
        console.log('|-------|-----------|------|---------|------------|----------|----------|');

        for (let i = 0; i < subDataIds.length; i++) {
          const subId = subDataIds[i];
          const verification = await verifySubDataId(subId, allTemplates);

          const subIdStr = String(subId);
          const subIdDisplay = subIdStr.length > 30 ? subIdStr.substring(0, 30) + '...' : subIdStr;
          const type = subId instanceof ObjectId ? 'ObjectId' : typeof subId;
          const found = verification.found ? '✅' : '❌';
          const matchType = verification.matchType || '-';
          const templateName = verification.template ? (verification.template.name || 'NO_NAME') : '-';
          const issue = verification.issue || (verification.isValid ? 'OK' : 'INVALID');

          console.log(`| ${i} | ${subIdDisplay} | ${type} | ${found} | ${matchType} | ${templateName} | ${issue} |`);

          if (!verification.isValid) {
            compositeIssues.push({
              template: name,
              subDataId: subIdStr,
              issue: verification.issue || 'ID non valido',
              severity: verification.found && verification.matchType === 'name' ? 'MEDIUM' : 'HIGH',
              suggestedFix: verification.template ? {
                current: subIdStr,
                correct: verification.template.id || verification.template._id?.toString()
              } : null
            });
          }
        }
        console.log('');
      }
    }

    // 4. Riepilogo Problemi
    console.log('## ⚠️ STEP 4: Riepilogo Problemi\n');

    if (compositeIssues.length === 0) {
      console.log('✅ **Nessun problema trovato!** Tutti i template sono corretti.\n');
    } else {
      console.log(`**Totale problemi trovati:** ${compositeIssues.length}\n`);

      // Raggruppa per severità
      const highSeverity = compositeIssues.filter(i => i.severity === 'HIGH');
      const mediumSeverity = compositeIssues.filter(i => i.severity === 'MEDIUM');

      if (highSeverity.length > 0) {
        console.log('### 🔴 Problemi HIGH Severity\n');
        console.log('| Template | subDataId | Problema | Fix Suggerito |');
        console.log('|----------|-----------|----------|---------------|');
        highSeverity.forEach(issue => {
          const fix = issue.suggestedFix
            ? `${issue.suggestedFix.current} → ${issue.suggestedFix.correct}`
            : 'Da investigare';
          console.log(`| ${issue.template} | ${issue.subDataId || 'N/A'} | ${issue.issue} | ${fix} |`);
        });
        console.log('');
      }

      if (mediumSeverity.length > 0) {
        console.log('### 🟡 Problemi MEDIUM Severity\n');
        console.log('| Template | subDataId | Problema | Fix Suggerito |');
        console.log('|----------|-----------|----------|---------------|');
        mediumSeverity.forEach(issue => {
          const fix = issue.suggestedFix
            ? `${issue.suggestedFix.current} → ${issue.suggestedFix.correct}`
            : 'Da investigare';
          console.log(`| ${issue.template} | ${issue.subDataId || 'N/A'} | ${issue.issue} | ${fix} |`);
        });
        console.log('');
      }
    }

    // 5. Proposta Struttura Corretta
    console.log('## 📐 STEP 5: Proposta Struttura Corretta\n');
    console.log('### 5.1 Template Atomic\n');
    console.log('I template atomic devono avere:\n');
    console.log('```json');
    console.log(JSON.stringify({
      "_id": "ObjectId(...)",
      "id": "guid-string",
      "name": "Email",
      "label": "Email",
      "kind": "email",
      "subDataIds": null  // o non presente
    }, null, 2));
    console.log('```\n');

    console.log('### 5.2 Template CompositeData\n');
    console.log('I template CompositeData devono avere subDataIds che referenziano template atomic esistenti:\n');
    console.log('```json');
    console.log(JSON.stringify({
      "_id": "ObjectId(...)",
      "id": "guid-string",
      "name": "Date",
      "label": "Date",
      "kind": "date",
      "subDataIds": [
        "guid-day-template",    // ID del template "Day"
        "guid-month-template",  // ID del template "Month"
        "guid-year-template"    // ID del template "Year"
      ]
    }, null, 2));
    console.log('```\n');

    console.log('**Regole:**\n');
    console.log('1. Ogni `subDataId` deve essere un ID valido (GUID string o ObjectId)');
    console.log('2. Ogni `subDataId` deve referenziare un template esistente nel database');
    console.log('3. I template referenziati devono essere Atomic');
    console.log('4. Non usare nomi (es. "atomic", "Day") come subDataId\n');

    // 6. Piano di Migrazione
    console.log('## 🚀 STEP 6: Piano di Migrazione\n');
    console.log('### 6.1 Preparazione\n');
    console.log('1. ✅ Backup completo del database Factory');
    console.log('2. ✅ Verifica che tutti i template atomic necessari esistano');
    console.log('3. ✅ Identificare tutti i template CompositeData da correggere\n');

    console.log('### 6.2 Passi di Migrazione\n');

    if (compositeIssues.length > 0) {
      console.log('**Per ogni template con problemi:**\n');
      console.log('1. Identificare il template da correggere');
      console.log('2. Verificare che i template atomic referenziati esistano');
      console.log('3. Sostituire i subDataId errati con gli ID corretti');
      console.log('4. Verificare che la struttura sia coerente\n');

      console.log('**Esempio concreta per template "Date":**\n');
      const dateTemplate = classified.CompositeData.find(t => t.name === 'Date');
      if (dateTemplate) {
        console.log('```javascript');
        console.log('// PRIMA (ERRATO)');
        console.log(JSON.stringify({
          name: dateTemplate.name,
          subDataIds: dateTemplate.subDataIds
        }, null, 2));
        console.log('');
        console.log('// DOPO (CORRETTO)');
        console.log('// Assumendo che esistano template Day, Month, Year:');
        const dayTemplate = allTemplates.find(t => t.name === 'Day');
        const monthTemplate = allTemplates.find(t => t.name === 'Month');
        const yearTemplate = allTemplates.find(t => t.name === 'Year');

        if (dayTemplate && monthTemplate && yearTemplate) {
          console.log(JSON.stringify({
            name: dateTemplate.name,
            subDataIds: [
              dayTemplate.id || dayTemplate._id?.toString(),
              monthTemplate.id || monthTemplate._id?.toString(),
              yearTemplate.id || yearTemplate._id?.toString()
            ]
          }, null, 2));
        } else {
          console.log('// ⚠️ Template Day/Month/Year non trovati nel database!');
          console.log('// Devono essere creati prima di correggere Date.');
        }
        console.log('```\n');
      }
    } else {
      console.log('✅ **Nessuna migrazione necessaria!** Tutti i template sono già corretti.\n');
    }

    console.log('### 6.3 Verifica Post-Migrazione\n');
    console.log('1. ✅ Eseguire nuovamente questo script di analisi');
    console.log('2. ✅ Verificare che tutti i problemi siano risolti');
    console.log('3. ✅ Testare la creazione di task da template corretti');
    console.log('4. ✅ Verificare che i subData vengano risolti correttamente\n');

    // 7. Template Atomic Necessari
    console.log('## 🔧 STEP 7: Template Atomic Necessari\n');
    console.log('Verifica che esistano tutti i template atomic necessari per i CompositeData:\n');

    const requiredAtomics = new Set();
    for (const template of classified.CompositeData) {
      if (template.subDataIds && Array.isArray(template.subDataIds)) {
        for (const subId of template.subDataIds) {
          const verification = await verifySubDataId(subId, allTemplates);
          if (verification.found && verification.template) {
            // Il template esiste, ma verifichiamo se è Atomic
            if (classifyTemplate(verification.template) === 'Atomic') {
              requiredAtomics.add(verification.template.name || 'NO_NAME');
            }
          }
        }
      }
    }

    console.log('**Template atomic trovati e referenziati:**\n');
    Array.from(requiredAtomics).sort().forEach(name => {
      console.log(`- ✅ ${name}`);
    });
    console.log('');

    // 8. Conclusione
    console.log('## ✅ STEP 8: Conclusione\n');
    console.log('**Stato attuale:**\n');
    console.log(`- Template totali: ${allTemplates.length}`);
    console.log(`- Template Atomic: ${classified.Atomic.length}`);
    console.log(`- Template CompositeData: ${classified.CompositeData.length}`);
    console.log(`- Problemi trovati: ${compositeIssues.length}\n`);

    if (compositeIssues.length === 0) {
      console.log('✅ **Il database Factory è coerente e pronto per l\'uso.**\n');
    } else {
      console.log('⚠️ **Sono necessarie correzioni prima di procedere.**\n');
      console.log('**Prossimi passi:**\n');
      console.log('1. Mostrare questo report a un esperto per approvazione');
      console.log('2. Dopo approvazione, eseguire la migrazione');
      console.log('3. Verificare post-migrazione\n');
    }

    console.log('---\n');
    console.log('**Fine Report**\n');

  } catch (error) {
    console.error('❌ **ERRORE FATALE:**', error);
    console.error(error.stack);
  } finally {
    await client.close();
  }
}

// Esegui analisi
analyzeFactoryTemplates().catch(console.error);
