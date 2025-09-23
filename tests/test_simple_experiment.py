"""
Test simple experiment creation
"""

import requests
import json

def test_simple_experiment():
    """Test creating experiment with minimal data"""
    base_url = "http://localhost:8200/api/hsp-experimental"

    simple_experiment = {
        "sample_name": "Simple Test",
        "solvent_tests": [
            {
                "solvent_name": "ethanol",
                "solubility": "soluble"
            }
        ]
    }

    print("Testing simple experiment creation...")
    print("Data being sent:")
    print(json.dumps(simple_experiment, indent=2))

    try:
        response = requests.post(f"{base_url}/experiments", json=simple_experiment)

        print(f"\nResponse status: {response.status_code}")

        if response.status_code == 200:
            result = response.json()
            print("SUCCESS!")
            print(f"Experiment ID: {result['id']}")

            # Get the created experiment
            get_response = requests.get(f"{base_url}/experiments/{result['id']}")
            if get_response.status_code == 200:
                exp_data = get_response.json()
                print("\nCreated experiment data:")
                print(json.dumps(exp_data, indent=2)[:500] + "...")

        else:
            print("FAILED!")
            print(f"Error: {response.text}")

    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    test_simple_experiment()