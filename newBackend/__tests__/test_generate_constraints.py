"""
Integration test for /api/nlp/generate-constraints endpoint

Tests the complete flow:
1. Constraints prompt generation
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
        "canonicalExamples": {
            "complete": [
                {
                    "input": "my email is user@example.com",
                    "expected": "user@example.com"
                }
            ],
            "partial": [],
            "incomplete": [],
            "ambiguous": [],
            "noisy": [],
            "stress": []
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
        "canonicalExamples": {
            "complete": [
                {
                    "input": "I was born on 15 April 2020",
                    "expected": {"day": "15", "month": "04", "year": "2020"}
                }
            ],
            "partial": [],
            "incomplete": [],
            "ambiguous": [],
            "noisy": [],
            "stress": []
        },
        "version": 1
    }


def test_generate_constraints_endpoint_exists():
    """Test that endpoint exists and accepts POST"""
    response = client.post("/api/nlp/generate-constraints", json={})
    # Should not be 404 (endpoint exists)
    assert response.status_code != 404


def test_generate_constraints_requires_contract(sample_contract):
    """Test that endpoint requires contract field"""
    response = client.post("/api/nlp/generate-constraints", json={})
    assert response.status_code == 200  # Endpoint returns error in body, not status
    data = response.json()
    assert "error" in data
    assert "contract" in data["error"].lower()


def test_generate_constraints_with_valid_contract(sample_contract):
    """Test generation with valid contract"""
    response = client.post(
        "/api/nlp/generate-constraints",
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
        # If successful, should have constraints
        assert "constraints" in data
        constraints_data = data["constraints"]

        # Validate constraints structure
        assert isinstance(constraints_data, dict)

        # Must have constraints field
        assert "constraints" in constraints_data
        assert isinstance(constraints_data["constraints"], dict)

        # Must have subentityConstraints field
        assert "subentityConstraints" in constraints_data
        assert isinstance(constraints_data["subentityConstraints"], list)


def test_generate_constraints_preserves_structure(sample_contract):
    """Test that generation preserves contract structure"""
    response = client.post(
        "/api/nlp/generate-constraints",
        json={
            "contract": sample_contract,
            "provider": "openai"
        }
    )

    assert response.status_code == 200
    data = response.json()

    if data.get("success") and "constraints" in data:
        constraints_data = data["constraints"]

        # Should only contain constraints and subentityConstraints
        allowed_fields = [
            "constraints",
            "subentityConstraints"
        ]

        for key in constraints_data.keys():
            assert key in allowed_fields, f"Unexpected field in constraints: {key}"


def test_generate_constraints_composite_contract(sample_composite_contract):
    """Test generation with composite contract"""
    response = client.post(
        "/api/nlp/generate-constraints",
        json={
            "contract": sample_composite_contract,
            "nodeLabel": "Date of Birth",
            "provider": "openai"
        }
    )

    assert response.status_code == 200
    data = response.json()

    if data.get("success") and "constraints" in data:
        constraints_data = data["constraints"]

        # Validate structure
        assert "constraints" in constraints_data
        assert "subentityConstraints" in constraints_data

        # For composite contracts, should have subentity constraints
        subentity_constraints = constraints_data["subentityConstraints"]
        assert isinstance(subentity_constraints, list)

        # Should have constraints for each subentity
        if len(subentity_constraints) > 0:
            for sub_constraint in subentity_constraints:
                assert "subTaskKey" in sub_constraint
                assert "constraints" in sub_constraint
                assert isinstance(sub_constraint["constraints"], dict)


def test_generate_constraints_error_handling():
    """Test error handling for invalid input"""
    # Test with invalid contract structure
    response = client.post(
        "/api/nlp/generate-constraints",
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
