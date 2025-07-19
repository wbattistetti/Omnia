const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const { ObjectId } = require('mongodb');

const app = express();
app.use(cors());
app.use(express.json());

// Sostituisci con la tua stringa di connessione Atlas!
const uri = 'mongodb+srv://walterbattistetti:kVywZA7WR3ykhaFu@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const client = new MongoClient(uri);

app.post('/projects', async (req, res) => {
  try {
    console.log('[DEBUG BACKEND] Ricevuto dal frontend:', req.body);
    await client.connect();
    const db = client.db('omnia'); // Usa il nome corretto del database
    const result = await db.collection('projects').insertOne(req.body);
    // LOG DOPO IL SALVATAGGIO
    const saved = await db.collection('projects').findOne({ _id: result.insertedId });
    console.log('[DEBUG BACKEND] Salvato su MongoDB:', saved);
    res.json({ id: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/projects/all', async (req, res) => {
  try {
    await client.connect();
    const db = client.db('omnia');
    const projects = await db.collection('projects')
      .find({})
      .sort({ _id: -1 })
      .toArray();
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/projects/:id', async (req, res) => {
  try {
    await client.connect();
    const db = client.db('omnia'); // Usa il nome del tuo database
    const project = await db.collection('projects').findOne({ _id: new ObjectId(req.params.id) });
    if (!project) return res.status(404).json({ error: 'Progetto non trovato' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/projects', async (req, res) => {
  try {
    await client.connect();
    const db = client.db('omnia');
    const projects = await db.collection('projects')
      .find({}, { projection: { name: 1 } })
      .sort({ _id: -1 })
      .limit(10)
      .toArray();
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/projects/:id', async (req, res) => {
  try {
    await client.connect();
    const db = client.db('omnia');
    const result = await db.collection('projects').deleteOne({ _id: new ObjectId(req.params.id) });
    if (result.deletedCount === 1) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Progetto non trovato' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/projects', async (req, res) => {
  try {
    await client.connect();
    const db = client.db('omnia');
    const result = await db.collection('projects').deleteMany({});
    res.json({ deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3100, () => {
  console.log('Backend API pronta su http://localhost:3100');
}); 