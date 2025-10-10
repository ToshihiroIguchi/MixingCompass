"""
Optimize size_factor using cross-validation and determine final HSP parameters
"""
import pandas as pd
import numpy as np
from hspipy import HSPEstimator
from continuous_hsp_loss import ContinuousHSPLoss
from evaluation_metrics import evaluate_with_loss, compute_loss_statistics
import matplotlib.pyplot as plt


def hansen_distance(X, center):
    """Calculate Hansen distance from center."""
    return np.sqrt(np.sum((X - center)**2, axis=1))


def leave_one_out_cv(X, y, size_factor, de_maxiter=3000, verbose=False):
    """
    Perform LOOCV for a single size_factor value

    Returns average test loss
    """
    n = len(X)
    test_losses = []
    train_losses = []
    hsps = []

    for i in range(n):
        # Split
        train_idx = np.concatenate([np.arange(i), np.arange(i+1, n)])
        test_idx = np.array([i])

        X_train, X_test = X[train_idx], X[test_idx]
        y_train, y_test = y[train_idx], y[test_idx]

        # Train
        est = HSPEstimator(
            n_spheres=1,
            method='differential_evolution',
            loss=ContinuousHSPLoss(size_factor=size_factor if size_factor > 0 else None),
            de_maxiter=de_maxiter,
            de_workers=1
        )
        est.fit(X_train, y_train)

        hsp = est.hsp_[0]
        hsps.append(hsp)

        # Evaluate on train
        train_metrics = evaluate_with_loss(hsp, X_train, y_train, size_factor=None)
        train_losses.append(train_metrics['base_loss'])

        # Evaluate on test
        test_metrics = evaluate_with_loss(hsp, X_test, y_test, size_factor=None)
        test_losses.append(test_metrics['base_loss'])

        if verbose and (i + 1) % 10 == 0:
            print(f"  Fold {i+1}/{n} complete")

    hsps = np.array(hsps)

    return {
        'mean_test_loss': np.mean(test_losses),
        'std_test_loss': np.std(test_losses),
        'mean_train_loss': np.mean(train_losses),
        'std_train_loss': np.std(train_losses),
        'test_losses': test_losses,
        'train_losses': train_losses,
        'hsps': hsps,
        'hsp_mean': np.mean(hsps, axis=0),
        'hsp_std': np.std(hsps, axis=0)
    }


def grid_search_size_factor(X, y, size_factors, de_maxiter=3000):
    """
    Grid search over size_factor values using LOOCV

    Returns best size_factor based on test loss
    """
    print("=" * 80)
    print("GRID SEARCH: Optimizing size_factor using Cross-Validation")
    print("=" * 80)
    print(f"Dataset: {len(X)} solvents")
    print(f"CV Method: Leave-One-Out Cross-Validation (LOOCV)")
    print(f"Size factors to test: {len(size_factors)}")
    print(f"Optimization iterations per fold: {de_maxiter}")
    print("=" * 80)

    results = {}

    for idx, sf in enumerate(size_factors, 1):
        print(f"\n[{idx}/{len(size_factors)}] Testing size_factor = {sf}")
        print("-" * 80)

        cv_result = leave_one_out_cv(X, y, sf, de_maxiter=de_maxiter, verbose=True)

        results[sf] = cv_result

        print(f"  Results:")
        print(f"    Mean Test Loss:  {cv_result['mean_test_loss']:.6f} ± {cv_result['std_test_loss']:.6f}")
        print(f"    Mean Train Loss: {cv_result['mean_train_loss']:.6f} ± {cv_result['std_train_loss']:.6f}")
        print(f"    Overfitting Gap: {cv_result['mean_test_loss'] - cv_result['mean_train_loss']:.6f}")
        print(f"    Mean Ra:         {cv_result['hsp_mean'][3]:.2f} ± {cv_result['hsp_std'][3]:.2f}")

    return results


def select_best_size_factor(cv_results, criterion='test_loss'):
    """
    Select best size_factor based on criterion

    Criteria:
    - 'test_loss': Minimize test loss (default)
    - 'overfitting': Minimize |test_loss - train_loss|
    - 'balanced': Balance between test_loss and overfitting
    """
    scores = {}

    for sf, result in cv_results.items():
        test_loss = result['mean_test_loss']
        train_loss = result['mean_train_loss']
        overfitting_gap = abs(test_loss - train_loss)

        if criterion == 'test_loss':
            scores[sf] = test_loss
        elif criterion == 'overfitting':
            scores[sf] = overfitting_gap
        elif criterion == 'balanced':
            # Weighted combination
            scores[sf] = 0.7 * test_loss + 0.3 * overfitting_gap

    best_sf = min(scores, key=scores.get)

    return best_sf, scores


def train_final_model(X, y, size_factor, de_maxiter=5000):
    """
    Train final model with all data using best size_factor
    """
    print("\n" + "=" * 80)
    print("TRAINING FINAL MODEL")
    print("=" * 80)
    print(f"Using all {len(X)} solvents")
    print(f"Optimal size_factor: {size_factor}")
    print(f"Optimization iterations: {de_maxiter}")
    print("-" * 80)

    est = HSPEstimator(
        n_spheres=1,
        method='differential_evolution',
        loss=ContinuousHSPLoss(size_factor=size_factor if size_factor > 0 else None),
        de_maxiter=de_maxiter,
        de_workers=1
    )

    est.fit(X, y)

    hsp = est.hsp_[0]

    # Evaluate
    metrics = evaluate_with_loss(hsp, X, y, size_factor=None)

    print(f"\nFinal Hansen Solubility Parameters:")
    print(f"  δD (Dispersion):       {hsp[0]:.2f} MPa^0.5")
    print(f"  δP (Polar):            {hsp[1]:.2f} MPa^0.5")
    print(f"  δH (Hydrogen bonding): {hsp[2]:.2f} MPa^0.5")
    print(f"  Ra (Interaction radius): {hsp[3]:.2f} MPa^0.5")

    print(f"\nFinal Model Performance:")
    print(f"  Loss (ContinuousHSPLoss): {metrics['base_loss']:.6f}")
    print(f"  Optimization Error:        {est.error_:.6f}")

    # Calculate RED and accuracy
    center = hsp[:3]
    radius = hsp[3]

    correct = 0
    for i in range(len(X)):
        dist = np.sqrt(np.sum((X[i] - center)**2))
        red = dist / radius

        if y[i] == 1.0:
            if red < 1.0:
                correct += 1
        elif y[i] == 0.5:
            if abs(red - 1.0) <= 0.1:
                correct += 1
        elif y[i] == 0.0:
            if red > 1.0:
                correct += 1

    accuracy = correct / len(X) * 100
    print(f"  Accuracy (boundary ±0.1):  {accuracy:.1f}%")

    return hsp, est, metrics


def plot_results(cv_results, best_sf):
    """
    Plot CV results
    """
    size_factors = sorted(cv_results.keys())

    test_losses = [cv_results[sf]['mean_test_loss'] for sf in size_factors]
    test_stds = [cv_results[sf]['std_test_loss'] for sf in size_factors]
    train_losses = [cv_results[sf]['mean_train_loss'] for sf in size_factors]
    radii = [cv_results[sf]['hsp_mean'][3] for sf in size_factors]
    radii_stds = [cv_results[sf]['hsp_std'][3] for sf in size_factors]

    fig, axes = plt.subplots(2, 2, figsize=(14, 10))

    # Plot 1: Test Loss
    ax = axes[0, 0]
    ax.errorbar(size_factors, test_losses, yerr=test_stds, marker='o', capsize=5, label='Test Loss')
    ax.errorbar(size_factors, train_losses, marker='s', capsize=5, label='Train Loss', alpha=0.7)
    ax.axvline(best_sf, color='r', linestyle='--', label=f'Best: {best_sf}')
    ax.set_xlabel('size_factor')
    ax.set_ylabel('Loss (ContinuousHSPLoss)')
    ax.set_title('Cross-Validation Loss vs size_factor')
    ax.legend()
    ax.grid(True, alpha=0.3)

    # Plot 2: Overfitting Gap
    ax = axes[0, 1]
    gaps = [test_losses[i] - train_losses[i] for i in range(len(size_factors))]
    ax.plot(size_factors, gaps, marker='o', color='orange')
    ax.axhline(0, color='gray', linestyle='--', alpha=0.5)
    ax.axvline(best_sf, color='r', linestyle='--', label=f'Best: {best_sf}')
    ax.set_xlabel('size_factor')
    ax.set_ylabel('Test Loss - Train Loss')
    ax.set_title('Overfitting Gap vs size_factor')
    ax.legend()
    ax.grid(True, alpha=0.3)

    # Plot 3: Radius
    ax = axes[1, 0]
    ax.errorbar(size_factors, radii, yerr=radii_stds, marker='o', capsize=5, color='green')
    ax.axvline(best_sf, color='r', linestyle='--', label=f'Best: {best_sf}')
    ax.set_xlabel('size_factor')
    ax.set_ylabel('Ra (MPa^0.5)')
    ax.set_title('Hansen Sphere Radius vs size_factor')
    ax.legend()
    ax.grid(True, alpha=0.3)

    # Plot 4: Loss vs Radius
    ax = axes[1, 1]
    scatter = ax.scatter(radii, test_losses, c=size_factors, s=100, cmap='viridis', edgecolors='black')
    best_idx = size_factors.index(best_sf)
    ax.scatter([radii[best_idx]], [test_losses[best_idx]], s=300,
               facecolors='none', edgecolors='red', linewidths=3, label='Best')
    ax.set_xlabel('Ra (MPa^0.5)')
    ax.set_ylabel('Test Loss')
    ax.set_title('Test Loss vs Radius (colored by size_factor)')
    plt.colorbar(scatter, ax=ax, label='size_factor')
    ax.legend()
    ax.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig('cv_optimization_results.png', dpi=300, bbox_inches='tight')
    print(f"\nPlot saved: cv_optimization_results.png")

    return fig


def main():
    """
    Main workflow: Optimize size_factor and determine final HSP
    """
    # Load data
    df = pd.read_csv('hansentest.csv')
    X = df[['D', 'P', 'H']].values
    y = df['Data'].values

    print("\n" + "=" * 80)
    print("HANSEN SOLUBILITY PARAMETER DETERMINATION")
    print("Using Cross-Validation to Optimize size_factor")
    print("=" * 80)
    print(f"\nDataset: hansentest.csv")
    print(f"  Total solvents: {len(df)}")
    print(f"  Good (y=1.0):   {sum(y == 1.0)}")
    print(f"  Partial (y=0.5): {sum(y == 0.5)}")
    print(f"  Poor (y=0.0):   {sum(y == 0.0)}")

    # Define size_factor candidates (finer grid)
    size_factors = [
        0.0, 0.00005, 0.0001, 0.00015, 0.0002, 0.00025, 0.0003, 0.00035, 0.0004, 0.00045,
        0.0005, 0.0006, 0.0007, 0.0008, 0.0009, 0.001, 0.0011, 0.0012, 0.0013, 0.0014,
        0.0015, 0.0016, 0.0017, 0.0018, 0.0019, 0.002, 0.0022, 0.0024, 0.0026, 0.0028, 0.003
    ]

    # Grid search
    cv_results = grid_search_size_factor(X, y, size_factors, de_maxiter=3000)

    # Select best size_factor
    print("\n" + "=" * 80)
    print("MODEL SELECTION")
    print("=" * 80)

    # Try different criteria
    best_test, scores_test = select_best_size_factor(cv_results, criterion='test_loss')
    best_balanced, scores_balanced = select_best_size_factor(cv_results, criterion='balanced')

    print("\nCandidate size_factors by criterion:")
    print(f"  Best by Test Loss:       {best_test}")
    print(f"  Best by Balanced:        {best_balanced}")

    # Show detailed comparison
    print("\n" + "-" * 80)
    print(f"{'size_factor':<12} {'Test Loss':<12} {'Train Loss':<12} {'Gap':<12} {'Ra':<10}")
    print("-" * 80)

    for sf in sorted(cv_results.keys()):
        result = cv_results[sf]
        test_loss = result['mean_test_loss']
        train_loss = result['mean_train_loss']
        gap = test_loss - train_loss
        ra = result['hsp_mean'][3]

        marker = ""
        if sf == best_test:
            marker = " ← Best (test loss)"
        elif sf == best_balanced:
            marker = " ← Best (balanced)"

        print(f"{sf:<12.4f} {test_loss:<12.6f} {train_loss:<12.6f} "
              f"{gap:<12.6f} {ra:<10.2f}{marker}")

    print("-" * 80)

    # Select final size_factor (use balanced criterion)
    final_size_factor = best_balanced
    print(f"\nFinal Selection: size_factor = {final_size_factor}")
    print(f"  Rationale: Balanced criterion minimizes both test loss and overfitting")

    # Train final model
    final_hsp, final_est, final_metrics = train_final_model(
        X, y, final_size_factor, de_maxiter=5000
    )

    # Plot results
    print("\n" + "=" * 80)
    print("VISUALIZATION")
    print("=" * 80)
    plot_results(cv_results, final_size_factor)

    # Summary
    print("\n" + "=" * 80)
    print("FINAL RESULTS SUMMARY")
    print("=" * 80)

    print(f"\nOptimal size_factor: {final_size_factor}")

    cv_result = cv_results[final_size_factor]
    print(f"\nCross-Validation Performance:")
    print(f"  Mean Test Loss:  {cv_result['mean_test_loss']:.6f} ± {cv_result['std_test_loss']:.6f}")
    print(f"  Mean Train Loss: {cv_result['mean_train_loss']:.6f} ± {cv_result['std_train_loss']:.6f}")
    print(f"  Overfitting Gap: {cv_result['mean_test_loss'] - cv_result['mean_train_loss']:.6f}")

    print(f"\nFinal Hansen Solubility Parameters (trained on all data):")
    print(f"  δD = {final_hsp[0]:.2f} MPa^0.5")
    print(f"  δP = {final_hsp[1]:.2f} MPa^0.5")
    print(f"  δH = {final_hsp[2]:.2f} MPa^0.5")
    print(f"  Ra = {final_hsp[3]:.2f} MPa^0.5")

    print(f"\nParameter Stability (from CV):")
    print(f"  δD: {cv_result['hsp_mean'][0]:.2f} ± {cv_result['hsp_std'][0]:.2f} "
          f"(CV = {cv_result['hsp_std'][0]/cv_result['hsp_mean'][0]*100:.1f}%)")
    print(f"  δP: {cv_result['hsp_mean'][1]:.2f} ± {cv_result['hsp_std'][1]:.2f} "
          f"(CV = {cv_result['hsp_std'][1]/cv_result['hsp_mean'][1]*100:.1f}%)")
    print(f"  δH: {cv_result['hsp_mean'][2]:.2f} ± {cv_result['hsp_std'][2]:.2f} "
          f"(CV = {cv_result['hsp_std'][2]/cv_result['hsp_mean'][2]*100:.1f}%)")
    print(f"  Ra: {cv_result['hsp_mean'][3]:.2f} ± {cv_result['hsp_std'][3]:.2f} "
          f"(CV = {cv_result['hsp_std'][3]/cv_result['hsp_mean'][3]*100:.1f}%)")

    print("\n" + "=" * 80)
    print("COMPLETED")
    print("=" * 80)

    return {
        'final_hsp': final_hsp,
        'final_size_factor': final_size_factor,
        'cv_results': cv_results,
        'final_metrics': final_metrics
    }


if __name__ == "__main__":
    results = main()
