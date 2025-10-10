"""
Simple HSP calculation script using HSPiPy
"""

import pandas as pd
import numpy as np
from hspipy import HSPEstimator

# Load solvent test data
df = pd.read_csv('hansentest.csv')

print("=" * 60)
print("Hansen Solubility Parameter Calculation")
print("=" * 60)
print(f"\nLoaded {len(df)} solvent tests")
print(f"Good solvents (Data=1.0): {len(df[df['Data'] == 1.0])}")
print(f"Partial solvents (Data=0.5): {len(df[df['Data'] == 0.5])}")
print(f"Poor solvents (Data=0.0): {len(df[df['Data'] == 0.0])}")

# Prepare data for fitting
X = df[['D', 'P', 'H']].to_numpy()
y = df['Data'].to_numpy()

print("\n" + "=" * 60)
print("Fitting HSP model...")
print("=" * 60)

# Create HSP Estimator for single sphere model
# inside_limit=1 means at least 1 good solvent should be inside the sphere
est = HSPEstimator(inside_limit=1, n_spheres=1)

# Fit the model to the data
est.fit(X, y)

# Print results
print("\n" + "=" * 60)
print("Results:")
print("=" * 60)

if est.hsp_ is not None and len(est.hsp_) > 0:
    hsp_params = est.hsp_[0]  # Get first sphere parameters
    print(f"δD (Dispersion):     {hsp_params[0]:.2f} MPa^0.5")
    print(f"δP (Polar):          {hsp_params[1]:.2f} MPa^0.5")
    print(f"δH (Hydrogen bond):  {hsp_params[2]:.2f} MPa^0.5")
    print(f"Ra (Sphere radius):  {hsp_params[3]:.2f} MPa^0.5")
else:
    print("ERROR: Failed to calculate HSP parameters")

# Print error metrics
if hasattr(est, 'error_') and est.error_ is not None:
    print(f"\nObjective error:     {est.error_:.4f}")

# Calculate model accuracy
try:
    acc = est.score(X, y)
    print(f"Accuracy:            {acc:.4f}")
except Exception as e:
    print(f"Could not calculate accuracy: {e}")

# Print detailed information about good solvents
print("\n" + "=" * 60)
print("Good Solvents (Data=1.0):")
print("=" * 60)
good_solvents = df[df['Data'] == 1.0]
for idx, row in good_solvents.iterrows():
    print(f"{row['Chemical']:40s} δD={row['D']:5.1f}, δP={row['P']:5.1f}, δH={row['H']:5.1f}")

# Calculate distances from sphere center if we have results
if est.hsp_ is not None and len(est.hsp_) > 0:
    center_d, center_p, center_h, radius = est.hsp_[0]

    print("\n" + "=" * 60)
    print("Distance from sphere center (RED):")
    print("=" * 60)
    print("RED < 1.0 = Inside sphere (predicted good)")
    print("RED > 1.0 = Outside sphere (predicted poor)")
    print("-" * 60)

    for idx, row in df.iterrows():
        # Calculate RED (Relative Energy Difference)
        dist_d = row['D'] - center_d
        dist_p = row['P'] - center_p
        dist_h = row['H'] - center_h
        ra = np.sqrt(dist_d**2 + dist_p**2 + dist_h**2)
        red = ra / radius

        status = "INSIDE " if red < 1.0 else "OUTSIDE"
        actual = "Good" if row['Data'] == 1.0 else ("Partial" if row['Data'] == 0.5 else "Poor")
        match = "OK" if (red < 1.0 and row['Data'] >= 0.5) or (red >= 1.0 and row['Data'] < 0.5) else "NG"

        print(f"{row['Chemical']:40s} RED={red:5.2f} {status} [Actual: {actual:7s}] {match}")

print("\n" + "=" * 60)
print("Calculation complete")
print("=" * 60)
