def get_suggest_constraints_prompt(meaning, desc):
    return f"""You are a data validation assistant.

Given the following data field (with possible subfields), suggest the most appropriate validation constraints for each field.

The data is structured as JSON with the following format:
- Each field has: \"name\", \"label\", and \"type\".
- It may optionally have \"subData\" (an array of nested fields).
- Some fields may not have subData. In that case, omit the subData array.

Example input:
{{
  \"name\": \"birthdate\",
  \"label\": \"Date of Birth\",
  \"type\": \"object\",
  \"subData\": [
    {{ \"name\": \"day\", \"label\": \"Day\", \"type\": \"number\" }},
    {{ \"name\": \"month\", \"label\": \"Month\", \"type\": \"number\" }},
    {{ \"name\": \"year\", \"label\": \"Year\", \"type\": \"number\" }}
  ]
}}

For each field (main and subfields), suggest a list of constraints in this format:
[
  {{
    \"type\": \"required\",
    \"label\": \"Required\",
    \"description\": \"This field must be filled in.\",
    \"payoff\": \"Ensures the user provides this value.\"
  }},
  ...
]

You can suggest multiple constraints per field if relevant (e.g. required + format + range).

Respond ONLY with a JSON object in this format:
{{
  \"mainData\": {{
    \"constraints\": [ ... ],
    \"subData\": [
      {{ \"name\": \"day\", \"constraints\": [ ... ] }},
      {{ \"name\": \"month\", \"constraints\": [ ... ] }},
      {{ \"name\": \"year\", \"constraints\": [ ... ] }}
    ]
  }}
}}

Do NOT generate any id or GUID. Do NOT include explanations or comments outside the JSON. All messages and labels must be in English.
""" 