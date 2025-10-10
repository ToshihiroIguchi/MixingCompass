"""
Evaluation metrics for HSP estimation using ContinuousHSPLoss
"""
import numpy as np
from continuous_hsp_loss import ContinuousHSPLoss


def hansen_distance(X, center):
    """Calculate Hansen distance from center."""
    return np.sqrt(np.sum((X - center)**2, axis=1))


def evaluate_with_loss(hsp, X, y, size_factor=None):
    """
    ContinuousHSPLoss を評価指標として使用

    Parameters:
    -----------
    hsp : array [D, P, H, R] - Hansen parameters
    X : array (n_samples, 3) - Solvent HSP coordinates
    y : array (n_samples,) - Solubility scores [0.0, 0.5, 1.0]
    size_factor : float or None - Penalty for sphere size

    Returns:
    --------
    dict with metrics:
        - 'total_loss': Total loss value
        - 'base_loss': Loss without size penalty
        - 'size_penalty': Size penalty term
        - 'good_penalty': Penalty for good solvents
        - 'poor_penalty': Penalty for poor solvents
        - 'per_sample_loss': Loss for each sample
    """
    D, P, H, R = hsp
    center = np.array([D, P, H])

    # Calculate distances and RED
    dist = hansen_distance(X, center)
    red = dist / R

    # Calculate penalties
    good_penalty = y * np.maximum(0, red - 1)**2
    poor_penalty = (1 - y) * np.maximum(0, 1 - red)**2
    per_sample_penalty = good_penalty + poor_penalty

    # Base loss
    base_loss = np.mean(per_sample_penalty)

    # Size penalty
    if size_factor is not None:
        size_penalty = size_factor * (R ** 2)
        total_loss = base_loss + size_penalty
    else:
        size_penalty = 0.0
        total_loss = base_loss

    return {
        'total_loss': total_loss,
        'base_loss': base_loss,
        'size_penalty': size_penalty,
        'good_penalty_mean': np.mean(good_penalty),
        'poor_penalty_mean': np.mean(poor_penalty),
        'per_sample_loss': per_sample_penalty,
        'red_values': red
    }


def compare_train_test_loss(hsp_train, X_train, y_train, X_test, y_test, size_factor=None):
    """
    Training loss と Test loss を比較（過適合の検出）

    Parameters:
    -----------
    hsp_train : array [D, P, H, R] - HSP from training
    X_train, y_train : Training data
    X_test, y_test : Test data
    size_factor : float or None

    Returns:
    --------
    dict with:
        - 'train_loss': Training loss
        - 'test_loss': Test loss
        - 'loss_diff': test - train (正なら過適合の兆候)
        - 'loss_ratio': test / train (1に近いほど良い)
    """
    train_metrics = evaluate_with_loss(hsp_train, X_train, y_train, size_factor)
    test_metrics = evaluate_with_loss(hsp_train, X_test, y_test, size_factor)

    train_loss = train_metrics['base_loss']
    test_loss = test_metrics['base_loss']

    return {
        'train_loss': train_loss,
        'test_loss': test_loss,
        'loss_diff': test_loss - train_loss,
        'loss_ratio': test_loss / train_loss if train_loss > 0 else np.inf,
        'train_metrics': train_metrics,
        'test_metrics': test_metrics
    }


def analyze_loss_components(hsp, X, y, size_factor=None):
    """
    Loss の詳細な内訳を分析

    各カテゴリ（good/partial/poor）ごとの寄与を計算
    """
    metrics = evaluate_with_loss(hsp, X, y, size_factor)

    # カテゴリ別の分析
    per_sample_loss = metrics['per_sample_loss']
    red = metrics['red_values']

    results = {
        'overall': {
            'total_loss': metrics['total_loss'],
            'base_loss': metrics['base_loss'],
            'size_penalty': metrics['size_penalty']
        },
        'by_category': {}
    }

    for category in [1.0, 0.5, 0.0]:
        mask = (y == category)
        n = np.sum(mask)

        if n == 0:
            continue

        cat_name = {1.0: 'good', 0.5: 'partial', 0.0: 'poor'}[category]

        results['by_category'][cat_name] = {
            'n_samples': n,
            'mean_loss': np.mean(per_sample_loss[mask]),
            'total_loss': np.sum(per_sample_loss[mask]),
            'mean_red': np.mean(red[mask]),
            'std_red': np.std(red[mask]),
            'contribution_pct': np.sum(per_sample_loss[mask]) / np.sum(per_sample_loss) * 100
        }

    return results


def find_problematic_solvents(hsp, X, y, df, threshold=0.1):
    """
    Lossが高い問題のある溶媒を特定

    Parameters:
    -----------
    hsp : array [D, P, H, R]
    X, y : Data
    df : DataFrame with solvent names
    threshold : Loss threshold for "problematic"

    Returns:
    --------
    DataFrame with problematic solvents and their metrics
    """
    metrics = evaluate_with_loss(hsp, X, y)
    per_sample_loss = metrics['per_sample_loss']
    red = metrics['red_values']

    # 問題のある溶媒
    problematic_mask = per_sample_loss > threshold

    if np.sum(problematic_mask) == 0:
        return None

    import pandas as pd

    problem_df = pd.DataFrame({
        'Chemical': df['Chemical'].values[problematic_mask],
        'y': y[problematic_mask],
        'RED': red[problematic_mask],
        'Loss': per_sample_loss[problematic_mask],
        'D': X[problematic_mask, 0],
        'P': X[problematic_mask, 1],
        'H': X[problematic_mask, 2]
    })

    # Sort by loss descending
    problem_df = problem_df.sort_values('Loss', ascending=False)

    return problem_df


def loss_based_model_selection(models_dict, X_val, y_val, size_factor=None):
    """
    複数のモデルをLossで比較して最良を選択

    Parameters:
    -----------
    models_dict : dict of {name: hsp_params}
    X_val, y_val : Validation data
    size_factor : float or None

    Returns:
    --------
    dict with:
        - 'best_model': Name of best model
        - 'best_loss': Loss of best model
        - 'all_losses': Dict of all losses
        - 'ranking': List of (name, loss) sorted by loss
    """
    losses = {}

    for name, hsp in models_dict.items():
        metrics = evaluate_with_loss(hsp, X_val, y_val, size_factor)
        losses[name] = metrics['base_loss']

    # Sort by loss
    ranking = sorted(losses.items(), key=lambda x: x[1])
    best_model = ranking[0][0]
    best_loss = ranking[0][1]

    return {
        'best_model': best_model,
        'best_loss': best_loss,
        'all_losses': losses,
        'ranking': ranking
    }


def compute_loss_statistics(loss_values):
    """
    Loss値の統計量を計算

    Parameters:
    -----------
    loss_values : list or array of loss values (e.g., from CV folds)

    Returns:
    --------
    dict with statistics
    """
    loss_values = np.array(loss_values)

    return {
        'mean': np.mean(loss_values),
        'std': np.std(loss_values),
        'median': np.median(loss_values),
        'min': np.min(loss_values),
        'max': np.max(loss_values),
        'q25': np.percentile(loss_values, 25),
        'q75': np.percentile(loss_values, 75),
        'cv': np.std(loss_values) / np.mean(loss_values) if np.mean(loss_values) > 0 else np.inf,
        'n': len(loss_values)
    }
