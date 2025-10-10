"""
Cross-validation using ContinuousHSPLoss as evaluation metric
"""
import pandas as pd
import numpy as np
from hspipy import HSPEstimator
from continuous_hsp_loss import ContinuousHSPLoss
from evaluation_metrics import (evaluate_with_loss, compare_train_test_loss,
                                analyze_loss_components, compute_loss_statistics)


def leave_one_out_cv_with_loss(X, y, loss_function_class, size_factor=None,
                                de_maxiter=3000):
    """
    Leave-One-Out CV using Loss as evaluation metric

    Parameters:
    -----------
    X : array (n_samples, 3) - Hansen coordinates
    y : array (n_samples,) - Solubility scores
    loss_function_class : Loss function class (e.g., ContinuousHSPLoss)
    size_factor : float or None - For training
    de_maxiter : int - Optimization iterations

    Returns:
    --------
    dict with comprehensive results
    """
    n = len(X)
    fold_results = []

    print(f"Running LOOCV with {loss_function_class.__name__}...")
    print(f"size_factor={size_factor}, n_samples={n}")
    print("=" * 80)

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
            loss=loss_function_class(size_factor=size_factor),
            de_maxiter=de_maxiter,
            de_workers=1
        )
        est.fit(X_train, y_train)

        hsp = est.hsp_[0]

        # Evaluate with Loss metric
        comparison = compare_train_test_loss(
            hsp, X_train, y_train, X_test, y_test,
            size_factor=None  # Evaluate without size penalty
        )

        fold_results.append({
            'fold': i,
            'test_index': test_idx[0],
            'y_test': y_test[0],
            'hsp': hsp,
            'train_loss': comparison['train_loss'],
            'test_loss': comparison['test_loss'],
            'loss_diff': comparison['loss_diff'],
            'training_error': est.error_
        })

        if (i + 1) % 5 == 0:
            print(f"Completed {i+1}/{n} folds")

    print("=" * 80)
    print("LOOCV complete. Aggregating results...")

    # Aggregate results
    train_losses = [r['train_loss'] for r in fold_results]
    test_losses = [r['test_loss'] for r in fold_results]
    loss_diffs = [r['loss_diff'] for r in fold_results]

    # HSP parameter statistics
    hsps = np.array([r['hsp'] for r in fold_results])

    summary = {
        'fold_results': fold_results,
        'train_loss_stats': compute_loss_statistics(train_losses),
        'test_loss_stats': compute_loss_statistics(test_losses),
        'loss_diff_stats': compute_loss_statistics(loss_diffs),
        'hsp_mean': np.mean(hsps, axis=0),
        'hsp_std': np.std(hsps, axis=0),
        'n_folds': n
    }

    return summary


def stratified_cv_with_loss(X, y, loss_function_class, size_factor=None,
                            k=5, de_maxiter=3000, random_state=42):
    """
    Stratified K-Fold CV using Loss as evaluation metric
    """
    from sklearn.model_selection import StratifiedKFold

    # Binarize y for stratification
    y_binary = (y >= 0.5).astype(int)

    skf = StratifiedKFold(n_splits=k, shuffle=True, random_state=random_state)

    fold_results = []

    print(f"Running {k}-Fold Stratified CV with {loss_function_class.__name__}...")
    print(f"size_factor={size_factor}")
    print("=" * 80)

    for fold_idx, (train_idx, test_idx) in enumerate(skf.split(X, y_binary)):
        X_train, X_test = X[train_idx], X[test_idx]
        y_train, y_test = y[train_idx], y[test_idx]

        # Train
        est = HSPEstimator(
            n_spheres=1,
            method='differential_evolution',
            loss=loss_function_class(size_factor=size_factor),
            de_maxiter=de_maxiter,
            de_workers=1
        )
        est.fit(X_train, y_train)

        hsp = est.hsp_[0]

        # Evaluate
        comparison = compare_train_test_loss(
            hsp, X_train, y_train, X_test, y_test,
            size_factor=None
        )

        fold_results.append({
            'fold': fold_idx,
            'test_indices': test_idx,
            'hsp': hsp,
            'train_loss': comparison['train_loss'],
            'test_loss': comparison['test_loss'],
            'loss_diff': comparison['loss_diff'],
            'n_train': len(train_idx),
            'n_test': len(test_idx)
        })

        print(f"Fold {fold_idx+1}/{k}: train_loss={comparison['train_loss']:.6f}, "
              f"test_loss={comparison['test_loss']:.6f}, "
              f"diff={comparison['loss_diff']:.6f}")

    print("=" * 80)

    # Aggregate
    train_losses = [r['train_loss'] for r in fold_results]
    test_losses = [r['test_loss'] for r in fold_results]
    loss_diffs = [r['loss_diff'] for r in fold_results]
    hsps = np.array([r['hsp'] for r in fold_results])

    summary = {
        'fold_results': fold_results,
        'train_loss_stats': compute_loss_statistics(train_losses),
        'test_loss_stats': compute_loss_statistics(test_losses),
        'loss_diff_stats': compute_loss_statistics(loss_diffs),
        'hsp_mean': np.mean(hsps, axis=0),
        'hsp_std': np.std(hsps, axis=0),
        'n_folds': k
    }

    return summary


def print_cv_summary(cv_results, loss_name="ContinuousHSPLoss"):
    """
    Print formatted summary of CV results
    """
    print("\n" + "=" * 80)
    print(f"Cross-Validation Results: {loss_name}")
    print("=" * 80)

    train_stats = cv_results['train_loss_stats']
    test_stats = cv_results['test_loss_stats']
    diff_stats = cv_results['loss_diff_stats']
    hsp_mean = cv_results['hsp_mean']
    hsp_std = cv_results['hsp_std']

    print(f"\nNumber of folds: {cv_results['n_folds']}")

    print("\n--- Training Loss Statistics ---")
    print(f"  Mean:   {train_stats['mean']:.6f} ± {train_stats['std']:.6f}")
    print(f"  Median: {train_stats['median']:.6f}")
    print(f"  Range:  [{train_stats['min']:.6f}, {train_stats['max']:.6f}]")

    print("\n--- Test Loss Statistics ---")
    print(f"  Mean:   {test_stats['mean']:.6f} ± {test_stats['std']:.6f}")
    print(f"  Median: {test_stats['median']:.6f}")
    print(f"  Range:  [{test_stats['min']:.6f}, {test_stats['max']:.6f}]")

    print("\n--- Generalization Analysis ---")
    print(f"  Mean loss difference (test - train): {diff_stats['mean']:.6f}")
    print(f"  Std of difference: {diff_stats['std']:.6f}")

    if diff_stats['mean'] < 0.01:
        print("  → EXCELLENT: No overfitting detected")
    elif diff_stats['mean'] < 0.05:
        print("  → GOOD: Slight overfitting, acceptable")
    elif diff_stats['mean'] < 0.1:
        print("  → MODERATE: Some overfitting present")
    else:
        print("  → WARNING: Significant overfitting")

    print("\n--- Hansen Parameters (across folds) ---")
    print(f"  δD: {hsp_mean[0]:.2f} ± {hsp_std[0]:.2f} MPa^0.5 (CV={hsp_std[0]/hsp_mean[0]*100:.1f}%)")
    print(f"  δP: {hsp_mean[1]:.2f} ± {hsp_std[1]:.2f} MPa^0.5 (CV={hsp_std[1]/hsp_mean[1]*100:.1f}%)")
    print(f"  δH: {hsp_mean[2]:.2f} ± {hsp_std[2]:.2f} MPa^0.5 (CV={hsp_std[2]/hsp_mean[2]*100:.1f}%)")
    print(f"  Ra: {hsp_mean[3]:.2f} ± {hsp_std[3]:.2f} MPa^0.5 (CV={hsp_std[3]/hsp_mean[3]*100:.1f}%)")

    # Stability assessment
    max_cv = max(hsp_std[i]/hsp_mean[i] for i in range(4) if hsp_mean[i] > 0) * 100
    if max_cv < 5:
        print("\n  Parameter stability: EXCELLENT (all CV < 5%)")
    elif max_cv < 10:
        print("\n  Parameter stability: GOOD (all CV < 10%)")
    elif max_cv < 20:
        print("\n  Parameter stability: ACCEPTABLE (CV < 20%)")
    else:
        print("\n  Parameter stability: POOR (CV > 20%)")

    print("=" * 80)


def compare_size_factors_cv(X, y, size_factors, cv_method='loocv'):
    """
    Compare different size_factors using CV with Loss metric
    """
    results = {}

    for sf in size_factors:
        print(f"\n{'='*80}")
        print(f"Testing size_factor = {sf}")
        print('='*80)

        if cv_method == 'loocv':
            cv_result = leave_one_out_cv_with_loss(
                X, y, ContinuousHSPLoss, size_factor=sf
            )
        else:
            k = int(cv_method.replace('fold', ''))
            cv_result = stratified_cv_with_loss(
                X, y, ContinuousHSPLoss, size_factor=sf, k=k
            )

        results[sf] = cv_result

        print_cv_summary(cv_result, loss_name=f"ContinuousHSPLoss(size_factor={sf})")

    # Summary comparison
    print("\n" + "=" * 80)
    print("COMPARISON ACROSS size_factors")
    print("=" * 80)
    print(f"{'size_factor':<15} {'Test Loss':<15} {'Loss Diff':<15} {'Ra Mean':<10}")
    print("-" * 80)

    for sf, result in results.items():
        test_loss = result['test_loss_stats']['mean']
        loss_diff = result['loss_diff_stats']['mean']
        ra_mean = result['hsp_mean'][3]

        print(f"{sf:<15.4f} {test_loss:<15.6f} {loss_diff:<15.6f} {ra_mean:<10.2f}")

    print("=" * 80)

    return results


if __name__ == "__main__":
    # Load data
    df = pd.read_csv('hansentest.csv')
    X = df[['D', 'P', 'H']].values
    y = df['Data'].values

    print("Hansen Solubility Parameter Cross-Validation")
    print("Using ContinuousHSPLoss as evaluation metric")
    print("=" * 80)
    print(f"Dataset: {len(df)} solvents")
    print(f"  Good (1.0): {sum(y == 1.0)}")
    print(f"  Partial (0.5): {sum(y == 0.5)}")
    print(f"  Poor (0.0): {sum(y == 0.0)}")

    # Run LOOCV with different size_factors
    size_factors = [None, 0.0005, 0.001]

    results = compare_size_factors_cv(X, y, size_factors, cv_method='loocv')
