/**
 * Fix: DELETE /api/projects/catalog - Elimina anche i database
 *
 * Questo script verifica e corregge l'endpoint DELETE /api/projects/catalog
 * per assicurarsi che elimini anche i database dei progetti, non solo il catalogo.
 */

console.log(`
📋 ANALISI ENDPOINT DELETE /api/projects/catalog:

PROBLEMA ATTUALE:
- Elimina solo il catalogo (projects_catalog collection)
- NON elimina i database dei progetti
- Risultato: database orfani rimangono nel MongoDB

SOLUZIONE:
Modificare l'endpoint per:
1. Leggere tutti i progetti dal catalogo PRIMA di eliminarli
2. Per ogni progetto, eliminare il database usando project.dbName
3. Poi eliminare il catalogo

CODICE DA AGGIUNGERE:
`);

const fixCode = `
// DELETE all catalog
app.delete('/api/projects/catalog', async (req, res) => {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbProjects);
    const coll = db.collection('projects_catalog');

    // ✅ NUOVO: Leggi tutti i progetti PRIMA di eliminarli
    const allProjects = await coll.find({}).toArray();

    // ✅ NUOVO: Elimina i database di tutti i progetti
    let databasesDeleted = 0;
    let databasesErrors = 0;

    for (const project of allProjects) {
      if (project.dbName) {
        try {
          const projectDb = client.db(project.dbName);
          const collections = await projectDb.listCollections().toArray();
          if (collections.length > 0) {
            await projectDb.dropDatabase();
            databasesDeleted++;
            logInfo('Projects.deleteAll', { dbName: project.dbName, deleted: true });
          }
        } catch (dbError) {
          databasesErrors++;
          logWarn('Projects.deleteAll', { dbName: project.dbName, error: dbError.message });
        }
      }
    }

    // ✅ Elimina dal catalogo (dopo aver eliminato i database)
    const result = await coll.deleteMany({});

    logInfo('Projects.deleteAll', {
      catalogDeleted: result.deletedCount,
      databasesDeleted,
      databasesErrors
    });

    res.json({
      ok: true,
      catalogDeleted: result.deletedCount,
      databasesDeleted,
      databasesErrors
    });
  } catch (e) {
    logError('Projects.deleteAll', e);
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    await client.close();
  }
});
`;

console.log(fixCode);

