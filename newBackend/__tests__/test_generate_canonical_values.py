"""
Integration test for /api/nlp/generate-canonical-values endpoint

Tests the complete flow:
1. Canonical values prompt generation
2. AI call
3. Response parsing
4. Validation
"""

import pytest
import json
from fastapi.testclient import TestClient
from newBackend.app import app

client = TestClient(app)


@pytest.fixture
def sample_contract():
    """Sample contract for testing"""
    return {
        "entity": {
            "label": "Email",
            "type": "email",
            "description": "an email address"
        },
        "outputCanonical": {
            "format": "value"
        },
        "version": 1
    }


@pytest.fixture
def sample_composite_contract():
    """Sample composite contract for testing"""
    return {
        "entity": {
            "label": "Date of Birth",
            "type": "date",
            "description": "a date composed of day, month, and year"
        },
        "outputCanonical": {
            "format": "object",
            "keys": ["day", "month", "year"]
        },
        "subentities": [
            {
                "subTaskKey": "day",
                "label": "Day",
                "meaning": "numeric day of the month (1-31)"
            },
            {
                "subTaskKey": "month",
                "label": "Month",
                "meaning": "numeric month of the year (1-12)"
            },
            {
                "subTaskKey": "year",
                "label": "Year",
                "meaning": "numeric year (4 digits preferred)"
            }
        ],
        "version": 1
    }


def test_generate_canonical_values_endpoint_exists():
    """Test that endpoint exists and accepts POST"""
    response = client.post("/api/nlp/generate-canonical-values", json={})
    # Should not be 404 (endpoint exists)
    assert response.status_code != 404


def test_generate_canonical_values_requires_contract(sample_contract):
    """Test that endpoint requires contract field"""
    response = client.post("/api/nlp/generate-canonical-values", json={})
    assert response.status_code == 200  # Endpoint returns error in body, not status
    data = response.json()
    assert "error" in data
    assert "contract" in data["error"].lower()


def test_generate_canonical_values_with_valid_contract(sample_contract):
    """Test generation with valid contract"""
    response = client.post(
        "/api/nlp/generate-canonical-values",
        json={
            "contract": sample_contract,
            "nodeLabel": "Email",
            "provider": "openai"
        }
    )

    # Note: This test may fail if OPENAI_KEY is not configured
    # That's expected - the endpoint should handle it gracefully
    assert response.status_code == 200
    data = response.json()

    # Response should have success field
    assert "success" in data

    if data.get("success"):
        # If successful, should have canonicalValues
        assert "canonicalValues" in data
        canonical_values = data["canonicalValues"]

        # Validate canonical values structure
        assert isinstance(canonical_values, dict)

        # Must have all three arrays
        assert "canonicalExamples" in canonical_values
        assert "partialExamples" in canonical_values
        assert "invalidExamples" in canonical_values

        # All must be arrays
        assert isinstance(canonical_values["canonicalExamples"], list)
        assert isinstance(canonical_values["partialExamples"], list)
        assert isinstance(canonical_values["invalidExamples"], list)

        # Must have at least one canonical example
        assert len(canonical_values["canonicalExamples"]) > 0


def test_generate_canonical_values_preserves_structure(sample_contract):
    """Test that generation preserves contract structure"""
    response = client.post(
        "/api/nlp/generate-canonical-values",
        json={
            "contract": sample_contract,
            "provider": "openai"
        }
    )

    assert response.status_code == 200
    data = response.json()

    if data.get("success") and "canonicalValues" in data:
        canonical_values = data["canonicalValues"]

        # Should only contain the three example arrays
        allowed_fields = [
            "canonicalExamples",
            "partialExamples",
            "invalidExamples"
        ]

        for key in canonical_values.keys():
            assert key in allowed_fields, f"Unexpected field in canonical values: {key}"


def test_generate_canonical_values_composite_contract(sample_composite_contract):
    """Test generation with composite contract (object format)"""
    response = client.post(
        "/api/nlp/generate-canonical-values",
        json={
            "contract": sample_composite_contract,
            "nodeLabel": "Date of Birth",
            "provider": "openai"
        }
    )

    assert response.status_code == 200
    data = response.json()

    if data.get("success") and "canonicalValues" in data:
        canonical_values = data["canonicalValues"]

        # Validate structure
        assert "canonicalExamples" in canonical_values
        assert len(canonical_values["canonicalExamples"]) > 0

        # For object format, examples should have object expected values
        first_example = canonical_values["canonicalExamples"][0]
        if "expected" in first_example:
            # Expected should be an object for object format
            assert isinstance(first_example["expected"], dict)


def test_generate_canonical_values_error_handling():
    """Test error handling for invalid input"""
    # Test with invalid contract structure
    response = client.post(
        "/api/nlp/generate-canonical-values",
        json={
            "contract": "not an object"
        }
    )

    assert response.status_code == 200
    data = response.json()

    # Should handle error gracefully
    assert "success" in data or "error" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
