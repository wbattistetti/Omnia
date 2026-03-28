/**
 * Inline label width: new nodes from "+" use full row until the user types;
 * then autosize (handled in SidebarInlineEditInput).
 */

export type SidebarLabelWidthMode = 'fill' | 'autosize';

/** Row keys: main `m:idx`, sub `s:m:s`, nested `p` + path segments joined by `:`. */
export function sidebarMainEditKey(mainIdx: number): string {
  return `m:${mainIdx}`;
}

export function sidebarSubEditKey(mainIdx: number, subIdx: number): string {
  return `s:${mainIdx}:${subIdx}`;
}

export function sidebarPathEditKey(path: number[]): string {
  return `p:${path.join(':')}`;
}

export function sidebarLabelWidthMode(
  fillRowKey: string | null,
  rowKey: string,
  draft: string
): SidebarLabelWidthMode {
  return fillRowKey === rowKey && draft === '' ? 'fill' : 'autosize';
}
