import re
import json
from newBackend.aiprompts.prm_registry import render
from newBackend.services.svc_ai_client import chat_json, chat_text

def normalize_pseudocode(pseudo: str, current_code: str, variables: list[str], mode: str = "predicate", label: str = "Condition", provider: str = "groq") -> dict:
    """Turn informal/pseudo code + current code into clean JavaScript."""
    try:
        # Use same structure as generate_condition: system + guidelines + example + user
        system_prompt = render("condition_system", out_lang="it")
        guidelines_prompt = render("condition_guidelines", out_lang="it")
        example_prompt = render("condition_examples", out_lang="it")
        user_prompt = render("condition_user_normalize", nl=pseudo, current_code=current_code, variables=variables, label=label)

        # Log full prompts
        print(f"[NORMALIZE] ===== FULL PROMPT =====")
        print(f"[NORMALIZE] [SYSTEM] {system_prompt}")
        print(f"[NORMALIZE] [GUIDELINES] {guidelines_prompt}")
        print(f"[NORMALIZE] [EXAMPLE] {example_prompt}")
        print(f"[NORMALIZE] [USER] {user_prompt}")
        print(f"[NORMALIZE] ===== END PROMPT =====")

        result = chat_json([
            {"role": "system", "content": system_prompt},
            {"role": "system", "content": guidelines_prompt},
            {"role": "system", "content": example_prompt},
            {"role": "user", "content": user_prompt}
        ], provider=provider)

        print(f"[NORMALIZE] AI result type: {type(result)}, preview: {str(result)[:500]}")

        # Parse result
        try:
            obj = json.loads(result) if isinstance(result, str) else result
            print(f"[NORMALIZE] Parsed obj: {obj}")
        except Exception as e:
            print(f"[NORMALIZE] Parse error: {e}, raw: {result[:200] if isinstance(result, str) else result}")
            obj = {"script": result} if isinstance(result, str) else {}

        # Check for question
        if "question" in obj:
            print(f"[NORMALIZE] AI asked question: {obj['question']}")
            return {"question": obj["question"]}

        # Extract and validate script
        script = obj.get("script", "")
        print(f"[NORMALIZE] Script extracted: {script[:200] if script else 'NO SCRIPT'}")
        if not script or not isinstance(script, str):
            print(f"[NORMALIZE] ERROR: no valid script - returning error")
            return {"error": "no_script_generated"}

        # Basic validation
        try:
            _assert_condition_policy(script, must_keys=variables if variables else None)
            print(f"[NORMALIZE] Policy check passed")
        except Exception as e:
            print(f"[NORMALIZE] Policy check failed: {e}")
            return {"error": str(e)}

        return {"script": script, "label": obj.get("label", label)}

    except ValueError as e:
        print(f"[NORMALIZE] ValueError: {e}")
        return {"error": str(e)}
    except Exception as e:
        print(f"[NORMALIZE] Exception: {e}")
        return {"error": f"normalize_error: {str(e)}"}

def generate_condition(nl: str, variables: list[str], out_lang: str = "it", provider: str = "groq") -> dict:
    """Generate a condition from natural language description."""
    # Build messages array with system, guidelines, example, and user (like old backend)
    system_prompt = render("condition_system", out_lang=out_lang)
    guidelines_prompt = render("condition_guidelines", out_lang=out_lang)
    example_prompt = render("condition_examples", out_lang=out_lang)
    user_prompt = render("condition_user", nl=nl, variables=variables, out_lang=out_lang)

    # Log full prompts
    print(f"[GENERATE_CONDITION] ===== FULL PROMPT =====")
    print(f"[GENERATE_CONDITION] Provider: {provider}")
    print(f"[GENERATE_CONDITION] [SYSTEM] {system_prompt}")
    print(f"[GENERATE_CONDITION] [GUIDELINES] {guidelines_prompt}")
    print(f"[GENERATE_CONDITION] [EXAMPLE] {example_prompt}")
    print(f"[GENERATE_CONDITION] [USER] {user_prompt}")
    print(f"[GENERATE_CONDITION] ===== END PROMPT =====")

    try:
        result = chat_json([
            {"role": "system", "content": system_prompt},
            {"role": "system", "content": guidelines_prompt},
            {"role": "system", "content": example_prompt},
            {"role": "user", "content": user_prompt},
        ], provider=provider)
        print(f"[GENERATE_CONDITION] AI result type: {type(result)}, preview: {str(result)[:500]}")
    except Exception as e:
        print(f"[GENERATE_CONDITION] AI API error: {e}")
        return {"error": f"AI API error: {str(e)}"}

    # Parse JSON string returned by chat_json
    try:
        obj = json.loads(result) if isinstance(result, str) else result
        print(f"[GENERATE_CONDITION] Parsed obj: {obj}")
    except Exception as e:
        print(f"[GENERATE_CONDITION] Parse error: {e}, raw: {str(result)[:200]}")
        return {"error": f"Failed to parse AI response as JSON: {str(e)}"}

    # Check for question
    if "question" in obj:
        print(f"[GENERATE_CONDITION] AI asked question: {obj['question']}")
        return {"question": obj["question"]}

    script = obj.get("script") or ""
    print(f"[GENERATE_CONDITION] Script extracted: {script[:200] if script else 'NO SCRIPT'}")
    if not script or not isinstance(script, str):
        print(f"[GENERATE_CONDITION] ERROR: no valid script - returning error")
        return {"error": "no_script_generated"}

    try:
        _assert_condition_policy(script, must_keys=variables or None)
        print(f"[GENERATE_CONDITION] Policy check passed")
    except Exception as e:
        print(f"[GENERATE_CONDITION] Policy check failed: {e}")
        return {"error": str(e)}

    return {"label": obj.get("label", ""), "script": script}

def refine_code(kind: str, script: str, notes=None, return_mode: str = "module", out_lang: str = "it"):
    """Refine and improve existing code."""
    notes = notes or []
    prompt = render("refine_code", kind=kind, script=script, notes=notes,
                    return_mode=return_mode, out_lang=out_lang)
    text = chat_text([
        {"role": "system", "content": "Apply minimal fixes only; preserve public shape; return only code/diff."},
        {"role": "user", "content": prompt},
    ]).strip()
    if kind == "condition_dsl":
        _assert_condition_policy(text)
    return {"script": text} if return_mode == "module" else {"diff": text}

def lint_condition(code: str, inputs: list[str]) -> list[dict]:
    """Lint condition code for policy violations."""
    findings: list[dict] = []
    for _ in re.finditer(r"\b(import|export)\b", code):
        findings.append({"severity": "error", "rule": "no-module-syntax"})
    if re.search(r"\bgetFullYear\(|\bgetMonth\(|\bgetDate\(", code):
        findings.append({"severity": "warning", "rule": "no-local-date-getters"})
    used = set(re.findall(r'ctx\[\s*"(.*?)"\s*\]', code))
    if inputs and set(inputs) != used:
        findings.append({"severity": "error", "rule": "inputs-mismatch"})
    return findings

def suggest_test_cases(nl: str, variables: list[str], provider: str = "groq") -> dict:
    """Suggest test case values for a condition."""
    try:
        system_msg = (
            "You suggest realistic test case values for a boolean condition.\n"
            "Return ONLY JSON with this structure:\n"
            "{\"trueCase\":{\"var1\":\"value1\",...},\"falseCase\":{\"var1\":\"value2\",...},\"hintTrue\":\"guidance for true case\",\"hintFalse\":\"guidance for false case\"}\n"
            "- trueCase: variable values that make the condition TRUE\n"
            "- falseCase: variable values that make the condition FALSE\n"
            "- hintTrue/hintFalse: brief guidance explaining what values to use\n"
            "Use realistic, valid values (dates as yyyy-mm-dd, emails as user@domain.com, etc.)\n"
        )

        user_msg = (
            f"Condition description:\n{nl}\n\n"
            f"Variables:\n{', '.join(variables)}\n\n"
            "Return only JSON."
        )

        result = chat_json([
            {"role": "system", "content": system_msg},
            {"role": "user", "content": user_msg}
        ], provider=provider)

        # Parse result
        try:
            obj = json.loads(result) if isinstance(result, str) else result
        except Exception:
            obj = {}

        return {
            "trueCase": obj.get("trueCase", {}),
            "falseCase": obj.get("falseCase", {}),
            "hintTrue": obj.get("hintTrue", ""),
            "hintFalse": obj.get("hintFalse", "")
        }

    except Exception as e:
        return {"error": f"suggest_cases_error: {str(e)}"}

def _assert_condition_policy(code: str, must_keys: list[str] | None = None):
    """Assert that condition code follows policy rules."""
    if "function main(ctx)" not in code or "const CONDITION" not in code:
        raise ValueError("missing_structure")
    if re.search(r"\bgetFullYear\(|\bgetMonth\(|\bgetDate\(", code):
        raise ValueError("use_utc_api")
    if re.search(r"new\s+Function|\beval\(|setTimeout\(|setInterval\(", code):
        raise ValueError("forbidden_api")

    # Extract CONDITION.inputs from code first (this is the source of truth)
    condition_match = re.search(r'const\s+CONDITION\s*=\s*\{[^}]*inputs\s*:\s*\[(.*?)\]', code, re.DOTALL)
    declared_inputs = set()
    if condition_match:
        inputs_str = condition_match.group(1)
        # Extract quoted strings from the inputs array
        declared_inputs = set(re.findall(r'"(.*?)"', inputs_str))

    # Extract keys used via ctx["key"] pattern (direct access)
    used_direct = set(re.findall(r'ctx\[\s*"(.*?)"\s*\]', code))

    # Also try to find indirect access patterns like: const k="key"; ... ctx[k]
    # Look for patterns: const k="key"; or const k='key'; followed by ctx[k]
    indirect_pattern = re.findall(r'const\s+\w+\s*=\s*"(.*?)"\s*;.*?ctx\[\w+\]', code, re.DOTALL)
    used_indirect = set(indirect_pattern)

    # Combine direct and indirect accesses
    used = used_direct | used_indirect

    # If we found declared_inputs but no direct/indirect accesses, use declared_inputs as used
    # (this handles cases where the AI uses a variable like const k="key"; ctx[k])
    if declared_inputs and not used:
        # Try to find variable assignments that match declared_inputs
        for key in declared_inputs:
            # Look for: const k="key"; or const k='key';
            var_pattern = rf'const\s+(\w+)\s*=\s*["\']{re.escape(key)}["\']\s*;'
            var_match = re.search(var_pattern, code)
            if var_match:
                var_name = var_match.group(1)
                # Check if this variable is used in ctx[var_name]
                if re.search(rf'ctx\[\s*{re.escape(var_name)}\s*\]', code):
                    used.add(key)

    # If still no used keys found but declared_inputs exists, trust CONDITION.inputs
    if not used and declared_inputs:
        used = declared_inputs

    # Check 1: CONDITION.inputs must match exactly the keys used in code
    if declared_inputs and declared_inputs != used:
        raise ValueError(f"key_set_mismatch: CONDITION.inputs {declared_inputs} does not match keys used in code {used}")

    # Check 2: All used keys must be available (subset of must_keys)
    if must_keys:
        available = set(must_keys)
        if used and not used.issubset(available):
            invalid = used - available
            raise ValueError(f"key_set_mismatch: keys {invalid} used in code are not in available variables {available}")
