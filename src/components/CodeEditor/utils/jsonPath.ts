export function getByPath(obj: any, path: string): any {
  if (!path) return obj;
  const parts = path.replace(/^\$\.?/, '').split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    const m = p.match(/(\w+)\[(\d+)\]/);
    if (m) {
      cur = cur[m[1]]; cur = Array.isArray(cur) ? cur[Number(m[2])] : undefined;
    } else {
      cur = cur[p];
    }
  }
  return cur;
}




