/**
 * Lucide icons and labels per KB document format (list + reader chrome).
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  FileSpreadsheet,
  FileText,
  FileCode2,
  FileJson,
  FileType,
  File,
  FileImage,
} from 'lucide-react';
import type { KbFileFormat } from './kbFileKinds';

export function detectKbFormatFromName(name: string, mimeType?: string): KbFileFormat {
  const lower = name.toLowerCase();
  const mime = String(mimeType || '').toLowerCase();
  if (lower.endsWith('.pdf') || mime === 'application/pdf') return 'pdf';
  if (lower.endsWith('.docx') || mime.includes('wordprocessingml')) return 'docx';
  if (lower.endsWith('.xlsx') || mime.includes('spreadsheetml')) return 'xlsx';
  if (lower.endsWith('.csv') || lower.endsWith('.tsv') || mime === 'text/csv') return 'csv';
  if (lower.endsWith('.json') || mime === 'application/json') return 'json';
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'md';
  if (lower.endsWith('.txt') || mime === 'text/plain') return 'txt';
  if (
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.png') ||
    lower.endsWith('.webp') ||
    mime.startsWith('image/')
  ) {
    return 'image';
  }
  if (mime.startsWith('text/')) return 'text';
  return 'text';
}

export function kbFormatIcon(format: KbFileFormat | undefined, fileName: string, mimeType?: string): LucideIcon {
  const f = format ?? detectKbFormatFromName(fileName, mimeType);
  switch (f) {
    case 'pdf':
      return FileType;
    case 'docx':
      return FileText;
    case 'xlsx':
      return FileSpreadsheet;
    case 'json':
      return FileJson;
    case 'md':
      return FileCode2;
    case 'image':
      return FileImage;
    case 'csv':
    case 'txt':
    case 'text':
    default:
      return File;
  }
}

export function kbFormatIconClass(format: KbFileFormat | undefined, fileName: string): string {
  const f = format ?? detectKbFormatFromName(fileName);
  switch (f) {
    case 'pdf':
      return 'text-rose-400';
    case 'docx':
      return 'text-sky-400';
    case 'xlsx':
      return 'text-emerald-400';
    case 'json':
      return 'text-amber-400';
    case 'md':
      return 'text-violet-400';
    case 'csv':
      return 'text-teal-400';
    case 'image':
      return 'text-pink-400';
    default:
      return 'text-slate-400';
  }
}

export type KbFormatIconProps = {
  format?: KbFileFormat;
  fileName: string;
  mimeType?: string;
  className?: string;
};

/** Icon component for document list rows. */
export function KbFormatIcon({
  format,
  fileName,
  mimeType,
  className = 'h-4 w-4 shrink-0',
}: KbFormatIconProps): React.ReactElement {
  const Icon = kbFormatIcon(format, fileName, mimeType);
  const color = kbFormatIconClass(format, fileName);
  return <Icon className={`${className} ${color}`} aria-hidden />;
}
