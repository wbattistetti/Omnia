import pytest
from ai_prompts.detect_type_prompt import get_detect_type_prompt

def test_detect_type_prompt_includes_subdata_analysis():
    """Test that the prompt includes instructions for subData analysis"""
    user_desc = "date of birth"
    prompt = get_detect_type_prompt(user_desc)
    
    # Verify the prompt includes subData analysis instructions
    assert "structure analyzer" in prompt
    assert "sub-components (subData)" in prompt
    assert "date of birth" in prompt
    assert "day" in prompt
    assert "month" in prompt
    assert "year" in prompt
    
    # Verify the expected JSON format includes subData
    assert '"subData":' in prompt
    assert '["<subData1>", "<subData2>", ...]' in prompt
    assert '"subData": []' in prompt

def test_detect_type_prompt_examples():
    """Test that the prompt includes correct examples for different data types"""
    user_desc = "test"
    prompt = get_detect_type_prompt(user_desc)
    
    # Verify examples are included
    assert "date of birth" in prompt
    assert "address" in prompt
    assert "phone number" in prompt
    assert "email" in prompt
    assert "number" in prompt
    
    # Verify subData examples
    assert '["day", "month", "year"]' in prompt
    assert '["street", "city", "postal_code", "country"]' in prompt
    assert '["country_code", "area_code", "number"]' in prompt

def test_detect_type_prompt_json_format():
    """Test that the prompt specifies the correct JSON format"""
    user_desc = "test"
    prompt = get_detect_type_prompt(user_desc)
    
    # Verify JSON structure
    assert '"type":' in prompt
    assert '"icon":' in prompt
    assert '"subData":' in prompt
    
    # Verify format instructions
    assert 'JSON object' in prompt
    assert 'ONLY with a JSON object' in prompt 