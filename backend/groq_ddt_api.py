from fastapi import FastAPI, Body, Request
from fastapi.middleware.cors import CORSMiddleware
import os
import requests
import json
from ai_steps.step3_suggest_constraints import router as step3_router
from ai_steps.step2_detect_type import router as step2_router
from ai_steps.stepNoMatch import router as stepNoMatch_router
from ai_steps.stepNoInput import router as stepNoInput_router
from ai_steps.stepConfirmation import router as stepConfirmation_router
from ai_steps.stepSuccess import router as stepSuccess_router
from ai_steps.startPrompt import router as startPrompt_router

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
app.include_router(step2_router)
app.include_router(step3_router)
app.include_router(stepNoMatch_router)
app.include_router(stepNoInput_router)
app.include_router(stepConfirmation_router)
app.include_router(stepSuccess_router)
app.include_router(startPrompt_router)

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

# --- step2: Data type recognition (detectType) ---
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

Respond ONLY with a JSON object in this format:
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

# --- step3: Suggest constraints/validations (constraints) ---
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

Respond ONLY with a JSON object in this format:
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

Do NOT generate any id or GUID. Do NOT include explanations or comments outside the JSON. All messages and labels must be in English.
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
        print("[GROQ RESPONSE /step3]", ai_obj)
        return {"ai": ai_obj}
    except Exception as e:
        return {"error": f"Failed to parse AI JSON: {str(e)}"}

# --- step3b: Parse user constraints (optional, sub-step) ---
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

# --- step4: Generate DDT messages (generateMessages) ---
@app.post("/step4")
def step4(ddt_structure: dict = Body(...)):
    print("\nSTEP: /step4 – Generate DDT messages (generateMessages)")
    prompt = f"""
You are a conversational AI message generator.

Given the following DDT structure (including main steps, constraints, and optional subfields), generate the user-facing English messages required to guide the user.

Return ONLY a flat JSON object with keys in this format:
  "runtime.<DDT_ID>.<step>#<index>.<action>.text": "<English message>"

Where:
- <DDT_ID> is the unique ID of the DDT (use the value from the input).
- <step> is one of: start, noMatch, noInput, confirmation, success, or the name of a constraint (e.g., "required", "range").
- <index> is the escalation index (starting from 1).
- <action> is the action type (e.g., SayMessage, ConfirmInput), followed by a placeholder ID or suffix.
- Example: "runtime.DDT_Birthdate.noMatch#1.SayMessage_1.text"

Instructions:
- Generate 1 message for start and success steps.
- Generate 3 messages for each noMatch and noInput step (escalation levels 1–3).
- Generate 2 messages for confirmation (escalation 1–2).
- For each constraint, generate 2 messages (e.g., for required, range, regex).
- If the DDT has subData, generate messages for each subfield's constraints.

⚠️ IMPORTANT:
- DO NOT generate any IDs or GUIDs — use static suffixes like SayMessage_1.
- DO NOT include any explanation, comment, or text outside the JSON.
- DO NOT include translations or other languages — ONLY English.

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
    try:
        ai_obj = json.loads(ai)
        print("[GROQ RESPONSE /step4]", ai_obj)
        return {"ai": ai_obj}
    except Exception as e:
        return {"ai": None, "error": f"Failed to parse AI JSON: {str(e)}"}

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
        return {"ai": ai_obj}
    except Exception as e:
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