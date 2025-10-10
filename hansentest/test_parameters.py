"""
Test different HSPEstimator parameters
"""

import pandas as pd
import numpy as np
from hspipy import HSPEstimator

# Load solvent test data
df = pd.read_csv('hansentest.csv')

# Prepare data for fitting
X = df[['D', 'P', 'H']].to_numpy()
y = df['Data'].to_numpy()

print("=" * 80)
print("HSP Parameter Comparison Test")
print("=" * 80)
print(f"\nDataset: {len(df)} solvent tests")
print(f"Good solvents (Data=1.0): {len(df[df['Data'] == 1.0])}")
print(f"Partial solvents (Data=0.5): {len(df[df['Data'] == 0.5])}")
print(f"Poor solvents (Data=0.0): {len(df[df['Data'] == 0.0])}")

# Test configurations
test_cases = [
    {
        'name': 'Default (baseline)',
        'params': {'inside_limit': 1, 'n_spheres': 1}
    },
    {
        'name': 'Case 1: inside_limit=0.9',
        'params': {'inside_limit': 0.9, 'n_spheres': 1}
    },
    {
        'name': 'Case 1b: inside_limit=0.95',
        'params': {'inside_limit': 0.95, 'n_spheres': 1}
    },
    {
        'name': 'Case 2: method=differential_evolution',
        'params': {'inside_limit': 1, 'n_spheres': 1, 'method': 'differential_evolution'}
    }
]

results = []

for test_case in test_cases:
    print("\n" + "=" * 80)
    print(f"Testing: {test_case['name']}")
    print("=" * 80)
    print(f"Parameters: {test_case['params']}")

    try:
        # Create and fit estimator
        est = HSPEstimator(**test_case['params'])
        est.fit(X, y)

        # Extract results
        if est.hsp_ is not None and len(est.hsp_) > 0:
            hsp_params = est.hsp_[0]
            delta_d = hsp_params[0]
            delta_p = hsp_params[1]
            delta_h = hsp_params[2]
            radius = hsp_params[3]

            print(f"\nResults:")
            print(f"  δD: {delta_d:.2f} MPa^0.5")
            print(f"  δP: {delta_p:.2f} MPa^0.5")
            print(f"  δH: {delta_h:.2f} MPa^0.5")
            print(f"  Ra: {radius:.2f} MPa^0.5")

            # Calculate accuracy
            try:
                accuracy = est.score(X, y)
                print(f"  Accuracy: {accuracy:.4f}")
            except:
                accuracy = None
                print(f"  Accuracy: N/A")

            # Calculate error
            error = est.error_ if hasattr(est, 'error_') and est.error_ is not None else None
            if error is not None:
                print(f"  Error: {error:.6f}")

            # Count predictions
            center_d, center_p, center_h, ra = hsp_params
            inside_count = 0
            outside_count = 0
            correct_predictions = 0

            for idx, row in df.iterrows():
                # Calculate RED
                dist_d = row['D'] - center_d
                dist_p = row['P'] - center_p
                dist_h = row['H'] - center_h
                distance = np.sqrt(dist_d**2 + dist_p**2 + dist_h**2)
                red = distance / ra

                predicted_inside = red < 1.0

                # Determine actual classification based on inside_limit
                inside_limit = test_case['params']['inside_limit']
                actual_inside = row['Data'] > 0 and row['Data'] <= inside_limit

                if predicted_inside:
                    inside_count += 1
                else:
                    outside_count += 1

                if predicted_inside == actual_inside:
                    correct_predictions += 1

            print(f"  Predicted inside: {inside_count}")
            print(f"  Predicted outside: {outside_count}")
            print(f"  Correct predictions: {correct_predictions}/{len(df)}")

            # Store results
            results.append({
                'name': test_case['name'],
                'delta_d': delta_d,
                'delta_p': delta_p,
                'delta_h': delta_h,
                'radius': radius,
                'accuracy': accuracy,
                'error': error,
                'inside': inside_count,
                'outside': outside_count,
                'correct': correct_predictions
            })

        else:
            print("ERROR: Failed to calculate HSP parameters")
            results.append({
                'name': test_case['name'],
                'error': 'Failed'
            })

    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        results.append({
            'name': test_case['name'],
            'error': str(e)
        })

# Print summary comparison
print("\n" + "=" * 80)
print("Summary Comparison")
print("=" * 80)
print(f"{'Case':<35s} {'δD':>6s} {'δP':>6s} {'δH':>6s} {'Ra':>6s} {'Acc':>8s} {'In':>3s} {'Out':>3s}")
print("-" * 80)

for result in results:
    if 'delta_d' in result:
        acc_str = f"{result['accuracy']:.4f}" if result['accuracy'] is not None else "N/A"
        print(f"{result['name']:<35s} {result['delta_d']:6.2f} {result['delta_p']:6.2f} {result['delta_h']:6.2f} {result['radius']:6.2f} {acc_str:>8s} {result['inside']:3d} {result['outside']:3d}")
    else:
        print(f"{result['name']:<35s} FAILED: {result.get('error', 'Unknown error')}")

print("\n" + "=" * 80)
print("Test Complete")
print("=" * 80)
