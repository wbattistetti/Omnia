/**

 * Chip header backend in analisi: colore uniforme (cyan).

 */



const CHIP_CLASS =

  'rounded-full border border-cyan-600/70 bg-cyan-950/50 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-100';



/** Classi Tailwind per chip nome backend nell'header accordion. */

export function backendChipClassForCatalogEntry(_catalogEntryId?: string): string {

  void _catalogEntryId;

  return CHIP_CLASS;

}


