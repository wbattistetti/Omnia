"""
Integration test for /api/nlp/refine-contract endpoint

Tests the complete flow:
1. Contract refinement prompt generation
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
            "label": "Date of Birth",
            "type": "date",
            "description": "a date"
        },
        "outputCanonical": {
            "format": "object",
            "keys": ["day", "month", "year"]
        },
        "subentities": [
            {
                "subTaskKey": "day",
                "label": "Day",
                "meaning": "day"
            },
            {
                "subTaskKey": "month",
                "label": "Month",
                "meaning": "month"
            },
            {
                "subTaskKey": "year",
                "label": "Year",
                "meaning": "year"
            }
        ],
        "version": 1
    }


def test_refine_contract_endpoint_exists():
    """Test that endpoint exists and accepts POST"""
    response = client.post("/api/nlp/refine-contract", json={})
    # Should not be 404 (endpoint exists)
    assert response.status_code != 404


def test_refine_contract_requires_contract(sample_contract):
    """Test that endpoint requires contract field"""
    response = client.post("/api/nlp/refine-contract", json={})
    assert response.status_code == 200  # Endpoint returns error in body, not status
    data = response.json()
    assert "error" in data
    assert "contract" in data["error"].lower()


def test_refine_contract_with_valid_contract(sample_contract):
    """Test refinement with valid contract"""
    response = client.post(
        "/api/nlp/refine-contract",
        json={
            "contract": sample_contract,
            "nodeLabel": "Date of Birth",
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
        # If successful, should have refinement
        assert "refinement" in data
        refinement = data["refinement"]

        # Validate refinement structure
        assert isinstance(refinement, dict)

        # Optional fields that may be present
        if "enhancedDescription" in refinement:
            assert refinement["enhancedDescription"] is None or isinstance(refinement["enhancedDescription"], str)

        if "enhancedSubentities" in refinement:
            assert isinstance(refinement["enhancedSubentities"], list)
            for sub in refinement["enhancedSubentities"]:
                assert "subTaskKey" in sub
                assert isinstance(sub["subTaskKey"], str)


def test_refine_contract_preserves_structure(sample_contract):
    """Test that refinement preserves contract structure"""
    response = client.post(
        "/api/nlp/refine-contract",
        json={
            "contract": sample_contract,
            "provider": "openai"
        }
    )

    assert response.status_code == 200
    data = response.json()

    if data.get("success") and "refinement" in data:
        refinement = data["refinement"]

        # Refinement should not contain structural changes
        # (those are handled in frontend merge)
        assert "entity" not in refinement  # Should not modify entity structure
        assert "outputCanonical" not in refinement  # Should not modify output format
        assert "subentities" not in refinement  # Should not add/remove subentities

        # Should only contain enhancement fields
        allowed_fields = [
            "enhancedDescription",
            "enhancedSubentities",
            "enhancedConstraints",
            "enhancedNormalization",
            "additionalConstraints",
            "ambiguities",
            "improvements"
        ]

        for key in refinement.keys():
            assert key in allowed_fields, f"Unexpected field in refinement: {key}"


def test_refine_contract_error_handling():
    """Test error handling for invalid input"""
    # Test with invalid contract structure
    response = client.post(
        "/api/nlp/refine-contract",
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
