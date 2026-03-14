"""
ContractExtractor: Python implementation of runtime extraction engine
Applies both engine and contract for normalization/validation
"""
import re
from typing import Dict, Any, List, Optional

class ContractExtractor:
    def __init__(self, contract: Dict[str, Any], engine: Dict[str, Any]):
        self.contract = contract
        self.engine = engine

    def extract(self, text: str) -> Dict[str, Any]:
        """
        Extract values from text using engine + contract
        Returns canonical output format
        """
        # 1. Apply engine to extract raw values
        raw_values = self._apply_engine(text)

        # 2. Apply contract for normalization
        normalized_values = self._apply_contract_normalization(raw_values)

        # 3. Apply contract for validation
        validation = self._validate_with_contract(normalized_values)

        # 4. Apply contract for constraints
        constrained_values = self._apply_contract_constraints(normalized_values)

        # 5. Produce canonical output
        return {
            "values": constrained_values,
            "hasMatch": validation["valid"],
            "errors": validation.get("errors", []),
            "source": self.engine.get("type"),
            "confidence": self._calculate_confidence(normalized_values, validation)
        }

    def _apply_engine(self, text: str) -> Dict[str, Any]:
        """Apply engine to extract raw values"""
        engine_type = self.engine.get("type", "regex")

        if engine_type == "regex":
            return self._apply_regex_engine(text)
        elif engine_type == "ner":
            return self._apply_ner_engine(text)
        elif engine_type == "embedding":
            return self._apply_embedding_engine(text)
        elif engine_type == "llm":
            return self._apply_llm_engine(text)
        elif engine_type == "rules" or engine_type == "rule_based":
            return self._apply_rule_based_engine(text)
        else:
            return {}

    def _apply_regex_engine(self, text: str) -> Dict[str, Any]:
        """Apply regex engine"""
        regex = self.engine.get("config", {}).get("regex")
        if not regex:
            return {}

        try:
            # Find all matches and get the longest one
            matches = list(re.finditer(regex, text, re.IGNORECASE))
            if not matches:
                return {}

            # Get the longest match
            best_match = max(matches, key=lambda m: len(m.group(0)))

            # Extract named groups
            extracted = {}
            if best_match.groupdict():
                for key, value in best_match.groupdict().items():
                    if value is not None and value.strip():
                        extracted[key] = value.strip()

            return extracted
        except Exception as e:
            print(f"[ContractExtractor] Regex error: {e}")
            return {}

    def _apply_ner_engine(self, text: str) -> Dict[str, Any]:
        """Apply NER engine using spaCy or similar"""
        # TODO: Implement NER extraction using spaCy
        # For now, return empty (will be implemented later)
        print(f"[ContractExtractor] NER engine not yet implemented")
        return {}

    def _apply_embedding_engine(self, text: str) -> Dict[str, Any]:
        """Apply embedding engine using similarity matching"""
        examples = self.engine.get("config", {}).get("embeddingExamples", {})
        threshold = self.engine.get("config", {}).get("embeddingThreshold", 0.7)

        positive_examples = examples.get("positive", [])
        negative_examples = examples.get("negative", [])

        if not positive_examples:
            return {}

        try:
            # Import embedding functions
            from backend.ai_endpoints.intent_embeddings import (
                compute_embedding_local,
                cosine_similarity
            )

            # Compute embedding for input text
            text_embedding = compute_embedding_local(text)

            # Find best match among positive examples
            best_match_score = 0.0
            best_match_text = ""

            for example_text in positive_examples:
                example_embedding = compute_embedding_local(example_text)
                score = cosine_similarity(text_embedding, example_embedding)

                if score > best_match_score:
                    best_match_score = score
                    best_match_text = example_text

            # Apply penalty for negative examples
            penalty = 0.0
            for neg_example in negative_examples:
                neg_embedding = compute_embedding_local(neg_example)
                neg_score = cosine_similarity(text_embedding, neg_embedding)
                if neg_score > 0.7:
                    penalty += (neg_score - 0.7) * 0.5

            final_score = max(0.0, best_match_score - penalty)

            # If score >= threshold, extract value
            if final_score >= threshold:
                extracted = {}
                subgroups = self.contract.get("subgroups", [])

                # If single subentity, use that
                if len(subgroups) == 1:
                    extracted[subgroups[0].get("subTaskKey")] = text
                else:
                    # Otherwise map from best_match_text
                    extracted["value"] = best_match_text

                return extracted

            return {}
        except Exception as e:
            print(f"[ContractExtractor] Embedding error: {e}")
            import traceback
            traceback.print_exc()
            return {}

    def _apply_llm_engine(self, text: str) -> Dict[str, Any]:
        """Apply LLM engine using OpenAI/Anthropic"""
        try:
            from newBackend.services.svc_ai_client import chat_json
            from newBackend.core.core_settings import OPENAI_KEY

            if not OPENAI_KEY:
                print(f"[ContractExtractor] LLM engine: OPENAI_KEY not configured")
                return {}

            config = self.engine.get("config", {})
            system_prompt = config.get("systemPrompt", "You are a data extraction expert. Always return valid JSON.")
            # Support both userPromptTemplate (backend) and aiPrompt (frontend field name)
            user_prompt_template = (
                config.get("userPromptTemplate") or
                config.get("aiPrompt") or ""
            )

            print(f"[ContractExtractor] LLM engine: systemPrompt present={bool(system_prompt)}, userPromptTemplate present={bool(user_prompt_template)}")

            # If no user prompt template, generate it from contract (deterministic, not saved)
            if not user_prompt_template:
                print(f"[ContractExtractor] LLM engine: userPromptTemplate empty, generating from contract")
                user_prompt_template = self._build_llm_prompt_from_contract()
                if not user_prompt_template:
                    print(f"[ContractExtractor] LLM engine: ERROR - could not generate prompt from contract")
                    return {}

            # Replace placeholders in user prompt
            user_prompt = user_prompt_template.replace("{text}", text)

            # Replace {subData} placeholder if present
            if "{subData}" in user_prompt:
                subgroups = self.contract.get("subentities") or self.contract.get("subgroups", [])
                sub_data_list = "\n".join([
                    f"- {sg.get('subTaskKey', 'unknown')}: {sg.get('label', '')} ({sg.get('type', 'text')})"
                    for sg in subgroups
                ])
                user_prompt = user_prompt.replace("{subData}", sub_data_list)

            # Call LLM
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]

            print(f"[ContractExtractor] LLM engine: Calling OpenAI with text={repr(text[:100])}")
            response_text = chat_json(messages, provider="openai")

            # Parse JSON response
            import json
            try:
                # chat_json returns a string, parse it
                if isinstance(response_text, str):
                    response_data = json.loads(response_text)
                else:
                    response_data = response_text

                print(f"[ContractExtractor] LLM engine: Parsed response: {type(response_data)} = {repr(str(response_data)[:200])}")

                # Extract values from response
                extracted = {}

                # Check if response is a dict
                if isinstance(response_data, dict):
                    # Get contract structure — support both subentities (new) and subgroups (legacy)
                    subgroups = self.contract.get("subentities") or self.contract.get("subgroups", [])
                    subgroup_keys = [sg.get("subTaskKey") for sg in subgroups if sg.get("subTaskKey")]

                    # Also check outputCanonical.keys as fallback
                    output_keys = self.contract.get("outputCanonical", {}).get("keys", [])
                    all_expected_keys = list(set(subgroup_keys + output_keys))

                    print(f"[ContractExtractor] LLM engine: Expected keys: {all_expected_keys}")
                    print(f"[ContractExtractor] LLM engine: Response keys: {list(response_data.keys())}")

                    # Strategy 1: Direct key mapping
                    for key, value in response_data.items():
                        if key in all_expected_keys:
                            extracted[key] = value
                        # Also check case-insensitive match
                        elif all_expected_keys:
                            for expected_key in all_expected_keys:
                                if key.lower() == expected_key.lower():
                                    extracted[expected_key] = value
                                    break

                    # Strategy 2: If single expected key and response has "value", map it
                    if not extracted and len(all_expected_keys) == 1 and "value" in response_data:
                        extracted[all_expected_keys[0]] = response_data["value"]

                    # Strategy 3: If no mapping worked but we have a "value", use it as generic
                    if not extracted and "value" in response_data:
                        # If we have expected keys, try to map to first one
                        if all_expected_keys:
                            extracted[all_expected_keys[0]] = response_data["value"]
                        else:
                            extracted["value"] = response_data["value"]

                    # Strategy 4: If response is a simple string value, use it
                    if not extracted and len(response_data) == 1:
                        first_key = list(response_data.keys())[0]
                        if all_expected_keys:
                            extracted[all_expected_keys[0]] = response_data[first_key]
                        else:
                            extracted["value"] = response_data[first_key]

                print(f"[ContractExtractor] LLM engine: Final extracted {len(extracted)} values: {list(extracted.keys())}")
                return extracted

            except json.JSONDecodeError as e:
                print(f"[ContractExtractor] LLM engine: Failed to parse JSON response: {e}")
                print(f"[ContractExtractor] LLM engine: Response was: {repr(response_text[:200])}")
                return {}

        except Exception as e:
            print(f"[ContractExtractor] LLM engine error: {e}")
            import traceback
            traceback.print_exc()
            return {}

    def _build_llm_prompt_from_contract(self) -> str:
        """Build LLM prompt template from contract (deterministic, not saved)"""
        try:
            entity = self.contract.get("entity", {})
            entity_label = entity.get("label", "")
            entity_desc = entity.get("description", "")

            # Support both subentities (new) and subgroups (legacy)
            subgroups = self.contract.get("subentities") or self.contract.get("subgroups", [])

            # Build subentities description
            subentities_list = []
            for sg in subgroups:
                sub_desc = f"- {sg.get('subTaskKey', 'unknown')}: {sg.get('label', '')}"
                if sg.get('meaning'):
                    sub_desc += f" ({sg.get('meaning')})"
                if sg.get('type'):
                    sub_desc += f" [type: {sg.get('type')}]"
                if sg.get('constraints'):
                    sub_desc += f" [constraints: {sg.get('constraints')}]"
                subentities_list.append(sub_desc)

            # Get output format
            output_format = self.contract.get("outputCanonical", {})
            output_keys = output_format.get("keys", [])

            # Build the prompt template
            prompt = f"Extract information from the following text.\n\n"

            if entity_label:
                prompt += f"Entity to extract: {entity_label}\n"
            if entity_desc:
                prompt += f"Description: {entity_desc}\n"

            if subentities_list:
                prompt += f"\nFields to extract:\n"
                prompt += "\n".join(subentities_list)
                prompt += "\n"

            prompt += f"\nOutput format: {output_format.get('format', 'object')}\n"
            if output_keys:
                prompt += f"Output keys: {', '.join(output_keys)}\n"

            prompt += "\nText to analyze:\n{text}\n\n"
            prompt += "Return a JSON object with the extracted values matching the output format above."

            return prompt
        except Exception as e:
            print(f"[ContractExtractor] Error building LLM prompt from contract: {e}")
            import traceback
            traceback.print_exc()
            return ""

    def _apply_rule_based_engine(self, text: str) -> Dict[str, Any]:
        """Apply rule-based engine using extractor code"""
        # TODO: Implement rule-based extraction
        # For now, return empty (will be implemented later)
        print(f"[ContractExtractor] Rule-based engine not yet implemented")
        return {}

    def _apply_contract_normalization(self, raw_values: Dict[str, Any]) -> Dict[str, Any]:
        """Apply contract normalization rules"""
        normalized = {}

        subgroups = self.contract.get("subgroups", [])
        for subgroup in subgroups:
            sub_task_key = subgroup.get("subTaskKey")
            if sub_task_key not in raw_values:
                continue

            raw_value = raw_values[sub_task_key]
            normalization = subgroup.get("normalization")

            if normalization:
                normalized[sub_task_key] = self._apply_normalization_rule(
                    raw_value,
                    normalization,
                    sub_task_key
                )
            else:
                normalized[sub_task_key] = raw_value

        return normalized

    def _apply_normalization_rule(self, value: Any, rule: str, sub_task_key: str) -> Any:
        """Apply a single normalization rule"""
        value_str = str(value).strip()

        # Year normalization: "year always 4 digits (61 -> 1961, 05 -> 2005)"
        if "year" in rule.lower() and "4 digits" in rule.lower():
            try:
                num = int(value_str)
                if num < 100:
                    return 2000 + num if num < 50 else 1900 + num
                return num
            except ValueError:
                return value

        # Month normalization: "month always numeric (january -> 1, february -> 2)"
        if "month" in rule.lower() and "numeric" in rule.lower():
            month_names = [
                'january', 'february', 'march', 'april', 'may', 'june',
                'july', 'august', 'september', 'october', 'november', 'december',
                'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
                'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
                'gen', 'feb', 'mar', 'apr', 'mag', 'giu',
                'lug', 'ago', 'set', 'ott', 'nov', 'dic'
            ]

            value_lower = value_str.lower()
            if value_lower in month_names:
                month_index = month_names.index(value_lower)
                return (month_index % 12) + 1

            # Try numeric
            try:
                num = int(value_str)
                if 1 <= num <= 12:
                    return num
            except ValueError:
                pass

            return value

        # Day normalization: "day always numeric (1-31)"
        if "day" in rule.lower() and "numeric" in rule.lower():
            try:
                num = int(value_str)
                if 1 <= num <= 31:
                    return num
            except ValueError:
                pass
            return value

        # Default: return as-is
        return value

    def _validate_with_contract(self, values: Dict[str, Any]) -> Dict[str, Any]:
        """Validate extracted values against contract"""
        errors = []

        subgroups = self.contract.get("subgroups", [])
        for subgroup in subgroups:
            sub_task_key = subgroup.get("subTaskKey")
            value = values.get(sub_task_key)

            # Check required fields (if not optional)
            if not subgroup.get("optional", True) and (value is None or value == ""):
                errors.append(f"Missing required field: {subgroup.get('label')} ({sub_task_key})")

            # Type validation
            if value is not None and value != "":
                sub_type = subgroup.get("type")
                if sub_type == "number":
                    try:
                        int(str(value))
                    except ValueError:
                        errors.append(f"Invalid number for {subgroup.get('label')}: {value}")

                # Range validation for dates
                if "day" in sub_task_key.lower():
                    try:
                        day = int(str(value))
                        if not (1 <= day <= 31):
                            errors.append(f"Invalid day: {day} (must be 1-31)")
                    except ValueError:
                        pass

                if "month" in sub_task_key.lower():
                    try:
                        month = int(str(value))
                        if not (1 <= month <= 12):
                            errors.append(f"Invalid month: {month} (must be 1-12)")
                    except ValueError:
                        pass

                if "year" in sub_task_key.lower():
                    try:
                        year = int(str(value))
                        if not (1900 <= year <= 2100):
                            errors.append(f"Invalid year: {year} (must be 1900-2100)")
                    except ValueError:
                        pass

        return {
            "valid": len(errors) == 0,
            "errors": errors
        }

    def _apply_contract_constraints(self, values: Dict[str, Any]) -> Dict[str, Any]:
        """Apply contract constraints"""
        # For now, just return normalized values
        # Can be extended with additional constraint logic
        return values

    def _calculate_confidence(self, values: Dict[str, Any], validation: Dict[str, Any]) -> float:
        """Calculate confidence score"""
        if not validation.get("valid"):
            return 0.0

        expected_keys = self.contract.get("outputCanonical", {}).get("keys", [])
        extracted_keys = list(values.keys())

        # Confidence based on how many expected keys were extracted
        if not expected_keys:
            return 0.5

        coverage = len(extracted_keys) / len(expected_keys)

        # High confidence if all keys extracted
        if coverage >= 1.0:
            return 0.95

        # Medium confidence if partial extraction
        if coverage >= 0.5:
            return 0.7

        # Low confidence if minimal extraction
        return 0.5
