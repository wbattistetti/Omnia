import { IntellisenseItem } from "../types/intellisense";
import { memoizeOne } from "./memo";

export const asArray = <T,>(v: T | T[] | undefined | null): T[] =>
    Array.isArray(v) ? v : (v ? [v as T] : []);

export const dedupeByKey = <T extends { id?: string; categoryType?: string }>(arr: T[]): T[] => {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const it of arr) {
        const key = `${it.categoryType ?? ""}::${(it.id ?? "").toString()}`;
        if (!it.id || seen.has(key)) continue;
        seen.add(key);
        out.push(it);
    }
    return out;
};

export const extractIntentsFromProblemRow = memoizeOne((row: any): { id: string; name: string }[] => {
    const pools = [row?.intents, row?.data?.intents, row?.payload?.intents].filter(Boolean);
    for (const p of pools) {
        const arr = asArray<any>(p);
        if (!arr.length) continue;
        const norm = arr
            .map((x) => {
                if (typeof x === "string") return { id: x, name: x };
                const id = x?.id ?? x?.value ?? x?.code ?? x?.name ?? x?.label;
                const name = x?.name ?? x?.label ?? x?.id ?? x?.value ?? "";
                if (!id || !name) return null;
                return { id: String(id), name: String(name) };
            })
            .filter(Boolean) as { id: string; name: string }[];
        if (norm.length) return norm;
    }
    return [];
});

export const collectProblemRows = memoizeOne((node: any): any[] => {
    const rows = [
        ...asArray(node?.data?.rows),
        ...asArray(node?.data?.tableRows),
        ...asArray(node?.rows),
    ];
    return rows.filter(
        (r) =>
            r?.type === "ProblemClassification" ||
            r?.kind === "ProblemClassification" ||
            r?.type === "problem-classification" ||
            r?.kind === "problem-classification"
    );
});

// Ordina: conditions prima, poi intents; poi per label
export const sortItems = (items: IntellisenseItem[]) =>
    items.slice().sort((a, b) => {
        if (a.categoryType !== b.categoryType) return a.categoryType === "conditions" ? -1 : 1;
        return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
    });

