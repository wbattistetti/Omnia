/**
 * KB upload file kind detection and accept string for file inputs.
 */

export type KbFileFormat =
  | 'txt'
  | 'xlsx'
  | 'md'
  | 'csv'
  | 'json'
  | 'text'
  | 'pdf'
  | 'docx'
  | 'image';

export const KB_DOCUMENT_ACCEPT =
  '.txt,.md,.csv,.json,.xlsx,.pdf,.docx,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp,text/plain,text/markdown,text/csv,application/json,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const TEXT_EXT = new Set(['.txt', '.md', '.markdown', '.csv', '.json', '.tsv', '.log']);

export function detectKbFileFormat(file: File): KbFileFormat {
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();
  if (name.endsWith('.pdf') || mime === 'application/pdf') return 'pdf';
  if (name.endsWith('.docx') || mime.includes('wordprocessingml')) return 'docx';
  if (name.endsWith('.xlsx') || mime.includes('spreadsheetml')) return 'xlsx';
  if (name.endsWith('.csv') || name.endsWith('.tsv')) return 'csv';
  if (name.endsWith('.json') || mime === 'application/json') return 'json';
  if (name.endsWith('.md') || name.endsWith('.markdown')) return 'md';
  if (name.endsWith('.txt') || mime === 'text/plain') return 'txt';
  if (
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.png') ||
    name.endsWith('.webp') ||
    mime.startsWith('image/')
  ) {
    return 'image';
  }
  if (mime.startsWith('text/')) return 'text';
  return 'text';
}

export function isKbImageFormat(format: KbFileFormat | undefined): boolean {
  return format === 'image';
}

export function isKbBinaryViewerFormat(format: KbFileFormat | undefined): boolean {
  return format === 'pdf' || format === 'docx' || format === 'image';
}

export function isKbParsableTabular(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith('.xlsx') ||
    name.endsWith('.txt') ||
    file.type === 'text/plain' ||
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
}

export function isKbGenericTextReadable(file: File): boolean {
  const name = file.name.toLowerCase();
  if (isKbParsableTabular(file) && !name.endsWith('.md') && !name.endsWith('.csv')) {
    return name.endsWith('.txt');
  }
  for (const ext of TEXT_EXT) {
    if (name.endsWith(ext)) return true;
  }
  return file.type.startsWith('text/');
}
