"""
Test HSP calculation integration
"""

import requests
import json

def test_hsp_calculation():
    """Test the complete HSP calculation workflow"""
    base_url = "http://localhost:8200/api/hsp-experimental"

    print("Testing HSP Calculation Integration")
    print("="*50)

    # Test data: known polymer sample
    test_experiment = {
        "sample_name": "Test Polymer Sample",
        "description": "Integration test for HSP calculation",
        "experimenter": "Test Suite",
        "solvent_tests": [
            {
                "solvent_name": "water",
                "solubility": "soluble",
                "notes": "Complete dissolution"
            },
            {
                "solvent_name": "ethanol",
                "solubility": "soluble",
                "notes": "Good solvent"
            },
            {
                "solvent_name": "acetone",
                "solubility": "partial",
                "notes": "Partial dissolution"
            },
            {
                "solvent_name": "toluene",
                "solubility": "insoluble",
                "notes": "No dissolution"
            },
            {
                "solvent_name": "hexane",
                "solubility": "insoluble",
                "notes": "No dissolution"
            }
        ]
    }

    try:
        # Step 1: Create experiment
        print("Step 1: Creating experiment...")
        response = requests.post(f"{base_url}/experiments", json=test_experiment)

        if response.status_code == 200:
            result = response.json()
            experiment_id = result["id"]
            print(f"[OK] Experiment created with ID: {experiment_id}")
        else:
            print(f"[FAIL] Failed to create experiment: {response.status_code}")
            print(response.text)
            return False

        # Step 2: Calculate HSP
        print("Step 2: Calculating HSP values...")
        calc_response = requests.post(f"{base_url}/experiments/{experiment_id}/calculate")

        if calc_response.status_code == 200:
            hsp_result = calc_response.json()
            print("[OK] HSP calculation successful!")
            print(f"   dD = {hsp_result['delta_d']:.1f} MPa^0.5")
            print(f"   dP = {hsp_result['delta_p']:.1f} MPa^0.5")
            print(f"   dH = {hsp_result['delta_h']:.1f} MPa^0.5")
            print(f"   Ra = {hsp_result['radius']:.1f} MPa^0.5")
            print(f"   Accuracy: {hsp_result['accuracy']:.3f}")
            print(f"   Method: {hsp_result['method']}")
            print(f"   Good solvents: {hsp_result['good_solvents']}/{hsp_result['solvent_count']}")
        else:
            print(f"[FAIL] HSP calculation failed: {calc_response.status_code}")
            print(calc_response.text)
            return False

        # Step 3: Verify experiment was updated
        print("Step 3: Verifying experiment update...")
        get_response = requests.get(f"{base_url}/experiments/{experiment_id}")

        if get_response.status_code == 200:
            experiment = get_response.json()
            if experiment.get('calculated_hsp'):
                print("[OK] Experiment successfully updated with HSP results")
            else:
                print("[FAIL] Experiment was not updated with HSP results")
                return False
        else:
            print(f"[FAIL] Failed to retrieve experiment: {get_response.status_code}")
            return False

        print("\n" + "="*50)
        print("[SUCCESS] ALL TESTS PASSED - HSP Integration Working!")
        return True

    except requests.exceptions.ConnectionError:
        print("[ERROR] Connection Error: Server not running on localhost:8200")
        print("Please run 'python start.py' first")
        return False
    except Exception as e:
        print(f"[ERROR] Unexpected error: {e}")
        return False

def test_api_endpoints():
    """Test basic API endpoints"""
    base_url = "http://localhost:8200/api/hsp-experimental"

    print("\nTesting API Endpoints")
    print("-"*30)

    try:
        # Test solvent list
        response = requests.get(f"{base_url}/solvents")
        if response.status_code == 200:
            solvents = response.json()
            print(f"[OK] Solvents API: {len(solvents)} solvents available")
        else:
            print(f"[FAIL] Solvents API failed: {response.status_code}")

        # Test specific solvent lookup (try common solvents)
        test_solvents = ["water", "ethanol", "acetone"]
        for solvent in test_solvents:
            response = requests.get(f"{base_url}/solvents/{solvent}")
            if response.status_code == 200:
                solvent_data = response.json()
                print(f"[OK] Solvent lookup: {solvent} dD={solvent_data['delta_d']}")
                break
        else:
            print(f"[FAIL] All solvent lookups failed")

        # Test stats
        response = requests.get(f"{base_url}/data/stats")
        if response.status_code == 200:
            stats = response.json()
            solvent_info = stats.get('solvent_database', {})
            record_count = solvent_info.get('record_count', len(solvents))
            print(f"[OK] Stats API: Database info available, ~{record_count} records")
        else:
            print(f"[FAIL] Stats API failed: {response.status_code}")

    except requests.exceptions.ConnectionError:
        print("[ERROR] Connection Error: Server not running")
        return False

if __name__ == "__main__":
    # Test API endpoints first
    test_api_endpoints()

    # Test HSP calculation
    success = test_hsp_calculation()

    if success:
        print("\n[SUCCESS] HSP Calculation Integration Test PASSED!")
    else:
        print("\n[FAILED] HSP Calculation Integration Test FAILED!")