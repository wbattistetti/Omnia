/**
 * Dev/local: allinea Express con ApiServer sullo stesso OMNIA_INTERNAL_TOOL_DIAGNOSTIC_SECRET senza .env.
 * Se la variabile è già valorizzata (produzione, test, override manuale), non modifica nulla.
 * Altrimenti crea o legge %TEMP%/omnia-diagnostic-bridge.secret (create esclusiva wx, stesso contratto .NET).
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const SECRET_FILE_NAME = 'omnia-diagnostic-bridge.secret';

function ensureDiagnosticBridgeSecret() {
  const existing = process.env.OMNIA_INTERNAL_TOOL_DIAGNOSTIC_SECRET;
  if (existing && String(existing).trim()) {
    return String(existing).trim();
  }

  const fp = path.join(os.tmpdir(), SECRET_FILE_NAME);

  try {
    const fd = fs.openSync(fp, 'wx');
    try {
      const secret = crypto.randomBytes(32).toString('hex');
      fs.writeFileSync(fd, secret, 'utf8');
      process.env.OMNIA_INTERNAL_TOOL_DIAGNOSTIC_SECRET = secret;
      return secret;
    } finally {
      fs.closeSync(fd);
    }
  } catch (e) {
    if (e && e.code === 'EEXIST') {
      const secret = fs.readFileSync(fp, 'utf8').trim();
      if (secret) {
        process.env.OMNIA_INTERNAL_TOOL_DIAGNOSTIC_SECRET = secret;
        return secret;
      }
    }
    throw e;
  }
}

module.exports = { ensureDiagnosticBridgeSecret, SECRET_FILE_NAME };
