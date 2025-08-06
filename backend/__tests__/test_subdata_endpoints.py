import pytest
import json
from fastapi.testclient import TestClient
from groq_ddt_api import app

client = TestClient(app)

class TestSubDataEndpoints:
    """Test cases for subData-specific endpoints"""
    
    def test_generate_subdata_messages_success(self):
        """Test successful generation of subData messages with recursive structure"""
        subdata_info = {
            "name": "day",
            "label": "Day",
            "type": "number",
            "parentField": "birthDate",
            "constraints": ["range", "required"]
        }
        
        response = client.post(
            "/api/generateSubDataMessages",
            json=subdata_info
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "ai" in data
        
        # Handle case where AI is not configured (returns None)
        if data["ai"] is None:
            pytest.skip("AI not configured - skipping message generation test")
        
        # Verify the recursive structure of generated messages
        messages = data["ai"]
        
        # Check for expected keys (handle variations in AI response)
        expected_keys = ["start", "noMatch", "noInput", "confirmation", "success"]
        found_keys = []
        
        for key in expected_keys:
            if key in messages:
                found_keys.append(key)
            elif f"'{key}'" in messages:  # Handle quoted keys from AI
                found_keys.append(f"'{key}'")
        
        # Should have at least 4 out of 5 expected keys
        assert len(found_keys) >= 4, f"Expected at least 4 keys, found: {found_keys}"
        
        # Verify recursive structure for found keys
        for key in found_keys:
            actual_key = key.strip("'") if key.startswith("'") else key
            messages_array = messages[actual_key]
            assert isinstance(messages_array, list)
            assert len(messages_array) > 0
            
            # Each message should be an object with escalationId and actions
            for message_obj in messages_array:
                assert isinstance(message_obj, dict)
                assert "escalationId" in message_obj
                assert "actions" in message_obj
                assert isinstance(message_obj["actions"], list)
                assert len(message_obj["actions"]) > 0
                
                # Each action should have actionId, actionInstanceId, and parameters
                for action in message_obj["actions"]:
                    assert isinstance(action, dict)
                    assert "actionId" in action
                    assert "actionInstanceId" in action
                    assert "parameters" in action
                    assert isinstance(action["parameters"], list)
                    
                    # Parameters should contain text with value
                    for param in action["parameters"]:
                        assert isinstance(param, dict)
                        assert "parameterId" in param
                        assert "value" in param
                        if param["parameterId"] == "text":
                            assert isinstance(param["value"], str)
                            assert len(param["value"]) > 0
    
    def test_generate_subdata_messages_with_invalid_input(self):
        """Test subData message generation with invalid input"""
        invalid_input = {"invalid": "data"}
        
        response = client.post(
            "/api/generateSubDataMessages",
            json=invalid_input
        )
        
        # Should still return 200 but with error in response
        assert response.status_code == 200
        data = response.json()
        # The response might contain an error or still work with minimal data
        assert "ai" in data
    
    def test_generate_subdata_scripts_success(self):
        """Test successful generation of subData validation scripts with recursive structure"""
        subdata_constraints = {
            "name": "day",
            "constraints": [
                {
                    "type": "range",
                    "label": "Day Range",
                    "description": "Day must be between 1 and 31",
                    "payoff": "Validates day of month"
                }
            ]
        }
        
        response = client.post(
            "/api/generateSubDataScripts",
            json=subdata_constraints
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "ai" in data
        
        # Handle case where AI is not configured (returns None)
        if data["ai"] is None:
            pytest.skip("AI not configured - skipping script generation test")
        
        # Verify the recursive structure of generated constraints
        constraints_data = data["ai"]
        assert "constraints" in constraints_data
        assert isinstance(constraints_data["constraints"], list)
        assert len(constraints_data["constraints"]) > 0
        
        # Each constraint should have the recursive structure
        for constraint in constraints_data["constraints"]:
            assert isinstance(constraint, dict)
            assert "type" in constraint
            assert "label" in constraint
            assert "description" in constraint
            assert "payoff" in constraint
            assert "prompts" in constraint
            assert "validationScript" in constraint
            assert "testSet" in constraint
            
            # Verify types
            assert isinstance(constraint["type"], str)
            assert isinstance(constraint["label"], str)
            assert isinstance(constraint["description"], str)
            assert isinstance(constraint["payoff"], str)
            assert isinstance(constraint["prompts"], list)
            assert isinstance(constraint["validationScript"], str)
            assert isinstance(constraint["testSet"], list)
            
            # Validation script should contain function definition
            assert "function validate" in constraint["validationScript"]
    
    def test_generate_subdata_scripts_with_invalid_input(self):
        """Test subData script generation with invalid input"""
        invalid_input = {"invalid": "constraints"}
        
        response = client.post(
            "/api/generateSubDataScripts",
            json=invalid_input
        )
        
        # Should still return 200 but might contain error
        assert response.status_code == 200
        data = response.json()
        # The response might contain an error or still work with minimal data
        assert "ai" in data or "error" in data
    
    def test_subdata_messages_specificity(self):
        """Test that subData messages are specific to the subfield"""
        day_subdata = {
            "name": "day",
            "label": "Day",
            "type": "number",
            "parentField": "birthDate"
        }
        
        month_subdata = {
            "name": "month", 
            "label": "Month",
            "type": "number",
            "parentField": "birthDate"
        }
        
        day_response = client.post("/api/generateSubDataMessages", json=day_subdata)
        month_response = client.post("/api/generateSubDataMessages", json=month_subdata)
        
        assert day_response.status_code == 200
        assert month_response.status_code == 200
        
        day_data = day_response.json()
        month_data = month_response.json()
        
        # Handle case where AI is not configured
        if day_data["ai"] is None or month_data["ai"] is None:
            pytest.skip("AI not configured - skipping specificity test")
        
        day_messages = day_data["ai"]
        month_messages = month_data["ai"]
        
        # Messages should be different for different subfields
        # Compare the text values in the recursive structure
        day_start_text = day_messages["start"][0]["actions"][0]["parameters"][0]["value"]
        month_start_text = month_messages["start"][0]["actions"][0]["parameters"][0]["value"]
        assert day_start_text != month_start_text
        
        day_no_match_text = day_messages["noMatch"][0]["actions"][0]["parameters"][0]["value"]
        month_no_match_text = month_messages["noMatch"][0]["actions"][0]["parameters"][0]["value"]
        assert day_no_match_text != month_no_match_text
    
    def test_subdata_scripts_different_constraints(self):
        """Test that subData scripts differ based on constraints"""
        range_constraints = {
            "name": "day",
            "constraints": [{"type": "range", "label": "Day Range"}]
        }
        
        required_constraints = {
            "name": "day", 
            "constraints": [{"type": "required", "label": "Required"}]
        }
        
        range_response = client.post("/api/generateSubDataScripts", json=range_constraints)
        required_response = client.post("/api/generateSubDataScripts", json=required_constraints)
        
        assert range_response.status_code == 200
        assert required_response.status_code == 200
        
        range_data = range_response.json()
        required_data = required_response.json()
        
        # Handle case where AI is not configured
        if range_data["ai"] is None or required_data["ai"] is None:
            pytest.skip("AI not configured - skipping constraint difference test")
        
        range_constraints = range_data["ai"]["constraints"]
        required_constraints = required_data["ai"]["constraints"]
        
        # Scripts should be different for different constraint types
        range_validation_script = range_constraints[0]["validationScript"]
        required_validation_script = required_constraints[0]["validationScript"]
        assert range_validation_script != required_validation_script
    
    def test_endpoint_structure(self):
        """Test that endpoints return correct structure even without AI"""
        subdata_info = {
            "name": "day",
            "label": "Day",
            "type": "number"
        }
        
        response = client.post("/api/generateSubDataMessages", json=subdata_info)
        
        assert response.status_code == 200
        data = response.json()
        assert "ai" in data
        # ai can be None if AI is not configured, but the structure should be correct 