"""
Simple HSPiPy functionality test
"""

import pandas as pd
from hspipy import HSP

def simple_test():
    """Simple functionality test"""
    print("HSPiPy Simple Test")
    print("-" * 30)

    # Create minimal test data
    data = pd.DataFrame({
        'Chemical': ['Water', 'Ethanol', 'Toluene', 'Hexane'],
        'D': [15.5, 15.8, 18.0, 14.9],
        'P': [16.0, 8.8, 1.4, 0.0],
        'H': [42.3, 19.4, 2.0, 0.0],
        'Data': [1, 1, 0, 0]
    })

    data.to_csv('simple_test.csv', index=False)
    print("Test data created")

    try:
        hsp = HSP()
        hsp.read('simple_test.csv')
        print("Data loaded")

        # Get calculation result
        result = hsp.get(inside_limit=1)
        print("Calculation completed")

        # Check if we can access results
        try:
            d_val = hsp.d
            p_val = hsp.p
            h_val = hsp.h
            radius = hsp.radius
            accuracy = hsp.accuracy

            print(f"Results available:")
            print(f"  δD = {d_val:.1f}")
            print(f"  δP = {p_val:.1f}")
            print(f"  δH = {h_val:.1f}")
            print(f"  Ra = {radius:.1f}")
            print(f"  Accuracy = {accuracy:.3f}")

            return True, (d_val, p_val, h_val, radius, accuracy)

        except Exception as e:
            print(f"Cannot access results: {e}")
            return False, None

    except Exception as e:
        print(f"Test failed: {e}")
        return False, None

if __name__ == "__main__":
    success, results = simple_test()
    print(f"\nTest result: {'SUCCESS' if success else 'FAILED'}")
    if results:
        print(f"HSP values: δD={results[0]:.1f}, δP={results[1]:.1f}, δH={results[2]:.1f}")