// update_templates_with_step_prompts.js
// Script completo per aggiungere prompt template stile call center ai template DDT (main data + sub data) e creare le translations

const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

// Funzione per generare prompt template basati sul tipo di dato (MAIN DATA)
function getStepPromptsForKind(kind, label) {
  const templatePrefix = `template.${kind}`;
  const fieldLabel = label || kind;

  // Prompt generici (usati come fallback) - struttura uniforme con chiavi multiple
  const genericPrompts = {
    start: {
      keys: [`${templatePrefix}.start.prompt1`],
      translations: {
        [`${templatePrefix}.start.prompt1`]: {
          en: `${fieldLabel}?`,
          it: `${fieldLabel}?`,
          pt: `${fieldLabel}?`
        }
      }
    },
    noMatch: {
      keys: [
        `${templatePrefix}.noMatch.prompt1`,
        `${templatePrefix}.noMatch.prompt2`
      ],
      translations: {
        [`${templatePrefix}.noMatch.prompt1`]: {
          en: "Sorry, can you repeat?",
          it: "Scusi, può ripetere?",
          pt: "Desculpe, pode repetir?"
        },
        [`${templatePrefix}.noMatch.prompt2`]: {
          en: "I didn't catch that, can you repeat?",
          it: "Non ho capito, può ripetere?",
          pt: "Não entendi, pode repetir?"
        }
      }
    },
    noInput: {
      keys: [
        `${templatePrefix}.noInput.prompt1`,
        `${templatePrefix}.noInput.prompt2`
      ],
      translations: {
        [`${templatePrefix}.noInput.prompt1`]: {
          en: "Can you repeat?",
          it: "Può ripetere?",
          pt: "Pode repetir?"
        },
        [`${templatePrefix}.noInput.prompt2`]: {
          en: "I didn't hear, can you repeat?",
          it: "Non ho sentito, può ripetere?",
          pt: "Não ouvi, pode repetir?"
        }
      }
    },
    confirmation: {
      keys: [`${templatePrefix}.confirmation.prompt1`],
      translations: {
        [`${templatePrefix}.confirmation.prompt1`]: {
          en: "{input}, right?",
          it: "{input}, giusto?",
          pt: "{input}, certo?"
        }
      }
    },
    notConfirmed: {
      keys: [`${templatePrefix}.notConfirmed.prompt1`],
      translations: {
        [`${templatePrefix}.notConfirmed.prompt1`]: {
          en: "No problem. {fieldLabel}?",
          it: "Nessun problema. {fieldLabel}?",
          pt: "Sem problema. {fieldLabel}?"
        }
      }
    },
    success: {
      keys: [`${templatePrefix}.success.prompt1`],
      translations: {
        [`${templatePrefix}.success.prompt1`]: {
          en: "Perfect, thanks.",
          it: "Perfetto, grazie.",
          pt: "Perfeito, obrigado."
        }
      }
    }
  };

  // Prompt specifici per tipo
  const specificPrompts = {
    phone: {
      start: {
        keys: [`${templatePrefix}.start.prompt1`],
        translations: {
          [`${templatePrefix}.start.prompt1`]: {
            en: "Phone number?",
            it: "Numero di telefono?",
            pt: "Número de telefone?"
          }
        }
      },
      noMatch: {
        keys: [
          `${templatePrefix}.noMatch.prompt1`,
          `${templatePrefix}.noMatch.prompt2`
        ],
        translations: {
          [`${templatePrefix}.noMatch.prompt1`]: {
            en: "Sorry, can you repeat the number?",
            it: "Scusi, può ripetere il numero?",
            pt: "Desculpe, pode repetir o número?"
          },
          [`${templatePrefix}.noMatch.prompt2`]: {
            en: "I didn't catch the number, can you repeat?",
            it: "Non ho capito il numero, può ripetere?",
            pt: "Não entendi o número, pode repetir?"
          }
        }
      },
      noInput: {
        keys: [
          `${templatePrefix}.noInput.prompt1`,
          `${templatePrefix}.noInput.prompt2`
        ],
        translations: {
          [`${templatePrefix}.noInput.prompt1`]: {
            en: "Can you repeat the number?",
            it: "Può ripetere il numero?",
            pt: "Pode repetir o número?"
          },
          [`${templatePrefix}.noInput.prompt2`]: {
            en: "I didn't hear, can you repeat the phone number?",
            it: "Non ho sentito, può ripetere il numero di telefono?",
            pt: "Não ouvi, pode repetir o número de telefone?"
          }
        }
      },
      confirmation: {
        keys: [`${templatePrefix}.confirmation.prompt1`],
        translations: {
          [`${templatePrefix}.confirmation.prompt1`]: {
            en: "{input}, right?",
            it: "{input}, giusto?",
            pt: "{input}, certo?"
          }
        }
      }
    },
    email: {
      start: {
        keys: [`${templatePrefix}.start.prompt1`],
        translations: {
          [`${templatePrefix}.start.prompt1`]: {
            en: "Email address?",
            it: "Indirizzo email?",
            pt: "Endereço de email?"
          }
        }
      },
      noMatch: {
        keys: [
          `${templatePrefix}.noMatch.prompt1`,
          `${templatePrefix}.noMatch.prompt2`
        ],
        translations: {
          [`${templatePrefix}.noMatch.prompt1`]: {
            en: "Sorry, can you repeat the email?",
            it: "Scusi, può ripetere l'email?",
            pt: "Desculpe, pode repetir o email?"
          },
          [`${templatePrefix}.noMatch.prompt2`]: {
            en: "I didn't catch the email, can you repeat?",
            it: "Non ho capito l'email, può ripetere?",
            pt: "Não entendi o email, pode repetir?"
          }
        }
      },
      noInput: {
        keys: [
          `${templatePrefix}.noInput.prompt1`,
          `${templatePrefix}.noInput.prompt2`
        ],
        translations: {
          [`${templatePrefix}.noInput.prompt1`]: {
            en: "Can you repeat the email?",
            it: "Può ripetere l'email?",
            pt: "Pode repetir o email?"
          },
          [`${templatePrefix}.noInput.prompt2`]: {
            en: "I didn't hear, can you repeat the email address?",
            it: "Non ho sentito, può ripetere l'indirizzo email?",
            pt: "Não ouvi, pode repetir o endereço de email?"
          }
        }
      },
      confirmation: {
        keys: [`${templatePrefix}.confirmation.prompt1`],
        translations: {
          [`${templatePrefix}.confirmation.prompt1`]: {
            en: "{input}, right?",
            it: "{input}, giusto?",
            pt: "{input}, certo?"
          }
        }
      }
    },
    date: {
      start: {
        keys: [`${templatePrefix}.start.prompt1`],
        translations: {
          [`${templatePrefix}.start.prompt1`]: {
            en: "Date of birth?",
            it: "Data di nascita?",
            pt: "Data de nascimento?"
          }
        }
      },
      noMatch: {
        keys: [
          `${templatePrefix}.noMatch.prompt1`,
          `${templatePrefix}.noMatch.prompt2`
        ],
        translations: {
          [`${templatePrefix}.noMatch.prompt1`]: {
            en: "Sorry, can you repeat the date?",
            it: "Scusi, può ripetere la data?",
            pt: "Desculpe, pode repetir a data?"
          },
          [`${templatePrefix}.noMatch.prompt2`]: {
            en: "I didn't catch the date, can you repeat?",
            it: "Non ho capito la data, può ripetere?",
            pt: "Não entendi a data, pode repetir?"
          }
        }
      },
      noInput: {
        keys: [
          `${templatePrefix}.noInput.prompt1`,
          `${templatePrefix}.noInput.prompt2`
        ],
        translations: {
          [`${templatePrefix}.noInput.prompt1`]: {
            en: "Can you repeat the date?",
            it: "Può ripetere la data?",
            pt: "Pode repetir a data?"
          },
          [`${templatePrefix}.noInput.prompt2`]: {
            en: "I didn't hear, can you repeat the date of birth?",
            it: "Non ho sentito, può ripetere la data di nascita?",
            pt: "Não ouvi, pode repetir a data de nascimento?"
          }
        }
      },
      confirmation: {
        keys: [`${templatePrefix}.confirmation.prompt1`],
        translations: {
          [`${templatePrefix}.confirmation.prompt1`]: {
            en: "{input}, right?",
            it: "{input}, giusto?",
            pt: "{input}, certo?"
          }
        }
      }
    },
    name: {
      start: {
        keys: [`${templatePrefix}.start.prompt1`],
        translations: {
          [`${templatePrefix}.start.prompt1`]: {
            en: "Name?",
            it: "Nome?",
            pt: "Nome?"
          }
        }
      },
      noMatch: {
        keys: [
          `${templatePrefix}.noMatch.prompt1`,
          `${templatePrefix}.noMatch.prompt2`
        ],
        translations: {
          [`${templatePrefix}.noMatch.prompt1`]: {
            en: "Sorry, can you repeat the name?",
            it: "Scusi, può ripetere il nome?",
            pt: "Desculpe, pode repetir o nome?"
          },
          [`${templatePrefix}.noMatch.prompt2`]: {
            en: "I didn't catch the name, can you repeat?",
            it: "Non ho capito il nome, può ripetere?",
            pt: "Não entendi o nome, pode repetir?"
          }
        }
      },
      noInput: {
        keys: [
          `${templatePrefix}.noInput.prompt1`,
          `${templatePrefix}.noInput.prompt2`
        ],
        translations: {
          [`${templatePrefix}.noInput.prompt1`]: {
            en: "Can you repeat the name?",
            it: "Può ripetere il nome?",
            pt: "Pode repetir o nome?"
          },
          [`${templatePrefix}.noInput.prompt2`]: {
            en: "I didn't hear, can you repeat the name?",
            it: "Non ho sentito, può ripetere il nome?",
            pt: "Não ouvi, pode repetir o nome?"
          }
        }
      },
      confirmation: {
        keys: [`${templatePrefix}.confirmation.prompt1`],
        translations: {
          [`${templatePrefix}.confirmation.prompt1`]: {
            en: "{input}, right?",
            it: "{input}, giusto?",
            pt: "{input}, certo?"
          }
        }
      }
    },
    time: {
      start: {
        keys: [`${templatePrefix}.start.prompt1`],
        translations: {
          [`${templatePrefix}.start.prompt1`]: {
            en: "Time?",
            it: "Ora?",
            pt: "Que horas?"
          }
        }
      },
      noMatch: {
        keys: [
          `${templatePrefix}.noMatch.prompt1`,
          `${templatePrefix}.noMatch.prompt2`
        ],
        translations: {
          [`${templatePrefix}.noMatch.prompt1`]: {
            en: "Sorry, can you repeat the time?",
            it: "Scusi, può ripetere l'ora?",
            pt: "Desculpe, pode repetir a hora?"
          },
          [`${templatePrefix}.noMatch.prompt2`]: {
            en: "I didn't catch the time, can you repeat?",
            it: "Non ho capito l'ora, può ripetere?",
            pt: "Não entendi a hora, pode repetir?"
          }
        }
      },
      noInput: {
        keys: [
          `${templatePrefix}.noInput.prompt1`,
          `${templatePrefix}.noInput.prompt2`
        ],
        translations: {
          [`${templatePrefix}.noInput.prompt1`]: {
            en: "Can you repeat the time?",
            it: "Può ripetere l'ora?",
            pt: "Pode repetir a hora?"
          },
          [`${templatePrefix}.noInput.prompt2`]: {
            en: "I didn't hear, can you repeat the time?",
            it: "Non ho sentito, può ripetere l'ora?",
            pt: "Não ouvi, pode repetir a hora?"
          }
        }
      },
      confirmation: {
        keys: [`${templatePrefix}.confirmation.prompt1`],
        translations: {
          [`${templatePrefix}.confirmation.prompt1`]: {
            en: "{input}, right?",
            it: "{input}, giusto?",
            pt: "{input}, certo?"
          }
        }
      },
      notConfirmed: {
        keys: [`${templatePrefix}.notConfirmed.prompt1`],
        translations: {
          [`${templatePrefix}.notConfirmed.prompt1`]: {
            en: "No problem. Time?",
            it: "Nessun problema. Ora?",
            pt: "Sem problema. Que horas?"
          }
        }
      },
      success: {
        keys: [`${templatePrefix}.success.prompt1`],
        translations: {
          [`${templatePrefix}.success.prompt1`]: {
            en: "Perfect, thanks.",
            it: "Perfetto, grazie.",
            pt: "Perfeito, obrigado."
          }
        }
      }
    }
  };

  // Usa prompt specifici se disponibili, altrimenti generici
  const prompts = specificPrompts[kind] || {};

  // Costruisci l'oggetto stepPrompts
  const stepPrompts = {
    start: prompts.start?.keys || genericPrompts.start.keys,
    noMatch: prompts.noMatch?.keys || genericPrompts.noMatch.keys,
    noInput: prompts.noInput?.keys || genericPrompts.noInput.keys,
    confirmation: prompts.confirmation?.keys || genericPrompts.confirmation.keys,
    notConfirmed: prompts.notConfirmed?.keys || genericPrompts.notConfirmed.keys,
    success: prompts.success?.keys || genericPrompts.success.keys
  };

  // Raccogli tutte le translations - struttura uniforme
  const allTranslations = {};

  // Aggiungi translations per start
  if (prompts.start?.translations) {
    Object.assign(allTranslations, prompts.start.translations);
  } else {
    Object.assign(allTranslations, genericPrompts.start.translations);
  }

  // Aggiungi translations per noMatch
  if (prompts.noMatch?.translations) {
    Object.assign(allTranslations, prompts.noMatch.translations);
  } else {
    Object.assign(allTranslations, genericPrompts.noMatch.translations);
  }

  // Aggiungi translations per noInput
  if (prompts.noInput?.translations) {
    Object.assign(allTranslations, prompts.noInput.translations);
  } else {
    Object.assign(allTranslations, genericPrompts.noInput.translations);
  }

  // Aggiungi translations per confirmation
  if (prompts.confirmation?.translations) {
    Object.assign(allTranslations, prompts.confirmation.translations);
  } else {
    Object.assign(allTranslations, genericPrompts.confirmation.translations);
  }

  // Aggiungi translations per notConfirmed
  if (prompts.notConfirmed?.translations) {
    Object.assign(allTranslations, prompts.notConfirmed.translations);
  } else {
    Object.assign(allTranslations, genericPrompts.notConfirmed.translations);
  }

  // Aggiungi translations per success
  if (prompts.success?.translations) {
    Object.assign(allTranslations, prompts.success.translations);
  } else {
    Object.assign(allTranslations, genericPrompts.success.translations);
  }

  return { stepPrompts, translations: allTranslations };
}

// Funzione per generare prompt sintetici per subData
function getStepPromptsForSubData(subDataItem) {
  const subLabel = subDataItem.label || subDataItem.name || 'field';
  // Usa il label del sub data per creare la chiave (es. "Giorno", "Ora", "Minuti")
  const subLabelLower = subLabel.toLowerCase();
  const templatePrefix = `template.sub.${subLabelLower}`;

  // Prompt sintetici e generici per subData
  const stepPrompts = {
    start: [`${templatePrefix}.start.prompt1`],
    noMatch: [
      `${templatePrefix}.noMatch.prompt1`,
      `${templatePrefix}.noMatch.prompt2`
    ],
    noInput: [
      `${templatePrefix}.noInput.prompt1`,
      `${templatePrefix}.noInput.prompt2`
    ],
    confirmation: [`${templatePrefix}.confirmation.prompt1`],
    notConfirmed: [`${templatePrefix}.notConfirmed.prompt1`],
    success: [`${templatePrefix}.success.prompt1`]
  };

  // Traduzioni: start è specifico per il sub data, gli altri sono generici
  // Mappa i nomi comuni dei sub-data alle traduzioni corrette
  const subLabelTranslations = {
    'Hour': { en: 'Hour?', it: 'Ora?', pt: 'Hora?' },
    'Minute': { en: 'Minute?', it: 'Minuto?', pt: 'Minuto?' },
    'Seconds': { en: 'Seconds?', it: 'Secondi?', pt: 'Segundos?' },
    'Day': { en: 'Day?', it: 'Giorno?', pt: 'Dia?' },
    'Month': { en: 'Month?', it: 'Mese?', pt: 'Mês?' },
    'Year': { en: 'Year?', it: 'Anno?', pt: 'Ano?' }
  };

  const startTranslations = subLabelTranslations[subLabel] || {
    en: `${subLabel}?`,
    it: `${subLabel}?`,
    pt: `${subLabel}?`
  };

  const translations = {
    // START: Solo il nome del sub data, molto sintetico
    [`${templatePrefix}.start.prompt1`]: startTranslations,
    // NOMATCH: Generico, uguale per tutti i sub data
    [`${templatePrefix}.noMatch.prompt1`]: {
      en: "Sorry, I didn't understand. Can you repeat?",
      it: "Scusi, non ho capito. Può ripetere?",
      pt: "Desculpe, não entendi. Pode repetir?"
    },
    [`${templatePrefix}.noMatch.prompt2`]: {
      en: "I didn't catch that. Can you repeat?",
      it: "Non ho capito. Può ripetere?",
      pt: "Não entendi. Pode repetir?"
    },
    // NOINPUT: Generico, uguale per tutti i sub data
    [`${templatePrefix}.noInput.prompt1`]: {
      en: "I didn't hear. Can you repeat?",
      it: "Non ho sentito. Può ripetere?",
      pt: "Não ouvi. Pode repetir?"
    },
    [`${templatePrefix}.noInput.prompt2`]: {
      en: "Can you repeat?",
      it: "Può ripetere?",
      pt: "Pode repetir?"
    },
    // CONFIRMATION: Breve
    [`${templatePrefix}.confirmation.prompt1`]: {
      en: "{input}, right?",
      it: "{input}, giusto?",
      pt: "{input}, certo?"
    },
    // NOTCONFIRMED: Breve con il sub data
    [`${templatePrefix}.notConfirmed.prompt1`]: {
      en: `No problem. ${subLabel}?`,
      it: `Nessun problema. ${subLabel}?`,
      pt: `Sem problema. ${subLabel}?`
    },
    // SUCCESS: Molto breve
    [`${templatePrefix}.success.prompt1`]: {
      en: "Perfect, thanks.",
      it: "Perfetto, grazie.",
      pt: "Perfeito, obrigado."
    }
  };

  return { stepPrompts, translations };
}

async function updateTemplates() {
  const client = new MongoClient(uri);

  try {
    console.log('🔗 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected successfully\n');

    const db = client.db(dbFactory);
    const templatesCollection = db.collection('type_templates');
    const translationsCollection = db.collection('Translations');

    const templates = await templatesCollection.find({}).toArray();
    console.log(`📋 Found ${templates.length} templates\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const failed = [];

    for (const template of templates) {
      const kind = template.name || template.type;
      const label = template.label || kind;

      try {
        console.log(`\n🔄 Processing ${kind}...`);

        // Genera stepPrompts e translations per MAIN DATA
        const { stepPrompts, translations } = getStepPromptsForKind(kind, label);

        // Aggiorna il template con stepPrompts
        await templatesCollection.updateOne(
          { _id: template._id },
          {
            $set: {
              stepPrompts: stepPrompts,
              updatedAt: new Date()
            }
          }
        );

        console.log(`  ✅ Added stepPrompts to template`);

        // Inserisci/aggiorna le translations
        for (const [key, value] of Object.entries(translations)) {
          await translationsCollection.updateOne(
            { _id: key },
            {
              $set: value,
              $setOnInsert: { _id: key }
            },
            { upsert: true }
          );
        }

        console.log(`  ✅ Added ${Object.keys(translations).length} translation keys`);
        updated++;

      } catch (error) {
        console.error(`  ❌ Error processing ${kind}:`, error.message);
        failed.push({ kind, error: error.message });
        errors++;
      }
    }

    console.log(`\n\n📊 Summary (Main Data):`);
    console.log(`  ✅ Updated: ${updated}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);

    if (failed.length > 0) {
      console.log(`\n❌ Failed templates:`);
      failed.forEach(f => console.log(`  - ${f.kind}: ${f.error}`));
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

async function updateSubDataPrompts() {
  const client = new MongoClient(uri);

  try {
    console.log('🔗 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected successfully\n');

    const db = client.db(dbFactory);
    const templatesCollection = db.collection('type_templates');
    const translationsCollection = db.collection('Translations');

    const templates = await templatesCollection.find({}).toArray();
    console.log(`📋 Found ${templates.length} templates\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const failed = [];

    for (const template of templates) {
      const kind = template.name || template.type;
      const label = template.label || kind;

      try {
        console.log(`\n🔄 Processing ${kind}...`);

        // Controlla se il template ha subData
        const subData = template.subData || [];
        if (!Array.isArray(subData) || subData.length === 0) {
          console.log(`  ⏭️  No subData found, skipping`);
          skipped++;
          continue;
        }

        console.log(`  📦 Found ${subData.length} subData items`);

        // Processa ogni subData
        const subDataWithPrompts = [];
        const allSubDataTranslations = {};

        for (const subDataItem of subData) {
          const subLabel = subDataItem.label || subDataItem.name || 'field';
          console.log(`    🔄 Processing subData: ${subLabel}...`);

          // Genera stepPrompts e translations per questo subData
          const { stepPrompts, translations } = getStepPromptsForSubData(subDataItem);

          // Aggiungi stepPrompts al subData
          subDataWithPrompts.push({
            ...subDataItem,
            stepPrompts: stepPrompts
          });

          // Raccogli tutte le translations
          Object.assign(allSubDataTranslations, translations);

          console.log(`      ✅ Added stepPrompts with ${Object.keys(translations).length} translation keys`);
        }

        // Aggiorna il template con subData che hanno stepPrompts
        await templatesCollection.updateOne(
          { _id: template._id },
          {
            $set: {
              subData: subDataWithPrompts,
              updatedAt: new Date()
            }
          }
        );

        console.log(`  ✅ Updated template with ${subDataWithPrompts.length} subData items with stepPrompts`);

        // Inserisci/aggiorna le translations per i subData
        for (const [key, value] of Object.entries(allSubDataTranslations)) {
          await translationsCollection.updateOne(
            { _id: key },
            {
              $set: value,
              $setOnInsert: { _id: key }
            },
            { upsert: true }
          );
        }

        console.log(`  ✅ Added ${Object.keys(allSubDataTranslations).length} subData translation keys`);
        updated++;

      } catch (error) {
        console.error(`  ❌ Error processing ${kind}:`, error.message);
        failed.push({ kind, error: error.message });
        errors++;
      }
    }

    console.log(`\n\n📊 Summary (Sub Data):`);
    console.log(`  ✅ Updated: ${updated}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);

    if (failed.length > 0) {
      console.log(`\n❌ Failed templates:`);
      failed.forEach(f => console.log(`  - ${f.kind}: ${f.error}`));
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Esegui entrambi gli script in sequenza
async function runAll() {
  console.log('🚀 Starting update process...\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('STEP 1: Updating MAIN DATA prompts');
  console.log('═══════════════════════════════════════════════════════════\n');

  await updateTemplates();

  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('STEP 2: Updating SUB DATA prompts');
  console.log('═══════════════════════════════════════════════════════════\n');

  await updateSubDataPrompts();

  console.log('\n\n✅ All updates completed!');
}

runAll().catch(console.error);