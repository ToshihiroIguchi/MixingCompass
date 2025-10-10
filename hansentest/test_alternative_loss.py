"""
Test alternative loss functions for HSP calculation
"""
import pandas as pd
import numpy as np
from hspipy import HSPEstimator
from alternative_loss import SoftBoundaryLoss, ExponentialLoss, AdaptiveWeightLoss


def hansen_distance(point, center):
    """Calculate Hansen distance."""
    return np.sqrt(np.sum((point - center)**2))


# Load data
print("=" * 80)
print("Testing Alternative Loss Functions for HSP Calculation")
print("=" * 80)

df = pd.read_csv('hansentest.csv')
X = df[['D', 'P', 'H']].values
y = df['Data'].values

print(f"\nDataset: {len(df)} solvents")
print(f"  Good (1.0): {sum(y == 1.0)}, Partial (0.5): {sum(y == 0.5)}, Poor (0.0): {sum(y == 0.0)}")

# Test different loss functions with optimal size_factor
loss_functions = [
    ("SoftBoundaryLoss", SoftBoundaryLoss, [0.0, 0.0001, 0.0005, 0.001]),
    ("ExponentialLoss", ExponentialLoss, [0.0, 0.0001, 0.0005, 0.001]),
    ("AdaptiveWeightLoss", AdaptiveWeightLoss, [0.0, 0.0001, 0.0005, 0.001]),
]

all_results = []

for loss_name, LossClass, size_factors in loss_functions:
    print("\n" + "=" * 80)
    print(f"Loss Function: {loss_name}")
    print("=" * 80)

    best_accuracy = 0
    best_result = None

    for sf in size_factors:
        print(f"\n--- size_factor = {sf} ---")

        est = HSPEstimator(
            n_spheres=1,
            method='differential_evolution',
            loss=LossClass(size_factor=sf if sf > 0 else None),
            de_bounds=[(10, 30), (0, 30), (0, 30), (1, 20)],
            de_maxiter=3000,
            de_workers=1
        )
        est.fit(X, y)

        hsp = est.hsp_[0]
        delta_d, delta_p, delta_h, radius = float(hsp[0]), float(hsp[1]), float(hsp[2]), float(hsp[3])

        # Calculate accuracy
        center = np.array([delta_d, delta_p, delta_h])
        correct = 0
        for i in range(len(X)):
            dist = hansen_distance(X[i], center)
            red = dist / radius
            predicted_good = red < 1.0
            actual_good = y[i] >= 0.5
            if predicted_good == actual_good:
                correct += 1
        accuracy = correct / len(X) * 100

        print(f"  D={delta_d:.2f}, P={delta_p:.2f}, H={delta_h:.2f}, Ra={radius:.2f}")
        print(f"  Error={est.error_:.6f}, Accuracy={accuracy:.1f}%")

        if accuracy > best_accuracy or (accuracy == best_accuracy and radius < best_result['radius']):
            best_accuracy = accuracy
            best_result = {
                'loss': loss_name,
                'size_factor': sf,
                'D': delta_d,
                'P': delta_p,
                'H': delta_h,
                'radius': radius,
                'accuracy': accuracy,
                'error': est.error_
            }

    all_results.append(best_result)
    print(f"\nBest for {loss_name}: size_factor={best_result['size_factor']}, Accuracy={best_result['accuracy']:.1f}%")

# Summary comparison
print("\n" + "=" * 80)
print("SUMMARY: Best Result for Each Loss Function")
print("=" * 80)
print(f"{'Loss Function':<25} {'size_factor':<12} {'D':<6} {'P':<6} {'H':<6} {'Ra':<6} {'Acc%':<6}")
print("-" * 80)

for result in all_results:
    print(f"{result['loss']:<25} {result['size_factor']:<12.4f} "
          f"{result['D']:<6.2f} {result['P']:<6.2f} {result['H']:<6.2f} "
          f"{result['radius']:<6.2f} {result['accuracy']:<6.1f}")

# Find overall best
best_overall = max(all_results, key=lambda x: (x['accuracy'], -x['radius']))
print("\n" + "=" * 80)
print(f"OVERALL BEST: {best_overall['loss']}")
print("=" * 80)
print(f"  D  = {best_overall['D']:.2f} MPa^0.5")
print(f"  P  = {best_overall['P']:.2f} MPa^0.5")
print(f"  H  = {best_overall['H']:.2f} MPa^0.5")
print(f"  Ra = {best_overall['radius']:.2f} MPa^0.5")
print(f"  Accuracy = {best_overall['accuracy']:.1f}%")
print(f"  size_factor = {best_overall['size_factor']}")
