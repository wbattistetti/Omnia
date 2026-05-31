/**
 * Project-scoped KB document storage (local filesystem; cloud-ready via storageKey contract).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_ROOT = path.join(__dirname, '..', 'data', 'kb-documents');

function repoRoot() {
  const env = String(process.env.OMNIA_KB_DOCUMENTS_DIR || '').trim();
  return env || DEFAULT_ROOT;
}

function safeProjectId(projectId) {
  const pid = String(projectId || '').trim();
  if (!pid) throw new Error('projectId is required');
  if (/[\\/]|\.\./.test(pid)) throw new Error('invalid projectId');
  return pid;
}

function docDir(projectId, documentId) {
  const pid = safeProjectId(projectId);
  const did = String(documentId || '').trim();
  if (!did || /[\\/]|\.\./.test(did)) throw new Error('invalid documentId');
  return path.join(repoRoot(), pid, did);
}

function metaPath(projectId, documentId) {
  return path.join(docDir(projectId, documentId), 'meta.json');
}

function originalPath(projectId, documentId, fileName) {
  const base = path.basename(String(fileName || 'document'));
  return path.join(docDir(projectId, documentId), `original-${base}`);
}

function readMeta(projectId, documentId) {
  const mp = metaPath(projectId, documentId);
  if (!fs.existsSync(mp)) return null;
  try {
    return JSON.parse(fs.readFileSync(mp, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * @param {string} projectId
 * @param {{ name: string, mimeType?: string, contentBase64: string, textPreview?: string, documentId?: string }} input
 */
function saveDocument(projectId, input) {
  const pid = safeProjectId(projectId);
  const name = String(input.name || 'document').trim() || 'document';
  const b64 = String(input.contentBase64 || '').trim();
  if (!b64) throw new Error('contentBase64 is required');

  const documentId =
    String(input.documentId || '').trim() ||
    (typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `kb_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);

  const buffer = Buffer.from(b64, 'base64');
  const dir = docDir(pid, documentId);
  fs.mkdirSync(dir, { recursive: true });

  const original = originalPath(pid, documentId, name);
  fs.writeFileSync(original, buffer);

  const textPreview =
    typeof input.textPreview === 'string' ? input.textPreview.slice(0, 512_000) : '';

  const meta = {
    id: documentId,
    projectId: pid,
    name,
    mimeType: String(input.mimeType || 'application/octet-stream'),
    size: buffer.length,
    originalFile: path.basename(original),
    textPreview,
    uploadedAt: new Date().toISOString(),
  };
  fs.writeFileSync(metaPath(pid, documentId), JSON.stringify(meta, null, 2), 'utf8');
  return meta;
}

function getDocumentMeta(projectId, documentId) {
  return readMeta(projectId, documentId);
}

/**
 * Text for reader / LLM sampling.
 * @param {string} projectId
 * @param {string} documentId
 * @param {{ maxChars?: number }} [opts]
 */
function readDocumentText(projectId, documentId, opts = {}) {
  const meta = readMeta(projectId, documentId);
  if (!meta) return null;

  const maxChars = Math.max(1000, Math.min(Number(opts.maxChars) || 120_000, 512_000));
  const dir = docDir(projectId, documentId);
  const original = path.join(dir, meta.originalFile || '');
  let fullText = '';

  if (meta.textPreview && meta.textPreview.trim()) {
    fullText = meta.textPreview;
  } else if (original && fs.existsSync(original)) {
    const mime = String(meta.mimeType || '').toLowerCase();
    const lower = String(meta.name || '').toLowerCase();
    const isText =
      mime.startsWith('text/') ||
      lower.endsWith('.md') ||
      lower.endsWith('.txt') ||
      lower.endsWith('.csv') ||
      lower.endsWith('.json');
    if (isText) {
      fullText = fs.readFileSync(original, 'utf8');
    }
  }

  if (!fullText.trim()) {
    return {
      meta,
      text: '',
      truncated: false,
      totalChars: 0,
      message: 'Nessun testo disponibile per anteprima. Per Excel usa textPreview al caricamento.',
    };
  }

  const normalized = fullText.replace(/^\uFEFF/, '');
  const totalChars = normalized.length;
  const truncated = totalChars > maxChars;
  const text = truncated ? normalized.slice(0, maxChars) : normalized;
  return { meta, text, truncated, totalChars };
}

function deleteDocument(projectId, documentId) {
  const dir = docDir(projectId, documentId);
  if (!fs.existsSync(dir)) return false;
  fs.rmSync(dir, { recursive: true, force: true });
  return true;
}

/**
 * Sposta il blob repository da `sourceDocumentId` a `targetDocumentId` (contratto: target = doc.id).
 * @returns {{ ok: true, documentId: string } | { ok: false, error: string }}
 */
function adoptRepositoryDocumentId(projectId, targetDocumentId, sourceDocumentId) {
  const pid = safeProjectId(projectId);
  const target = String(targetDocumentId || '').trim();
  const source = String(sourceDocumentId || '').trim();
  if (!target || !source) {
    return { ok: false, error: 'target_and_source_required' };
  }
  if (target === source) {
    return { ok: true, documentId: target };
  }
  if (readMeta(pid, target)) {
    return { ok: true, documentId: target };
  }
  if (!readMeta(pid, source)) {
    return { ok: false, error: 'source_not_found' };
  }
  const srcDir = docDir(pid, source);
  const tgtDir = docDir(pid, target);
  if (!fs.existsSync(srcDir)) {
    return { ok: false, error: 'source_not_found' };
  }
  if (fs.existsSync(tgtDir)) {
    return { ok: false, error: 'target_exists' };
  }
  fs.renameSync(srcDir, tgtDir);
  const meta = readMeta(pid, target);
  if (meta) {
    meta.id = target;
    meta.projectId = pid;
    fs.writeFileSync(metaPath(pid, target), JSON.stringify(meta, null, 2), 'utf8');
  }
  return { ok: true, documentId: target };
}

/**
 * Original uploaded bytes for PDF/Word viewers.
 * @returns {{ meta: object, buffer: Buffer, mimeType: string } | null}
 */
function readDocumentFile(projectId, documentId) {
  const meta = readMeta(projectId, documentId);
  if (!meta) return null;
  const dir = docDir(projectId, documentId);
  const original = path.join(dir, meta.originalFile || '');
  if (!original || !fs.existsSync(original)) return null;
  const buffer = fs.readFileSync(original);
  return {
    meta,
    buffer,
    mimeType: String(meta.mimeType || 'application/octet-stream'),
  };
}

module.exports = {
  saveDocument,
  getDocumentMeta,
  readDocumentText,
  readDocumentFile,
  deleteDocument,
  adoptRepositoryDocumentId,
};
