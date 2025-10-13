import { Variant } from '../types/types';

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const grams3 = (s: string) => { const t = `  ${norm(s)}  `; const g: string[] = []; for (let i=0;i<t.length-2;i++) g.push(t.slice(i,i+3)); return g; };
const jacc = (a: string[], b: string[]) => { const A=new Set(a), B=new Set(b); let inter=0; A.forEach(x=>{ if(B.has(x)) inter++; }); return inter / (A.size + B.size - inter || 1); };

export function dedupVariants(cands: Variant[], existing: Variant[], thr=0.9): Variant[]{
  const keep: Variant[] = [];
  for (const v of cands){
    const near = keep.some(k=> jacc(grams3(k.text), grams3(v.text))>=thr)
             || existing.some(k=> jacc(grams3(k.text), grams3(v.text))>=thr);
    if (!near) keep.push(v);
  }
  return keep;
}


