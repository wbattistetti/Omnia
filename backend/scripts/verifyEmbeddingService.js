/**
 * Script: Verifica lo stato del servizio di embedding
 *
 * Verifica:
 * 1. Se il servizio Python FastAPI è in esecuzione
 * 2. Se l'endpoint /api/embeddings/compute risponde
 * 3. Se sentence-transformers è installato (tramite test)
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const EMBEDDING_SERVICE_URL = process.env.EMBEDDING_SERVICE_URL || 'http://localhost:8000';

// Helper function per fare fetch in Node.js senza dipendenze esterne
function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    const method = options.method || 'GET';
    const headers = options.headers || {};

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: headers
    };

    const req = protocol.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const response = {
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: res.headers,
          json: () => Promise.resolve(JSON.parse(data)),
          text: () => Promise.resolve(data)
        };
        resolve(response);
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

async function verifyEmbeddingService() {
  console.log('🔍 Verifica servizio di embedding\n');
  console.log(`📍 URL servizio: ${EMBEDDING_SERVICE_URL}\n`);

  // 1. Verifica se il servizio risponde al ping
  console.log('1️⃣ Verifica ping del servizio...');
  try {
    const pingResponse = await fetch(`${EMBEDDING_SERVICE_URL}/api/ping`);
    if (pingResponse.ok) {
      const pingData = await pingResponse.json();
      console.log('✅ Servizio Python FastAPI è in esecuzione');
      console.log(`   Risposta: ${JSON.stringify(pingData)}\n`);
    } else {
      console.log(`❌ Servizio risponde ma con errore: ${pingResponse.status} ${pingResponse.statusText}\n`);
    }
  } catch (error) {
    console.log(`❌ Servizio Python FastAPI NON è raggiungibile`);
    console.log(`   Errore: ${error.message}`);
    console.log(`   Verifica che il servizio sia in esecuzione su ${EMBEDDING_SERVICE_URL}\n`);
    return;
  }

  // 2. Verifica se l'endpoint /api/embeddings/compute esiste
  console.log('2️⃣ Verifica endpoint /api/embeddings/compute...');
  try {
    const testResponse = await fetch(`${EMBEDDING_SERVICE_URL}/api/embeddings/compute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'test' })
    });

    if (testResponse.ok) {
      const testData = await testResponse.json();
      console.log('✅ Endpoint /api/embeddings/compute funziona correttamente');
      console.log(`   Modello: ${testData.model || 'N/A'}`);
      console.log(`   Lunghezza embedding: ${testData.length || testData.embedding?.length || 'N/A'}\n`);
    } else {
      const errorText = await testResponse.text();
      let errorJson;
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        errorJson = { raw: errorText };
      }

      console.log(`❌ Endpoint restituisce errore: ${testResponse.status} ${testResponse.statusText}`);
      console.log(`   Dettaglio: ${errorJson.detail || errorJson.error || errorJson.raw || errorText}\n`);

      if (errorJson.detail && errorJson.detail.includes('sentence-transformers')) {
        console.log('⚠️  PROBLEMA IDENTIFICATO: sentence-transformers non è installato');
        console.log('   Soluzione: pip install sentence-transformers\n');
      } else if (errorJson.detail && errorJson.detail.includes('Failed to load model')) {
        console.log('⚠️  PROBLEMA IDENTIFICATO: Il modello non può essere caricato');
        console.log('   Verifica la connessione internet per scaricare il modello\n');
      }
    }
  } catch (error) {
    console.log(`❌ Errore durante la chiamata all'endpoint`);
    console.log(`   Errore: ${error.message}\n`);
  }

  // 3. Verifica tramite backend Node.js (se disponibile)
  console.log('3️⃣ Verifica tramite backend Node.js...');
  try {
    const nodeResponse = await fetch('http://localhost:3000/api/embeddings/compute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'test' })
    });

    if (nodeResponse.ok) {
      const nodeData = await nodeResponse.json();
      console.log('✅ Backend Node.js può comunicare con il servizio Python');
      console.log(`   Modello: ${nodeData.model || 'N/A'}\n`);
    } else {
      const errorText = await nodeResponse.text();
      console.log(`❌ Backend Node.js restituisce errore: ${nodeResponse.status}`);
      console.log(`   Dettaglio: ${errorText.substring(0, 200)}\n`);
    }
  } catch (error) {
    console.log(`⚠️  Backend Node.js non è raggiungibile o non è in esecuzione`);
    console.log(`   (Questo è normale se stai testando solo il servizio Python)\n`);
  }

  console.log('📊 REPORT FINALE:');
  console.log('─'.repeat(50));
  console.log('Se vedi errori, verifica:');
  console.log('1. Il servizio Python FastAPI è in esecuzione?');
  console.log('   → Verifica con: curl http://localhost:8000/api/ping');
  console.log('2. sentence-transformers è installato?');
  console.log('   → Installa con: pip install sentence-transformers');
  console.log('3. Il modello può essere scaricato?');
  console.log('   → Verifica la connessione internet');
  console.log('─'.repeat(50));
}

verifyEmbeddingService().catch(error => {
  console.error('❌ ERRORE FATALE:', error);
  process.exit(1);
});
