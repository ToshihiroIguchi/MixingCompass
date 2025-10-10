"""
Calculate Hansen Solubility Parameters from hansentest.csv with detailed output
"""
import pandas as pd
import numpy as np
from hspipy import HSPEstimator

# Import custom loss functions
import sys
sys.path.insert(0, '.')
from continuous_hsp_loss import ContinuousHSPLoss, WeightedDistanceLoss

def hansen_distance(point, center):
    """Calculate Hansen distance."""
    return np.sqrt(np.sum((point - center)**2))

# Load data
print("=" * 80)
print("Hansen Solubility Parameter Calculation from hansentest.csv")
print("=" * 80)

df = pd.read_csv('hansentest.csv')
X = df[['D', 'P', 'H']].values
y = df['Data'].values

print(f"\nDataset Information:")
print(f"  Total solvents: {len(df)}")
print(f"  Good solvents (1.0): {sum(y == 1.0)}")
print(f"  Partial solvents (0.5): {sum(y == 0.5)}")
print(f"  Poor solvents (0.0): {sum(y == 0.0)}")

# Calculate using ContinuousHSPLoss with size_factor
print("\n" + "=" * 80)
print("Method: ContinuousHSPLoss with size_factor penalty")
print("=" * 80)

# Test different size_factor values (with R^2 penalty now)
# Explore wider range to see if accuracy continues to improve
size_factors = [0.0, 0.0001, 0.0003, 0.0005, 0.001, 0.002, 0.003, 0.005, 0.01, 0.02, 0.05]
results_by_size = []

for sf in size_factors:
    print(f"\n--- Testing size_factor = {sf} ---")

    est = HSPEstimator(
        n_spheres=1,
        method='differential_evolution',  # MUST specify to use custom loss!
        loss=ContinuousHSPLoss(size_factor=sf if sf > 0 else None),
        de_bounds=[(10, 30), (0, 30), (0, 30), (1, 20)],  # Wide range, let size_factor control
        de_maxiter=3000,
        de_workers=1  # Avoid pickle error with custom loss
    )
    est.fit(X, y)

    hsp = est.hsp_[0]
    delta_d, delta_p, delta_h, radius = float(hsp[0]), float(hsp[1]), float(hsp[2]), float(hsp[3])

    print(f"  δD={delta_d:.2f}, δP={delta_p:.2f}, δH={delta_h:.2f}, Ra={radius:.2f}")
    print(f"  Error: {est.error_:.6f}")

    # Quick accuracy check
    center = np.array([delta_d, delta_p, delta_h])
    correct = 0
    for i in range(len(X)):
        dist = np.sqrt(np.sum((X[i] - center)**2))
        red = dist / radius
        predicted_good = red < 1.0
        actual_good = y[i] >= 0.5
        if predicted_good == actual_good:
            correct += 1
    accuracy = correct / len(X) * 100
    print(f"  Accuracy: {accuracy:.1f}%")

    results_by_size.append({
        'size_factor': sf,
        'hsp': hsp,
        'error': est.error_,
        'accuracy': accuracy
    })

# Select best result (highest accuracy)
best_result = max(results_by_size, key=lambda x: x['accuracy'])
print(f"\n{'=' * 80}")
print(f"Best size_factor: {best_result['size_factor']} (Accuracy: {best_result['accuracy']:.1f}%)")
print(f"{'=' * 80}")

# Use best size_factor for detailed analysis
best_sf = best_result['size_factor']
est = HSPEstimator(
    n_spheres=1,
    method='differential_evolution',  # MUST specify to use custom loss!
    loss=ContinuousHSPLoss(size_factor=best_sf if best_sf > 0 else None),
    de_bounds=[(10, 30), (0, 30), (0, 30), (1, 20)],  # Wide range, let size_factor control
    de_maxiter=3000,
    de_workers=1  # Avoid pickle error with custom loss
)
est.fit(X, y)

hsp = est.hsp_[0]
delta_d, delta_p, delta_h, radius = float(hsp[0]), float(hsp[1]), float(hsp[2]), float(hsp[3])

print(f"\nCalculated Hansen Solubility Parameters:")
print(f"  δD (Dispersion):       {delta_d:.2f} MPa^0.5")
print(f"  δP (Polar):            {delta_p:.2f} MPa^0.5")
print(f"  δH (Hydrogen bonding): {delta_h:.2f} MPa^0.5")
print(f"  Ra (Interaction radius): {radius:.2f} MPa^0.5")
print(f"\nOptimization Error: {est.error_:.6f}")

# Calculate RED for each solvent
print("\n" + "=" * 80)
print("Relative Energy Difference (RED) for Each Solvent")
print("=" * 80)
print("RED < 1.0 = Inside sphere (good solvent predicted)")
print("RED ~ 1.0 = On boundary")
print("RED > 1.0 = Outside sphere (poor solvent predicted)")
print("-" * 80)

center = np.array([delta_d, delta_p, delta_h])
results = []

for i, row in df.iterrows():
    solvent_hsp = X[i]
    dist = hansen_distance(solvent_hsp, center)
    red = dist / radius
    
    actual_score = y[i]
    if actual_score == 1.0:
        label = "Good"
    elif actual_score == 0.5:
        label = "Partial"
    else:
        label = "Poor"
    
    # Check if prediction matches
    predicted_good = red < 1.0
    actual_good = actual_score >= 0.5
    match = "OK" if predicted_good == actual_good else "NG"
    
    results.append({
        'Solvent': row['Chemical'],
        'RED': red,
        'Label': label,
        'Match': match,
        'Distance': dist
    })
    
    print(f"{row['Chemical']:45s} RED={red:5.2f} [{label:7s}] {match}")

# Summary statistics
print("\n" + "=" * 80)
print("Summary Statistics")
print("=" * 80)

good_solvents = [r for r in results if r['Label'] == 'Good']
partial_solvents = [r for r in results if r['Label'] == 'Partial']
poor_solvents = [r for r in results if r['Label'] == 'Poor']

print(f"\nGood solvents (y=1.0):")
print(f"  Count: {len(good_solvents)}")
print(f"  Average RED: {np.mean([r['RED'] for r in good_solvents]):.3f}")
print(f"  Inside sphere (RED<1): {sum([r['RED'] < 1.0 for r in good_solvents])}")

print(f"\nPartial solvents (y=0.5):")
print(f"  Count: {len(partial_solvents)}")
if len(partial_solvents) > 0:
    print(f"  Average RED: {np.mean([r['RED'] for r in partial_solvents]):.3f}")
    print(f"  Inside sphere (RED<1): {sum([r['RED'] < 1.0 for r in partial_solvents])}")

print(f"\nPoor solvents (y=0.0):")
print(f"  Count: {len(poor_solvents)}")
print(f"  Average RED: {np.mean([r['RED'] for r in poor_solvents]):.3f}")
print(f"  Outside sphere (RED>1): {sum([r['RED'] > 1.0 for r in poor_solvents])}")

# Classification accuracy
correct = sum([r['Match'] == 'OK' for r in results])
total = len(results)
accuracy = correct / total * 100

print(f"\nClassification Accuracy: {correct}/{total} ({accuracy:.1f}%)")
print("\n" + "=" * 80)
print("Calculation Complete")
print("=" * 80)
