"""
Test: ContinuousHSPLoss as evaluation metric
"""
import pandas as pd
import numpy as np
from hspipy import HSPEstimator
from continuous_hsp_loss import ContinuousHSPLoss
from evaluation_metrics import (evaluate_with_loss, analyze_loss_components,
                                find_problematic_solvents, loss_based_model_selection)


# Load data
df = pd.read_csv('hansentest.csv')
X = df[['D', 'P', 'H']].values
y = df['Data'].values

print("=" * 80)
print("Test: ContinuousHSPLoss as Evaluation Metric")
print("=" * 80)

# ============================================================================
# Test 1: Train a model and evaluate with Loss
# ============================================================================
print("\n--- Test 1: Basic Evaluation ---")

est = HSPEstimator(
    n_spheres=1,
    method='differential_evolution',
    loss=ContinuousHSPLoss(size_factor=0.001),
    de_maxiter=3000,
    de_workers=1
)
est.fit(X, y)

hsp = est.hsp_[0]
print(f"Trained HSP: D={hsp[0]:.2f}, P={hsp[1]:.2f}, H={hsp[2]:.2f}, Ra={hsp[3]:.2f}")

# Evaluate with Loss metric
metrics = evaluate_with_loss(hsp, X, y, size_factor=None)

print(f"\nEvaluation Metrics (ContinuousHSPLoss):")
print(f"  Base Loss:           {metrics['base_loss']:.6f}")
print(f"  Good Penalty (mean): {metrics['good_penalty_mean']:.6f}")
print(f"  Poor Penalty (mean): {metrics['poor_penalty_mean']:.6f}")

# ============================================================================
# Test 2: Detailed loss analysis by category
# ============================================================================
print("\n--- Test 2: Loss Analysis by Category ---")

analysis = analyze_loss_components(hsp, X, y, size_factor=None)

print(f"\nOverall Loss: {analysis['overall']['base_loss']:.6f}")

print("\nBy Category:")
for cat_name, cat_stats in analysis['by_category'].items():
    print(f"\n  {cat_name.upper()} (n={cat_stats['n_samples']}):")
    print(f"    Mean Loss:      {cat_stats['mean_loss']:.6f}")
    print(f"    Total Loss:     {cat_stats['total_loss']:.6f}")
    print(f"    Contribution:   {cat_stats['contribution_pct']:.1f}%")
    print(f"    Mean RED:       {cat_stats['mean_red']:.3f} ± {cat_stats['std_red']:.3f}")

# ============================================================================
# Test 3: Find problematic solvents
# ============================================================================
print("\n--- Test 3: Problematic Solvents ---")

problem_df = find_problematic_solvents(hsp, X, y, df, threshold=0.05)

if problem_df is not None:
    print(f"\nFound {len(problem_df)} solvents with loss > 0.05:")
    print(problem_df.to_string(index=False))
else:
    print("\nNo problematic solvents found (all loss < 0.05)")

# ============================================================================
# Test 4: Compare different size_factors
# ============================================================================
print("\n--- Test 4: Model Selection by Loss ---")

models = {}
size_factors_to_test = [None, 0.0005, 0.001, 0.002]

for sf in size_factors_to_test:
    est = HSPEstimator(
        n_spheres=1,
        method='differential_evolution',
        loss=ContinuousHSPLoss(size_factor=sf),
        de_maxiter=2000,
        de_workers=1
    )
    est.fit(X, y)

    sf_name = "None" if sf is None else f"{sf:.4f}"
    models[f"size_factor={sf_name}"] = est.hsp_[0]

# Select best model by loss
selection = loss_based_model_selection(models, X, y, size_factor=None)

print(f"\nModel Ranking (by Loss):")
for i, (name, loss) in enumerate(selection['ranking'], 1):
    print(f"  {i}. {name:<25} Loss={loss:.6f}")

print(f"\nBest Model: {selection['best_model']}")
print(f"Best Loss:  {selection['best_loss']:.6f}")

# ============================================================================
# Test 5: Train/Test split comparison
# ============================================================================
print("\n--- Test 5: Train/Test Split (Overfitting Check) ---")

from sklearn.model_selection import train_test_split

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.3, random_state=42, stratify=(y >= 0.5).astype(int)
)

est = HSPEstimator(
    n_spheres=1,
    method='differential_evolution',
    loss=ContinuousHSPLoss(size_factor=0.001),
    de_maxiter=3000,
    de_workers=1
)
est.fit(X_train, y_train)

hsp_trained = est.hsp_[0]

train_metrics = evaluate_with_loss(hsp_trained, X_train, y_train, size_factor=None)
test_metrics = evaluate_with_loss(hsp_trained, X_test, y_test, size_factor=None)

print(f"\nTrain Loss: {train_metrics['base_loss']:.6f}")
print(f"Test Loss:  {test_metrics['base_loss']:.6f}")
print(f"Difference: {test_metrics['base_loss'] - train_metrics['base_loss']:.6f}")

if test_metrics['base_loss'] - train_metrics['base_loss'] < 0.01:
    print("→ No overfitting (difference < 0.01)")
elif test_metrics['base_loss'] - train_metrics['base_loss'] < 0.05:
    print("→ Slight overfitting (difference < 0.05)")
else:
    print("→ Overfitting detected (difference > 0.05)")

# ============================================================================
# Summary
# ============================================================================
print("\n" + "=" * 80)
print("SUMMARY: ContinuousHSPLoss as Evaluation Metric")
print("=" * 80)
print("\nAdvantages:")
print("  ✓ Theoretically consistent (optimization target = evaluation metric)")
print("  ✓ No arbitrary parameters (pure Hansen theory)")
print("  ✓ Continuous values fully utilized (y=0.0, 0.5, 1.0)")
print("  ✓ Clear interpretation (Loss=0 is perfect)")
print("  ✓ Enables direct train/test comparison")
print("  ✓ Works naturally with cross-validation")

print("\nKey Insight:")
print("  Loss should be SIMILAR between train and test for good generalization")
print("  - train_loss ≈ test_loss → Good model")
print("  - train_loss << test_loss → Overfitting")
print("  - train_loss >> test_loss → Underfitting (rare)")

print("\n" + "=" * 80)
