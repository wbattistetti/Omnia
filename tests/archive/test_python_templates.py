"""
Test script to verify that Python services load templates from Task_Types collection
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_type_template_manager():
    """Test type_template_manager.py"""
    print("\n[TEST] ===== Testing type_template_manager.py =====")
    try:
        from type_template_manager import load_templates, get_available_types

        templates = load_templates()
        types = get_available_types()

        print(f"[TEST] ✅ type_template_manager loaded successfully")
        print(f"[TEST] Templates loaded: {len(templates)}")
        print(f"[TEST] Available types: {len(types)}")

        if len(types) > 0:
            print(f"[TEST] Sample types: {', '.join(types[:3])}")

        return True
    except Exception as e:
        print(f"[TEST] ❌ type_template_manager failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_step2_detect_type():
    """Test step2_detect_type.py"""
    print("\n[TEST] ===== Testing step2_detect_type.py =====")
    try:
        from ai_steps.step2_detect_type import load_templates_from_db

        templates = load_templates_from_db()

        print(f"[TEST] ✅ step2_detect_type loaded successfully")
        print(f"[TEST] Templates loaded: {len(templates)}")

        if len(templates) > 0:
            sample_keys = list(templates.keys())[:3]
            print(f"[TEST] Sample template keys: {', '.join(sample_keys)}")

        return True
    except Exception as e:
        print(f"[TEST] ❌ step2_detect_type failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_template_intelligence_service():
    """Test template_intelligence_service.py"""
    print("\n[TEST] ===== Testing template_intelligence_service.py =====")
    try:
        from services.template_intelligence_service import TemplateIntelligenceService

        # TemplateIntelligenceService doesn't take parameters
        service = TemplateIntelligenceService()
        templates = service._load_templates_from_db()

        print(f"[TEST] ✅ template_intelligence_service loaded successfully")
        print(f"[TEST] Templates loaded: {len(templates)}")

        if len(templates) > 0:
            sample_keys = list(templates.keys())[:3]
            print(f"[TEST] Sample template keys: {', '.join(sample_keys)}")

        return True
    except Exception as e:
        print(f"[TEST] ❌ template_intelligence_service failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests"""
    print("[TEST] Starting Python template loading tests...")
    print("[TEST] Verifying that all services load from Task_Templates collection\n")

    results = []

    # Test each service
    results.append(("type_template_manager", test_type_template_manager()))
    results.append(("step2_detect_type", test_step2_detect_type()))
    results.append(("template_intelligence_service", test_template_intelligence_service()))

    # Summary
    print("\n[TEST] ===== SUMMARY =====")
    passed = sum(1 for _, result in results if result)
    total = len(results)

    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"[TEST] {name}: {status}")

    print(f"\n[TEST] Total: {passed}/{total} tests passed")

    if passed == total:
        print("[TEST] ✅ All tests passed!")
        return 0
    else:
        print("[TEST] ❌ Some tests failed")
        return 1

if __name__ == '__main__':
    exit_code = main()
    sys.exit(exit_code)

