// Script da lanciare con: mongosh "mongodb+srv://<user>:<password>@omnia-db.a5j05mj.mongodb.net/" crea_industries_factory.js

// 1. Prendi i documenti da test.Industries
const docs = db.getSiblingDB('test').Industries.find().toArray();
// 2. Rimuovi il campo _id da ogni documento
docs.forEach(doc => { delete doc._id; });
// 3. Passa al database factory
use factory;
// 4. Cancella la collection se vuoi sovrascrivere (decommenta la riga sotto se serve)
// db.Industries.drop();
// 5. Inserisci tutti i documenti nella collection Industries di factory
db.Industries.insertMany(docs);

print('Industries copiate da test a factory!'); 