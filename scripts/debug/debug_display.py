"""
Debug display issue with zero values
"""

import requests

def test_hexane_display():
    """Test hexane data retrieval and display"""
    base_url = "http://localhost:8200/api/hsp-experimental"

    print("Testing Hexane Data Display")
    print("=" * 40)

    # Get hexane data
    response = requests.get(f"{base_url}/solvents/hexane")

    if response.status_code == 200:
        data = response.json()
        print("Raw API Response:")
        print(f"  delta_d: {data['delta_d']} (type: {type(data['delta_d'])})")
        print(f"  delta_p: {data['delta_p']} (type: {type(data['delta_p'])})")
        print(f"  delta_h: {data['delta_h']} (type: {type(data['delta_h'])})")

        print("\nValue checks:")
        print(f"  delta_p == 0: {data['delta_p'] == 0}")
        print(f"  delta_p == 0.0: {data['delta_p'] == 0.0}")
        print(f"  str(delta_p): '{str(data['delta_p'])}'")
        print(f"  delta_h == 0: {data['delta_h'] == 0}")
        print(f"  delta_h == 0.0: {data['delta_h'] == 0.0}")
        print(f"  str(delta_h): '{str(data['delta_h'])}'")

        # Test JavaScript-like behavior
        print("\nJavaScript-like checks:")
        print(f"  bool(delta_p): {bool(data['delta_p'])}")
        print(f"  bool(delta_h): {bool(data['delta_h'])}")

        if data['delta_p'] == 0:
            print("  delta_p is zero - this should display as 0")
        if data['delta_h'] == 0:
            print("  delta_h is zero - this should display as 0")

    else:
        print(f"Failed to get hexane data: {response.status_code}")

def test_experiment_creation():
    """Test experiment creation with hexane"""
    base_url = "http://localhost:8200/api/hsp-experimental"

    print("\n" + "=" * 40)
    print("Testing Experiment with Hexane")
    print("=" * 40)

    test_experiment = {
        "sample_name": "Zero Value Test",
        "solvent_tests": [
            {
                "solvent_name": "hexane",
                "solubility": "insoluble"
            }
        ]
    }

    # Create experiment
    response = requests.post(f"{base_url}/experiments", json=test_experiment)

    if response.status_code == 200:
        result = response.json()
        experiment_id = result["id"]
        print(f"Experiment created: {experiment_id}")

        # Get experiment data
        get_response = requests.get(f"{base_url}/experiments/{experiment_id}")
        if get_response.status_code == 200:
            exp_data = get_response.json()
            solvent_test = exp_data["solvent_tests"][0]

            print("\nSolvent test data structure:")
            for key, value in solvent_test.items():
                print(f"  {key}: {value} (type: {type(value)})")

            # Check if solvent_data is populated correctly
            if solvent_test.get("solvent_data"):
                print("\nSolvent data found!")
                solvent_data = solvent_test["solvent_data"]
                print(f"  delta_d: {solvent_data.get('delta_d')}")
                print(f"  delta_p: {solvent_data.get('delta_p')}")
                print(f"  delta_h: {solvent_data.get('delta_h')}")
            else:
                print("\nNo solvent_data found - this is the problem!")

    else:
        print(f"Failed to create experiment: {response.status_code}")

if __name__ == "__main__":
    try:
        test_hexane_display()
        test_experiment_creation()
    except requests.exceptions.ConnectionError:
        print("Connection Error: Server not running")