from fastapi import FastAPI, Body, Request, Response, HTTPException
from typing import Any
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import sys
import requests
import json
import re

# Ensure this file's directory (backend/) is on sys.path so local imports work
_CURR_DIR = os.path.dirname(__file__)
if _CURR_DIR and _CURR_DIR not in sys.path:
    sys.path.insert(0, _CURR_DIR)

# Support running either from project root (package imports) or from backend/ (local imports)
try:
    from backend.ai_steps.step3_suggest_constraints import router as step3_router
    from backend.ai_steps.constraint_messages import router as constraint_messages_router
    from backend.ai_steps.generate_validator import router as generate_validator_router
    from backend.ai_steps.generate_tests import router as generate_tests_router
    from backend.ai_steps.stepNoMatch import router as stepNoMatch_router
    from backend.ai_steps.stepNoInput import router as stepNoInput_router
    from backend.ai_steps.stepConfirmation import router as stepConfirmation_router
    from backend.ai_steps.nlp_extract import router as nlp_extract_router
    from backend.ner_spacy import router as ner_router
    from backend.ai_steps.stepSuccess import router as stepSuccess_router
    from backend.ai_steps.startPrompt import router as startPrompt_router
    from backend.ai_steps.stepNotConfirmed import router as stepNotConfirmed_router
    from backend.ai_steps.parse_address import router as parse_address_router
    from backend.ai_endpoints.intent_generation import router as intent_gen_router
except Exception:
    from ai_steps.step3_suggest_constraints import router as step3_router
    from ai_steps.constraint_messages import router as constraint_messages_router
    from ai_steps.generate_validator import router as generate_validator_router
    from ai_steps.generate_tests import router as generate_tests_router
    from ai_steps.stepNoMatch import router as stepNoMatch_router
    from ai_steps.stepNoInput import router as stepNoInput_router
    from ai_steps.stepConfirmation import router as stepConfirmation_router
    from ai_steps.nlp_extract import router as nlp_extract_router
    from ner_spacy import router as ner_router
    from ai_steps.stepSuccess import router as stepSuccess_router
    from ai_steps.startPrompt import router as startPrompt_router
    from ai_steps.stepNotConfirmed import router as stepNotConfirmed_router
    from ai_steps.parse_address import router as parse_address_router
    from ai_endpoints.intent_generation import router as intent_gen_router

GROQ_KEY = os.environ.get("Groq_key")

# ✅ Load supported types from shared config
NLP_TYPES_CONFIG_PATH = os.path.join(os.path.dirname(__file__), '..', 'config', 'nlp-types.json')
SUPPORTED_KINDS = []
TYPE_ALIASES = {}

try:
    if os.path.exists(NLP_TYPES_CONFIG_PATH):
        with open(NLP_TYPES_CONFIG_PATH, 'r', encoding='utf-8') as f:
            nlp_config = json.load(f)
            SUPPORTED_KINDS = nlp_config.get('supportedKinds', [])
            TYPE_ALIASES = nlp_config.get('aliases', {})
            print(f"[NLP Config] Loaded {len(SUPPORTED_KINDS)} supported kinds:", ', '.join(SUPPORTED_KINDS))
    else:
        print(f"[NLP Config] WARNING: Config file not found at {NLP_TYPES_CONFIG_PATH}, using fallback types")
        SUPPORTED_KINDS = ['name', 'email', 'phone', 'date', 'address', 'generic']
except Exception as e:
    print(f"[NLP Config] ERROR loading config: {e}, using fallback types")
    SUPPORTED_KINDS = ['name', 'email', 'phone', 'date', 'address', 'generic']

# Import OPENAI_KEY from call_openai to get registry fallback
try:
    from backend.call_openai import OPENAI_KEY
except Exception:
    from call_openai import OPENAI_KEY
IDE_LANGUE = os.environ.get("IdeLangue", "it")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"  # PATCH: endpoint corretto
MODEL = os.environ.get("GROQ_MODEL", "llama-3.1-70b-instruct")

MEANINGS = [
    "date", "email", "phone", "address", "number", "text", "boolean"
]

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# --- Lint endpoint for editor diagnostics ---
@app.post("/api/conditions/lint")
def lint_condition(body: dict = Body(...)):
    try:
        code = (body or {}).get("code") or ""
        inputs = (body or {}).get("inputs") or []
        if not isinstance(code, str):
            return {"findings": [{"severity": "error", "message": "code must be string", "startLine": 1, "startCol": 1, "endLine": 1, "endCol": 1, "rule": "bad-request"}]}

        def compute_line_starts(txt: str):
            starts = [0]
            for i, ch in enumerate(txt):
                if ch == "\n":
                    starts.append(i + 1)
            return starts

        def idx_to_pos(idx: int, starts):
            lo, hi = 0, len(starts) - 1
            while lo <= hi:
                mid = (lo + hi) >> 1
                if starts[mid] <= idx:
                    lo = mid + 1
                else:
                    hi = mid - 1
            line_start = starts[max(0, hi)]
            line = max(1, hi + 1)
            col = max(1, (idx - line_start) + 1)
            return line, col

        starts = compute_line_starts(code)
        findings = []

        # No module syntax
        for m in re.finditer(r"\b(import|export)\b", code):
            s, e = m.start(), m.end()
            sl, sc = idx_to_pos(s, starts)
            el, ec = idx_to_pos(e, starts)
            findings.append({
                "severity": "error",
                "message": "Module syntax is not supported in this runtime (no import/export).",
                "startLine": sl, "startCol": sc, "endLine": el, "endCol": ec,
                "rule": "no-module-syntax",
            })

        # Hint unsafe date
        for m in re.finditer(r"new\s+Date\s*\(", code):
            s, e = m.start(), m.end()
            sl, sc = idx_to_pos(s, starts)
            el, ec = idx_to_pos(e, starts)
            findings.append({
                "severity": "warning",
                "message": "Use of new Date(...): verify timezone/locale or parse explicitly.",
                "startLine": sl, "startCol": sc, "endLine": el, "endCol": ec,
                "rule": "no-unsafe-date",
            })

        # Info local getters
        for m in re.finditer(r"\.(getFullYear|getMonth|getDate|getHours|getMinutes|getSeconds|getDay)\s*\(", code):
            s, e = m.start(1), m.end(1)
            sl, sc = idx_to_pos(s, starts)
            el, ec = idx_to_pos(e, starts)
            findings.append({
                "severity": "info",
                "message": f'Local date getter "{m.group(1)}": prefer UTC when relevant.',
                "startLine": sl, "startCol": sc, "endLine": el, "endCol": ec,
                "rule": "no-local-date-getters",
            })

        # Unused inputs
        if isinstance(inputs, list):
            for name in inputs:
                pat = re.compile(rf"\b{re.escape(str(name))}\b")
                if not pat.search(code):
                    findings.append({
                        "severity": "warning",
                        "message": f'Input "{name}" not used in code.',
                        "startLine": 1, "startCol": 1, "endLine": 1, "endCol": 1,
                        "rule": "unused-input",
                    })

        return {"findings": findings}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

# Simple request/response logger (silence noisy paths)
@app.middleware("http")
async def log_requests(request: Request, call_next):
    path = request.url.path
    # Silence frequent frontend fetches/polling
    if path.startswith("/projects"):
        return await call_next(request)
    try:
        print(f"[REQ] {request.method} {path}")
    except Exception:
        pass
    response = await call_next(request)
    try:
        print(f"[RES] {response.status_code} {path}")
    except Exception:
        pass
    return response

# ---- Global error logging handlers ----
@app.exception_handler(HTTPException)
async def http_exception_logger(request: Request, exc: HTTPException):
    try:
        print(f"[HTTPERROR] {request.url.path} status={exc.status_code} detail={exc.detail}")
    except Exception:
        pass
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

@app.exception_handler(Exception)
async def unhandled_exception_logger(request: Request, exc: Exception):
    try:
        print(f"[UNHANDLED] {request.url.path} error={exc}")
    except Exception:
        pass
    return JSONResponse(status_code=500, content={"detail": "internal_error"})
# NOTE: mount routers
# Neutral routers
app.include_router(nlp_extract_router)
app.include_router(ner_router)
app.include_router(parse_address_router)
app.include_router(intent_gen_router)

# DDT Wizard step routers (required by Build Messages)
app.include_router(stepNoMatch_router)
app.include_router(stepNoInput_router)
app.include_router(stepConfirmation_router)
app.include_router(stepSuccess_router)
app.include_router(startPrompt_router)
app.include_router(stepNotConfirmed_router)

# --- Condition: suggest minimal variables ---
@app.post("/api/conditions/suggest-vars")
def suggest_vars(body: dict = Body(...)):
    try:
        nl = (body or {}).get("nl") or ""
        variables = (body or {}).get("variables") or []
    except Exception as e:
        return JSONResponse({"error": f"bad_request: {e}"}, status_code=200)
    try:
        print("[SUGGEST_VARS][req]", {"nl_preview": (nl or "")[:160], "vars_count": len(variables)})
    except Exception:
        pass
    if not isinstance(nl, str) or not nl.strip():
        return {"error": "nl_required"}
    if not isinstance(variables, list):
        variables = []

    system = (
        "You help select the MINIMAL set of variables needed to evaluate a condition.\n"
        "Rules:\n"
        "- Consider only the provided dotted variable names.\n"
        "- Prefer variables explicitly mentioned or implied by the user's description.\n"
        "- If there are multiple granularities in a family (e.g., whole vs parts), select ONE coherent representation.\n"
        "- Do NOT include unrelated variables.\n"
        "Return STRICT JSON: {\"selected\": string[], \"rationale\": string }"
    )
    user = {
        "role": "user",
        "content": (
            "Condition (natural language):\n" + nl + "\n\n" +
            "Available variables (dotted):\n" + " | ".join([str(v) for v in variables]) + "\n\n" +
            "Select only the variables strictly necessary."
        )
    }
    provider = ((body or {}).get("provider") or os.environ.get("AI_PROVIDER") or "groq").lower()
    try:
        if provider == "openai":
            try:
                from backend.call_openai import call_openai_json as _call_json
            except Exception:
                from call_openai import call_openai_json as _call_json
        else:
            _call_json = call_groq_json
        ai = _call_json([
            {"role": "system", "content": system},
            user,
        ])
        text = (ai or "{}").strip()
        try:
            print("[SUGGEST_VARS][ai_raw]", text[:300])
        except Exception:
            pass
        obj = _safe_json_loads(text)
        if obj is None:
            return {"error": "parse_error", "raw": text[:400]}
        # sanitize
        selected = [s for s in (obj.get("selected") or []) if isinstance(s, str)]
        rationale = obj.get("rationale") or ""
        try:
            print("[SUGGEST_VARS][selected]", selected, "rationale:", rationale[:160])
        except Exception:
            pass
        return JSONResponse({"selected": selected, "rationale": rationale}, status_code=200)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=200)

# --- Condition generation (backend-centralized Groq) ---
@app.post("/api/conditions/generate")
def generate_condition(body: dict = Body(...)):
    nl = (body or {}).get("nl") or ""
    variables = (body or {}).get("variables") or []
    try:
        print("[COND][req]", {"nl_preview": (nl or "")[:160], "vars": variables[:20]})
    except Exception:
        pass
    if not isinstance(nl, str) or not nl.strip():
        return {"error": "nl_required"}
    if not isinstance(variables, list):
        variables = []

    # System prompt aligned to runtime, key binding, self-check, and strict JSON output
    SYSTEM = (
        "You generate safe JavaScript from natural language or pseudocode for our Condition DSL.\n"
        "RUNTIME_MODE=module\n"
        "ACCESSOR_ROOT=ctx\n"
        "Hard rules:\n"
        "- Use only ACCESSOR_ROOT[\"<exact dotted key>\"] (case-sensitive).\n"
        "- If the input contains ACCESSOR_ROOT[\"...\"], those are the only allowed keys.\n"
        "- Only use keys listed in Available variables. Do NOT invent/rename keys.\n"
        "- Code must be pure: no side-effects, no console, no I/O, no globals, no comments.\n"
        "- Use UTC date API only: getUTCFullYear, getUTCMonth, getUTCDate (never local getters).\n"
        "- function main(ctx) must always return a boolean; on any exception return false (wrap with try/catch).\n"
        "- Label must be concise (<= 40 chars) and in the user's NL language.\n"
        "- CONDITION.inputs must equal exactly the set of keys accessed via ACCESSOR_ROOT[\"...\"] in the code.\n"
        "- Do not use eval, new Function, setTimeout, setInterval.\n"
        "- Capture current time once (const now=new Date()) and reuse it (avoid multiple new Date() calls).\n"
        "- Only call Date.parse after verifying the input matches the ISO regex shown in parseDate; otherwise return null.\n"
        "- Before responding, SELF-CHECK that: (a) CONDITION.inputs contains the same key(s); and (b) the code uses ACCESSOR_ROOT[\"...\"] for each key. If the check fails -> return only {\"question\":\"Key mismatch. Confirm the exact dotted key.\"}.\n"
        "- EXTRA SELF-CHECK: if the code contains prohibited patterns like new Date(\"dd/mm/yyyy\") or other non-deterministic date parsing, return only {\"question\":\"Bad date parsing: use parseDate.\"}.\n"
        "- EXTRA SELF-CHECK: if the script uses getFullYear|getMonth|getDate (non-UTC) -> return only {\"question\":\"Use UTC date API (getUTC*).\"}.\n"
        "- EXTRA SELF-CHECK: if Date.parse( appears without an ISO regex test -> return only {\"question\":\"Bad date parsing: ISO only.\"}.\n"
        "- EXTRA SELF-CHECK: if const CONDITION= or function main(ctx) is missing -> return only {\"question\":\"Missing CONDITION or main(ctx).\"}.\n"
        "- EXTRA SELF-CHECK: if main(ctx) does not return a boolean on all paths -> return only {\"question\":\"main(ctx) must return a boolean.\"}.\n"
        "- EXTRA SELF-CHECK: if the set of inputs differs from the set of ACCESSOR_ROOT[\"...\"] keys used -> return only {\"question\":\"Key set mismatch between inputs and code.\"}.\n"
        "- If the description is insufficient or ambiguous (operator/threshold/unit/variable), return only {\"question\":\"...\"}.\n\n"
        "Output (strict):\n"
        "Return ONLY JSON: {\"label\":\"...\",\"script\":\"...\"} or {\"question\":\"...\"}. No extra text.\n\n"
        "Runtime profile (module):\n"
        "Emit a complete module: const CONDITION={label:\"<auto>\",type:\"predicate\",inputs:[\"<key(s)>\"]}; function main(ctx){...} // returns boolean; read via ctx[\"<key>\"].\n"
    )

    # ensure a blank line before Guidelines in the composed prompt

    GUIDELINES = (
    )

    GUIDELINES = (
        "Guidelines by type: "
        "Dates & durations: Never use new Date(non-ISO). Use parseDate (below) for dd/mm/yyyy, yyyy-mm-dd, Date, timestamp. Now/today = current UTC. Support differences in years|days|hours. For age, compute UTC age. For \"Now - <date> > N years\": if <date> is a Date of Birth, compute age in UTC; otherwise compute calendar-year difference with month/day correction. If unclear, ask a question. "
        "Email: trim+lowercase; regex ^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$. "
        "Phone: keep leading +, strip non-digits; length>=9. "
        "Strings: trim and collapse whitespace; case-insensitive unless specified. "
        "Numbers: Number(...), require Number.isFinite. "
        "Mini-DSL: AGE(ACCESSOR_ROOT[\"<key>\"]) >= N ; Now - ACCESSOR_ROOT[\"<dateKey>\"] > N years|days|hours ; ACCESSOR_ROOT[\"<dateA>\"] before|after (ACCESSOR_ROOT[\"<dateB>\"]|Now) ; is valid email/phone ; ACCESSOR_ROOT[\"<strKey>\"] contains|equals \"<text>\" (case-insensitive by default).\n"
        "Helper (copy verbatim when dates are involved):\n"
        "function parseDate(v){ if(v instanceof Date&&!Number.isNaN(v.valueOf()))return v; if(typeof v===\"number\"&&Number.isFinite(v))return new Date(v); if(typeof v===\"string\"){ const s=v.trim(); let m=s.match(/^(\\d{1,2})[\\/-](\\d{1,2})[\\/-](\\d{2,4})$/); if(m){ let d=parseInt(m[1],10),mo=parseInt(m[2],10)-1,y=parseInt(m[3],10); if(y<100)y+=2000; const dt=new Date(Date.UTC(y,mo,d)); return (dt.getUTCFullYear()===y&&dt.getUTCMonth()===mo&&dt.getUTCDate()===d)?dt:null; } m=s.match(/^(\\d{4})[\\/-](\\d{1,2})[\\/-](\\d{1,2})$/); if(m){ const y=parseInt(m[1],10),mo=parseInt(m[2],10)-1,d=parseInt(m[3],10); const dt=new Date(Date.UTC(y,mo,d)); return (dt.getUTCFullYear()===y&&dt.getUTCMonth()===mo&&dt.getUTCDate()===d)?dt:null; } const iso=/^\\d{4}-\\d{2}-\\d{2}(?:[T\\s]\\d{2}:\\d{2}(?::\\d{2})?(?:\\.\\d+)?(?:Z|[+\\-]\\d{2}:\\d{2})?)?$/; if(iso.test(s)){ const tt=Date.parse(s); if(!Number.isNaN(tt)) return new Date(tt); } } return null; }"
    )

    examples = [
        {
            "role": "system",
            "content": (
                'Example (age >= 18): NL "utente maggiorenne"; Vars include "agents asks for personal data.Date of Birth" -> '
                '{"label":"Utente maggiorenne","script":"const CONDITION={label:\"Utente maggiorenne\",type:\"predicate\",inputs:[\"agents asks for personal data.Date of Birth\"]};function main(ctx){const k=\"agents asks for personal data.Date of Birth\";if(!ctx||!Object.prototype.hasOwnProperty.call(ctx,k))return false;const d=parseDate(ctx[k]);if(!d)return false;const t=new Date();let a=t.getUTCFullYear()-d.getUTCFullYear();const m=t.getUTCMonth()-d.getUTCMonth();if(m<0||(m===0&&t.getUTCDate()<d.getUTCDate()))a--;return a>=18;}function parseDate(v){if(v instanceof Date&&!Number.isNaN(v.valueOf()))return v;if(typeof v===\\\"number\\\"&&Number.isFinite(v))return new Date(v);if(typeof v===\\\"string\\\"){const s=v.trim();let m=s.match(/^(\\\\d{1,2})[\\\\\/\\\\\-](\\\\d{1,2})[\\\\\/\\\\\-](\\\\d{2,4})$/);if(m){let d=parseInt(m[1],10),mo=parseInt(m[2],10)-1,y=parseInt(m[3],10);if(y<100)y+=2000;const dt=new Date(Date.UTC(y,mo,d));return dt.getUTCFullYear()===y&&dt.getUTCMonth()===mo&&dt.getUTCDate()===d?dt:null;}m=s.match(/^(\\\\d{4})[\\\\\/\\\\\-](\\\\d{1,2})[\\\\\/\\\\\-](\\\\d{1,2})$/);if(m){const y=parseInt(m[1],10),mo=parseInt(m[2],10)-1,d=parseInt(m[3],10);const dt=new Date(Date.UTC(y,mo,d));return dt.getUTCFullYear()===y&&dt.getUTCMonth()===mo&&dt.getUTCDate()===d?dt:null;}const tt=Date.parse(s);if(!Number.isNaN(tt))return new Date(tt);}return null;}"}'
            )
        }
    ]

    user = {
        "role": "user",
        "content": (
            "Natural language description:\n" + nl + "\n\nAvailable variables (dotted, exact):\n" + " | ".join([str(v) for v in variables]) + "\nReturn only JSON."
        )
    }
    provider = ((body or {}).get("provider") or os.environ.get("AI_PROVIDER") or "groq").lower()
    try:
        if provider == "openai":
            try:
                from backend.call_openai import call_openai_json as _call_json
            except Exception:
                from call_openai import call_openai_json as _call_json
        else:
            _call_json = call_groq_json
        ai = _call_json([
            {"role": "system", "content": SYSTEM},
            {"role": "system", "content": GUIDELINES},
            *examples,
            user,
        ])
        text = (ai or "{}").strip()
        try:
            print("[COND][ai][raw]", text[:400])
        except Exception:
            pass
        obj = _safe_json_loads(text)
        if obj is None:
            return {"error": "parse_error", "raw": text[:400]}
        # normalize 'script' to a string if AI emitted an object form under script
        script_val = obj.get("script") if isinstance(obj, dict) else None
        if isinstance(script_val, dict):
            raw_failed = json.dumps(script_val)
            m = re.search(r"function\s+main\s*\(ctx\)[\s\S]*?\}\s*$", raw_failed, flags=re.M)
            if m:
                obj["script"] = m.group(0)
            else:
                obj["script"] = "try { return false; } catch { return false; }"

        # Guardrail: quick validation of script vs keys and date parsing
        try:
            script_s = (obj.get("script") or "") if isinstance(obj, dict) else ""
            if isinstance(script_s, str) and script_s:
                # exact key presence in inputs and usage
                for k in (variables or []):
                    if isinstance(k, str):
                        if (f'inputs:["{k}"]' not in script_s) and (f'inputs: ["{k}"]' not in script_s):
                            return {"question": "Key mismatch. Confirm the exact dotted key."}
                        if f'["{k}"]' not in script_s:
                            return {"question": "Key mismatch. Confirm the exact dotted key."}
                # forbid new Date('dd/mm/yyyy') and similar non-ISO
                if re.search(r"new\s+Date\(\s*['\"`](?!\d{4}-\d{2}-\d{2})", script_s):
                    return {"question": "Bad date parsing: use parseDate."}
                # must contain a boolean return in main
                if not re.search(r"return\s+(true|false|!|\(|[a-zA-Z_])", script_s):
                    return {"question": "The script must return a boolean predicate."}
        except Exception:
            pass

        # heuristic fallback remains unchanged
        try:
            script_s = (obj.get("script") or "").strip() if isinstance(obj, dict) else ""
            nl_lc = (nl or "").lower()
            need_adult = any(k in nl_lc for k in ["maggiorenne", "adult", ">= 18", "18 anni", "18 years"]) or True
            dob_candidates = []
            for v in (variables or []):
                vs = str(v)
                if re.search(r"date of birth|\bDOB\b", vs, flags=re.I) or vs.endswith(".Date"):
                    dob_candidates.append(vs)
            if (not script_s or script_s == "try { return false; } catch { return false; }") and dob_candidates:
                key = dob_candidates[0]
                script_tpl = (
                    "try {\n"+
                    f"  var vars = ctx;\n  const dob = vars[\"{key}\"];\n"+
                    "  if (!dob) return false;\n"+
                    "  const d = new Date(dob);\n"+
                    "  if (isNaN(d.getTime())) return false;\n"+
                    "  const now = new Date();\n"+
                    "  let age = now.getFullYear() - d.getFullYear();\n"+
                    "  const m = now.getMonth() - d.getMonth();\n"+
                    "  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;\n"+
                    "  return age >= 18;\n"+
                    "} catch { return false; }\n"
                )
                if isinstance(obj, dict):
                    obj["script"] = script_tpl
                    if not obj.get("label"):
                        obj["label"] = "Utente maggiorenne"
        except Exception:
            pass
        return obj
    except Exception as e:
        try:
            print("[COND][error]", str(e))
        except Exception:
            pass
        return {"error": str(e)}

# --- Condition: repair an existing module using failures ---
@app.post("/api/conditions/repair")
def repair_condition(body: dict = Body(...)):
    script = (body or {}).get("script") or ""
    failures = (body or {}).get("failures") or []
    return_mode = ((body or {}).get("return") or "module").lower()  # "module" | "diff"
    variables = (body or {}).get("variables") or []
    if not isinstance(script, str) or not script.strip():
        return {"error": "script_required"}
    if not isinstance(failures, list):
        failures = []

    system = (
        "You are an expert backend engineer for our Condition DSL. Fix the given JavaScript module so that it satisfies the failures and rules below.\n"
        "Constraints (must-haves):\n"
        "- Keep the same runtime: RUNTIME_MODE=module, ACCESSOR_ROOT=ctx.\n"
        "- Preserve the exact input key(s) and CONDITION.inputs.\n"
        "- Code must be pure: no console, no I/O, no globals, no comments.\n"
        "- Use UTC getters (getUTCFullYear/getUTCMonth/getUTCDate), capture const now=new Date() once and reuse it.\n"
        "- Parse dates deterministically with parseDate (supports dd/mm/yyyy, yyyy-mm-dd, Date, timestamp in milliseconds, strict ISO fallback only); never new Date(non-ISO).\n"
        "- main(ctx) must return a boolean on all paths (try/catch { return false } allowed).\n"
        "- Return only the full corrected JS module (no explanations).\n"
    )

    # Normalize failures pretty JSON
    try:
        failures_json = json.dumps(failures, ensure_ascii=False)
    except Exception:
        failures_json = "[]"

    user = {
        "role": "user",
        "content": (
            "Current code (buggy):\n\n" + script + "\n\n" +
            "Observed failures (input -> expected -> got) [JSON list]:\n" + failures_json + "\n\n" +
            "Hard rules to apply while fixing:\n"
            "- Keep CONDITION.inputs exactly as-is.\n"
            "- Use parseDate helper as described (dd/mm/yyyy, yyyy-mm-dd, Date, timestamp in ms, ISO-only fallback).\n"
            "- Age check is age >= 18 (UTC).\n"
            "- No local date getters; Date.parse only after ISO regex test.\n\n"
            "Task:\nFix the module so that all the above cases pass and the rules are respected.\n"
            "Output only the corrected JavaScript module."
        )
    }

    provider = ((body or {}).get("provider") or os.environ.get("AI_PROVIDER") or "groq").lower()
    try:
        if provider == "openai":
            try:
                from backend.call_openai import call_openai as _call_text
            except Exception:
                from call_openai import call_openai as _call_text
        else:
            try:
                from backend.call_groq import call_groq_text as _call_text
            except Exception:
                from call_groq import call_groq_text as _call_text
        resp = _call_text([
            {"role": "system", "content": system},
            user,
        ])
        corrected = (resp or "").strip()
        # Basic guardrails: ensure module shape
        if "const CONDITION" not in corrected or "function main(ctx)" not in corrected:
            return {"error": "missing_structure", "raw": corrected[:400]}
        if re.search(r"\bgetFullYear\(|\bgetMonth\(|\bgetDate\(", corrected):
            return {"error": "non_utc_getters"}
        if re.search(r"new\s+Function|\beval\(|setTimeout\(|setInterval\(", corrected):
            return {"error": "forbidden_apis"}
        # ISO-only Date.parse use (quick heuristic)
        if "Date.parse(" in corrected and "-" not in corrected.split("Date.parse(")[1].split(")")[0]:
            return {"error": "bad_date_parse"}
        return {"script": corrected}
    except Exception as e:
        try:
            print("[COND][repair][error]", str(e))
        except Exception:
            pass
        return {"error": str(e)}

# --- Condition: suggest sample cases (true/false) ---
@app.post("/api/conditions/suggest-cases")
def suggest_condition_cases(body: dict = Body(...)):
    nl = (body or {}).get("nl") or ""
    variables = (body or {}).get("variables") or []
    if not isinstance(nl, str) or not nl.strip():
        return {"error": "nl_required"}
    if not isinstance(variables, list):
        variables = []

    system = (
        "You propose example variable assignments for a condition.\n"
        "Return STRICT JSON only. No comments.\n"
        "Always include two objects: trueCase and falseCase.\n"
        "Each object maps dotted variable names to realistic, minimal sample values.\n"
        "Additionally include two short English hints: hintTrue and hintFalse.\n"
        "Each hint must tell the tester what to write, e.g., 'Write a date of birth that makes the user an adult (18+)'."
    )
    user = {
        "role": "user",
        "content": (
            "Condition (natural language):\n" + nl + "\n\n"
            "Available variables (dotted):\n" + " | ".join([str(v) for v in variables]) + "\n\n"
            "Goal: propose one assignment that SHOULD make the condition evaluate to true (trueCase) and another that SHOULD make it evaluate to false (falseCase).\n"
            "Also provide textual guidance in English: 'hintTrue' and 'hintFalse' (one short sentence each) explaining what value to write.\n"
            "Respond ONLY with JSON: {\"trueCase\": {..}, \"falseCase\": {..}, \"hintTrue\": \"...\", \"hintFalse\": \"...\"}\n"
        )
    }
    provider = ((body or {}).get("provider") or os.environ.get("AI_PROVIDER") or "groq").lower()
    try:
        if provider == "openai":
            try:
                from backend.call_openai import call_openai_json as _call_json
            except Exception:
                from call_openai import call_openai_json as _call_json
        else:
            _call_json = call_groq_json
        ai = _call_json([
            {"role": "system", "content": system},
            user,
        ])
        text = (ai or "{}").strip()
        obj = _safe_json_loads(text)
        if obj is None:
            return {"error": "parse_error", "raw": text[:400]}
        # ensure labelTrue/labelFalse exist; add simple heuristics
        if isinstance(obj, dict):
            lt = obj.get("labelTrue")
            lf = obj.get("labelFalse")
            desc = (nl or "").lower()
            if not lt or not isinstance(lt, str):
                if "maggiorenne" in desc or "adult" in desc:
                    lt = "Adult"
                else:
                    lt = ""
            if not lf or not isinstance(lf, str):
                if "maggiorenne" in desc or "adult" in desc:
                    lf = "Minor"
                else:
                    lf = ""
            obj["labelTrue"], obj["labelFalse"] = lt, lf
        return obj
    except Exception as e:
        return {"error": str(e)}

# --- Condition: normalize pseudo-code using chat + current code ---
@app.post("/api/conditions/normalize")
def normalize_pseudocode(body: dict = Body(...)):
    """Turn informal/pseudo code + chat intent + current code into clean JS for main(ctx).

    Body: {
    chat: [{role:'user'|'assistant', content:string}] | undefined,
    pseudo: string,
    currentCode: string,
    variables: string[],
    mode: 'predicate'|'value'|'object'|'enum'
    }
    Return: { script?: string, error?: string }
    """
    try:
        chat = (body or {}).get("chat") or []
        pseudo = (body or {}).get("pseudo") or ""
        current = (body or {}).get("currentCode") or ""
        variables = (body or {}).get("variables") or []
        mode = (body or {}).get("mode") or "predicate"
        desired_label = (body or {}).get("label") or "Condition"
    except Exception as e:
        return JSONResponse({"error": f"bad_request: {e}"}, status_code=200)

    provider = ((body or {}).get("provider") or os.environ.get("AI_PROVIDER") or "groq").lower()

    # Build transcript string (clip to reasonable size)
    transcript_lines = []
    try:
        for m in chat:
            r = str((m or {}).get("role") or "user")
            c = str((m or {}).get("content") or "")
            transcript_lines.append(f"[{r}] {c}")
    except Exception:
        pass
    transcript = "\n".join(transcript_lines)[-6000:]

    # Try lightweight heuristic for simple patterns like:
    # if vars["A.B"] = "X" then return "Y" else return "Z"
    try:
        text = f"{pseudo} {current}".strip()
        # extract first vars["..."] occurrence and the compared literal
        m_cmp = re.search(r"vars\s*\[\s*([\"\'])(.+?)\1\s*\]\s*[=]{1,3}\s*([\"\'])(.+?)\3", text, flags=re.I)
        # extract two return literals (order: then/else). Accept 'ritorna', 'return', 'allora', 'else/altrimenti'
        returns = re.findall(r"(?:return|ritorna)\s*([\"\'])(.+?)\1", text, flags=re.I)
        if m_cmp and returns:
            try:
                print("[NORMALIZE][heuristic][match]", {"key": m_cmp.group(2), "then": returns[0][1], "else": (returns[1][1] if len(returns)>1 else None)})
                sys.stdout.flush()
            except Exception:
                pass
            key = m_cmp.group(2)
            val = m_cmp.group(4)
            then_val = returns[0][1]
            else_val = (returns[1][1] if len(returns) > 1 else ("" if mode == "value" else "false"))
            # If outputs look boolean-like, coerce to boolean mode
            def _is_bool_like(s):
                return str(s).strip().lower() in ["true", "false", "vero", "falso"]
            if _is_bool_like(then_val) and _is_bool_like(else_val):
                script = (
                    "try {\n"
                    "  var vars = ctx;\n"
                    f"  const v = vars[\"{key}\"];\n"
                    f"  return String(v) === \"{val}\" ? {str(then_val).lower() in ['true','vero']} : {str(else_val).lower() in ['true','vero']};\n"
                    "} catch { return false; }\n"
                )
            else:
                # value/enum style: return strings
                script = (
                    "try {\n"
                    "  var vars = ctx;\n"
                    f"  const v = vars[\"{key}\"];\n"
                    f"  return String(v) === \"{val}\" ? \"{then_val}\" : \"{else_val}\";\n"
                    "} catch { return \"" + else_val + "\"; }\n"
                )
            return JSONResponse({"script": script}, status_code=200)
    except Exception:
        pass

    # STRICT_MINIMAL system prompt
    system = (
        "You are a code generator that converts human pseudo-code into executable JavaScript predicate conditions.\n\n"
        "Goal:\n"
        "Follow the user's pseudo-code exactly. If incomplete, add only the minimal, deterministic assumptions required to produce a valid predicate. Never add extra signals, heuristics, or additional variables beyond what the pseudo-code implies.\n\n"
        "Hard requirements:\n"
        "- Produce ONE code block of valid JavaScript, and nothing else\n"
        "- No logs, no comments, no explanations\n"
        "- Output only one top-level constant `CONDITION` and one function `main(ctx)`\n"
        "- `main(ctx)` must return a boolean\n"
        "- Safe failure: if the variable key is missing from `ctx` or invalid, return false\n"
        "- Case-insensitive string comparison; compare only the first token unless a full-string match is explicitly requested\n\n"
        "STRICT_MINIMAL policy:\n"
        "1) Priority: Explicit pseudo-code > Allowed variables list > Defaults.\n"
        "2) If the pseudo-code names an explicit key (quoted or code-like), use exactly that key and only the stated operations. Do NOT substitute or add any other variable or signal.\n"
        "3) If the pseudo-code lacks a key, infer exactly ONE key from the Allowed list by best semantic match; if tie, pick the first deterministically.\n"
        "4) If the operator is unstated, default to equality under the default comparison rule (case-insensitive, first token).\n"
        "5) If the pseudo-code asks for a full-string/\"exact\" match, do NOT split to first token; compare the entire trimmed string case-insensitively.\n"
        "6) If the comparison value is missing, return false (do not invent values).\n"
        "7) For numbers: parse with `Number(...)`; if `NaN`, return false. No range inference unless written.\n"
        "8) Use only variables listed in `CONDITION.inputs`. Do not read any other `ctx` keys.\n"
        "9) Do not add proxies (e.g., timezone, phone prefix, IP country) or regexes unless explicitly requested.\n"
        "10) Determinism: produce identical output for identical inputs.\n\n"
        "Shape (must match exactly):\n"
        "const CONDITION = { label: \"<label>\", type: \"predicate\", inputs: [\"<varKey>\" /* or multiple only if explicitly required */] };\n"
        "function main(ctx){ /* boolean */ }\n"
    )
    # Prepare user message (template-aware: parse Name/When true/Variables)
    brief = "\n".join([l for l in transcript.splitlines() if l.strip()])[:800]
    label_value = str(desired_label or "Condition")

    # Parse structured pseudo if present
    def _parse_template(text: str):
        name = None
        when_true = None
        vars_list: list[str] = []
        lines = (text or "").splitlines()
        mode_vars = False
        for raw in lines:
            ln = raw.strip()
            if not ln:
                continue
            k = ln.lower()
            if ln.lower().startswith("name:"):
                name = ln.split(":", 1)[1].strip() or None
                mode_vars = False
                continue
            if k.startswith("when true:"):
                when_true = ln.split(":", 1)[1].strip() or None
                mode_vars = False
                continue
            if k.startswith("variables:"):
                mode_vars = True
                tail = ln.split(":", 1)[1].strip()
                if tail and not tail.lower().startswith("scegli"):
                    # support comma-separated on same line
                    parts = [p.strip(" -\t") for p in tail.split(",") if p.strip()]
                    vars_list.extend(parts)
                continue
            if mode_vars:
                if ln.startswith("-"):
                    v = ln.lstrip("- ").strip()
                    if v and not v.lower().startswith("scegli"):
                        vars_list.append(v)
                else:
                    # stop vars block on first non-bullet line
                    mode_vars = False
        return name, when_true, vars_list

    p_name, p_when, p_vars = _parse_template(str(pseudo))
    if p_name:
        label_value = p_name
    pseudo_for_model = (p_when or str(pseudo).strip())

    # Decide allowed variables: prefer parsed list if provided
    allowed_vars = [str(v) for v in (p_vars if p_vars else (variables or []))]
    # If pseudo contains an explicit allowed key in quotes, restrict allowed list to that key
    explicit_key = None
    try:
        for v in allowed_vars:
            v_esc = re.escape(v)
            if re.search(rf"[\"\']{v_esc}[\"\']", pseudo_for_model):
                explicit_key = v
                break
    except Exception:
        explicit_key = None
    if explicit_key:
        allowed_list_str = "- " + explicit_key
        allowed_vars = [explicit_key]
    else:
        allowed_list_str = "\n".join([f"- {v}" for v in allowed_vars])

    # User message following STRICT_MINIMAL policy
    user_content = (
        "You are a code generator. Interpret natural language pseudo-code and map it to the most appropriate variable from the list below, following STRICT_MINIMAL policy.\n\n"
        "If the variable is not explicitly quoted in the pseudo-code, infer exactly ONE semantically appropriate key from the Allowed list (tie-break: the first).\n\n"
        "Compare strings case-insensitively and only on the first token unless a full-string match is explicitly stated.\n\n"
        "---\n\n"
        "Pseudo-code:\n" + str(pseudo_for_model) + "\n\n"
        "Allowed variables:\n" + allowed_list_str + "\n\n"
        "Condition label (optional; defaults to your condition title):\n" + str(label_value or "") + "\n"
    )
    # Few-shot examples (STRICT_MINIMAL; no helpers; one JS block each)
    few_shots = (
        "EXAMPLE A — explicit complex key (STRICT_MINIMAL; default first-token)\n"
        "User pseudo-code:\ntrue if \"Agent asks for user's name.Name\" equals \"mario\" (case-insensitive; compare first token); else false\nLabel:\nItaliano\n\n"
        "Allowed variable keys include:\n- Agent asks for user's name.Name\n\n"
        "Output:\nconst CONDITION = { label: \"Italiano\", type: \"predicate\", inputs: [\"Agent asks for user's name.Name\"] };\n"
        "function main(ctx){\n  const k = \"Agent asks for user's name.Name\";\n  if (!Object.prototype.hasOwnProperty.call(ctx,k)) return false;\n  const v = String(ctx[k]).trim();\n  if (v === \"\") return false;\n  const first = (v.split(/\\s+/)[0] || \"\").toLowerCase();\n  return first === \"mario\";\n}\n\n"
        "EXAMPLE B — numeric range (predicate)\n"
        "User pseudo-code:\ntrue if 18 ≤ User.Age < 65 else false\nLabel:\nAdulto\n\n"
        "Allowed variable keys include:\n- User.Age\n\n"
        "Output:\nconst CONDITION = { label: \"Adulto\", type: \"predicate\", inputs: [\"User.Age\"] };\n"
        "function main(ctx){\n  const k = \"User.Age\";\n  if (!Object.prototype.hasOwnProperty.call(ctx,k)) return false;\n  const x = Number(ctx[k]);\n  if (!Number.isFinite(x)) return false;\n  return x >= 18 && x < 65;\n}\n\n"
        "EXAMPLE C — full-string match explicitly requested (do NOT split)\n"
        "User pseudo-code:\ntrue if full string of \"User.Country\" equals \"Italia\" (case-insensitive); else false\nLabel:\nPaeseItalia\n\n"
        "Allowed variable keys include:\n- User.Country\n\n"
        "Output:\nconst CONDITION = { label: \"PaeseItalia\", type: \"predicate\", inputs: [\"User.Country\"] };\n"
        "function main(ctx){\n  const k = \"User.Country\";\n  if (!Object.prototype.hasOwnProperty.call(ctx,k)) return false;\n  const v = String(ctx[k]).trim().toLowerCase();\n  if (v === \"\") return false;\n  return v === \"italia\";\n}\n\n"
        "EXAMPLE D — incomplete pseudo: missing key (choose ONE from Allowed, deterministically)\n"
        "User pseudo-code:\ntrue if name equals \"mario\"\nLabel:\nItaliano\n\n"
        "Allowed variable keys include:\n- User.FirstName\n- Agent asks for user's name.Name\n\n"
        "Output:\nconst CONDITION = { label: \"Italiano\", type: \"predicate\", inputs: [\"User.FirstName\"] };\n"
        "function main(ctx){\n  const k = \"User.FirstName\";\n  if (!Object.prototype.hasOwnProperty.call(ctx,k)) return false;\n  const v = String(ctx[k]).trim();\n  if (v === \"\") return false;\n  const first = (v.split(/\\s+/)[0] || \"\").toLowerCase();\n  return first === \"mario\";\n}\n"
    )
    try:
        # Ask for plain text (function only) and extract deterministically
        try:
            print("[NORMALIZE][provider]", provider)
            print(f"[NORMALIZE][prompt][lens] system={len(system or '')} few_shots={len(few_shots or '')} user={len(user_content or '')}")
            print("[NORMALIZE][prompt][system]\n" + (system or ""))
            print("[NORMALIZE][prompt][few_shots]\n" + (few_shots or ""))
            print("[NORMALIZE][prompt][user]\n" + (user_content or ""))
        except Exception:
            pass
        if provider == "openai":
            try:
                from backend.call_openai import call_openai as _call_ai
            except Exception:
                from call_openai import call_openai as _call_ai
        else:
            _call_ai = call_groq
        ai = _call_ai([
            {"role": "system", "content": system},
            {"role": "system", "content": few_shots},
            {"role": "user", "content": user_content},
        ])
        text = (ai or "").strip()
        try:
            print("[NORMALIZE][ai_raw]", text[:600])
        except Exception:
            pass
        # Extract code block (if fenced)
        code = text
        mfence = re.search(r"```(?:js|javascript)?\n([\s\S]*?)\n```", text, flags=re.I)
        if mfence:
            code = mfence.group(1)

        # Extract CONDITION and main(ctx)
        mcond = re.search(r"const\s+CONDITION\s*=\s*\{[\s\S]*?\};", code, flags=re.M)
        mfun = re.search(r"function\s+main\s*\(\s*ctx\s*\)\s*\{[\s\S]*?\}\s*", code, flags=re.M)
        parts = []
        if mcond:
            parts.append(mcond.group(0).strip())
        if mfun:
            parts.append(mfun.group(0).strip())

        script = "\n".join(parts).strip()

        # Post-generation validator: label and inputs vs actually used keys
        try:
            lbl_m = re.search(r"const\s+CONDITION\s*=\s*\{[\s\S]*?label\s*:\s*\"([^\"]+)\"", script)
            inputs_m = re.search(r"inputs\s*:\s*\[([\s\S]*?)\]", script)
            used_keys = set(re.findall(r"getVar\(ctx,\s*[\"\']([^\"\']+)[\"\']\)", script))
            declared = set()
            if inputs_m:
                declared = set([s.strip().strip('"\'') for s in re.findall(r"[\"\']([^\"\']+)[\"\']", inputs_m.group(1))])
            lbl_ok = (lbl_m and lbl_m.group(1) == label_value)
            inputs_ok = (declared == used_keys and all((k in allowed_vars) for k in declared))
            # If invalid, we can append a nudge to the user prompt next run; for now just log
            if not (lbl_ok and inputs_ok):
                try:
                    print('[NORMALIZE][validator]', {'label_ok': lbl_ok, 'inputs_ok': inputs_ok, 'declared': list(declared), 'used': list(used_keys)})
                except Exception:
                    pass
        except Exception:
            pass

        # Add helpers only if referenced and not already defined
        def _need(name: str) -> bool:
            return (name+"(") in code and (f"function {name}(" not in code)

        helpers = []
        if _need("getVar"):
            helpers.append("function getVar(ctx, key){ return Object.prototype.hasOwnProperty.call(ctx,key) ? ctx[key] : undefined; }")
        if _need("s"):
            helpers.append("function s(v){ return (v==null? '' : String(v)).trim(); }")
        if _need("n"):
            helpers.append("function n(v){ const x = Number(v); return Number.isFinite(x) ? x : NaN; }")

        if script:
            if helpers:
                script = "\n".join(helpers) + "\n" + script
            return JSONResponse({"script": script}, status_code=200)
        # fallback default
        # Fallback: minimal CONDITION + main(ctx) false
        script = (
            "const CONDITION = { label: \"Condition\", type: \"predicate\", inputs: [] };\n"
            "function main(ctx){ return false; }\n"
        )
        return JSONResponse({"script": script}, status_code=200)
    except Exception as e:
        try:
            print("[NORMALIZE][error]", e)
        except Exception:
            pass
        return JSONResponse({"error": "normalize_failed"}, status_code=200)

# --- Backend Builder: synthesize natural-language outline from chat ---
@app.post("/api/builder/brief")
def builder_brief(body: dict = Body(...)):
    """
    Body: { "messages": [{role,text}...], "context": "CONTESTO_STATO opzionale" }
    Return: { ok: true, text: outline, delta: suggested_delta }
    """
    msgs = (body or {}).get("messages") or []
    context = (body or {}).get("context") or ""
    if not isinstance(msgs, list) or not msgs:
        return {"error": "messages_required"}

    convo = []
    for m in msgs:
        role = (m or {}).get("role") or "designer"
        text = (m or {}).get("text") or ""
        convo.append(f"[{role}] {text}")
    convo_text = "\n".join(convo)[-6000:]

    SYSTEM_RULES = f"""
Sei un consulente backend. In questa fase lavori SOLO in linguaggio naturale ben formattato.
Regole:
- Spiega in modo chiaro e ordinato, con titoli in **grassetto** e elenchi numerati/puntati.
- Riformula le richieste per conferma.
- NIENTE codice e NIENTE JSON.
- Evidenzia sempre: Obiettivo finale; Passi (fetch, normalizzazione, deduplica, filtri, aggregazione); Dubbi/Informazioni mancanti; Prossima azione proposta.
Mantieni coerenza con il CONTESTO_STATO.
Alla fine della risposta, aggiungi una sezione "Delta CONTESTO_STATO:" con 1-3 righe da aggiungere al contesto cumulato (solo testo, niente JSON/codice).
"""

    prompt = f"""
{SYSTEM_RULES}

CONTESTO_STATO attuale (se presente):
{context}

Conversazione (designer/IA):
{convo_text}
"""

    ai = call_groq([
        {"role": "system", "content": "Rispondi in italiano. Solo linguaggio naturale formattato. Nessun JSON/codice."},
        {"role": "user", "content": prompt}
    ])
    raw = (ai or "").strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```[a-zA-Z]*\n", "", raw)
        raw = re.sub(r"\n```\s*$", "", raw)
    raw = re.sub(r"\r\n", "\n", raw)
    raw = re.sub(r"\n{2,}(\d+\))", r"\n\n\1", raw)

    # Extract delta section if present
    delta = ""
    m = re.search(r"Delta CONTESTO_STATO:\s*(.*)$", raw, flags=re.I | re.S)
    if m:
        delta = m.group(1).strip()
        # Remove delta from main text
        raw = raw[:m.start()].rstrip()

    return {"ok": True, "text": raw, "delta": delta}

# --- NLP Tester: contract tuning from unmatched/false-acceptance ---
@app.post("/api/nlp/tune-contract")
def tune_contract(body: dict = Body(...)):
    """
    Body example:
    {
    "kind": "date",
    "profile": {"synonyms":[], "formatHints":[], "regex":"", "postProcess":{}},
    "errors": [
        {"phrase":"...","key":"day","pred":"16","gt":"15","type":"false-accept"},
        {"phrase":"...","key":"month","pred":null,"gt":"12","type":"unmatched"}
    ],
    "locale": "it-IT"
    }
    Returns: { "suggested": { regex?, synonyms?, formatHints?, postProcess? } }
    """
    kind = (body or {}).get("kind") or "generic"
    profile = (body or {}).get("profile") or {}
    errors = (body or {}).get("errors") or []
    locale = (body or {}).get("locale") or "it-IT"

    brief_errors = []
    for e in errors:
        brief_errors.append({
            "k": e.get("key"),
            "p": e.get("pred"),
            "g": e.get("gt"),
            "t": e.get("type"),
            "x": (e.get("phrase") or "")[:140]
        })

    system = {
        "role": "system",
        "content": (
            f"You are an NLP contract tuner for locale {locale}. "
            "Given a kind and a profile (synonyms, formatHints, regex, postProcess), and a set of errors (false-accept, unmatched), "
            "propose minimal, safe improvements to reduce false-accepts and unmatched without overfitting. "
            "Return STRICT JSON only with a 'suggested' object that may contain any of: synonyms (array of strings), formatHints (array of strings), regex (string), postProcess (JSON). No narration."
        )
    }
    user = {
        "role": "user",
        "content": json.dumps({
            "kind": kind,
            "profile": profile,
            "errors": brief_errors
        }, ensure_ascii=False)
    }

    try:
        ai = call_groq([system, user])
        text = (ai or "").strip()
        try:
            obj = json.loads(text)
        except Exception:
            m = re.search(r"\{[\s\S]*\}$", text)
            obj = json.loads(m.group(0)) if m else {"suggested": {}}
        suggested = (obj or {}).get("suggested") or {}
        clean = {}
        if isinstance(suggested.get("synonyms"), list):
            clean["synonyms"] = [str(s) for s in suggested["synonyms"]][:50]
        if isinstance(suggested.get("formatHints"), list):
            clean["formatHints"] = [str(s) for s in suggested["formatHints"]][:50]
        if isinstance(suggested.get("regex"), str):
            clean["regex"] = suggested["regex"][:2000]
        if isinstance(suggested.get("postProcess"), (dict, list, str, int, float, bool)):
            clean["postProcess"] = suggested["postProcess"]
        return {"ok": True, "suggested": clean}
    except Exception as e:
        return {"ok": False, "error": str(e)}

# Allow overriding Express base so WSL can reach Windows-hosted Express
EXPRESS_BASE = os.environ.get("EXPRESS_BASE", "http://localhost:3100")

# Simple reverse proxy to Express so the frontend can hit only port 8000
async def _proxy_to_express(request: Request) -> Response:
    method = request.method.upper()
    query = ("?" + request.url.query) if request.url.query else ""
    target_url = f"{EXPRESS_BASE}{request.url.path}{query}"

    headers = {k: v for k, v in request.headers.items() if k.lower() != "host"}
    body_bytes = await request.body()

    try:
        print(f"[PROXY->EXPRESS] {method} {target_url}")
        if headers.get("content-type", "").startswith("application/json"):
            try:
                json_payload = await request.json()
            except Exception:
                json_payload = None
            resp = requests.request(method, target_url, headers=headers, json=json_payload)
        else:
            resp = requests.request(method, target_url, headers=headers, data=body_bytes)
    except Exception as e:
        print(f"[PROXY ERROR] {method} {target_url} -> {e}")
        return Response(content=str(e), status_code=502)

    try:
        print(f"[PROXY←EXPRESS] {resp.status_code} {method} {target_url}")
    except Exception:
        pass
    return Response(content=resp.content, status_code=resp.status_code, media_type=resp.headers.get("content-type"))

# Proxy routes for Express endpoints
@app.api_route("/api/factory/{full_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def proxy_factory(full_path: str, request: Request):
    return await _proxy_to_express(request)

@app.api_route("/api/projects", methods=["GET", "POST"])
async def proxy_projects_root(request: Request):
    return await _proxy_to_express(request)

@app.api_route("/api/projects/{full_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def proxy_projects(full_path: str, request: Request):
    return await _proxy_to_express(request)

@app.api_route("/projects", methods=["GET", "POST"])
async def proxy_projects_alias_root(request: Request):
    return await _proxy_to_express(request)

@app.api_route("/projects/{full_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def proxy_projects_alias(full_path: str, request: Request):
    return await _proxy_to_express(request)

def call_groq(messages):
    headers = {
        "Authorization": f"Bearer {GROQ_KEY}",
        "Content-Type": "application/json"
    }
    # Build candidate model list: configured MODEL, env fallbacks, and a small built-in list
    candidates_env = os.environ.get("GROQ_MODEL_FALLBACKS", "")
    candidates = [m.strip() for m in candidates_env.split(",") if m.strip()]
    builtins = ["llama-3.1-70b-instruct", "llama-3.1-8b-instant", "llama-3.1-405b-instruct"]
    models_to_try = []
    for m in [MODEL, *candidates, *builtins]:
        if m and m not in models_to_try:
            models_to_try.append(m)

    last_error = None
    for model in models_to_try:
        data = {"model": model, "messages": messages}
        resp = requests.post(GROQ_URL, headers=headers, json=data)
        try:
            print(f"[GROQ][REQ] model={model} url={GROQ_URL} messages={len(messages)}")
            print(f"[GROQ][RES] status={resp.status_code} body_snippet={(resp.text or '')[:280]!r}")
        except Exception:
            pass
        if resp.status_code >= 400:
            txt = resp.text or ""
            if "model" in txt.lower() and ("decommissioned" in txt.lower() or "invalid" in txt.lower()):
                last_error = f"Groq API error {resp.status_code}: {txt}"
                try: print("[GROQ][FALLBACK] switching model due to error -> trying next")
                except Exception: pass
                continue
            raise requests.HTTPError(f"Groq API error {resp.status_code}: {txt}")
        try:
            j = resp.json()
        except Exception:
            raise requests.HTTPError(f"Groq API: invalid JSON response: {(resp.text or '')[:200]}")
        return j.get("choices", [{}])[0].get("message", {}).get("content", "")

    raise requests.HTTPError(last_error or "Groq API: all model candidates failed")

def call_groq_json(messages):
    headers = {
        "Authorization": f"Bearer {GROQ_KEY}",
        "Content-Type": "application/json"
    }
    candidates_env = os.environ.get("GROQ_MODEL_FALLBACKS", "")
    candidates = [m.strip() for m in candidates_env.split(",") if m.strip()]
    builtins = ["llama-3.1-70b-instruct", "llama-3.1-8b-instant"]
    models_to_try = []
    for m in [MODEL, *candidates, *builtins]:
        if m and m not in models_to_try:
            models_to_try.append(m)

    last_error = None
    for model in models_to_try:
        data = {"model": model, "messages": messages, "response_format": {"type": "json_object"}}
        resp = requests.post(GROQ_URL, headers=headers, json=data)
        try:
            print(f"[GROQ][REQ][json] model={model} messages={len(messages)}")
            print(f"[GROQ][RES] status={resp.status_code} body_snippet={(resp.text or '')[:280]!r}")
        except Exception:
            pass
        if resp.status_code >= 400:
            # Attempt salvage if Groq returns a json_validate_failed with a failed_generation payload
            try:
                err = resp.json().get("error")
            except Exception:
                err = None
            if err and isinstance(err, dict) and "failed_generation" in err:
                raw_failed = err.get("failed_generation") or ""
                try:
                    cleaned = _clean_json_like(raw_failed)
                    obj = _safe_json_loads(cleaned) or {}
                    label = obj.get("label") or "Condition"
                    script_val = obj.get("script")
                    script_str = None
                    if isinstance(script_val, str):
                        script_str = script_val
                    elif isinstance(script_val, dict):
                        m = re.search(r"function\s+main\s*\(ctx\)[\s\S]*?\}\s*$", raw_failed, flags=re.M)
                        if m:
                            script_str = m.group(0)
                    if not script_str:
                        m2 = re.search(r"try\s*\{[\s\S]*?\}\s*catch[\s\S]*?\}", raw_failed, flags=re.I)
                        script_str = m2.group(0) if m2 else "try { return false; } catch { return false; }"
                    salvage = {"label": label, "script": script_str}
                    return json.dumps(salvage)
                except Exception:
                    pass
            txt = resp.text or ""
            if "model" in txt.lower() and ("decommissioned" in txt.lower() or "invalid" in txt.lower() or "not exist" in txt.lower()):
                last_error = f"Groq API error {resp.status_code}: {txt}"
                continue
            raise requests.HTTPError(f"Groq API error {resp.status_code}: {txt}")
        try:
            j = resp.json()
        except Exception:
            raise requests.HTTPError(f"Groq API: invalid JSON response: {(resp.text or '')[:200]}")
        return j.get("choices", [{}])[0].get("message", {}).get("content", "")

    raise requests.HTTPError(last_error or "Groq API: all model candidates failed")

# Helpers: sanitize and safely parse JSON from AI

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

def _infer_subdata_from_text(text: str):
    try:
        t = (text or '').lower()
        out = []
        def add(label, typ='string'):
            if not any((x.get('label','') or '').lower() == label.lower() for x in out):
                out.append({'label': label, 'type': typ})
        # Italian + English variants
        if re.search(r"country\s*code|codice\s*del\s*paese|prefisso\s*internazionale", t):
            add('Country code')
        if re.search(r"area\s*code|prefisso\s*area|prefisso\s*citt[aà]|\bprefisso\b", t):
            add('Area code')
        if re.search(r"\bnumber\b|\bnumero\b", t):
            add('Number')
        return out
    except Exception:
        return []

# --- step2: Data type recognition (detectType)
@app.post("/step2")
def step2(user_desc: Any = Body(...)):
    print("\nSTEP: /step2 – Data type recognition (detectType) with template system")
    try:
        # Import template manager
        try:
            from backend.type_template_manager import get_localized_template, get_available_types, load_templates
        except ImportError:
            from type_template_manager import get_localized_template, get_available_types, load_templates

        # Accept both plain text or an object { text, currentSchema }
        current_schema = None
        target_lang = "it"  # Default language

        if isinstance(user_desc, dict):
            text = str(user_desc.get('text') or user_desc.get('desc') or user_desc.get('user_desc') or "").strip()
            current_schema = user_desc.get('currentSchema') or user_desc.get('schema')
            target_lang = str(user_desc.get('lang') or user_desc.get('language') or "it").lower()
        else:
            text = str(user_desc or "").strip()

        # Load templates
        load_templates()
        available_types = get_available_types()

        # Check AI key availability
        if not (GROQ_KEY or OPENAI_KEY):
            raise HTTPException(status_code=500, detail="missing_ai_key")

        # ✅ NEW APPROACH: AI only detects types, templates provide structure
        types_list = '|'.join(available_types)

        print(f"[step2] Available types from templates: {types_list}")
        print(f"[step2] Target language: {target_lang}")

        # If refining existing schema, keep old behavior
        if current_schema and isinstance(current_schema, dict) and (current_schema.get('mainData') or current_schema.get('mains')):
            prompt = f"""
You are a data structure refiner.

Input (natural-language refinement):
{text}

Current structure (JSON):
{current_schema}

Return ONLY a strict JSON in this exact format (no markdown/comments/trailing commas):
{{
"type": "<one of: {types_list}>",
"icon": "<Lucide icon name>",
"schema": {{
    "label": "Data",
    "mainData": [
    {{
        "label": "<Main label in English>",
        "type": "<repeat 'type'>",
        "icon": "<Lucide icon name>",
        "subData": [
        {{ "label": "<Sub1>", "type": "string" }}
        ]
    }}
    ]
}}
}}

Rules:
- Choose the most specific type from the list above.
- If the description asks to split the field (e.g., country code, area code, number), include those parts in subData in natural order.
- Use concise English labels. No explanations.
"""
        else:
            # ✅ NEW: Simplified prompt to detect only types, templates will provide structure
            prompt = f"""
You are a data type detector.

User description:
{text}

Your task:
1. Identify ALL distinct data fields/concepts mentioned.
2. For EACH field, determine the most appropriate data type.

Available types: {types_list}

Return ONLY strict JSON (no markdown, no comments):
{{
  "fields": [
    {{"concept": "<short English description>", "type": "<type from list above>"}},
    {{"concept": "<concept2>", "type": "<type>"}}
  ]
}}

Examples:
Input: "chiedi nome e cognome"
Output: {{"fields": [{{"concept": "full name", "type": "name"}}]}}

Input: "chiedi data di nascita"
Output: {{"fields": [{{"concept": "date of birth", "type": "date"}}]}}

Input: "chiedi età"
Output: {{"fields": [{{"concept": "age", "type": "number"}}]}}

Input: "chiedi telefono"
Output: {{"fields": [{{"concept": "phone number", "type": "phone"}}]}}

Input: "chiedi email"
Output: {{"fields": [{{"concept": "email", "type": "email"}}]}}

Input: "chiedi nome cognome data di nascita telefono e email"
Output: {{"fields": [
  {{"concept": "full name", "type": "name"}},
  {{"concept": "date of birth", "type": "date"}},
  {{"concept": "phone number", "type": "phone"}},
  {{"concept": "email", "type": "email"}}
]}}

Rules:
- Be precise in type selection
- Use "number" for numeric fields (age, quantity, count)
- Use "generic" only when no specific type matches
- Multiple fields = multiple entries
"""

        print("AI PROMPT ================")
        print(prompt)

        # Provider routing (align with /step3)
        provider = (os.environ.get("AI_PROVIDER") or "groq").lower()
        print(f"[step2][provider]={provider} text_len={len(text)} has_current_schema={bool(current_schema)}")

        if provider == "openai":
            try:
                from backend.call_openai import call_openai_json as _call_json
            except Exception:
                from call_openai import call_openai_json as _call_json
        else:
            _call_json = call_groq_json

        ai = _call_json([
            {"role": "system", "content": "Always reply in English with strict JSON."},
            {"role": "user", "content": prompt}
        ])

        print("AI ANSWER ================")
        print(ai)

        ai_obj = ai if isinstance(ai, dict) else _safe_json_loads(ai)

        # ✅ NEW: Check for new format (fields array) or old format (type + schema)
        if isinstance(ai_obj, dict) and 'fields' in ai_obj:
            # New template-based approach
            fields = ai_obj.get('fields', [])
            if not fields or not isinstance(fields, list):
                raise HTTPException(status_code=500, detail="invalid_ai_response: no fields")

            # Build mainData from templates
            main_data_list = []

            # Get AI caller for translations
            provider = (os.environ.get("AI_PROVIDER") or "groq").lower()
            if provider == "openai":
                try:
                    from backend.call_openai import call_openai as _ai_caller
                except Exception:
                    from call_openai import call_openai as _ai_caller
            else:
                _ai_caller = None  # Groq doesn't support translation yet

            for field in fields:
                field_type = field.get('type', 'generic')
                field_concept = field.get('concept', 'Data field')

                print(f"[step2] Processing field: {field_concept} -> type: {field_type}")

                # Get template (with localization if needed)
                template = get_localized_template(field_type, target_lang, _ai_caller)

                if template:
                    # Use template structure
                    main_entry = {
                        'label': template.get('label', field_concept),
                        'type': template.get('type', field_type),
                        'icon': template.get('icon', 'FileText'),
                        'subData': template.get('subData', [])
                    }
                    print(f"[step2] Using template for {field_type}: {main_entry['label']}")
                else:
                    # Fallback: create basic entry
                    main_entry = {
                        'label': field_concept.title(),
                        'type': field_type,
                        'icon': 'FileText',
                        'subData': []
                    }
                    print(f"[step2] No template found for {field_type}, using fallback")

                main_data_list.append(main_entry)

            # Build final response
            response = {
                'type': 'object',
                'icon': 'Folder',
                'schema': {
                    'label': 'Data',
                    'mainData': main_data_list
                }
            }

            print(f"[step2] Built schema with {len(main_data_list)} fields from templates")
            return {"ai": response}

        elif isinstance(ai_obj, dict) and ai_obj.get('type') and ai_obj.get('icon'):
            # Old format compatibility (for refinement mode)
            inferred = _infer_subdata_from_text(text)
            if (ai_obj.get('type') in (None, 'text')) and inferred:
                ai_obj['type'] = 'phone'
                ai_obj['icon'] = 'Phone'
            if 'schema' not in ai_obj:
                ai_obj['schema'] = {
                    'label': 'Data',
                    'mainData': [{
                        'label': str(ai_obj.get('type', 'Data')).title(),
                        'type': ai_obj.get('type'),
                        'icon': ai_obj.get('icon'),
                        'subData': inferred
                    }]
                }
            return {"ai": ai_obj}
        else:
            raise HTTPException(status_code=500, detail="invalid_ai_response")
    except HTTPException:
        raise
    except Exception as e:
        print("[step2][fatal]", str(e))
        raise HTTPException(status_code=500, detail=f"step2_error: {str(e)}")

# --- step3: Suggest constraints/validations (constraints)
@app.post("/step3")
def step3(schema: dict = Body(...)):
    print("\nSTEP: /step3 – Suggest constraints/validations")
    # Accetta direttamente lo schema dal frontend (label + mains/mainData)
    # Normalizza a un oggetto semplice da passare al prompt
    try:
        schema_in = schema if isinstance(schema, dict) else {}
        # Compat: alcuni client usano 'mains' invece di 'mainData'
        if 'mains' in schema_in and 'mainData' not in schema_in:
            schema_in = { **schema_in, 'mainData': schema_in.get('mains') }
        # Include anche la descrizione del designer se presente
        desc_text = ''
        try:
            if isinstance(schema, dict):
                desc_text = str(schema.get('text') or schema.get('desc') or schema.get('user_desc') or '').strip()
        except Exception:
            desc_text = ''
        _designer_prefix = (f"Designer description:\n{desc_text}\n\n" if desc_text else '')

        prompt = f"""
You are a data validation assistant.

{_designer_prefix}Given the following data structure, suggest appropriate validation constraints for each field and its subfields (if any).

Input schema (JSON):
{schema_in}

Respond ONLY with strict JSON (no markdown/comments), using this format:
{{
"schema": {{
    "mainData": [
    {{
        "label": "<Main label>",
    "constraints": [ ... ],
    "subData": [
        {{ "label": "<Sub label>", "constraints": [ ... ] }}
    ]
}}
    ]
}}
}}
"""
        print("AI PROMPT ================")
        print(prompt)

        # Provider routing: default OpenAI; override with AI_PROVIDER if set
        provider = (os.environ.get("AI_PROVIDER") or "groq").lower()
        if provider == "openai":
            try:
                from backend.call_openai import call_openai_json as _call_json
            except Exception:
                from call_openai import call_openai_json as _call_json
        else:
            _call_json = call_groq_json

        ai = _call_json([
            {"role": "system", "content": "Always reply in English with strict JSON."},
            {"role": "user", "content": prompt}
        ])
        print("AI ANSWER ================")
        print(ai)
        ai_obj = ai if isinstance(ai, dict) else _safe_json_loads(ai)
        if ai_obj is None:
            return {"ai": {"schema": {"mainData": []}}, "error": "Failed to parse AI JSON"}
        print("[AI RESPONSE /step3]", ai_obj)
        # Ensure shape always includes 'schema'
        if isinstance(ai_obj, dict) and 'schema' in ai_obj:
            return {"ai": ai_obj}
        return {"ai": {"schema": ai_obj}}
    except Exception as e:
        try: print("[step3][fatal]", str(e))
        except Exception: pass
        return {"ai": {"schema": {"mainData": []}}}

# --- step3b: Parse user constraints (optional, sub-step)
@app.post("/step3b")
def step3b(user_constraints: str = Body(...), meaning: str = Body(...), desc: str = Body(...)):
    print("\nSTEP: /step3b – Parse user constraints (optional, sub-step)")
    prompt = (
        f"Rispondi in {IDE_LANGUE}. Interpreta e formalizza la risposta utente '{user_constraints}' in una lista di constraint chiari e strutturati per il dato '{meaning}' ({desc})."
    )
    print("AI PROMPT ================")
    print(prompt)
    ai = call_groq([
        {"role": "system", "content": f"Rispondi sempre in {IDE_LANGUE}."},
        {"role": "user", "content": prompt}
    ])
    print("AI ANSWER ================")
    print(ai)
    return {"ai": ai}

# --- step4: Generate DDT messages (generateMessages)
@app.post("/step4")
def step4(ddt_structure: dict = Body(...)):
    print("\nSTEP: /step4 – Generate DDT messages (generateMessages)")
    prompt = """
You are writing for a voice (phone) customer‑care agent.
Generate the agent's spoken messages to collect the data described by the DDT structure.

Style and constraints:
- One short sentence (about 4–12 words), natural, polite, human.
- Phone conversation tone: concise, fluid, not robotic.
- Prefer light contractions when natural (I'm, don't, can't).
- Neutral and professional; no chit‑chat, no opinions, no humor.
- NEVER ask about "favorite …" or "why".
- No emojis and no exclamation marks.
- Do NOT use UI words like "click", "type", "enter". Use "say/tell/give".
- NEVER output example values or names (e.g., "Emily", "01/01/2000", "Main Street").
- NEVER output greetings or generic help phrases (e.g., "How may I help you today").
- Use the field label; if the field is composite, ask ONLY the missing part (e.g., Day, Month, Year).
- Add compact format hints when useful: (DD/MM/YYYY), (YYYY), (email), (+country code).
- English only.

Output format (strict JSON only, no comments, no trailing commas):
"runtime.<DDT_ID>.<step>#<index>.<action>.text": "<message>"

Generation rules:
- start: 1 message per field/subfield. Example: "Please tell me your date of birth (DD/MM/YYYY)?"
- noInput: 3 concise re‑asks with natural variations. Example: "Could you share the date of birth (DD/MM/YYYY)?"
- noMatch: 3 concise clarifications with hint. Prefer voice phrasing like "I didn't catch that" over "I couldn't parse that". Example: "I didn't catch that. Date of birth (DD/MM/YYYY)?"
- confirmation: 2 short confirmations like "Is this correct: {{ '{input}' }}?"
- success: 1 short acknowledgement like "Thanks, got it."
- For subData (e.g., date): ask targeted parts — "Day?", "Month?", "Year?" (or "Which year (YYYY)?").
- For start, noInput, and noMatch: the text MUST directly ask for the value and MUST end with a question mark.
- Only confirmation messages may include the {{ '{input}' }} placeholder.

Avoid examples like:
- "What's your favorite year and why is it special?"

Where:
- <DDT_ID> is the unique ID of the DDT (use the value from the input).
- <step> is one of: start, noMatch, noInput, confirmation, success, or the name of a constraint (e.g., "required", "range").
- <index> is the escalation index (starting from 1).
- <action> is the action type (e.g., SayMessage, ConfirmInput), followed by a placeholder ID or suffix.
- Example: "runtime.DDT_Birthdate.noMatch#1.SayMessage_1.text"

IMPORTANT:
- DO NOT generate any IDs or GUIDs — use static suffixes like SayMessage_1.
- DO NOT include any explanation, markdown or comments, or text outside the JSON. If unsure, return an empty object.

Input DDT structure:
""" + str(ddt_structure)
    print("AI PROMPT ================")
    print(prompt)
    ai = call_groq([
        {"role": "system", "content": "Always reply in English."},
        {"role": "user", "content": prompt}
    ])
    print("AI ANSWER ================")
    print(ai)
    ai_obj = _safe_json_loads(ai)
    if ai_obj is None:
        return {"ai": {}, "error": "Failed to parse AI JSON"}
    print("[GROQ RESPONSE /step4]", ai_obj)
    return {"ai": ai_obj}

# --- API: Generate Regex from natural language description ---
@app.post("/api/nlp/generate-regex")
def generate_regex(body: dict = Body(...)):
    """
    Generate a regex pattern from a natural language description.

    Body example:
    {
      "description": "numeri di telefono italiani"
    }

    Returns:
    {
      "regex": "\\+39\\s?\\d{3}\\s?\\d{3}\\s?\\d{4}",
      "explanation": "Matches Italian phone numbers with optional spaces",
      "examples": ["+39 333 123 4567", "+393331234567"]
    }
    """
    print("\n[API] POST /api/nlp/generate-regex")

    try:
        description = (body or {}).get("description", "").strip()

        if not description:
            raise HTTPException(status_code=400, detail="Description is required")

        # Check AI key availability
        if not (GROQ_KEY or OPENAI_KEY):
            raise HTTPException(status_code=500, detail="missing_ai_key")

        # Build AI prompt for regex generation
        prompt = f"""
You are a regex expert. Generate a JavaScript-compatible regular expression pattern based on the user's description.

User description: "{description}"

Requirements:
1. Generate a regex pattern that matches the described pattern
2. Escape special characters properly for JavaScript (use \\\\ for backslashes)
3. Provide a clear explanation of what the regex matches
4. Include 2-3 realistic examples that match the pattern
5. Consider edge cases and common variations
6. For Italian contexts, consider Italian formats (phone numbers, postal codes, etc.)

Return ONLY a strict JSON object with this format (no markdown, no extra text):
{{
  "regex": "your-regex-pattern-here",
  "explanation": "Clear explanation of what this regex matches",
  "examples": ["example1", "example2", "example3"],
  "flags": "gi"
}}

Common patterns for reference:
- Email: [a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{{2,}}
- Italian phone: \\+39\\s?\\d{{3}}\\s?\\d{{3}}\\s?\\d{{4}}
- Italian postal code (CAP): \\d{{5}}
- Italian tax code (CF): [A-Z]{{6}}\\d{{2}}[A-Z]\\d{{2}}[A-Z]\\d{{3}}[A-Z]
- Date (dd/mm/yyyy): \\d{{2}}/\\d{{2}}/\\d{{4}}
- Number: -?\\d+(?:[.,]\\d+)?
- URL: https?://[^\\s/$.?#].[^\\s]*
- Italian VAT (P.IVA): \\d{{11}}

Be precise and practical. Test mentally that your regex works correctly.
"""

        print(f"[generate-regex] Description: {description}")
        print("[generate-regex] Calling AI...")

        # Provider routing
        provider = (os.environ.get("AI_PROVIDER") or "groq").lower()
        print(f"[generate-regex] Provider: {provider}")

        if provider == "openai":
            try:
                from backend.call_openai import call_openai_json as _call_json
            except Exception:
                from call_openai import call_openai_json as _call_json
        else:
            _call_json = call_groq_json

        # Call AI
        ai_response = _call_json([
            {"role": "system", "content": "You are a regex expert. Always return valid JSON."},
            {"role": "user", "content": prompt}
        ])

        print("[generate-regex] AI Response:", ai_response)

        # Parse response
        if isinstance(ai_response, dict):
            result = ai_response
        else:
            result = _safe_json_loads(ai_response)

        if not result or not isinstance(result, dict) or 'regex' not in result:
            raise HTTPException(status_code=500, detail="AI returned invalid response")

        # Validate regex can be compiled
        try:
            import re as regex_module
            regex_module.compile(result.get('regex', ''))
        except Exception as regex_error:
            print(f"[generate-regex] WARNING: Generated regex is invalid: {regex_error}")
            result['warning'] = f"Generated regex may be invalid: {str(regex_error)}"

        print(f"[generate-regex] Success! Regex: {result.get('regex')}")

        return {
            "success": True,
            "regex": result.get('regex', ''),
            "explanation": result.get('explanation', ''),
            "examples": result.get('examples', []),
            "flags": result.get('flags', 'g')
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[generate-regex] ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error generating regex: {str(e)}")

# --- API: Generate TypeScript Extractor from natural language description ---
@app.post("/api/nlp/generate-extractor")
def generate_extractor(body: dict = Body(...)):
    """
    Generate a TypeScript DataExtractor implementation from a natural language description.

    Body example:
    {
      "description": "Extract age between 1-120, accept numeric or written form (uno, due, tre...)",
      "dataType": "number"
    }

    Returns:
    {
      "success": true,
      "code": "export const ageExtractor: DataExtractor<number> = { ... }",
      "explanation": "This extractor validates age between 1-120..."
    }
    """
    print("\n[API] POST /api/nlp/generate-extractor")

    try:
        description = (body or {}).get("description", "").strip()
        data_type = (body or {}).get("dataType", "string").strip()

        if not description:
            raise HTTPException(status_code=400, detail="Description is required")

        if not (GROQ_KEY or OPENAI_KEY):
            raise HTTPException(status_code=500, detail="missing_ai_key")

        prompt = f"""
You are a TypeScript expert specializing in data extraction and validation.

User wants: "{description}"
Base data type: {data_type}

Generate a complete TypeScript DataExtractor implementation following this interface:

interface DataExtractor<T> {{
  extract(text: string): {{ value?: T; confidence: number; reasons?: string[] }};
  validate(value: T): {{ ok: boolean; errors?: string[] }};
  format(value: T): string;
}}

Requirements:
1. START with a JSDoc comment block containing the user's original request verbatim
2. The JSDoc header MUST be in this exact format:
   /**
    * {description}
    *
    * AI-generated extractor for semantic data extraction
    */
3. Export a const with a descriptive name (e.g., ageExtractor, emailExtractor)
4. Handle all edge cases: empty input, null, undefined, invalid formats
5. For Italian context: support Italian language where relevant (month names, numbers, etc.)
6. Return confidence scores: 0.9+ for exact matches, 0.7-0.8 for fuzzy, 0 for invalid
7. Add clear inline comments explaining the logic
8. Use type-safe TypeScript (use proper types for T generic)
9. The extract() method should parse the text and return the extracted value
10. The validate() method should validate the extracted value semantically
11. The format() method should return a user-friendly string representation

Example for age 1-120:

/**
 * Extract age between 1-120, accept numeric or written form (uno, due, tre...)
 *
 * AI-generated extractor for semantic data extraction
 */
export const ageExtractor: DataExtractor<number> = {{
  extract(text) {{
    const raw = text.trim().toLowerCase();

    // Try numeric parsing
    const num = parseInt(raw, 10);
    if (!isNaN(num)) {{
      return {{ value: num, confidence: 0.9 }};
    }}

    // Try Italian written numbers
    const written: Record<string, number> = {{
      'uno': 1, 'due': 2, 'tre': 3, 'quattro': 4, 'cinque': 5,
      'sei': 6, 'sette': 7, 'otto': 8, 'nove': 9, 'dieci': 10,
      'undici': 11, 'dodici': 12, 'tredici': 13, 'quattordici': 14,
      'quindici': 15, 'sedici': 16, 'diciassette': 17, 'diciotto': 18,
      'diciannove': 19, 'venti': 20, 'trenta': 30, 'quaranta': 40,
      'cinquanta': 50, 'sessanta': 60, 'settanta': 70, 'ottanta': 80,
      'novanta': 90, 'cento': 100
    }};

    if (written[raw]) {{
      return {{ value: written[raw], confidence: 0.85 }};
    }}

    return {{ confidence: 0, reasons: ['invalid-format'] }};
  }},

  validate(v) {{
    if (typeof v !== 'number' || isNaN(v)) {{
      return {{ ok: false, errors: ['not-a-number'] }};
    }}
    if (v < 1 || v > 120) {{
      return {{ ok: false, errors: ['age-out-of-range'] }};
    }}
    return {{ ok: true }};
  }},

  format(v) {{
    return `${{v}} anni`;
  }}
}};

Return ONLY the TypeScript code WITH the JSDoc header, no markdown blocks, no explanations outside the code.
Make it production-ready and well-commented.
"""

        print(f"[generate-extractor] Description: {description}")
        print(f"[generate-extractor] Data type: {data_type}")
        print("[generate-extractor] Calling AI...")

        provider = (os.environ.get("AI_PROVIDER") or "groq").lower()
        print(f"[generate-extractor] Provider: {provider}")

        if provider == "openai":
            try:
                from backend.call_openai import call_openai as _call_ai
            except Exception:
                from call_openai import call_openai as _call_ai
        else:
            _call_ai = call_groq

        ai_response = _call_ai([
            {"role": "system", "content": "You are a TypeScript expert. Generate clean, production-ready DataExtractor code."},
            {"role": "user", "content": prompt}
        ])

        print("[generate-extractor] AI Response received")

        # Clean up response (remove markdown if present)
        code = str(ai_response).strip()

        # Remove markdown code blocks if present
        if code.startswith('```typescript') or code.startswith('```ts'):
            code = code.split('\n', 1)[1] if '\n' in code else code
        if code.startswith('```'):
            code = code.split('\n', 1)[1] if '\n' in code else code
        if code.endswith('```'):
            code = code.rsplit('\n', 1)[0] if '\n' in code else code

        code = code.strip()

        if not code or len(code) < 50:
            raise HTTPException(status_code=500, detail="AI returned invalid or empty code")

        print(f"[generate-extractor] Success! Generated {len(code)} characters of code")

        # Extract a brief explanation from comments if possible
        explanation = "AI-generated TypeScript extractor"
        try:
            # Look for first multi-line comment or series of single-line comments
            if '/*' in code:
                start = code.index('/*')
                end = code.index('*/', start) + 2
                explanation = code[start:end].replace('/*', '').replace('*/', '').strip()
            elif code.count('//') > 2:
                lines = [l.strip()[2:].strip() for l in code.split('\n') if l.strip().startswith('//')]
                if lines:
                    explanation = ' '.join(lines[:3])
        except:
            pass

        return {
            "success": True,
            "code": code,
            "explanation": explanation[:200] if len(explanation) > 200 else explanation
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[generate-extractor] ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error generating extractor: {str(e)}")

# --- API: Refine existing TypeScript Extractor based on user comments/TODOs ---
@app.post("/api/nlp/refine-extractor")
def refine_extractor(body: dict = Body(...)):
    """
    Refine existing TypeScript DataExtractor code based on:
    - TODO comments in the code
    - User improvement requests
    - Test failure notes (optional)

    Body example:
    {
      "code": "export const extractor = { extract(text) { /* TODO: add validation */ } }",
      "improvements": "implement TODO comments and add Italian number support",
      "testNotes": ["Should parse 'venti' as 20", "Failed on negative numbers"],
      "dataType": "number"
    }

    Returns:
    {
      "success": true,
      "code": "improved TypeScript code",
      "explanation": "what was changed"
    }
    """
    print("\n[API] POST /api/nlp/refine-extractor")

    try:
        existing_code = (body or {}).get("code", "").strip()
        improvements = (body or {}).get("improvements", "").strip()
        test_notes = (body or {}).get("testNotes", [])
        data_type = (body or {}).get("dataType", "string").strip()

        if not existing_code:
            raise HTTPException(status_code=400, detail="Existing code is required")

        if not improvements or len(improvements) < 5:
            raise HTTPException(status_code=400, detail="Improvements description is required (min 5 characters)")

        if not (GROQ_KEY or OPENAI_KEY):
            raise HTTPException(status_code=500, detail="missing_ai_key")

        # Build test notes section
        test_notes_section = ""
        if test_notes and isinstance(test_notes, list) and len(test_notes) > 0:
            test_notes_section = "\n\nTEST FAILURE NOTES:\n" + "\n".join(f"- {note}" for note in test_notes[:10])

        prompt = f"""
You are a TypeScript expert. Refine and improve this existing DataExtractor code.

CURRENT CODE:
{existing_code}

USER IMPROVEMENT REQUESTS:
{improvements}{test_notes_section}

Your tasks:
1. Implement any TODO or FIXME comments found in the code
2. Address the user's improvement requests
3. Fix issues mentioned in test failure notes (if any)
4. Keep the existing structure and working logic intact
5. Preserve the JSDoc header if present, or add one summarizing what you changed
6. Add inline comments explaining what you improved
7. Ensure the code follows the DataExtractor<T> interface:
   interface DataExtractor<T> {{
     extract(text: string): {{ value?: T; confidence: number; reasons?: string[] }};
     validate(value: T): {{ ok: boolean; errors?: string[] }};
     format(value: T): string;
   }}

8. For Italian context: support Italian language where relevant (month names, numbers, etc.)
9. Return confidence scores: 0.9+ for exact matches, 0.7-0.8 for fuzzy, 0 for invalid
10. Use type-safe TypeScript (proper types for T generic: {data_type})

Important:
- Do NOT rewrite the entire code from scratch unless absolutely necessary
- Keep what works, improve what doesn't
- Add a comment at the top summarizing your changes (if not already present)

Return ONLY the improved TypeScript code, no markdown blocks, no explanations outside the code.
"""

        print(f"[refine-extractor] Code length: {len(existing_code)} chars")
        print(f"[refine-extractor] Improvements: {improvements[:100]}...")
        print(f"[refine-extractor] Test notes: {len(test_notes)} items")
        print("[refine-extractor] Calling AI...")

        provider = (os.environ.get("AI_PROVIDER") or "groq").lower()
        print(f"[refine-extractor] Provider: {provider}")

        if provider == "openai":
            try:
                from backend.call_openai import call_openai as _call_ai
            except Exception:
                from call_openai import call_openai as _call_ai
        else:
            _call_ai = call_groq

        ai_response = _call_ai([
            {"role": "system", "content": "You are a TypeScript expert. Improve existing code incrementally, keeping what works."},
            {"role": "user", "content": prompt}
        ])

        print("[refine-extractor] AI Response received")

        # Clean up response (remove markdown if present)
        code = str(ai_response).strip()

        # Remove markdown code blocks if present
        if code.startswith('```typescript') or code.startswith('```ts'):
            code = code.split('\n', 1)[1] if '\n' in code else code
        if code.startswith('```'):
            code = code.split('\n', 1)[1] if '\n' in code else code
        if code.endswith('```'):
            code = code.rsplit('\n', 1)[0] if '\n' in code else code

        code = code.strip()

        if not code or len(code) < 50:
            raise HTTPException(status_code=500, detail="AI returned invalid or empty code")

        print(f"[refine-extractor] Success! Refined code: {len(code)} characters")

        # Extract explanation from changes (look for comments at top)
        explanation = "Code refined based on your improvements"
        try:
            # Look for summary comment at the top
            if code.startswith('/**') or code.startswith('//'):
                lines = code.split('\n')
                comment_lines = []
                for line in lines[:10]:  # Check first 10 lines
                    if line.strip().startswith('*') or line.strip().startswith('//'):
                        clean_line = line.strip().lstrip('*').lstrip('/').strip()
                        if clean_line and not clean_line.startswith('AI-generated'):
                            comment_lines.append(clean_line)
                if comment_lines:
                    explanation = ' '.join(comment_lines[:2])  # First 2 meaningful lines
        except:
            pass

        return {
            "success": True,
            "code": code,
            "explanation": explanation[:200] if len(explanation) > 200 else explanation
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[refine-extractor] ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error refining extractor: {str(e)}")

# --- step5: Generate validation scripts (generateValidationScripts) ---
@app.post("/step5")
def step5(constraint_json: dict = Body(...)):
    print("\nSTEP: /step5 – Generate validation scripts (generateValidationScripts)")
    prompt = """
You are a validation script generator.

Given the following constraint definition:
""" + str(constraint_json) + """

Generate a reusable validation script for this constraint in three languages:
- JavaScript
- Python
- TypeScript

Each script must define a **pure function** that takes one input (`value`) and returns `true` or `false` depending on whether the value satisfies the constraint.

Respond ONLY with a JSON object in this exact format:
{
"js": "function validate(value) { /* JavaScript code */ }",
"py": "def validate(value):\n    # Python code",
"ts": "function validate(value: any): boolean { /* TypeScript code */ }"
}

⚠️ DO NOT:
- Include any explanation, markdown or comments outside the JSON object.
- Generate any random ID, GUID, or metadata.
- Use print(), console.log(), or output messages — only return functions.

All three functions must have the same name: `validate`.
"""

    # ... [rest of the step5 code remains unchanged]
