"""
Test inside_limit=0.5 to see if Data=0.5 becomes inside and Data=1.0 becomes outside
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
print("Testing inside_limit=0.5")
print("=" * 80)
print(f"\nDataset: {len(df)} solvent tests")
print(f"Data=1.0: {len(df[df['Data'] == 1.0])}")
print(f"Data=0.5: {len(df[df['Data'] == 0.5])}")
print(f"Data=0.0: {len(df[df['Data'] == 0.0])}")

print("\nWith inside_limit=0.5:")
print("Expected classification:")
print("  Data=0.5 → inside (0 < 0.5 <= 0.5)")
print("  Data=1.0 → outside (1.0 > 0.5)")
print("  Data=0.0 → outside")

# Create and fit estimator
est = HSPEstimator(inside_limit=0.5, n_spheres=1)
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

    # Show which solvents are predicted inside
    print("\n" + "=" * 80)
    print("Predicted classifications:")
    print("=" * 80)

    center_d, center_p, center_h, ra = hsp_params

    data_0_5_solvents = []
    data_1_0_solvents = []

    for idx, row in df.iterrows():
        # Calculate RED
        dist_d = row['D'] - center_d
        dist_p = row['P'] - center_p
        dist_h = row['H'] - center_h
        distance = np.sqrt(dist_d**2 + dist_p**2 + dist_h**2)
        red = distance / ra

        predicted_inside = red < 1.0

        if row['Data'] == 0.5:
            data_0_5_solvents.append((row['Chemical'], predicted_inside, red))
        elif row['Data'] == 1.0:
            data_1_0_solvents.append((row['Chemical'], predicted_inside, red))

    print("\nData=0.5 solvents (should be INSIDE):")
    for name, pred_inside, red in data_0_5_solvents:
        status = "INSIDE " if pred_inside else "OUTSIDE"
        print(f"  {name:45s} RED={red:5.2f} {status}")

    print("\nData=1.0 solvents (should be OUTSIDE):")
    for name, pred_inside, red in data_1_0_solvents:
        status = "INSIDE " if pred_inside else "OUTSIDE"
        print(f"  {name:45s} RED={red:5.2f} {status}")

print("\n" + "=" * 80)
print("Test Complete")
print("=" * 80)
