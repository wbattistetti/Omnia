from fastapi import APIRouter, Body, Response
import json
import os
import re

router = APIRouter()

_nlp = None
_load_error = None


def _get_nlp():
    global _nlp, _load_error
    if _nlp is not None or _load_error is not None:
        return _nlp
    try:
        import spacy  # type: ignore
        model_name = os.environ.get("SPACY_MODEL", "it_core_news_sm")
        _tmp = spacy.load(model_name)
        _nlp = _tmp
        return _nlp
    except Exception as e:  # pragma: no cover
        _load_error = str(e)
        return None


MONTHS = {
    "gennaio": 1, "febbraio": 2, "marzo": 3, "aprile": 4, "maggio": 5, "giugno": 6,
    "luglio": 7, "agosto": 8, "settembre": 9, "ottobre": 10, "novembre": 11, "dicembre": 12,
    "gen": 1, "feb": 2, "mar": 3, "apr": 4, "mag": 5, "giu": 6, "lug": 7, "ago": 8, "set": 9, "ott": 10, "nov": 11, "dic": 12,
}


def _parse_dob(text: str):
    """Very small helper to parse a single date from Italian text.
    Returns list of candidate DOB objects.
    """
    s = text.lower()
    cands = []
    # 1) numeric dd/mm/yyyy
    m = re.search(r"\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b", s)
    if m:
        day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if year < 100:
            year = 2000 + year if year < 50 else 1900 + year
        cands.append({"day": day, "month": month, "year": year, "_conf": 0.8})
    # 2) day month [year]
    if not cands:
        name_re = re.compile(r"\b(\d{1,2})\s*(?:di|de|del|della)?\s+([a-zà-ù]{3,})\s*(\d{2,4})?\b", re.I)
        m2 = name_re.search(s)
        if m2:
            day = int(m2.group(1))
            mon = MONTHS.get(m2.group(2).lower())
            year = m2.group(3)
            if mon:
                cands.append({"day": day, "month": mon, "year": int(year) if year else None, "_conf": 0.7})
    # 3) year-first (nel 1980 il 16 dicembre)
    if not cands:
        yf = re.search(r"\b(19\d{2}|20\d{2})\b.*?\b(\d{1,2})\s*(?:di|de|del|della)?\s+([a-zà-ù]{3,})\b", s, re.I)
        if yf:
            year = int(yf.group(1))
            day = int(yf.group(2))
            mon = MONTHS.get(yf.group(3).lower())
            if mon:
                cands.append({"day": day, "month": mon, "year": year, "_conf": 0.7})
    # 4) month-name + year (es. "dicembre 1980")
    if not cands:
        m3 = re.search(r"\b([a-zà-ù]{3,})\s*(\d{2,4})\b", s, re.I)
        if m3:
            mon = MONTHS.get(m3.group(1).lower())
            year = m3.group(2)
            if mon:
                y = int(year)
                if y < 100:
                    y = 2000 + y if y < 50 else 1900 + y
                cands.append({"day": None, "month": mon, "year": y, "_conf": 0.65})
    # 5) year + month-name (es. "nel 1980 a dicembre")
    if not cands:
        m4 = re.search(r"\b(19\d{2}|20\d{2})\b.*?\b([a-zà-ù]{3,})\b", s, re.I)
        if m4:
            y = int(m4.group(1))
            mon = MONTHS.get(m4.group(2).lower())
            if mon:
                cands.append({"day": None, "month": mon, "year": y, "_conf": 0.62})
    return cands


@router.post("/api/ner/extract")
def ner_extract(body: dict = Body(...)):
    field = (body or {}).get("field") or ""
    text = (body or {}).get("text") or ""
    
    print(f"[NER_EXTRACT] Request received - field: {field}, text: {repr(text)}")

    nlp = _get_nlp()
    if nlp is None:
        print(f"[NER_EXTRACT] ERROR: spaCy not available - {_load_error}")
        return Response(
            content=json.dumps({
                "error": "spaCy not available",
                "details": _load_error or "Install spaCy and it_core_news_sm",
                "install": [
                    "pip install spacy",
                    "python -m spacy download it_core_news_sm",
                ],
            }),
            media_type="application/json",
            status_code=501,
        )

    print(f"[NER_EXTRACT] spaCy loaded successfully, processing text...")
    doc = nlp(text)
    
    print(f"[NER_EXTRACT] Document entities found: {[(e.text, e.label_) for e in doc.ents]}")
    
    candidates = []

    if field == "dateOfBirth":
        print("[NER_EXTRACT] Processing dateOfBirth field")
        # from doc ents
        for e in doc.ents:
            if e.label_.upper() == "DATE":
                print(f"[NER_EXTRACT] Found DATE entity: {e.text}")
                for c in _parse_dob(e.text):
                    candidates.append({"value": {"day": c.get("day"), "month": c.get("month"), "year": c.get("year")}, "confidence": c.get("_conf", 0.6)})
                    print(f"[NER_EXTRACT] Added date candidate: {c}")
        # also try whole text if no candidates
        if not candidates:
            print("[NER_EXTRACT] No entities found, trying whole text parsing")
            for c in _parse_dob(text):
                candidates.append({"value": {"day": c.get("day"), "month": c.get("month"), "year": c.get("year")}, "confidence": c.get("_conf", 0.6)})
                print(f"[NER_EXTRACT] Added date candidate from text: {c}")

    elif field == "email":
        print("[NER_EXTRACT] Processing email field")
        m = re.search(r"[^\s]+@[^\s]+\.[^\s]+", text)
        if m:
            candidates.append({"value": m.group(0), "confidence": 0.7})
            print(f"[NER_EXTRACT] Found email: {m.group(0)}")
        else:
            print("[NER_EXTRACT] No email found")

    elif field == "phone":
        print("[NER_EXTRACT] Processing phone field")
        # very naive: longest digit-ish chunk
        digs = re.findall(r"\+?\d[\d\s\-]{5,}\d", text)
        if digs:
            # pick the longest
            v = max(digs, key=len)
            candidates.append({"value": v, "confidence": 0.65})
            print(f"[NER_EXTRACT] Found phone: {v}")
        else:
            print("[NER_EXTRACT] No phone found")
    else:
        print(f"[NER_EXTRACT] Unknown field: {field}")

    print(f"[NER_EXTRACT] Final candidates: {candidates}")
    return {"candidates": candidates}


