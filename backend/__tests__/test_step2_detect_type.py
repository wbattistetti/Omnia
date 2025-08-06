import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from ai_steps.step2_detect_type import step2

def test_step2_with_subdata():
    """Test that step2 correctly handles AI response with subData"""
    # Mock AI response with subData
    mock_ai_response = {
        "type": "date of birth",
        "icon": "Calendar",
        "subData": ["day", "month", "year"]
    }
    
    with patch('ai_steps.step2_detect_type.call_groq') as mock_call_groq:
        mock_call_groq.return_value = '{"type": "date of birth", "icon": "Calendar", "subData": ["day", "month", "year"]}'
        
        result = step2("date of birth")
        
        assert result["ai"]["type"] == "date of birth"
        assert result["ai"]["icon"] == "Calendar"
        assert result["ai"]["subData"] == ["day", "month", "year"]

def test_step2_without_subdata():
    """Test that step2 adds empty subData array when not present"""
    # Mock AI response without subData (backward compatibility)
    mock_ai_response = {
        "type": "email",
        "icon": "Mail"
    }
    
    with patch('ai_steps.step2_detect_type.call_groq') as mock_call_groq:
        mock_call_groq.return_value = '{"type": "email", "icon": "Mail"}'
        
        result = step2("email")
        
        assert result["ai"]["type"] == "email"
        assert result["ai"]["icon"] == "Mail"
        assert result["ai"]["subData"] == []  # Should be added automatically

def test_step2_empty_subdata():
    """Test that step2 handles empty subData array correctly"""
    with patch('ai_steps.step2_detect_type.call_groq') as mock_call_groq:
        mock_call_groq.return_value = '{"type": "number", "icon": "Hash", "subData": []}'
        
        result = step2("number")
        
        assert result["ai"]["type"] == "number"
        assert result["ai"]["icon"] == "Hash"
        assert result["ai"]["subData"] == []

def test_step2_invalid_response():
    """Test that step2 handles invalid AI responses correctly"""
    with patch('ai_steps.step2_detect_type.call_groq') as mock_call_groq:
        mock_call_groq.return_value = 'invalid json'
        
        result = step2("invalid")
        
        assert result["error"] == "unrecognized_data_type"

def test_step2_missing_required_fields():
    """Test that step2 handles responses missing required fields"""
    with patch('ai_steps.step2_detect_type.call_groq') as mock_call_groq:
        mock_call_groq.return_value = '{"type": "date of birth"}'  # Missing icon
        
        result = step2("date of birth")
        
        assert result["error"] == "unrecognized_data_type" 