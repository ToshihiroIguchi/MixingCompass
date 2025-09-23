"""
Debug HSP calculation issues
"""

import requests
import json

def debug_solvent_data():
    """Debug solvent data availability"""
    base_url = "http://localhost:8200/api/hsp-experimental"

    test_solvents = ["water", "ethanol", "acetone", "toluene", "hexane"]

    print("Debugging Solvent Data")
    print("="*40)

    for solvent in test_solvents:
        response = requests.get(f"{base_url}/solvents/{solvent}")
        if response.status_code == 200:
            data = response.json()
            print(f"{solvent:10}: Found - dD={data.get('delta_d', 'N/A')}, dP={data.get('delta_p', 'N/A')}, dH={data.get('delta_h', 'N/A')}")
        else:
            print(f"{solvent:10}: NOT FOUND ({response.status_code})")

def debug_experiment_creation():
    """Debug experiment creation and data structure"""
    base_url = "http://localhost:8200/api/hsp-experimental"

    test_experiment = {
        "sample_name": "Debug Test",
        "description": "Debug test",
        "solvent_tests": [
            {
                "solvent_name": "ethanol",
                "solubility": "soluble",
                "notes": "test"
            },
            {
                "solvent_name": "toluene",
                "solubility": "insoluble",
                "notes": "test"
            }
        ]
    }

    print("\nDebugging Experiment Creation")
    print("="*40)

    # Create experiment
    response = requests.post(f"{base_url}/experiments", json=test_experiment)
    if response.status_code == 200:
        result = response.json()
        experiment_id = result["id"]
        print(f"Experiment created: {experiment_id}")

        # Get experiment data
        get_response = requests.get(f"{base_url}/experiments/{experiment_id}")
        if get_response.status_code == 200:
            experiment_data = get_response.json()
            print("\nExperiment Data Structure:")
            print(json.dumps(experiment_data, indent=2))

            return experiment_id
    else:
        print(f"Failed to create experiment: {response.status_code}")
        print(response.text)

    return None

def debug_hsp_calculation(experiment_id):
    """Debug HSP calculation"""
    base_url = "http://localhost:8200/api/hsp-experimental"

    print(f"\nDebugging HSP Calculation for {experiment_id}")
    print("="*50)

    response = requests.post(f"{base_url}/experiments/{experiment_id}/calculate")

    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")

if __name__ == "__main__":
    try:
        # Step 1: Check solvent data
        debug_solvent_data()

        # Step 2: Create experiment and check structure
        experiment_id = debug_experiment_creation()

        # Step 3: Try HSP calculation
        if experiment_id:
            debug_hsp_calculation(experiment_id)

    except requests.exceptions.ConnectionError:
        print("Connection Error: Server not running")