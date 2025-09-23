"""
HSP Calculation Example - Demonstration
"""

import requests
import json

def demonstrate_hsp_calculation():
    """Demonstrate HSP calculation with real example"""
    base_url = "http://localhost:8200/api/hsp-experimental"

    print("="*60)
    print("MixingCompass HSP Calculation Example")
    print("="*60)

    # Example: Polymer sample with known solvents
    polymer_experiment = {
        "sample_name": "Acrylic Polymer Sample",
        "description": "Common acrylic polymer for coating applications",
        "experimenter": "Demo User",
        "solvent_tests": [
            # Good solvents (dissolve the polymer)
            {
                "solvent_name": "acetone",
                "solubility": "soluble",
                "notes": "Complete dissolution, clear solution"
            },
            {
                "solvent_name": "ethanol",
                "solubility": "soluble",
                "notes": "Good solvent, dissolves well"
            },
            {
                "solvent_name": "ethyl acetate",
                "solubility": "partial",
                "notes": "Partial dissolution, swells polymer"
            },
            # Poor solvents (don't dissolve the polymer)
            {
                "solvent_name": "hexane",
                "solubility": "insoluble",
                "notes": "No dissolution, polymer remains solid"
            },
            {
                "solvent_name": "toluene",
                "solubility": "insoluble",
                "notes": "No dissolution, slight swelling only"
            }
        ]
    }

    try:
        print("Step 1: Creating polymer experiment...")
        response = requests.post(f"{base_url}/experiments", json=polymer_experiment)

        if response.status_code == 200:
            result = response.json()
            experiment_id = result["id"]
            print(f"[OK] Experiment created: {experiment_id}")

            # Show solvent data used
            print("\nStep 2: Solvent HSP Data:")
            print("-" * 40)
            for test in polymer_experiment["solvent_tests"]:
                solvent_name = test["solvent_name"]
                solv_response = requests.get(f"{base_url}/solvents/{solvent_name}")
                if solv_response.status_code == 200:
                    data = solv_response.json()
                    print(f"{solvent_name:12}: dD={data['delta_d']:4.1f}, dP={data['delta_p']:4.1f}, dH={data['delta_h']:4.1f} ({test['solubility']})")
                else:
                    print(f"{solvent_name:12}: Data not found")

        else:
            print(f"[FAIL] Failed to create experiment: {response.status_code}")
            return

        print("\nStep 3: Calculating HSP parameters...")
        calc_response = requests.post(f"{base_url}/experiments/{experiment_id}/calculate")

        if calc_response.status_code == 200:
            hsp_result = calc_response.json()

            print("\n" + "="*60)
            print("HSP CALCULATION RESULTS")
            print("="*60)
            print(f"Sample: {polymer_experiment['sample_name']}")
            print(f"Method: {hsp_result['method']}")
            print()
            print("Hansen Solubility Parameters:")
            print(f"  dD (Dispersive)     = {hsp_result['delta_d']:5.1f} MPa^0.5")
            print(f"  dP (Polar)          = {hsp_result['delta_p']:5.1f} MPa^0.5")
            print(f"  dH (Hydrogen bond)  = {hsp_result['delta_h']:5.1f} MPa^0.5")
            print(f"  Ra (Sphere radius)  = {hsp_result['radius']:5.1f} MPa^0.5")
            print()
            print("Calculation Quality:")
            print(f"  Accuracy:           {hsp_result['accuracy']:5.1%}")
            print(f"  Data Fit:           {hsp_result['data_fit']:5.1%}")
            print(f"  Error:              {hsp_result['error']:8.6f}")
            print()
            print("Data Summary:")
            print(f"  Total solvents:     {hsp_result['solvent_count']}")
            print(f"  Good solvents:      {hsp_result['good_solvents']}")
            print(f"  Poor solvents:      {hsp_result['solvent_count'] - hsp_result['good_solvents']}")

            # Calculate total solubility parameter
            total_delta = (hsp_result['delta_d']**2 + hsp_result['delta_p']**2 + hsp_result['delta_h']**2)**0.5
            print(f"  Total d:            {total_delta:5.1f} MPa^0.5")

            print("\n" + "="*60)
            print("INTERPRETATION")
            print("="*60)

            # Provide interpretation
            if hsp_result['delta_d'] > 16:
                print("• High dispersive component - polymer has strong van der Waals interactions")
            else:
                print("• Moderate dispersive component - typical for many organic polymers")

            if hsp_result['delta_p'] > 8:
                print("• High polar component - polymer has significant dipole interactions")
            else:
                print("• Low polar component - relatively non-polar polymer")

            if hsp_result['delta_h'] > 8:
                print("• High hydrogen bonding - polymer can form hydrogen bonds")
            else:
                print("• Low hydrogen bonding - limited hydrogen bonding capability")

            if hsp_result['accuracy'] > 0.9:
                print("• Excellent fit quality - results are highly reliable")
            elif hsp_result['accuracy'] > 0.7:
                print("• Good fit quality - results are reliable")
            else:
                print("• Moderate fit quality - may need more solvent data points")

            print("\nSolvent Selection Guidance:")
            print(f"• Look for solvents with HSP values close to:")
            print(f"  dD = {hsp_result['delta_d']:.1f} +/- 2.0")
            print(f"  dP = {hsp_result['delta_p']:.1f} +/- 2.0")
            print(f"  dH = {hsp_result['delta_h']:.1f} +/- 2.0")

        else:
            error_data = calc_response.json()
            print(f"[FAIL] HSP calculation failed: {error_data.get('detail', 'Unknown error')}")

    except requests.exceptions.ConnectionError:
        print("[ERROR] Connection Error: Server not running on localhost:8200")
        print("Please run 'python start.py' first")
    except Exception as e:
        print(f"[ERROR] Error: {e}")

if __name__ == "__main__":
    demonstrate_hsp_calculation()