from fastapi import FastAPI, Body, Request, Response
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
	from backend.ai_steps.step2_detect_type import router as step2_router
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
except Exception:
	from ai_steps.step3_suggest_constraints import router as step3_router
	from ai_steps.step2_detect_type import router as step2_router
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

GROQ_KEY = os.environ.get("Groq_key")
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
app.include_router(step2_router)
app.include_router(step3_router)
app.include_router(constraint_messages_router)
app.include_router(generate_validator_router)
app.include_router(generate_tests_router)
app.include_router(stepNoMatch_router)
app.include_router(stepNoInput_router)
app.include_router(stepConfirmation_router)
app.include_router(stepSuccess_router)
app.include_router(startPrompt_router)
app.include_router(stepNotConfirmed_router)
app.include_router(nlp_extract_router)
app.include_router(ner_router)
app.include_router(parse_address_router)

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
    try:
        ai = call_groq_json([
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

    SYSTEM = (
        "You are an expert backend engineer. You generate concise labels and boolean JS.\n"
        "Output policy:\n"
        "- If description is sufficient, return JSON {\"label\":\"...\",\"script\":\"...\"}.\n"
        "- If insufficient, return ONLY {\"question\":\"...\"}.\n"
        "Script field REQUIREMENTS (critical): The value of 'script' MUST be a JSON string containing the JavaScript code. Do NOT return objects or functions in 'script'. Do NOT wrap in markdown fences. Example OK: {\"script\":\"try {\\n  return true;\\n} catch { return false; }\"}.\n"
        "Script rules: single boolean return; use vars[\"...\"]; null/undefined checks; no logs.\n"
        "Formatting: ALWAYS return multi-line, readable, well-indented JavaScript with line breaks; include 1-2 short inline comments for key steps."
    )
    GUIDELINES = (
        "Guidelines by type: DOB/age: compute from date; >=18 true. Date compare: parse ISO; compare getTime(). "
        "Email: robust regex; trim lowercase. Phone: strip non-digits; length>=9. Strings: trim; case-insensitive equals unless specified. "
        "Numbers: Number(); guard NaN. Presence: Boolean(vars[\"...\"])."
    )
    examples = [
        {
            "role": "system",
            "content": (
                'Example: NL "utente maggiorenne"; vars include "Act.DOB" -> '
                '{"label":"Utente maggiorenne","script":"try { const dob = vars[\\"Act.DOB\\"]; if (!dob) return false; const d = new Date(dob); if (isNaN(d.getTime())) return false; const now = new Date(); let age = now.getFullYear() - d.getFullYear(); const m = now.getMonth() - d.getMonth(); if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--; return age >= 18; } catch { return false; }"}'
            )
        }
    ]
    user = {
        "role": "user",
        "content": (
            "Natural language description:\n" + nl + "\n\nAvailable variables (dotted):\n" + " | ".join([str(v) for v in variables]) + "\nReturn only JSON."
        )
    }
    try:
        ai = call_groq_json([
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
        # heuristic fallback: if no script or placeholder, synthesize adult check when DOB variable is present
        try:
            script_s = (obj.get("script") or "").strip() if isinstance(obj, dict) else ""
            nl_lc = (nl or "").lower()
            need_adult = any(k in nl_lc for k in ["maggiorenne", "adult", ">= 18", "18 anni", "18 years"]) or True
            # choose DOB-like variable
            dob_candidates = []
            for v in (variables or []):
                vs = str(v)
                if re.search(r"date of birth|\bDOB\b", vs, flags=re.I) or vs.endswith(".Date"):
                    dob_candidates.append(vs)
            if (not script_s or script_s == "try { return false; } catch { return false; }") and dob_candidates:
                key = dob_candidates[0]
                script_tpl = (
                    "try {\n"+
                    f"  const dob = vars[\"{key}\"];\n"+
                    "  if (!dob) return false;\n"+
                    "  const d = new Date(dob);\n"+
                    "  if (isNaN(d.getTime())) return false;\n"+
                    "  const now = new Date();\n"+
                    "  let age = now.getFullYear() - d.getFullYear();\n"+
                    "  const m = now.getMonth() - d.getMonth();\n"+
                    "  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;\n"+
                    "  return age >= 18;\n"+
                    "} catch { return false; }"
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
    try:
        ai = call_groq_json([
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
		print(f"[PROXY→EXPRESS] {method} {target_url}")
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

# --- step2: Data type recognition (detectType)
@app.post("/step1")
def step2(user_desc: str = Body(...)):
	EN_MEANINGS = [
		'date of birth', 'email', 'phone number', 'address', 'number', 'text', 'boolean'
	]
	ICON_LIST = [
		'Sparkles', 'CheckSquare', 'Hash', 'Type', 'IdCard', 'Gift', 'Phone', 'Calendar', 'Mail', 'HelpCircle', 'MapPin', 'FileQuestion'
	]
	print("\nSTEP: /step2 – Data type recognition (detectType)")
	prompt = f"""
You are a data type classifier.

Given the following user intent (in English), extract the most specific data type from this list:
{EN_MEANINGS}

If the type is not included in the list, suggest a new one (in English).

Also, assign the most appropriate Lucide icon name from this list:
{ICON_LIST}

If no suitable icon is found, use 'HelpCircle'.

Respond ONLY with a JSON object in this format (strict JSON, no comments, no trailing commas):
{{ "type": "<English label>", "icon": "<Lucide icon name>" }}

User intent: '{user_desc}'
"""
	print("AI PROMPT ================")
	print(prompt)
	ai = call_groq([
		{"role": "system", "content": "Always reply in English."},
		{"role": "user", "content": prompt}
	])
	print("AI ANSWER ================")
	print(ai)
	try:
		ai_obj = json.loads(ai)
		print("[GROQ RESPONSE /step2]", ai_obj)
		if not isinstance(ai_obj, dict) or 'type' not in ai_obj or 'icon' not in ai_obj:
			return {"error": "unrecognized_data_type"}
		if ai_obj['type'] == 'unrecognized_data_type':
			return {"error": "unrecognized_data_type"}
		return {"ai": ai_obj}
	except Exception:
		return {"error": "unrecognized_data_type"}

# --- step3: Suggest constraints/validations (constraints)
@app.post("/step2")
def step3(meaning: str = Body(...), desc: str = Body(...)):
	print("\nSTEP: /step3 – Suggest constraints/validations")
	prompt = f"""
You are a data validation assistant.

Given the following data field (with possible subfields), suggest the most appropriate validation constraints for each field.

The data is structured as JSON with the following format:
- Each field has: "name", "label", and "type".
- It may optionally have "subData" (an array of nested fields).
- Some fields may not have subData. In that case, omit the subData array.

Example input:
{{
  "name": "birthdate",
  "label": "Date of Birth",
  "type": "object",
  "subData": [
    {{ "name": "day", "label": "Day", "type": "number" }},
    {{ "name": "month", "label": "Month", "type": "number" }},
    {{ "name": "year", "label": "Year", "type": "number" }}
  ]
}}

For each field (main and subfields), suggest a list of constraints in this format:
[
  {{
    "type": "required",
    "label": "Required",
    "description": "This field must be filled in.",
    "payoff": "Ensures the user provides this value."
  }},
  ...
]

You can suggest multiple constraints per field if relevant (e.g. required + format + range).

Respond ONLY with a single strict JSON object (no markdown, no comments, no trailing commas) in this format:
{{
  "mainData": {{
    "constraints": [ ... ],
    "subData": [
      {{ "name": "day", "constraints": [ ... ] }},
      {{ "name": "month", "constraints": [ ... ] }},
      {{ "name": "year", "constraints": [ ... ] }}
    ]
  }}
}}

Do NOT generate any id or GUID. Do NOT include explanations or comments outside the JSON. All messages and labels must be in English. If unsure, return an empty object.
"""
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
	print("[GROQ RESPONSE /step3]", ai_obj)
	return {"ai": ai_obj}

# --- step3b: Parse user constraints (optional, sub-step)
@app.post("/step4")
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
	prompt = f"""
You are writing for a voice (phone) customer‑care agent.
Generate the agent’s spoken messages to collect the data described by the DDT structure.

Style and constraints:
- One short sentence (about 4–12 words), natural, polite, human.
- Phone conversation tone: concise, fluid, not robotic.
- Prefer light contractions when natural (I'm, don't, can't).
- Neutral and professional; no chit‑chat, no opinions, no humor.
- NEVER ask about “favorite …” or “why”.
- No emojis and no exclamation marks.
- Do NOT use UI words like “click”, “type”, “enter”. Use “say/tell/give”.
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
- noMatch: 3 concise clarifications with hint. Prefer voice phrasing like “I didn’t catch that” over “I couldn’t parse that”. Example: "I didn't catch that. Date of birth (DD/MM/YYYY)?"
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
{ddt_structure}
"""
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

# --- step5: Generate validation scripts (generateValidationScripts) ---
@app.post("/step5")
def step5(constraint_json: dict = Body(...)):
	print("\nSTEP: /step5 – Generate validation scripts (generateValidationScripts)")
	prompt = f"""
You are a validation script generator.

Given the following constraint definition:
{constraint_json}

Generate a reusable validation script for this constraint in three languages:
- JavaScript
- Python
- TypeScript

Each script must define a **pure function** that takes one input (`value`) and returns `true` or `false` depending on whether the value satisfies the constraint.

Respond ONLY with a JSON object in this exact format:
{{
  "js": "function validate(value) {{ /* JavaScript code */ }}",
  "py": "def validate(value):\n    # Python code",
  "ts": "function validate(value: any): boolean {{ /* TypeScript code */ }}"
}}

⚠️ DO NOT:
- Include any explanation, markdown or comments outside the JSON object.
- Generate any random ID, GUID, or metadata.
- Use print(), console.log(), or output messages — only return functions.

All three functions must have the same name: `validate`.
"""
	print("AI PROMPT ================")
	print(prompt)
	ai = call_groq([
		{"role": "system", "content": "Always reply in English."},
		{"role": "user", "content": prompt}
	])
	print("AI ANSWER ================")
	print(ai)
	try:
		ai_obj = json.loads(ai)
		return {"ai": ai_obj}
	except Exception as e:
		return {"error": f"Failed to parse AI JSON: {str(e)}"}

# --- Constraint Generation Endpoint ---

@app.post("/api/generateConstraint")
async def generate_constraint(request: Request):
	data = await request.json()
	description = data.get("description", "")
	variable = data.get("variable", "value")
	type_ = data.get("type", "string")

	prompt = f'''
You are an expert coding assistant.
Generate a script that solves the following problem:

{description}

Requirements:
- Add a short summary at the top (in plain English) as a comment.
- Add inline comments to explain each important step.
- Return the script in three languages: JavaScript, Python, and TypeScript.
- For each language, include all comments and best practices.
- The field "tests" is MANDATORY and must contain at least 3 test cases. If you do not know what to put, invent plausible test cases.
- The field "label" is MANDATORY and must be a synthetic name (max 2 words) that describes the constraint, suitable for use as a tab title.
- The field "payoff" is MANDATORY and must be a natural language description (1-2 lines) that explains what the constraint does, suitable for use as a tooltip or subtitle.
- Respond ONLY with a valid JSON object, no markdown, no explanations, no text outside the JSON. The output MUST be parsable by Python's json.loads().
- The JSON structure must be:
{{
  "label": "...",
  "payoff": "...",
  "summary": "...",
  "scripts": {{
    "js": "// JavaScript code here",
    "py": "# Python code here",
    "ts": "// TypeScript code here"
  }},
  "tests": [
    {{ "input": <example input>, "expected": <example expected>, "description": "..." }}
  ]
}}

Example output:
{{
  "label": "Past Date",
  "payoff": "Checks if the given date is in the past compared to today.",
  "summary": "Checks if a date is in the past.",
  "scripts": {{
    "js": "// JavaScript code...",
    "py": "# Python code...",
    "ts": "// TypeScript code..."
  }},
  "tests": [
    {{ "input": [2020, 1, 1], "expected": true, "description": "Past date" }},
    {{ "input": [2099, 1, 1], "expected": false, "description": "Future date" }},
    {{ "input": [2022, 12, 31], "expected": true, "description": "Recent past date" }}
  ]
}}
'''

	ai = call_groq([
		{"role": "system", "content": "Always reply in English."},
		{"role": "user", "content": prompt}
	])
	print("AI RAW RESPONSE:", ai)
	try:
		ai_obj = json.loads(ai)
		return ai_obj
	except Exception as e:
		return {"error": f"Failed to parse AI JSON: {str(e)}"}

@app.post("/api/ddt/structure")
async def ddt_structure(request: Request):
	try:
		data = await request.json()
	except Exception:
		data = {}
	name = data.get('name', 'unknown') if isinstance(data, dict) else 'unknown'
	desc = data.get('desc', '') if isinstance(data, dict) else ''
	return {
		"ddt": {
			"name": name,
			"desc": desc,
			"fields": [
				{"field": "example", "type": "string"}
			]
		},
		"messages": {
			"it": "Messaggio di esempio",
			"en": "Sample message"
		}
	}

# --- stepNoMatch: Generate no match prompts ---
@app.post("/api/stepNoMatch")
def step_no_match(body: dict = Body(...)):
	print("[BACKEND] /api/stepNoMatch CHIAMATA - body:", body)
	meaning = body.get('meaning', '')
	desc = body.get('desc', '')
	print("\nSTEP: /api/stepNoMatch – Generazione messaggi no match")
	prompt = f"""
You are a conversational AI message generator.

Generate 3 escalation messages to use when the user input does not match the expected data type: '{meaning}'.

Return ONLY a JSON array of 3 English strings, no explanations, no comments, no IDs.
"""
	print("AI PROMPT ================")
	print(prompt)
	ai = call_groq([
		{"role": "system", "content": "Always reply in English."},
		{"role": "user", "content": prompt}
	])
	print("AI ANSWER ================")
	print(ai)
	try:
		ai_obj = json.loads(ai)
		print("[GROQ RESPONSE /stepNoMatch]", ai_obj)
		print("[BACKEND] /api/stepNoMatch RISPOSTA OK")
		return {"ai": ai_obj}
	except Exception as e:
		print("[BACKEND] /api/stepNoMatch ERRORE PARSING:", str(e))
		return {"error": f"Failed to parse AI JSON: {str(e)}"}

# --- stepNoInput: Generate no input prompts ---
@app.post("/api/stepNoInput")
def step_no_input(body: dict = Body(...)):
	meaning = body.get('meaning', '')
	desc = body.get('desc', '')
	print("\nSTEP: /api/stepNoInput – Generazione messaggi no input")
	prompt = f"""
You are a conversational AI message generator.

Generate 3 escalation messages to use when the user provides no input for the expected data type: '{meaning}'.

Return ONLY a JSON array of 3 English strings, no explanations, no comments, no IDs.
"""
	print("AI PROMPT ================")
	print(prompt)
	ai = call_groq([
		{"role": "system", "content": "Always reply in English."},
		{"role": "user", "content": prompt}
	])
	print("AI ANSWER ================")
	print(ai)
	try:
		ai_obj = json.loads(ai)
		print("[GROQ RESPONSE /stepNoInput]", ai_obj)
		return {"ai": ai_obj}
	except Exception as e:
		return {"error": f"Failed to parse AI JSON: {str(e)}"}

# --- stepConfirmation: Generate confirmation prompts ---
@app.post("/api/stepConfirmation")
def step_confirmation(body: dict = Body(...)):
	meaning = body.get('meaning', '')
	desc = body.get('desc', '')
	print("\nSTEP: /api/stepConfirmation – Generazione messaggi di conferma")
	prompt = f"""
You are a conversational AI message generator.

Generate 2 escalation messages to confirm with the user the value for the data type: '{meaning}'.

Return ONLY a JSON array of 2 English strings, no explanations, no comments, no IDs.
"""
	print("AI PROMPT ================")
	print(prompt)
	ai = call_groq([
		{"role": "system", "content": "Always reply in English."},
		{"role": "user", "content": prompt}
	])
	print("AI ANSWER ================")
	print(ai)
	try:
		ai_obj = json.loads(ai)
		print("[GROQ RESPONSE /stepConfirmation]", ai_obj)
		return {"ai": ai_obj}
	except Exception as e:
		return {"error": f"Failed to parse AI JSON: {str(e)}"}

# --- stepSuccess: Generate success prompts ---
@app.post("/api/stepSuccess")
def step_success(body: dict = Body(...)):
	meaning = body.get('meaning', '')
	desc = body.get('desc', '')
	print("\nSTEP: /api/stepSuccess – Generazione messaggio di successo")
	prompt = f"""
You are a conversational AI message generator.

Generate 1 message to use when the user has successfully provided the expected data type: '{meaning}'.

Return ONLY a JSON array with 1 English string, no explanations, no comments, no IDs.
"""
	print("AI PROMPT ================")
	print(prompt)
	ai = call_groq([
		{"role": "system", "content": "Always reply in English."},
		{"role": "user", "content": prompt}
	])
	print("AI ANSWER ================")
	print(ai)
	try:
		ai_obj = json.loads(ai)
		print("[GROQ RESPONSE /stepSuccess]", ai_obj)
		return {"ai": ai_obj}
	except Exception as e:
		return {"error": f"Failed to parse AI JSON: {str(e)}"} 