/**
 * Builds a text preview for repository storage and LLM sampling (client-side).
 */

import { detectKbFileFormat } from './kbFileKinds';
import { normalizeKbDocumentText } from './kbDocumentTextNormalize';
import { KB_XLSX_PREVIEW_ROWS, readXlsxWorkbookLimited } from './xlsxLimitedRead';

const DEFAULT_MAX_LINES = 200;
const DEFAULT_MAX_CHARS = 80_000;

export async function buildKbTextPreview(
  file: File,
  opts?: { maxLines?: number; maxChars?: number }
): Promise<string> {
  const maxLines = opts?.maxLines ?? DEFAULT_MAX_LINES;
  const maxChars = opts?.maxChars ?? DEFAULT_MAX_CHARS;
  const kind = detectKbFileFormat(file);

  if (kind === 'xlsx') {
    const XLSX = await import('xlsx');
    const workbook = await readXlsxWorkbookLimited(file, KB_XLSX_PREVIEW_ROWS);
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return '';
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet, { FS: '\t' });
    return trimPreview(csv, maxLines, maxChars);
  }

  if (kind === 'docx') {
    const mammoth = await import('mammoth');
    const buffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return trimPreview(result.value || '', maxLines, maxChars);
  }

  const text = await file.text();
  return trimPreview(normalizeKbDocumentText(text), maxLines, maxChars);
}

function trimPreview(text: string, maxLines: number, maxChars: number): string {
  const lines = normalizeKbDocumentText(text).split('\n').slice(0, maxLines);
  let out = lines.join('\n');
  if (out.length > maxChars) out = out.slice(0, maxChars);
  return out;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Lettura file non riuscita'));
        return;
      }
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
    reader.readAsDataURL(file);
  });
}
