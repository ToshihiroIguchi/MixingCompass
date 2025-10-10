"""
Test all loss functions with size_factor=0 (no size penalty)
"""
import pandas as pd
import numpy as np
from hspipy import HSPEstimator
from continuous_hsp_loss import ContinuousHSPLoss, WeightedDistanceLoss
from alternative_loss import SoftBoundaryLoss, ExponentialLoss, AdaptiveWeightLoss


def hansen_distance(point, center):
    """Calculate Hansen distance."""
    return np.sqrt(np.sum((point - center)**2))


# Load data
print("=" * 80)
print("Comparison of All Loss Functions with size_factor=0")
print("=" * 80)

df = pd.read_csv('hansentest.csv')
X = df[['D', 'P', 'H']].values
y = df['Data'].values

print(f"\nDataset: {len(df)} solvents")
print(f"  Good (1.0): {sum(y == 1.0)}, Partial (0.5): {sum(y == 0.5)}, Poor (0.0): {sum(y == 0.0)}")

# Test all loss functions with size_factor=0
loss_functions = [
    ("ContinuousHSPLoss", ContinuousHSPLoss(size_factor=None)),
    ("WeightedDistanceLoss", WeightedDistanceLoss(size_factor=None)),
    ("SoftBoundaryLoss", SoftBoundaryLoss(size_factor=None)),
    ("ExponentialLoss", ExponentialLoss(size_factor=None)),
    ("AdaptiveWeightLoss", AdaptiveWeightLoss(size_factor=None)),
]

results = []

for loss_name, loss_func in loss_functions:
    print("\n" + "=" * 80)
    print(f"Loss Function: {loss_name} (size_factor=0)")
    print("=" * 80)

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

    print(f"\nHansen Solubility Parameters:")
    print(f"  δD = {delta_d:.2f} MPa^0.5")
    print(f"  δP = {delta_p:.2f} MPa^0.5")
    print(f"  δH = {delta_h:.2f} MPa^0.5")
    print(f"  Ra = {radius:.2f} MPa^0.5")
    print(f"\nOptimization Error: {est.error_:.6f}")
    print(f"\nAccuracy Breakdown:")
    print(f"  Overall:  {accuracy:.1f}% ({correct}/{len(X)})")
    print(f"  Good:     {good_accuracy:.1f}% ({good_correct}/{int(sum(y == 1.0))})")
    print(f"  Partial:  {partial_accuracy:.1f}% ({partial_correct}/{int(sum(y == 0.5))})")
    print(f"  Poor:     {poor_accuracy:.1f}% ({poor_correct}/{int(sum(y == 0.0))})")

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
print(f"{'Loss Function':<25} {'δD':<7} {'δP':<7} {'δH':<7} {'Ra':<7} {'Acc%':<7} {'Error':<10}")
print("-" * 80)

for r in results:
    print(f"{r['loss']:<25} {r['D']:<7.2f} {r['P']:<7.2f} {r['H']:<7.2f} "
          f"{r['Ra']:<7.2f} {r['accuracy']:<7.1f} {r['error']:<10.6f}")

print("\n" + "=" * 80)
print("DETAILED ACCURACY BY SOLVENT TYPE")
print("=" * 80)
print(f"{'Loss Function':<25} {'Good%':<8} {'Partial%':<10} {'Poor%':<8} {'Overall%':<10}")
print("-" * 80)

for r in results:
    print(f"{r['loss']:<25} {r['good_acc']:<8.1f} {r['partial_acc']:<10.1f} "
          f"{r['poor_acc']:<8.1f} {r['accuracy']:<10.1f}")

# Find best by different criteria
best_accuracy = max(results, key=lambda x: x['accuracy'])
best_balanced = max(results, key=lambda x: min(x['good_acc'], x['poor_acc']))
smallest_radius = min(results, key=lambda x: x['Ra'])

print("\n" + "=" * 80)
print("RECOMMENDATIONS")
print("=" * 80)
print(f"Best Overall Accuracy:  {best_accuracy['loss']} ({best_accuracy['accuracy']:.1f}%)")
print(f"  δD={best_accuracy['D']:.2f}, δP={best_accuracy['P']:.2f}, δH={best_accuracy['H']:.2f}, Ra={best_accuracy['Ra']:.2f}")

print(f"\nBest Balanced (good/poor): {best_balanced['loss']}")
print(f"  Good: {best_balanced['good_acc']:.1f}%, Poor: {best_balanced['poor_acc']:.1f}%")
print(f"  δD={best_balanced['D']:.2f}, δP={best_balanced['P']:.2f}, δH={best_balanced['H']:.2f}, Ra={best_balanced['Ra']:.2f}")

print(f"\nSmallest Radius:        {smallest_radius['loss']} (Ra={smallest_radius['Ra']:.2f})")
print(f"  Accuracy: {smallest_radius['accuracy']:.1f}%")
print(f"  δD={smallest_radius['D']:.2f}, δP={smallest_radius['P']:.2f}, δH={smallest_radius['H']:.2f}, Ra={smallest_radius['Ra']:.2f}")
