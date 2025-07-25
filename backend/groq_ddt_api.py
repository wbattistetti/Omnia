from fastapi import FastAPI, Body, Request
from fastapi.middleware.cors import CORSMiddleware
import os
import requests
import json

GROQ_KEY = os.environ.get("Groq_key")
IDE_LANGUE = os.environ.get("IdeLangue", "it")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"  # PATCH: endpoint corretto
MODEL = "llama3-70b-8192"

MEANINGS = [
    "date", "email", "phone", "address", "number", "text", "boolean"
]

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def call_groq(messages):
    headers = {
        "Authorization": f"Bearer {GROQ_KEY}",
        "Content-Type": "application/json"
    }
    data = {
        "model": MODEL,
        "messages": messages
    }
    response = requests.post(GROQ_URL, headers=headers, json=data)
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"]

@app.post("/step1")
def step1():
    prompt = f"Rispondi in {IDE_LANGUE}. Descrivi il tipo di informazione che vuoi acquisire (es: data di nascita, email, ecc)."
    return {"ai": prompt}

@app.post("/step2")
def step2(user_desc: str = Body(...)):
    IT_MEANINGS = [
        'data di nascita', 'email', 'numero di telefono', 'indirizzo', 'numero', 'testo', 'booleano'
    ]
    MEANING_ICONS = {
        'data di nascita': 'Calendar',
        'email': 'Mail',
        'numero di telefono': 'Phone',
        'indirizzo': 'MapPin',
        'numero': 'Hash',
        'testo': 'Type',
        'booleano': 'CheckSquare'
    }
    ICON_LIST = list(set(MEANING_ICONS.values()) | {'HelpCircle', 'Sparkles', 'FileQuestion', 'Gift', 'IdCard'})
    prompt = (
        f"Sei un classificatore di tipi di dato. Dato il testo utente: '{user_desc}', estrai SOLO il tipo di dato più specifico possibile tra questi (in italiano): {IT_MEANINGS}.\n"
        "Se il tipo non è presente, proponi un nuovo tipo.\n"
        f"Associa anche una icona Lucide tra queste: {ICON_LIST}.\n"
        "Se non esiste un'icona adatta, usa 'HelpCircle'.\n"
        "Rispondi SOLO con un oggetto JSON: { \"type\": <tipo>, \"icon\": <nomeMini> }.\n"
        "Esempi:\n"
        "- Input: 'Voglio una cosa che riconosca i numeri di telefono' → Output: { \"type\": \"numero di telefono\", \"icon\": \"Phone\" }\n"
        "- Input: 'Serve la data di nascita' → Output: { \"type\": \"data di nascita\", \"icon\": \"Calendar\" }\n"
        "- Input: 'codice promozionale' → Output: { \"type\": \"codice promozionale\", \"icon\": \"Gift\" }\n"
        "- Input: 'asdasd' → Output: { \"type\": \"unrecognized_data_type\", \"icon\": \"HelpCircle\" }\n"
    )
    ai = call_groq([
        {"role": "system", "content": "Rispondi sempre in italiano."},
        {"role": "user", "content": prompt}
    ])
    try:
        ai_obj = json.loads(ai)
        if not isinstance(ai_obj, dict) or 'type' not in ai_obj or 'icon' not in ai_obj:
            return {"error": "unrecognized_data_type"}
        if ai_obj['type'] == 'unrecognized_data_type':
            return {"error": "unrecognized_data_type"}
        return {"ai": ai_obj}
    except Exception:
        return {"error": "unrecognized_data_type"}

@app.post("/step3")
def step3(meaning: str = Body(...), desc: str = Body(...)):
    prompt = (
        f"Rispondi in {IDE_LANGUE}. Per il dato '{meaning}' ({desc}), quali constraint/validazioni vuoi applicare? "
        "(es: obbligatorio, formato, range, ecc). Suggerisci i più adatti e chiedi se aggiungere altri constraint."
    )
    ai = call_groq([
        {"role": "system", "content": f"Rispondi sempre in {IDE_LANGUE}."},
        {"role": "user", "content": prompt}
    ])
    return {"ai": ai}

@app.post("/step3b")
def step3b(user_constraints: str = Body(...), meaning: str = Body(...), desc: str = Body(...)):
    prompt = (
        f"Rispondi in {IDE_LANGUE}. Interpreta e formalizza la risposta utente '{user_constraints}' in una lista di constraint chiari e strutturati per il dato '{meaning}' ({desc})."
    )
    ai = call_groq([
        {"role": "system", "content": f"Rispondi sempre in {IDE_LANGUE}."},
        {"role": "user", "content": prompt}
    ])
    return {"ai": ai}

@app.post("/step4")
def step4(meaning: str = Body(...), desc: str = Body(...), constraints: str = Body(...)):
    DDT_EXAMPLE_JSON = """
    {
      "_id": "687dc1d84a68b869802aea16",
      "id": "DDT_BirthOfDate",
      "label": "Acquire date of birth",
      "description": "Flow to acquire the user's date of birth, handling partial input, validation, confirmation, and success.",
      "dataType": "Object",
      "variable": "dateOfBirth",
      "constraints": [],
      "steps": {
        "noMatch": [
          { "id": "noMatch_escalation_UUID1", "type": "escalation" },
          { "actionInstanceId": "SayMessage_UUID2", "parentId": "noMatch_escalation_UUID1", "actionType": "sayMessage" },
          { "id": "noMatch_escalation_UUID3", "type": "escalation" },
          { "actionInstanceId": "SayMessage_UUID4", "parentId": "noMatch_escalation_UUID3", "actionType": "sayMessage" }
        ],
        "noInput": [
          { "id": "noInput_escalation_UUID5", "type": "escalation" },
          { "actionInstanceId": "SayMessage_UUID6", "parentId": "noInput_escalation_UUID5", "actionType": "sayMessage" },
          { "id": "noInput_escalation_UUID7", "type": "escalation" },
          { "actionInstanceId": "SayMessage_UUID8", "parentId": "noInput_escalation_UUID7", "actionType": "sayMessage" }
        ],
        "confirmation": [
          { "id": "confirmation_escalation_UUID9", "type": "escalation" },
          { "actionInstanceId": "SayMessage_UUID10", "parentId": "confirmation_escalation_UUID9", "actionType": "sayMessage" },
          { "id": "confirmation_escalation_UUID11", "type": "escalation" },
          { "actionInstanceId": "SayMessage_UUID12", "parentId": "confirmation_escalation_UUID11", "actionType": "sayMessage" }
        ],
        "notAcquired": [
          { "id": "notAcquired_escalation_UUID13", "type": "escalation" },
          { "actionInstanceId": "SayMessage_UUID14", "parentId": "notAcquired_escalation_UUID13", "actionType": "sayMessage" }
        ]
      },
      "success": {}
    }
    """
    prompt = f"""You are an expert dialogue template generator for conversational AI.
Given the following specifications:
- Data type: {meaning}
- Description: {desc}

Generate ONLY a JSON object with EXACTLY this structure:

{{
  "ddt": <COMPLETE_DDT_OBJECT>,
  "messages": <RUNTIME_MESSAGES_OBJECT>
}}

Where:
- "ddt" is a Data Dialogue Template object with the same ontological structure as this example:
{DDT_EXAMPLE_JSON}
- For each step that supports escalation (e.g., noMatch, noInput, confirmation, notAcquired), alternate escalation nodes and their child actions as shown above.
- Each escalation must have a unique id (e.g., "noMatch_escalation_<UUID>") and each action must have a parentId pointing to its escalation.
- The order of escalation blocks in the array determines their visual index (for labels like "1° recovery", "2° recovery", ...).
- For each action, generate a runtime string key as: runtime.<DDT_ID>.<step>#<n>.<actionInstanceId>.text
  - <n> is the escalation index (starting from 1) based on the position of the escalation node in the array for that step (count only escalation nodes, not actions).
  - Example: runtime.DDT_Phone.noMatch#2.SayMessage_UUID.text
- "messages" is an object with all runtime string keys and their values (in Italian and English).
  - Each value in the "messages" object MUST be a multilingual object with language codes as keys (e.g., {{ "it": "...", "en": "..." }}).
- The output MUST be valid JSON, parsable by Python.
- DO NOT include any explanation, markdown, or text outside the JSON object.

Example output:
{{
  "ddt": {{ ... }},
  "messages": {{ ... }}
}}
"""
    ai = call_groq([
        {"role": "system", "content": "Always reply in English."},
        {"role": "user", "content": prompt}
    ])
    try:
        ai_obj = json.loads(ai)
        return {"ai": ai_obj}
    except Exception as e:
        return {"ai": None, "error": f"Failed to parse AI JSON: {str(e)}"}

# --- Constraint Generation Endpoint ---

@app.post("/api/generateConstraint")
async def generate_constraint(request: Request):
    data = await request.json()
    description = data.get("description", "")
    variable = data.get("variable", "value")
    type_ = data.get("type", "string")
    # MOCK: restituisci un constraint fittizio
    return {
        "id": "constraint1",
        "title": f"Constraint per {variable}",
        "script": "return value < Date.now();",
        "explanation": f"Il valore di {variable} deve essere nel passato.",
        "messages": [
            "Il valore inserito non è valido.",
            "Per favore inserisci un valore corretto."
        ],
        "testCases": [
            {"input": "2020-01-01", "expected": True, "description": "Valore valido"},
            {"input": "2099-01-01", "expected": False, "description": "Valore futuro"}
        ],
        "variable": variable,
        "type": type_
    } 