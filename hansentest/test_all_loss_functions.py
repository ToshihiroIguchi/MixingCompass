"""
Comprehensive test of all loss functions (size_factor=0)
"""
import pandas as pd
import numpy as np
from hspipy import HSPEstimator
from continuous_hsp_loss import ContinuousHSPLoss, WeightedDistanceLoss
from alternative_loss import (ExponentialLoss, AdaptiveWeightLoss,
                              HuberLoss, LogCoshLoss, QuantileLoss, HingeLoss)


def hansen_distance(point, center):
    """Calculate Hansen distance."""
    return np.sqrt(np.sum((point - center)**2))


# Load data
print("=" * 80)
print("Comprehensive Test of All Loss Functions (size_factor=0)")
print("=" * 80)

df = pd.read_csv('hansentest.csv')
X = df[['D', 'P', 'H']].values
y = df['Data'].values

print(f"\nDataset: {len(df)} solvents")
print(f"  Good (1.0): {sum(y == 1.0)}, Partial (0.5): {sum(y == 0.5)}, Poor (0.0): {sum(y == 0.0)}")

# Test all loss functions
loss_functions = [
    ("ContinuousHSPLoss", ContinuousHSPLoss(size_factor=None)),
    ("WeightedDistanceLoss", WeightedDistanceLoss(size_factor=None)),
    ("ExponentialLoss", ExponentialLoss(size_factor=None)),
    ("AdaptiveWeightLoss", AdaptiveWeightLoss(size_factor=None)),
    ("HuberLoss", HuberLoss(size_factor=None)),
    ("LogCoshLoss", LogCoshLoss(size_factor=None)),
    ("QuantileLoss", QuantileLoss(size_factor=None, quantile=0.5)),
    ("HingeLoss", HingeLoss(size_factor=None, margin=0.1)),
]

results = []

for loss_name, loss_func in loss_functions:
    print(f"\nProcessing: {loss_name}...", end=" ", flush=True)

    est = HSPEstimator(
        n_spheres=1,
        method='differential_evolution',
        loss=loss_func,
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
    good_correct = 0
    partial_correct = 0
    poor_correct = 0

    for i in range(len(X)):
        dist = hansen_distance(X[i], center)
        red = dist / radius
        predicted_good = red < 1.0
        actual_good = y[i] >= 0.5

        if predicted_good == actual_good:
            correct += 1
            if y[i] == 1.0:
                good_correct += 1
            elif y[i] == 0.5:
                partial_correct += 1
            else:
                poor_correct += 1

    accuracy = correct / len(X) * 100
    good_accuracy = good_correct / sum(y == 1.0) * 100
    partial_accuracy = partial_correct / sum(y == 0.5) * 100
    poor_accuracy = poor_correct / sum(y == 0.0) * 100

    print(f"Done. Acc={accuracy:.1f}%")

    results.append({
        'loss': loss_name,
        'D': delta_d,
        'P': delta_p,
        'H': delta_h,
        'Ra': radius,
        'error': est.error_,
        'accuracy': accuracy,
        'good_acc': good_accuracy,
        'partial_acc': partial_accuracy,
        'poor_acc': poor_accuracy
    })

# Summary table
print("\n" + "=" * 80)
print("SUMMARY TABLE (size_factor=0)")
print("=" * 80)
print(f"{'Loss Function':<25} {'δD':<7} {'δP':<7} {'δH':<7} {'Ra':<7} {'Acc%':<7}")
print("-" * 80)

# Sort by accuracy
results_sorted = sorted(results, key=lambda x: x['accuracy'], reverse=True)
for r in results_sorted:
    print(f"{r['loss']:<25} {r['D']:<7.2f} {r['P']:<7.2f} {r['H']:<7.2f} "
          f"{r['Ra']:<7.2f} {r['accuracy']:<7.1f}")

print("\n" + "=" * 80)
print("DETAILED ACCURACY BY SOLVENT TYPE")
print("=" * 80)
print(f"{'Loss Function':<25} {'Good%':<8} {'Partial%':<10} {'Poor%':<8} {'Overall%':<10}")
print("-" * 80)

for r in results_sorted:
    print(f"{r['loss']:<25} {r['good_acc']:<8.1f} {r['partial_acc']:<10.1f} "
          f"{r['poor_acc']:<8.1f} {r['accuracy']:<10.1f}")

# Analysis
print("\n" + "=" * 80)
print("ANALYSIS")
print("=" * 80)

best = results_sorted[0]
print(f"\nBest Overall Accuracy: {best['loss']} ({best['accuracy']:.1f}%)")
print(f"  δD={best['D']:.2f}, δP={best['P']:.2f}, δH={best['H']:.2f}, Ra={best['Ra']:.2f}")
print(f"  Good: {best['good_acc']:.1f}%, Partial: {best['partial_acc']:.1f}%, Poor: {best['poor_acc']:.1f}%")

# Find best balanced
best_balanced = max(results, key=lambda x: min(x['good_acc'], x['poor_acc']))
print(f"\nBest Balanced (good vs poor): {best_balanced['loss']}")
print(f"  Good: {best_balanced['good_acc']:.1f}%, Poor: {best_balanced['poor_acc']:.1f}%")
print(f"  δD={best_balanced['D']:.2f}, δP={best_balanced['P']:.2f}, δH={best_balanced['H']:.2f}, Ra={best_balanced['Ra']:.2f}")

# Smallest reasonable radius
reasonable = [r for r in results if r['accuracy'] >= 75.0]
if reasonable:
    smallest = min(reasonable, key=lambda x: x['Ra'])
    print(f"\nSmallest Radius (with >=75% accuracy): {smallest['loss']}")
    print(f"  Ra={smallest['Ra']:.2f}, Accuracy={smallest['accuracy']:.1f}%")
    print(f"  δD={smallest['D']:.2f}, δP={smallest['P']:.2f}, δH={smallest['H']:.2f}")

# Check for outliers
print(f"\nRadius Statistics:")
radii = [r['Ra'] for r in results]
print(f"  Min: {min(radii):.2f}, Max: {max(radii):.2f}, Mean: {np.mean(radii):.2f}, Std: {np.std(radii):.2f}")

print("\n" + "=" * 80)
print("RECOMMENDATION")
print("=" * 80)
print(f"For highest accuracy: Use {best['loss']} (Acc={best['accuracy']:.1f}%)")
if best['Ra'] > 12:
    print(f"  Note: Ra={best['Ra']:.2f} is large. Consider using size_factor penalty.")
print(f"\nFor balanced classification: Use {best_balanced['loss']}")
print(f"  Better balance between good and poor solvents")
