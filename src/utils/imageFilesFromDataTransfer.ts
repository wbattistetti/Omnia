/**
 * Estrae file immagine da clipboard, drag-and-drop o selezione file — logica unica per UI tipo album foto.
 */

/** Estensioni ammesse se il MIME è vuoto (rarità browser). */
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i;

function isImageFile(f: File): boolean {
  if (f.type.startsWith('image/')) return true;
  if (f.name && IMAGE_EXT.test(f.name)) return true;
  return false;
}

/**
 * File immagine da un elenco (input file o `dataTransfer.files`).
 */
export function filterImageFiles(files: FileList | readonly File[] | null | undefined): File[] {
  if (!files || (!('length' in files) && !(Array.isArray(files)))) return [];
  const arr = Array.from(files as FileList | File[]);
  return arr.filter(isImageFile);
}

/**
 * Clipboard paste: preferisce `files`, poi `items` (screenshot / copia immagine).
 */
export function imageFilesFromClipboardDataTransfer(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  const fromFiles = filterImageFiles(dt.files);
  if (fromFiles.length > 0) return fromFiles;
  const items = dt.items;
  if (!items?.length) return [];
  const out: File[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind !== 'file') continue;
    if (!item.type.startsWith('image/') && item.type !== '') continue;
    const f = item.getAsFile();
    if (f && isImageFile(f)) out.push(f);
  }
  return out;
}

/**
 * Drop da explorer / browser: usa solo `dataTransfer.files`.
 */
export function imageFilesFromDragDataTransfer(dt: DataTransfer | null): File[] {
  if (!dt?.files?.length) return [];
  return filterImageFiles(dt.files);
}
