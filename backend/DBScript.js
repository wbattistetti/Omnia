// update_templates_multilingual.js
// Script per aggiornare i template nel database con:
// 1. Synonyms multilingua (IT, EN, PT)
// 2. Countries per template country-specific
// 3. SubData migliorati per phone, email, currency, time
// 4. Rimozione address semplice, rinomina complexAddress in address

const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

// Mapping synonyms multilingua per ogni template
const multilingualSynonyms = {
  url: {
    it: ["url", "sito web", "sito", "indirizzo web", "link"],
    en: ["url", "website", "site", "web address", "link"],
    pt: ["url", "site", "sítio", "endereço web", "link"]
  },
  name: {
    it: ["nome", "nome completo", "cognome", "nome e cognome"],
    en: ["name", "full name", "surname", "first name", "last name"],
    pt: ["nome", "nome completo", "sobrenome", "primeiro nome", "último nome"]
  },
  date: {
    it: ["data", "data di nascita", "data nascita", "dob", "compleanno"],
    en: ["date", "date of birth", "birth date", "dob", "birthday"],
    pt: ["data", "data de nascimento", "data nascimento", "aniversário"]
  },
  phone: {
    it: ["telefono", "cellulare", "numero di telefono", "tel", "mobile"],
    en: ["phone", "telephone", "mobile", "cell", "phone number"],
    pt: ["telefone", "celular", "número de telefone", "móvel"]
  },
  mobilePhone: {
    it: ["cellulare", "mobile", "telefono cellulare", "numero cellulare"],
    en: ["mobile", "cell", "cellphone", "mobile phone", "cell phone"],
    pt: ["celular", "móvel", "telemóvel", "telefone celular"]
  },
  wiredPhone: {
    it: ["telefono fisso", "fisso", "telefono", "numero fisso"],
    en: ["landline", "fixed phone", "wired phone", "home phone"],
    pt: ["telefone fixo", "fixo", "telefone residencial"]
  },
  anyPhone: {
    it: ["telefono", "numero di telefono", "tel", "contatto telefonico"],
    en: ["phone", "telephone", "phone number", "contact number"],
    pt: ["telefone", "número de telefone", "contato telefônico"]
  },
  email: {
    it: ["email", "e-mail", "posta elettronica", "indirizzo email", "mail"],
    en: ["email", "e-mail", "mail", "email address"],
    pt: ["email", "e-mail", "correio eletrônico", "endereço de email"]
  },
  vatNumber: {
    it: ["partita iva", "iva", "p.iva", "numero iva"],
    en: ["vat", "vat number", "tax id", "vat id"],
    pt: ["nif", "nif número", "iva", "número iva"]
  },
  currency: {
    it: ["importo", "somma", "valore", "prezzo", "costo", "euro", "euro"],
    en: ["amount", "sum", "value", "price", "cost", "currency", "money"],
    pt: ["valor", "montante", "preço", "custo", "moeda", "dinheiro"]
  },
  generic: {
    it: ["testo", "campo testo", "valore", "dato"],
    en: ["text", "text field", "value", "data"],
    pt: ["texto", "campo texto", "valor", "dado"]
  },
  address: {
    it: ["indirizzo", "residenza", "domicilio", "via", "civico"],
    en: ["address", "residence", "street", "location"],
    pt: ["endereço", "residência", "rua", "localização"]
  },
  number: {
    it: ["numero", "valore numerico", "cifra"],
    en: ["number", "numeric value", "digit"],
    pt: ["número", "valor numérico", "dígito"]
  },
  taxCode: {
    it: ["codice fiscale", "cf", "codice fiscale italiano"],
    en: ["tax code", "fiscal code", "tax id"],
    pt: ["código fiscal", "nif", "número fiscal"]
  },
  accountNumber: {
    it: ["numero conto", "conto", "numero account"],
    en: ["account number", "account", "account id"],
    pt: ["número da conta", "conta", "número de conta"]
  },
  iban: {
    it: ["iban", "coordinate bancarie", "conto corrente"],
    en: ["iban", "bank account", "bank details"],
    pt: ["iban", "conta bancária", "dados bancários"]
  },
  postalCode: {
    it: ["cap", "codice postale", "zip"],
    en: ["postal code", "zip code", "zip", "postcode"],
    pt: ["código postal", "cep", "código de área"]
  },
  podPdrCode: {
    it: ["pod", "pdr", "codice pod", "codice pdr", "punto di prelievo"],
    en: ["pod", "pdr", "pod code", "pdr code", "supply point"],
    pt: ["pod", "pdr", "código pod", "código pdr", "ponto de fornecimento"]
  },
  time: {
    it: ["ora", "orario", "tempo", "orario di appuntamento"],
    en: ["time", "hour", "schedule", "appointment time"],
    pt: ["hora", "horário", "tempo", "horário de agendamento"]
  }
};

async function updateTemplates() {
  const client = new MongoClient(uri);

  try {
    console.log('🔗 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected successfully\n');

    const db = client.db(dbFactory);
    const collection = db.collection('type_templates');

    const updates = [];

    // 1. PHONE - Aggiorna con subData: Country Code, Prefix (opzionale), Number, phoneType
    updates.push({
      name: 'phone',
      update: {
        $set: {
          subData: [
            {
              label: "Country code",
              type: "number",
              icon: "Globe",
              examples: ["39", "1", "44", "33", "49"],
              constraints: [{ type: "required" }]
            },
            {
              label: "Prefix",
              type: "number",
              icon: "Hash",
              examples: ["333", "347", "320", "02", "06"],
              constraints: [] // Opzionale
            },
            {
              label: "Number",
              type: "number",
              icon: "Phone",
              examples: ["1234567", "12345678", "5551234"],
              constraints: [
                { type: "required" },
                { type: "minLength", value: 6 },
                { type: "maxLength", value: 15 }
              ]
            }
          ],
          synonyms: multilingualSynonyms.phone,
          updatedAt: new Date()
        }
      }
    });

    // 2. Crea 3 template phone separati: mobilePhone, wiredPhone, anyPhone
    const mobilePhoneTemplate = {
      id: "template_mobilePhone",
      name: "mobilePhone",
      label: "Mobile Phone",
      type: "phone",
      icon: "Smartphone",
      subData: [
        {
          label: "Country code",
          type: "number",
          icon: "Globe",
          examples: ["39", "1", "44", "33", "49"],
          constraints: [{ type: "required" }]
        },
        {
          label: "Prefix",
          type: "number",
          icon: "Hash",
          examples: ["333", "347", "320", "329"],
          constraints: [{ type: "required" }]
        },
        {
          label: "Number",
          type: "number",
          icon: "Phone",
          examples: ["1234567", "12345678"],
          constraints: [
            { type: "required" },
            { type: "minLength", value: 6 },
            { type: "maxLength", value: 10 }
          ]
        }
      ],
      synonyms: multilingualSynonyms.mobilePhone,
      constraints: [],
      metadata: {
        description: "Template per tipo di dato: Mobile Phone",
        version: "1.0",
        tags: ["phone", "mobile", "cell"]
      },
      permissions: {
        canEdit: true,
        canDelete: false,
        canShare: true
      },
      auditLog: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const wiredPhoneTemplate = {
      id: "template_wiredPhone",
      name: "wiredPhone",
      label: "Wired Phone",
      type: "phone",
      icon: "Phone",
      subData: [
        {
          label: "Country code",
          type: "number",
          icon: "Globe",
          examples: ["39", "1", "44", "33", "49"],
          constraints: [{ type: "required" }]
        },
        {
          label: "Area code",
          type: "number",
          icon: "Hash",
          examples: ["02", "06", "010", "020"],
          constraints: [{ type: "required" }]
        },
        {
          label: "Number",
          type: "number",
          icon: "Phone",
          examples: ["1234567", "12345678", "5551234"],
          constraints: [
            { type: "required" },
            { type: "minLength", value: 6 },
            { type: "maxLength", value: 10 }
          ]
        }
      ],
      synonyms: multilingualSynonyms.wiredPhone,
      constraints: [],
      metadata: {
        description: "Template per tipo di dato: Wired Phone",
        version: "1.0",
        tags: ["phone", "landline", "fixed"]
      },
      permissions: {
        canEdit: true,
        canDelete: false,
        canShare: true
      },
      auditLog: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const anyPhoneTemplate = {
      id: "template_anyPhone",
      name: "anyPhone",
      label: "Phone (any type)",
      type: "phone",
      icon: "Phone",
      subData: [
        {
          label: "Country code",
          type: "number",
          icon: "Globe",
          examples: ["39", "1", "44", "33", "49"],
          constraints: [{ type: "required" }]
        },
        {
          label: "Prefix/Area code",
          type: "number",
          icon: "Hash",
          examples: ["333", "02", "06"],
          constraints: [] // Opzionale
        },
        {
          label: "Number",
          type: "number",
          icon: "Phone",
          examples: ["1234567", "12345678"],
          constraints: [
            { type: "required" },
            { type: "minLength", value: 6 },
            { type: "maxLength", value: 15 }
          ]
        }
      ],
      synonyms: multilingualSynonyms.anyPhone,
      constraints: [],
      metadata: {
        description: "Template per tipo di dato: Phone (any type)",
        version: "1.0",
        tags: ["phone", "any"]
      },
      permissions: {
        canEdit: true,
        canDelete: false,
        canShare: true
      },
      auditLog: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // 3. EMAIL - Aggiorna con subData: Label, Domain
    updates.push({
      name: 'email',
      update: {
        $set: {
          subData: [
            {
              label: "Label",
              type: "generic",
              icon: "User",
              examples: ["mario.rossi", "user", "info"],
              constraints: [
                { type: "required" },
                { type: "minLength", value: 1 },
                { type: "maxLength", value: 64 }
              ]
            },
            {
              label: "Domain",
              type: "generic",
              icon: "Globe",
              examples: ["@gmail.com", "@example.com", "@company.it"],
              constraints: [
                { type: "required" },
                { type: "pattern", value: "^@[\\w\\.-]+\\.[a-zA-Z]{2,}$" }
              ]
            }
          ],
          synonyms: multilingualSynonyms.email,
          updatedAt: new Date()
        }
      }
    });

    // 4. CURRENCY - Aggiorna con subData: Amount, Currency Type
    updates.push({
      name: 'currency',
      update: {
        $set: {
          subData: [
            {
              label: "Amount",
              type: "number",
              icon: "DollarSign",
              examples: ["150.50", "1000", "45.00"],
              constraints: [
                { type: "required" },
                { type: "min", value: 0 }
              ]
            },
            {
              label: "Currency",
              type: "generic",
              icon: "Coins",
              examples: ["EUR", "USD", "GBP", "BRL"],
              constraints: [
                { type: "required" },
                { type: "pattern", value: "^[A-Z]{3}$" }
              ]
            }
          ],
          synonyms: multilingualSynonyms.currency,
          updatedAt: new Date()
        }
      }
    });

    // 5. TIME - Aggiorna con subData: Hour, Minute, Seconds (opzionale)
    updates.push({
      name: 'time',
      update: {
        $set: {
          subData: [
            {
              label: "Hour",
              type: "number",
              icon: "Clock",
              examples: ["14", "9", "18", "0"],
              constraints: [
                { type: "required" },
                { type: "min", value: 0 },
                { type: "max", value: 23 }
              ]
            },
            {
              label: "Minute",
              type: "number",
              icon: "Clock",
              examples: ["30", "0", "45", "15"],
              constraints: [
                { type: "required" },
                { type: "min", value: 0 },
                { type: "max", value: 59 }
              ]
            },
            {
              label: "Seconds",
              type: "number",
              icon: "Clock",
              examples: ["0", "30", "59"],
              constraints: [
                { type: "min", value: 0 },
                { type: "max", value: 59 }
              ]
              // Opzionale: no required constraint
            }
          ],
          synonyms: multilingualSynonyms.time,
          updatedAt: new Date()
        }
      }
    });

    // 6. ADDRESS - Rimuovi address semplice, rinomina complexAddress in address
    // Prima rimuovi address
    const addressToRemove = await collection.findOne({ name: 'address' });
    if (addressToRemove) {
      console.log('🗑️  Removing simple address template...');
      await collection.deleteOne({ name: 'address' });
      console.log('✅ Removed simple address\n');
    }

    // Poi rinomina complexAddress in address
    updates.push({
      name: 'complexAddress',
      update: {
        $set: {
          name: 'address',
          label: 'Address',
          synonyms: multilingualSynonyms.address,
          updatedAt: new Date()
        }
      },
      rename: true
    });

    // 7. Aggiungi synonyms multilingua a tutti gli altri template
    const allTemplates = await collection.find({}).toArray();
    for (const template of allTemplates) {
      const templateName = template.name;
      if (multilingualSynonyms[templateName] && !updates.find(u => u.name === templateName)) {
        updates.push({
          name: templateName,
          update: {
            $set: {
              synonyms: multilingualSynonyms[templateName],
              updatedAt: new Date()
            }
          }
        });
      }
    }

    // 8. Aggiungi countries ai template country-specific
    updates.push({
      name: 'taxCode',
      update: {
        $set: {
          countries: ["it-it"], // Codice fiscale italiano
          synonyms: multilingualSynonyms.taxCode,
          updatedAt: new Date()
        }
      }
    });

    updates.push({
      name: 'postalCode',
      update: {
        $set: {
          countries: ["it-it", "us-us", "gb-gb", "fr-fr", "de-de", "es-es", "pt-pt"], // Multi-country
          synonyms: multilingualSynonyms.postalCode,
          updatedAt: new Date()
        }
      }
    });

    updates.push({
      name: 'podPdrCode',
      update: {
        $set: {
          countries: ["it-it"], // Specifico per Italia
          synonyms: multilingualSynonyms.podPdrCode,
          updatedAt: new Date()
        }
      }
    });

    updates.push({
      name: 'iban',
      update: {
        $set: {
          countries: ["it-it", "gb-gb", "de-de", "fr-fr", "es-es", "pt-pt", "us-us"], // Multi-country (IBAN è standard internazionale ma formato varia)
          synonyms: multilingualSynonyms.iban,
          updatedAt: new Date()
        }
      }
    });

    // Esegui tutti gli aggiornamenti
    console.log('🔄 Starting template updates...\n');

    let updatedCount = 0;
    let createdCount = 0;

    for (const update of updates) {
      if (update.rename) {
        // Special case: rename complexAddress to address
        const result = await collection.updateOne(
          { name: update.name },
          update.update
        );
        if (result.modifiedCount > 0) {
          console.log(`✅ Renamed ${update.name} → address`);
          updatedCount++;
        }
      } else {
        const result = await collection.updateOne(
          { name: update.name },
          update.update,
          { upsert: false }
        );
        if (result.modifiedCount > 0) {
          console.log(`✅ Updated ${update.name}`);
          updatedCount++;
        }
      }
    }

    // Crea i nuovi template phone
    console.log('\n📝 Creating new phone templates...');

    for (const newTemplate of [mobilePhoneTemplate, wiredPhoneTemplate, anyPhoneTemplate]) {
      const existing = await collection.findOne({ name: newTemplate.name });
      if (existing) {
        const result = await collection.updateOne(
          { name: newTemplate.name },
          { $set: newTemplate }
        );
        if (result.modifiedCount > 0) {
          console.log(`✅ Updated ${newTemplate.name}`);
          updatedCount++;
        }
      } else {
        await collection.insertOne(newTemplate);
        console.log(`✅ Created ${newTemplate.name}`);
        createdCount++;
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`✅ Updated: ${updatedCount} templates`);
    console.log(`✅ Created: ${createdCount} templates`);
    console.log('='.repeat(80));

    // Verifica finale
    const finalCount = await collection.countDocuments({});
    console.log(`\n📊 Total templates in database: ${finalCount}`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n🔌 Connection closed');
  }
}

// Run
updateTemplates()
  .then(() => {
    console.log('\n✅ Update completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Update failed:', error);
    process.exit(1);
  });