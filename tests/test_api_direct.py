"""
Test API directly with detailed error handling
"""

import requests
import json

def test_api_experiment_creation():
    """Test experiment creation via API with detailed error reporting"""

    base_url = "http://localhost:8200/api/hsp-experimental"

    # Test data exactly as it would be sent from the frontend
    experiment_data = {
        "sample_name": "API Test Sample",
        "description": None,
        "solvent_tests": [
            {
                "solvent_name": "hexane",
                "solubility": "insoluble",
                "notes": None
            }
        ],
        "experimenter": None,
        "notes": None,
        "tags": []
    }

    print("Sending experiment creation request...")
    print(f"Data: {json.dumps(experiment_data, indent=2)}")

    try:
        response = requests.post(
            f"{base_url}/experiments",
            json=experiment_data,
            headers={'Content-Type': 'application/json'}
        )

        print(f"Response status: {response.status_code}")
        print(f"Response headers: {dict(response.headers)}")

        if response.status_code == 200:
            result = response.json()
            print("SUCCESS!")
            print(f"Response: {json.dumps(result, indent=2)}")
        else:
            print("FAILED!")
            print(f"Response text: {response.text}")

            # Try to parse as JSON
            try:
                error_data = response.json()
                print(f"Error JSON: {json.dumps(error_data, indent=2)}")
            except:
                print("Response is not valid JSON")

    except Exception as e:
        print(f"Exception occurred: {e}")
        import traceback
        traceback.print_exc()

def test_minimal_experiment():
    """Test with absolutely minimal data"""

    base_url = "http://localhost:8200/api/hsp-experimental"

    # Minimal possible experiment
    minimal_data = {
        "sample_name": "Minimal Test",
        "solvent_tests": [
            {
                "solvent_name": "hexane",
                "solubility": "insoluble"
            }
        ]
    }

    print("\n" + "="*50)
    print("Testing minimal experiment data...")
    print(f"Data: {json.dumps(minimal_data, indent=2)}")

    try:
        response = requests.post(
            f"{base_url}/experiments",
            json=minimal_data
        )

        print(f"Response status: {response.status_code}")

        if response.status_code == 200:
            result = response.json()
            print("SUCCESS!")
            print(f"Result: {result}")
        else:
            print("FAILED!")
            print(f"Response: {response.text}")

    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    test_api_experiment_creation()
    test_minimal_experiment()