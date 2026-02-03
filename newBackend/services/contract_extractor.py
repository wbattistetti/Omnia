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
        elif engine_type == "llm":
            # TODO: Implement LLM engine
            return {}
        elif engine_type == "rule_based":
            # TODO: Implement rule-based engine
            return {}
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
