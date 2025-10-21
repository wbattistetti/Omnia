import json
import re

def _clean_json_like(s: str) -> str:
    try:
        t = s.strip()
        if t.startswith("```"):
            # remove starting fence (and optional language)
            t = re.sub(r"^```[a-zA-Z]*\n", "", t)
            # remove ending fence
            t = re.sub(r"\n```\s*$", "", t)
        # clip to outermost JSON block
        first_candidates = [i for i in [t.find('{'), t.find('[')] if i != -1]
        if first_candidates:
            first = min(first_candidates)
            last = max(t.rfind('}'), t.rfind(']'))
            if last > first:
                t = t[first:last+1]
        # remove trailing commas before } or ]
        t = re.sub(r",\s*(\}|\])", r"\1", t)
        return t.strip()
    except Exception:
        return s

def _safe_json_loads(text: str):
    try:
        return json.loads(text)
    except Exception:
        clean = _clean_json_like(text)
        try:
            return json.loads(clean)
        except Exception:
            return None
