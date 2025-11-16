/**
 * Script completo per sistemare Task_Templates:
 * 1. Cambia type da "atomic"/"composite" a "data" o "aggregate"
 * 2. Aggiunge stepPrompts con GUID unici nei mainData e subData per template "data"
 * 3. Crea/verifica entries in Translations per ogni GUID
 * 4. Tutti i dati (main e sub) hanno TUTTI i 6 stepPrompts con GUID unici
 * 5. Testi generici (noMatch, noInput, confirmation, notConfirmed, success) uguali per tutti
 * 6. Testo start specifico per ogni dato
 */

const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const DB_NAME = 'factory';

// Step types - TUTTI i dati hanno tutti questi step
const ALL_STEPS = ['start', 'noMatch', 'noInput', 'confirmation', 'notConfirmed', 'success'];

// Testi generici (uguali per tutti i dati)
const GENERIC_MESSAGES = {
  noMatch: {
    en: "Sorry, I didn't understand. Could you repeat?",
    it: "Scusi, non ho capito. Può ripetere?",
    pt: "Desculpe, não entendi. Você poderia repetir?"
  },
  noInput: {
    en: "I didn't hear anything. Could you repeat?",
    it: "Non ho sentito. Può ripetere?",
    pt: "Não ouvi nada. Você poderia repetir?"
  },
  confirmation: {
    en: "{input} correct?",
    it: "{input} corretto?",
    pt: "{input} correto?"
  },
  notConfirmed: {
    en: "OK, let's try again.",
    it: "OK, riproviamo.",
    pt: "OK, vamos tentar novamente."
  },
  success: {
    en: "OK, thank you.",
    it: "OK, grazie.",
    pt: "OK, obrigado."
  }
};

// Genera messaggio start specifico per un dato
function generateStartMessage(fieldLabel, lang = 'en') {
  const messages = {
    en: `What is your ${fieldLabel.toLowerCase()}?`,
    it: `Qual è il tuo ${fieldLabel.toLowerCase()}?`,
    pt: `Qual é o seu ${fieldLabel.toLowerCase()}?`
  };
  return messages[lang] || messages.en;
}

// Crea o aggiorna entries in Translations (una per lingua)
async function ensureTranslation(translationsCollection, guid, stepType, fieldLabel) {
  const languages = ['en', 'it', 'pt'];

  // Determina i testi per ogni lingua
  let texts = {};
  if (stepType === 'start') {
    // Start: specifico per il dato
    texts = {
      en: generateStartMessage(fieldLabel, 'en'),
      it: generateStartMessage(fieldLabel, 'it'),
      pt: generateStartMessage(fieldLabel, 'pt')
    };
  } else {
    // Altri step: generici
    texts = GENERIC_MESSAGES[stepType] || {};
  }

  // Crea/aggiorna una entry per ogni lingua
  for (const lang of languages) {
    const text = texts[lang] || texts.en || '';

    const existing = await translationsCollection.findOne({
      guid: guid,
      language: lang,
      type: 'Template'
    });

    if (existing) {
      // Aggiorna se il testo è diverso
      if (existing.text !== text) {
        await translationsCollection.updateOne(
          { guid: guid, language: lang, type: 'Template' },
          { $set: { text: text, updatedAt: new Date() } }
        );
        console.log(`  ✅ Updated Translations for ${guid} (${stepType}, ${lang})`);
      }
    } else {
      // Crea nuova entry
      await translationsCollection.insertOne({
        guid: guid,
        language: lang,
        type: 'Template',
        text: text,
        projectId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log(`  ✅ Created Translations for ${guid} (${stepType}, ${lang})`);
    }
  }

  return guid;
}

// Crea stepPrompts per un campo (main o sub) - TUTTI i 6 step
async function createStepPrompts(translationsCollection, fieldLabel) {
  const stepPrompts = {};

  for (const stepType of ALL_STEPS) {
    const guid = uuidv4();
    await ensureTranslation(translationsCollection, guid, stepType, fieldLabel);
    stepPrompts[stepType] = [guid];
  }

  return stepPrompts;
}

// Verifica e sistema stepPrompts esistenti
async function fixStepPrompts(translationsCollection, stepPrompts, fieldLabel) {
  const fixedStepPrompts = {};

  for (const stepType of ALL_STEPS) {
    if (stepPrompts[stepType] && Array.isArray(stepPrompts[stepType]) && stepPrompts[stepType].length > 0) {
      // Verifica che sia un GUID valido
      const guid = stepPrompts[stepType][0];
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(guid)) {
        await ensureTranslation(translationsCollection, guid, stepType, fieldLabel);
        fixedStepPrompts[stepType] = [guid];
      } else {
        // Non è un GUID valido, creane uno nuovo
        const newGuid = uuidv4();
        await ensureTranslation(translationsCollection, newGuid, stepType, fieldLabel);
        fixedStepPrompts[stepType] = [newGuid];
        console.log(`    ⚠️  Replaced non-GUID key with GUID for ${stepType}`);
      }
    } else {
      // Manca questo step, crealo
      const newGuid = uuidv4();
      await ensureTranslation(translationsCollection, newGuid, stepType, fieldLabel);
      fixedStepPrompts[stepType] = [newGuid];
      console.log(`    ✅ Created missing stepPrompts for ${stepType}`);
    }
  }

  return fixedStepPrompts;
}

async function fixTaskTemplates() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(DB_NAME);
    const templatesCollection = db.collection('Task_Templates');
    const translationsCollection = db.collection('Translations');

    // Get all templates
    const templates = await templatesCollection.find({}).toArray();
    console.log(`📦 Found ${templates.length} templates\n`);

    let updated = 0;
    let skipped = 0;

    for (const template of templates) {
      const templateName = template.name || template._id || 'unknown';
      const templateLabel = template.label || templateName;

      console.log(`\n🔍 Processing template: ${templateLabel} (${templateName})`);

      // Determina se è aggregato
      const isAggregate = template.type === 'aggregate' ||
                         template.type === 'aggregated' ||
                         template.introductionMessage ||
                         (template.label && (
                           template.label.toLowerCase().includes('dati personali') ||
                           template.label.toLowerCase().includes('personal data')
                         ));

      if (isAggregate) {
        // Template aggregato: cambia type e assicura introductionMessage
        console.log(`  📋 Type: aggregate`);
        const update = { type: 'aggregate' };

        if (!template.introductionMessage) {
          update.introductionMessage = `I need to collect some personal information from you.`;
          console.log(`  ✅ Added introductionMessage`);
        }

        // Rimuovi stepPrompts a livello root se presenti
        if (template.stepPrompts) {
          update.$unset = { stepPrompts: '' };
          console.log(`  ✅ Removed root stepPrompts (aggregates don't have them)`);
        }

        const updateOp = { $set: update };
        if (update.$unset) {
          updateOp.$unset = update.$unset;
          delete update.$unset;
        }
        await templatesCollection.updateOne(
          { _id: template._id },
          updateOp
        );
        updated++;
        console.log(`  ✅ Updated to aggregate`);

        // Per ogni mainData, assicura che abbia stepPrompts (TUTTI i 6 step)
        if (template.mainData && Array.isArray(template.mainData)) {
          const mainDataUpdates = {};

          for (let i = 0; i < template.mainData.length; i++) {
            const mainItem = template.mainData[i];
            const mainLabel = mainItem.label || 'Data';

            // Assicura stepPrompts per main data (TUTTI i 6 step)
            if (!mainItem.stepPrompts || Object.keys(mainItem.stepPrompts).length === 0) {
              mainDataUpdates[`mainData.${i}.stepPrompts`] = await createStepPrompts(translationsCollection, mainLabel);
              console.log(`    ✅ Created stepPrompts for main data: ${mainLabel}`);
            } else {
              const fixed = await fixStepPrompts(translationsCollection, mainItem.stepPrompts, mainLabel);
              if (JSON.stringify(fixed) !== JSON.stringify(mainItem.stepPrompts)) {
                mainDataUpdates[`mainData.${i}.stepPrompts`] = fixed;
                console.log(`    ✅ Fixed stepPrompts for main data: ${mainLabel}`);
              }
            }

            // Assicura stepPrompts per sub data (TUTTI i 6 step)
            if (mainItem.subData && Array.isArray(mainItem.subData)) {
              for (let j = 0; j < mainItem.subData.length; j++) {
                const subItem = mainItem.subData[j];
                const subLabel = subItem.label || 'Sub';

                if (!subItem.stepPrompts || Object.keys(subItem.stepPrompts).length === 0) {
                  mainDataUpdates[`mainData.${i}.subData.${j}.stepPrompts`] = await createStepPrompts(translationsCollection, subLabel);
                  console.log(`      ✅ Created stepPrompts for sub data: ${subLabel}`);
                } else {
                  const fixed = await fixStepPrompts(translationsCollection, subItem.stepPrompts, subLabel);
                  if (JSON.stringify(fixed) !== JSON.stringify(subItem.stepPrompts)) {
                    mainDataUpdates[`mainData.${i}.subData.${j}.stepPrompts`] = fixed;
                    console.log(`      ✅ Fixed stepPrompts for sub data: ${subLabel}`);
                  }
                }
              }
            }
          }

          if (Object.keys(mainDataUpdates).length > 0) {
            await templatesCollection.updateOne(
              { _id: template._id },
              { $set: mainDataUpdates }
            );
          }
        }

        continue;
      }

      // Template "data": cambia type e assicura stepPrompts
      console.log(`  📋 Type: data`);
      const update = { type: 'data' };

      // Se ci sono stepPrompts a livello root, spostali al primo mainData se non ce l'ha
      if (template.stepPrompts) {
        if (template.mainData && Array.isArray(template.mainData) && template.mainData.length > 0) {
          const firstMain = template.mainData[0];
          if (!firstMain.stepPrompts) {
            update['mainData.0.stepPrompts'] = template.stepPrompts;
            console.log(`  ✅ Moved root stepPrompts to first mainData`);
          }
        }
        update.$unset = { stepPrompts: '' };
      }

      const updateOp = { $set: update };
      if (update.$unset) {
        updateOp.$unset = update.$unset;
        delete update.$unset;
      }
      await templatesCollection.updateOne(
        { _id: template._id },
        updateOp
      );
      updated++;

      // Assicura stepPrompts per ogni mainData (TUTTI i 6 step)
      if (template.mainData && Array.isArray(template.mainData)) {
        const mainDataUpdates = {};

        for (let i = 0; i < template.mainData.length; i++) {
          const mainItem = template.mainData[i];
          const mainLabel = mainItem.label || 'Data';

          // Assicura stepPrompts per main data (TUTTI i 6 step)
          if (!mainItem.stepPrompts || Object.keys(mainItem.stepPrompts).length === 0) {
            mainDataUpdates[`mainData.${i}.stepPrompts`] = await createStepPrompts(translationsCollection, mainLabel);
            console.log(`    ✅ Created stepPrompts for main data: ${mainLabel}`);
          } else {
            const fixed = await fixStepPrompts(translationsCollection, mainItem.stepPrompts, mainLabel);
            if (JSON.stringify(fixed) !== JSON.stringify(mainItem.stepPrompts)) {
              mainDataUpdates[`mainData.${i}.stepPrompts`] = fixed;
              console.log(`    ✅ Fixed stepPrompts for main data: ${mainLabel}`);
            }
          }

          // Assicura stepPrompts per sub data (TUTTI i 6 step)
          if (mainItem.subData && Array.isArray(mainItem.subData)) {
            for (let j = 0; j < mainItem.subData.length; j++) {
              const subItem = mainItem.subData[j];
              const subLabel = subItem.label || 'Sub';

              if (!subItem.stepPrompts || Object.keys(subItem.stepPrompts).length === 0) {
                mainDataUpdates[`mainData.${i}.subData.${j}.stepPrompts`] = await createStepPrompts(translationsCollection, subLabel);
                console.log(`      ✅ Created stepPrompts for sub data: ${subLabel}`);
              } else {
                const fixed = await fixStepPrompts(translationsCollection, subItem.stepPrompts, subLabel);
                if (JSON.stringify(fixed) !== JSON.stringify(subItem.stepPrompts)) {
                  mainDataUpdates[`mainData.${i}.subData.${j}.stepPrompts`] = fixed;
                  console.log(`      ✅ Fixed stepPrompts for sub data: ${subLabel}`);
                }
              }
            }
          }
        }

        if (Object.keys(mainDataUpdates).length > 0) {
          await templatesCollection.updateOne(
            { _id: template._id },
            { $set: mainDataUpdates }
          );
        }
      } else {
        // Template senza mainData (atomic template): crea mainData con stepPrompts
        const mainLabel = template.label || templateName;
        const stepPrompts = await createStepPrompts(translationsCollection, mainLabel);

        const newMainData = [{
          label: mainLabel,
          type: template.type || template.name || 'generic',
          icon: template.icon || 'FileText',
          subData: template.subData || [],
          stepPrompts: stepPrompts
        }];

        // Se c'erano subData a livello root, spostali e aggiungi stepPrompts
        if (template.subData && Array.isArray(template.subData)) {
          for (let j = 0; j < template.subData.length; j++) {
            const subItem = template.subData[j];
            const subLabel = subItem.label || 'Sub';

            if (!subItem.stepPrompts || Object.keys(subItem.stepPrompts).length === 0) {
              newMainData[0].subData[j].stepPrompts = await createStepPrompts(translationsCollection, subLabel);
              console.log(`    ✅ Created stepPrompts for sub data: ${subLabel}`);
            } else {
              const fixed = await fixStepPrompts(translationsCollection, subItem.stepPrompts, subLabel);
              newMainData[0].subData[j].stepPrompts = fixed;
              console.log(`    ✅ Fixed stepPrompts for sub data: ${subLabel}`);
            }
          }
        }

        await templatesCollection.updateOne(
          { _id: template._id },
          {
            $set: {
              mainData: newMainData,
              type: 'data'
            },
            $unset: {
              subData: '',
              stepPrompts: ''
            }
          }
        );
        console.log(`  ✅ Created mainData structure`);
      }
    }

    console.log(`\n\n${'='.repeat(70)}`);
    console.log(`📊 SUMMARY`);
    console.log(`${'='.repeat(70)}\n`);
    console.log(`✅ Templates updated: ${updated}`);
    console.log(`⏭️  Templates skipped: ${skipped}`);
    console.log(`\n✅ All templates fixed!`);

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

fixTaskTemplates().catch(console.error);

