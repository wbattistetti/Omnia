/**
 * Active Tutor — carica manuale designer per Q&A LLM (cache in memoria).
 */

const fs = require('fs');
const path = require('path');

let cachedManual = null;

function loadDesignerManualForTutor() {
  if (cachedManual) return cachedManual;
  const manualPath = path.join(__dirname, '../data/designer-manual-for-tutor.md');
  if (!fs.existsSync(manualPath)) {
    throw new Error(
      `Missing designer manual: ${manualPath}. Run: npm run sync:designer-manual`
    );
  }
  cachedManual = fs.readFileSync(manualPath, 'utf8');
  return cachedManual;
}

module.exports = { loadDesignerManualForTutor };
