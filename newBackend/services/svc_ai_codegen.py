import re
from newBackend.aiprompts.prm_registry import render
from newBackend.services.svc_ai_client import chat_json, chat_text

def generate_condition(nl: str, variables: list[str], out_lang: str = "it") -> dict:
    """Generate a condition from natural language description."""
    prompt = render("create_condition", nl=nl, variables=variables, out_lang=out_lang)
    obj = chat_json([
        {"role": "system", "content": f"Write NL text in {out_lang}. Keep JSON keys/code in English."},
        {"role": "user", "content": prompt},
    ])
    script = (obj or {}).get("script") or ""
    _assert_condition_policy(script, must_keys=variables or None)
    return obj

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

def _assert_condition_policy(code: str, must_keys: list[str] | None = None):
    """Assert that condition code follows policy rules."""
    if "function main(ctx)" not in code or "const CONDITION" not in code:
        raise ValueError("missing_structure")
    if re.search(r"\bgetFullYear\(|\bgetMonth\(|\bgetDate\(", code):
        raise ValueError("use_utc_api")
    if re.search(r"new\s+Function|\beval\(|setTimeout\(|setInterval\(", code):
        raise ValueError("forbidden_api")
    if must_keys:
        used = set(re.findall(r'ctx\[\s*"(.*?)"\s*\]', code))
        if not set(must_keys).issubset(used):
            raise ValueError("key_set_mismatch")
