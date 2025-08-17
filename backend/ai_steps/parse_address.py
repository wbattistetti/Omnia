from fastapi import APIRouter, Body
from typing import Dict
import re

router = APIRouter()

try:
    from postal.parser import parse_address  # requires libpostal native + pip install postal
except Exception:
    parse_address = None


def normalize(parts: Dict[str, str]) -> Dict[str, str]:
    # Map libpostal labels to our canonical fields
    return {
        "street": parts.get("road") or parts.get("pedestrian") or parts.get("footway") or parts.get("residential"),
        "number": parts.get("house_number"),
        "city": parts.get("city") or parts.get("town") or parts.get("village") or parts.get("hamlet"),
        "postal_code": parts.get("postcode"),
        "state": parts.get("state") or parts.get("state_district"),
        "country": parts.get("country"),
        "raw": parts,
    }


def heuristic_parse(text: str) -> Dict[str, str]:
    """Very lightweight address heuristic useful on Windows when libpostal is not installed.
    Extracts street, number, city, postal_code, country, state when possible.
    """
    t = ' '.join(text.strip().split())
    out: Dict[str, str] = {}

    # Postal code (Italian CAP)
    m_cap = re.search(r"\b(\d{5})\b", t)
    if m_cap:
        out["postcode"] = m_cap.group(1)

    # Country (very naive)
    m_country = re.search(r"\b(italia|italy)\b", t, re.IGNORECASE)
    if m_country:
        out["country"] = m_country.group(1)

    # Road + house number
    road_kw = r"via|viale|corso|piazza|piazzale|strada|vicolo|largo|regione|frazione|località|localita|contrada|lungomare|lungarno"
    m_road = re.search(rf"\b({road_kw})\s+([A-Za-zÀ-ÿ'\-\.\s]+?)(?:\s+(\d+[A-Za-z]?))?(?=\s+(?:a|ad|in|,|$))", t, re.IGNORECASE)
    if m_road:
        out["road"] = (m_road.group(1) + " " + m_road.group(2)).strip()
        if m_road.group(3):
            out["house_number"] = m_road.group(3)

    # City after prepositions a/ad/in … until next keyword/comma/end
    m_city = re.search(r"\b(?:a|ad|in)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'\-\.\s]{2,}?)(?=(?:\s+(?:in|regione|provincia|frazione|località|localita)\b|,|$))", t, re.IGNORECASE)
    if m_city:
        out["city"] = m_city.group(1).strip()

    return out


@router.post("/api/parse-address")
def api_parse_address(body: dict = Body(...)):
    text = (body.get("text") or "").strip()
    if not text:
        return {"ok": False, "error": "empty_text"}
    # Try libpostal if available, otherwise fallback to heuristic
    if parse_address is not None:
        try:
            parts_list = parse_address(text)
            parts = dict(parts_list)
            return {"ok": True, "address": normalize(parts)}
        except Exception as e:
            # fall back to heuristic
            pass

    parts = heuristic_parse(text)
    if parts:
        return {"ok": True, "address": normalize(parts)}
    return {"ok": False, "error": "unable_to_parse_address"}


