"""
Debug: Test how inside_limit actually classifies data values
"""

import pandas as pd
import numpy as np
from hspipy import HSPEstimator

# Create simple test data with clear Data values
test_data = pd.DataFrame({
    'Chemical': ['A', 'B', 'C', 'D', 'E'],
    'D': [16.0, 16.0, 16.0, 16.0, 16.0],
    'P': [8.0, 8.0, 8.0, 8.0, 8.0],
    'H': [10.0, 10.0, 10.0, 10.0, 10.0],
    'Data': [0.0, 0.5, 0.9, 1.0, 1.5]
})

X = test_data[['D', 'P', 'H']].to_numpy()

print("=" * 80)
print("Debug: How does inside_limit classify different Data values?")
print("=" * 80)

# Test different inside_limit values
for limit in [0.5, 0.9, 1.0, 1.5]:
    print(f"\ninside_limit = {limit}")
    print("-" * 80)

    y = test_data['Data'].to_numpy()

    # According to documentation:
    # 0 < y <= inside_limit → inside
    # y == 0 or y > inside_limit → outside

    print("Expected classification (from docs):")
    for val in [0.0, 0.5, 0.9, 1.0, 1.5]:
        if val == 0:
            expected = "outside"
        elif 0 < val <= limit:
            expected = "inside"
        else:
            expected = "outside"
        print(f"  Data={val:.1f} → {expected}")

    # Now test with HSPEstimator
    try:
        est = HSPEstimator(inside_limit=limit, n_spheres=1)
        est.fit(X, y)

        if est.hsp_ is not None and len(est.hsp_) > 0:
            print(f"\nHSP Result: δD={est.hsp_[0][0]:.2f}, δP={est.hsp_[0][1]:.2f}, δH={est.hsp_[0][2]:.2f}, Ra={est.hsp_[0][3]:.2f}")

            # Check internal classification
            # HSPiPy should have converted y values to binary
            print("\nActual behavior: (checking which values were treated as 'inside' during fitting)")

    except Exception as e:
        print(f"Error: {e}")

print("\n" + "=" * 80)
