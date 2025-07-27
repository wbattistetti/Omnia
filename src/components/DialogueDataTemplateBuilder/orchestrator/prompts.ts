// Prompt e esempi per orchestratore DDT step-by-step

export const structurePrompt = (meaning: string) => `You are an expert in designing Data Dialogue Templates (DDT) for conversational AI.
Generate a JSON DDT for acquiring a ${meaning}.

Only include:
- structure (mainData, variable)
- composite flag
- subData if needed (like day, month, year)
- steps: Normal, NoInput, NoMatch, Confirmation, Success (with 1–2 escalations each)
- constraints (only label/summary/payoff/type — no script)
- spoken keys as @placeholders
- messages object mapping spoken keys to sample English text (e.g., "Can you tell me your birth date?")

DO NOT generate any code/script. Do NOT include IDs or GUIDs. Use only placeholder strings.
Respond ONLY with a valid JSON object.

EXAMPLE OUTPUT (truncated):
{
  "ddt": {
    "label": "Date of Birth",
    "type": "composite",
    "mainData": { "label": "", "description": "", "parameter": "dateOfBirth" },
    "variable": { "label": "", "name": "dateOfBirth" },
    "constraints": [
      {
        "label": "Date in the past",
        "summary": "The date must be before today",
        "payoff": "Rejects dates in the future",
        "type": "pastDate"
      }
    ],
    "subData": [
      {
        "label": "Day",
        "type": "primitive",
        "mainData": { "label": "", "parameter": "birthDay" },
        "variable": { "label": "", "name": "birthDay" },
        "constraints": [
          { "label": "Day range", "summary": "1 to 31", "payoff": "Valid day of the month", "type": "range" }
        ],
        "steps": []
      }
    ],
    "steps": [
      {
        "stepType": "Normal",
        "escalation": [
          { "actionType": "AskInput", "parameters": [ { "IDReference": "ask_birth_date", "value": "@ask_birth_date" } ] }
        ]
      }
    ]
  },
  "messages": {
    "ask_birth_date": "Can you tell me your full date of birth?",
    "rephrase_birth_date_1": "Sorry, could you repeat the birth date?"
  }
}`;

export const constraintPrompt = (field: string, type: string, description: string) => `You are an expert in data validation.
Given this constraint:
- Field: ${field}
- Type: ${type}
- Description: "${description}"
Generate a detailed JSON constraint with:
- label
- description
- type
- payoff
- summary
DO NOT include any script or test cases. Respond only with valid JSON.

Example:
{
  "label": "Past Date",
  "description": "The selected date must be in the past",
  "type": "pastDate",
  "payoff": "Avoids future birth dates",
  "summary": "Date < today"
}`;

export const scriptPrompt = (type: string, label: string, description: string, variable: string) => `You are an expert coding assistant.
Generate validation scripts for the following constraint:
Constraint type: ${type}
Constraint label: ${label}
Constraint description: "${description}"
Variable: ${variable}

Requirements:
- Summary comment at the top (in plain English)
- Code for JS, Python, TS
- Inline comments for clarity
- At least 3 test cases (with expected result)
- Output must be in valid JSON with fields: label, payoff, scripts, tests

EXAMPLE:
{
  "label": "Past Date",
  "payoff": "Rejects any date that is today or in the future.",
  "scripts": {
    "js": "// Check if a date is in the past\nfunction isPast(date) {\n  return new Date(date) < new Date();\n}",
    "py": "# Check if date is before today\ndef is_past(date):\n    from datetime import datetime\n    return datetime.strptime(date, '%Y-%m-%d') < datetime.today()",
    "ts": "// Check if date is in the past\nfunction isPast(date: string): boolean {\n  return new Date(date) < new Date();\n}"
  },
  "tests": [
    { "input": "2030-01-01", "expected": false, "description": "Future date" },
    { "input": "2000-05-20", "expected": true, "description": "Valid past date" },
    { "input": "today", "expected": false, "description": "Current date" }
  ]
}`;

export const messagesPrompt = (spokenKeys: string[]) => `You are a conversational UX writer.
Generate a mapping of spoken keys (full path) to user-facing messages for the following keys:
${spokenKeys.map(k => `- ${k}`).join('\n')}
Return only a JSON object mapping each key to its text.

Example:
{
  "mainData.variable.label": "Date of birth",
  "steps.0.escalation.0.parameters.0.value": "Can you tell me your full date of birth?",
  "subData.0.label": "Day"
}`; 