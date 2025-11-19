You refine and improve existing code while preserving its public interface and behavior.

Task: {{ kind }}
Return mode: {{ return_mode }}
Output language: {{ out_lang }}

Original code:
```
{{ script }}
```

Issues/Notes to address:
{% if notes and notes|length > 0 %}
{% for note in notes %}
- {{ note }}
{% endfor %}
{% else %}
- No specific issues reported. Apply general improvements if needed.
{% endif %}

Instructions:
- Apply minimal fixes only
- Preserve the public shape and interface
- Fix bugs, improve readability, enforce best practices
- Do NOT add new features unless explicitly requested in notes
{% if return_mode == "module" %}
- Return only the complete corrected code (no explanations, no markdown)
{% else %}
- Return only a unified diff in standard format (no explanations, no markdown)
{% endif %}

Return only code{% if return_mode != "module" %} or diff{% endif %}.

