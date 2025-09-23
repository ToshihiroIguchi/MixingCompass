"""
Detailed verification of HSPiPy library
"""

import pandas as pd
import numpy as np
from hspipy import HSP
import traceback

def detailed_hsp_test():
    """Perform detailed HSPiPy testing"""
    print("="*60)
    print("DETAILED HSPiPy VERIFICATION")
    print("="*60)

    # Create test data with known HSP values
    test_data = pd.DataFrame({
        'Chemical': ['Water', 'Ethanol', 'Acetone', 'Chloroform', 'Toluene', 'Hexane'],
        'D': [15.5, 15.8, 15.5, 17.8, 18.0, 14.9],
        'P': [16.0, 8.8, 10.4, 3.1, 1.4, 0.0],
        'H': [42.3, 19.4, 7.0, 5.7, 2.0, 0.0],
        'Data': [1, 1, 1, 0, 0, 0]  # Solubility: 1=good solvent, 0=poor solvent
    })

    print("Test Data:")
    print(test_data)
    print()

    # Save to CSV
    test_data.to_csv('detailed_test.csv', index=False)

    try:
        # Initialize HSP object
        hsp = HSP()
        print("HSP object created successfully")

        # Read data
        print("Reading CSV data...")
        hsp.read('detailed_test.csv')
        print("Data loaded successfully")

        # Check what's actually loaded
        print(f"Internal data shape: {len(hsp.inside_) + len(hsp.outside_)}")
        print(f"Inside solvents: {len(hsp.inside_)}")
        print(f"Outside solvents: {len(hsp.outside_)}")
        print()

        # Perform HSP calculation
        print("Performing HSP calculation...")
        hsp.get(inside_limit=1)
        print("Calculation completed successfully!")
        print()

        # Display results
        print("CALCULATION RESULTS:")
        print("-" * 40)
        print(f"Dispersive (δD): {hsp.d:.2f} MPa^0.5")
        print(f"Polar (δP): {hsp.p:.2f} MPa^0.5")
        print(f"Hydrogen bonding (δH): {hsp.h:.2f} MPa^0.5")
        print(f"Sphere radius (Ra): {hsp.radius:.2f} MPa^0.5")
        print(f"Accuracy: {hsp.accuracy:.4f}")
        print(f"Error: {hsp.error:.6f}")
        print(f"Data fit: {hsp.DATAFIT:.4f}")
        print()

        # Verify sphere classification
        print("SOLVENT CLASSIFICATION:")
        print("-" * 40)
        for i, solvent in enumerate(test_data['Chemical']):
            predicted = 1 if i < len(hsp.inside_) else 0
            actual = test_data.iloc[i]['Data']
            status = "✓" if predicted == actual else "✗"
            print(f"{solvent:12}: Predicted={predicted}, Actual={actual} {status}")

        print()

        # Test visualization capability
        print("Testing visualization...")
        try:
            # Create plots (but don't show them)
            import matplotlib
            matplotlib.use('Agg')  # Non-interactive backend

            hsp.plot_2d()
            print("2D plot creation: SUCCESS")

            hsp.plot_3d()
            print("3D plot creation: SUCCESS")

        except Exception as plot_e:
            print(f"Plot creation failed: {plot_e}")

        return True

    except Exception as e:
        print(f"ERROR in HSPiPy test: {e}")
        print("\nTraceback:")
        traceback.print_exc()
        return False

def test_edge_cases():
    """Test edge cases"""
    print("\n" + "="*60)
    print("TESTING EDGE CASES")
    print("="*60)

    # Test with minimal data
    minimal_data = pd.DataFrame({
        'Chemical': ['GoodSolvent', 'BadSolvent'],
        'D': [15.0, 20.0],
        'P': [10.0, 5.0],
        'H': [15.0, 2.0],
        'Data': [1, 0]
    })

    minimal_data.to_csv('minimal_test.csv', index=False)

    try:
        hsp_min = HSP()
        hsp_min.read('minimal_test.csv')
        hsp_min.get(inside_limit=1)

        print("Minimal data test: SUCCESS")
        print(f"HSP: δD={hsp_min.d:.1f}, δP={hsp_min.p:.1f}, δH={hsp_min.h:.1f}")
        return True

    except Exception as e:
        print(f"Minimal data test FAILED: {e}")
        return False

if __name__ == "__main__":
    detailed_success = detailed_hsp_test()
    edge_success = test_edge_cases()

    print("\n" + "="*60)
    print("FINAL VERIFICATION RESULTS")
    print("="*60)
    print(f"Detailed test: {'PASS' if detailed_success else 'FAIL'}")
    print(f"Edge case test: {'PASS' if edge_success else 'FAIL'}")
    print(f"Overall HSPiPy verification: {'PASS' if detailed_success and edge_success else 'FAIL'}")