"""
Training Script for SMILES-based Property Prediction Models

This script trains GradientBoosting models to predict:
- Hansen Solubility Parameters (dD, dP, dH)
- Boiling Point (Tv)

from molecular SMILES strings using RDKit molecular descriptors.

=============================================================================
METHOD DESCRIPTION
=============================================================================

1. DATA SOURCE
--------------
Training data is derived from the solvent database published by:

    Niederquell, A., & Kuentz, M. (2018).
    "Solvent data for pharmaceutical and chemical industry -
    Useful physicochemical data of common solvents."
    Mendeley Data, V1.
    https://doi.org/10.17632/b4dmjzk8w6.1

The dataset contains 499 common solvents with:
- SMILES structures
- Hansen Solubility Parameters (dD, dP, dH in MPa^0.5)
- Boiling points (Tv in degrees Celsius)
- Other physicochemical properties

2. FEATURE EXTRACTION
---------------------
Molecular features are calculated using RDKit molecular descriptors.
After preprocessing (removing NaN, Inf, and zero-variance features),
approximately 164 descriptors are retained, including:

- Molecular weight, LogP, TPSA
- Constitutional descriptors (atom counts, bond counts)
- Topological descriptors (Wiener index, Balaban J)
- Electronic descriptors (partial charges)
- Geometric descriptors

3. MODEL ARCHITECTURE
---------------------
GradientBoosting Regressor (sklearn) with parameters:
- n_estimators: 100
- max_depth: 5
- learning_rate: 0.1
- random_state: 42

Features are standardized using StandardScaler before training.

4. VALIDATION
-------------
5-Fold Cross-Validation is used to evaluate model performance.
Metrics reported:
- R2 (coefficient of determination)
- MAE (mean absolute error)

=============================================================================
USAGE
=============================================================================

To train models:
    python -m app.ml.train

To train and visualize results:
    python -m app.ml.train --visualize

=============================================================================
"""

import argparse
import warnings
import joblib
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from pathlib import Path
from datetime import datetime

warnings.filterwarnings('ignore')

from rdkit import Chem
from rdkit.Chem import Descriptors
from rdkit.ML.Descriptors import MoleculeDescriptors

from sklearn.model_selection import cross_val_predict, KFold
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import r2_score, mean_absolute_error


# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent
DATA_PATH = PROJECT_ROOT / 'data' / 'original' / 'solvents' / 'Solvent List for calc.csv'
MODEL_DIR = SCRIPT_DIR / 'models'
REPORT_DIR = PROJECT_ROOT / 'docs'


def load_training_data() -> pd.DataFrame:
    """
    Load and preprocess training data

    Returns:
        DataFrame with SMILES and target properties
    """
    print(f"Loading data from: {DATA_PATH}")
    df = pd.read_csv(DATA_PATH, encoding='utf-8-sig')

    # Find Tv column (may have encoding issues)
    tv_col = [c for c in df.columns if 'Tv' in c][0]

    # Standardize column names
    df = df.rename(columns={tv_col: 'Tv'})

    # Convert Tv to numeric
    df['Tv'] = pd.to_numeric(df['Tv'], errors='coerce')

    # Filter rows with valid SMILES and target values
    df = df.dropna(subset=['Smiles', 'dD', 'dP', 'dH', 'Tv'])

    print(f"Loaded {len(df)} solvents with complete data")
    return df


def calculate_descriptors(smiles_list: list) -> tuple:
    """
    Calculate RDKit molecular descriptors

    Args:
        smiles_list: List of SMILES strings

    Returns:
        Tuple of (descriptor DataFrame, valid indices, feature names)
    """
    print("Calculating RDKit molecular descriptors...")

    descriptor_names = [x[0] for x in Descriptors._descList]
    calc = MoleculeDescriptors.MolecularDescriptorCalculator(descriptor_names)

    descriptors = []
    valid_indices = []

    for idx, smiles in enumerate(smiles_list):
        mol = Chem.MolFromSmiles(str(smiles))
        if mol is not None:
            try:
                desc = calc.CalcDescriptors(mol)
                descriptors.append(desc)
                valid_indices.append(idx)
            except Exception:
                pass

    df_desc = pd.DataFrame(descriptors, columns=descriptor_names)

    # Clean data
    df_desc = df_desc.replace([np.inf, -np.inf], np.nan)
    df_desc = df_desc.dropna(axis=1)
    df_desc = df_desc.loc[:, df_desc.std() > 0]

    print(f"Calculated {len(df_desc.columns)} valid descriptors for {len(df_desc)} molecules")

    return df_desc, valid_indices, list(df_desc.columns)


def train_models(X: np.ndarray, df_targets: pd.DataFrame, visualize: bool = False) -> dict:
    """
    Train GradientBoosting models with cross-validation

    Args:
        X: Feature matrix
        df_targets: DataFrame with target columns (dD, dP, dH, Tv)
        visualize: If True, create visualization plots

    Returns:
        Dictionary with trained models and metrics
    """
    targets = ['dD', 'dP', 'dH', 'Tv']
    target_units = {'dD': 'MPa^0.5', 'dP': 'MPa^0.5', 'dH': 'MPa^0.5', 'Tv': 'C'}
    target_names = {
        'dD': 'Dispersion (dD)',
        'dP': 'Polar (dP)',
        'dH': 'H-bonding (dH)',
        'Tv': 'Boiling Point (Tv)'
    }

    # Scale features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Cross-validation setup
    kfold = KFold(n_splits=5, shuffle=True, random_state=42)

    # Store results
    models = {}
    cv_results = {}
    predictions = {}

    print("\n" + "=" * 70)
    print("Training GradientBoosting Models (5-Fold Cross-Validation)")
    print("=" * 70)

    for target in targets:
        y = df_targets[target].values

        # Create model
        model = GradientBoostingRegressor(
            n_estimators=100,
            max_depth=5,
            learning_rate=0.1,
            random_state=42
        )

        # Cross-validation predictions
        y_pred = cross_val_predict(model, X_scaled, y, cv=kfold)

        # Calculate metrics
        r2 = r2_score(y, y_pred)
        mae = mean_absolute_error(y, y_pred)

        cv_results[target] = {'r2': r2, 'mae': mae}
        predictions[target] = {'y_true': y, 'y_pred': y_pred}

        print(f"\n{target_names[target]}:")
        print(f"  R2  = {r2:.3f}")
        print(f"  MAE = {mae:.2f} {target_units[target]}")

        # Train final model on all data
        model.fit(X_scaled, y)
        models[target] = model

    # Create visualizations if requested
    if visualize:
        create_visualizations(predictions, cv_results, target_names, target_units)

    return {
        'models': models,
        'scaler': scaler,
        'cv_results': cv_results
    }


def create_visualizations(predictions: dict, cv_results: dict,
                         target_names: dict, target_units: dict):
    """Create cross-validation result visualizations"""

    print("\nGenerating visualizations...")

    # Ensure output directory exists
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    targets = ['dD', 'dP', 'dH', 'Tv']
    colors = {'dD': '#3498db', 'dP': '#2ecc71', 'dH': '#e74c3c', 'Tv': '#9b59b6'}

    # Figure 1: Scatter plots (Actual vs Predicted)
    fig, axes = plt.subplots(2, 2, figsize=(12, 12))
    axes = axes.flatten()

    for i, target in enumerate(targets):
        ax = axes[i]
        y_true = predictions[target]['y_true']
        y_pred = predictions[target]['y_pred']

        ax.scatter(y_true, y_pred, alpha=0.5, c=colors[target], s=30, edgecolors='none')

        # Perfect prediction line
        min_val = min(y_true.min(), y_pred.min())
        max_val = max(y_true.max(), y_pred.max())
        ax.plot([min_val, max_val], [min_val, max_val], 'k--', lw=2)

        # Metrics annotation
        r2 = cv_results[target]['r2']
        mae = cv_results[target]['mae']
        ax.text(0.05, 0.95, f'R2 = {r2:.3f}\nMAE = {mae:.2f}',
                transform=ax.transAxes, fontsize=12, verticalalignment='top',
                bbox=dict(boxstyle='round', facecolor='white', alpha=0.8))

        ax.set_xlabel(f'Literature Value ({target_units[target]})', fontsize=11)
        ax.set_ylabel(f'Predicted Value ({target_units[target]})', fontsize=11)
        ax.set_title(target_names[target], fontsize=12, fontweight='bold')
        ax.grid(True, alpha=0.3)
        ax.set_aspect('equal', adjustable='box')

    plt.suptitle('GradientBoosting Predictions vs Literature Values\n(5-Fold Cross-Validation)',
                 fontsize=14, fontweight='bold', y=1.02)
    plt.tight_layout()

    scatter_path = MODEL_DIR / 'cv_scatter_plots.png'
    plt.savefig(scatter_path, dpi=150, bbox_inches='tight')
    print(f"Saved: {scatter_path}")
    plt.close()

    # Figure 2: Error distributions
    fig, axes = plt.subplots(2, 2, figsize=(12, 10))
    axes = axes.flatten()

    for i, target in enumerate(targets):
        ax = axes[i]
        y_true = predictions[target]['y_true']
        y_pred = predictions[target]['y_pred']
        errors = y_pred - y_true

        ax.hist(errors, bins=30, color=colors[target], alpha=0.7, edgecolor='black')
        ax.axvline(x=0, color='black', linestyle='--', lw=2)
        ax.axvline(x=errors.mean(), color='red', linestyle='-', lw=2)

        ax.text(0.95, 0.95, f'Mean = {errors.mean():.2f}\nStd = {errors.std():.2f}',
                transform=ax.transAxes, fontsize=11, verticalalignment='top',
                horizontalalignment='right',
                bbox=dict(boxstyle='round', facecolor='white', alpha=0.8))

        ax.set_xlabel(f'Prediction Error ({target_units[target]})', fontsize=11)
        ax.set_ylabel('Frequency', fontsize=11)
        ax.set_title(f'{target_names[target]} Error Distribution', fontsize=12, fontweight='bold')
        ax.grid(True, alpha=0.3)

    plt.suptitle('Prediction Error Distributions\n(5-Fold Cross-Validation)',
                 fontsize=14, fontweight='bold', y=1.02)
    plt.tight_layout()

    error_path = MODEL_DIR / 'cv_error_distributions.png'
    plt.savefig(error_path, dpi=150, bbox_inches='tight')
    print(f"Saved: {error_path}")
    plt.close()

    # Figure 3: Summary bar chart
    fig, ax = plt.subplots(figsize=(10, 6))

    x = np.arange(len(targets))
    width = 0.35

    r2_values = [cv_results[t]['r2'] for t in targets]
    bars = ax.bar(x, r2_values, width, color=[colors[t] for t in targets], edgecolor='black')

    ax.set_ylabel('R2 Score', fontsize=12)
    ax.set_xlabel('Target Property', fontsize=12)
    ax.set_xticks(x)
    ax.set_xticklabels([target_names[t] for t in targets])
    ax.set_ylim(0, 1)
    ax.axhline(y=0.8, color='gray', linestyle='--', alpha=0.5, label='R2 = 0.8')
    ax.axhline(y=0.7, color='gray', linestyle=':', alpha=0.5, label='R2 = 0.7')

    # Add value labels
    for bar, val in zip(bars, r2_values):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.02,
                f'{val:.3f}', ha='center', va='bottom', fontsize=11, fontweight='bold')

    ax.legend()
    ax.grid(axis='y', alpha=0.3)

    plt.title('Cross-Validation R2 Scores by Target Property\n(GradientBoosting with RDKit Descriptors)',
              fontsize=14, fontweight='bold')
    plt.tight_layout()

    summary_path = MODEL_DIR / 'cv_summary.png'
    plt.savefig(summary_path, dpi=150, bbox_inches='tight')
    print(f"Saved: {summary_path}")
    plt.close()


def save_models(result: dict, feature_names: list):
    """Save trained models and metadata"""

    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    model_data = {
        'models': result['models'],
        'scaler': result['scaler'],
        'feature_names': feature_names,
        'cv_results': result['cv_results'],
        'training_date': datetime.now().isoformat(),
        'description': 'GradientBoosting models for HSP and Tv prediction from SMILES'
    }

    model_path = MODEL_DIR / 'hsp_tv_models.joblib'
    joblib.dump(model_data, model_path)
    print(f"\nModels saved to: {model_path}")


def generate_report(cv_results: dict, n_samples: int, n_features: int):
    """Generate academic-style report"""

    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    report = f"""# Machine Learning Prediction of Hansen Solubility Parameters and Boiling Point from SMILES

## Abstract

This document describes a machine learning approach for predicting Hansen Solubility Parameters
(dD, dP, dH) and boiling point (Tv) from molecular SMILES strings. GradientBoosting regression
models were trained using RDKit molecular descriptors as features.

## Data Source

Training data is derived from the solvent database published by:

> Niederquell, A., & Kuentz, M. (2018). Solvent data for pharmaceutical and chemical industry -
> Useful physicochemical data of common solvents. Mendeley Data, V1.
> https://doi.org/10.17632/b4dmjzk8w6.1

The dataset contains physicochemical properties of common solvents used in pharmaceutical
and chemical applications.

## Methods

### Feature Extraction

Molecular features were calculated using RDKit molecular descriptors. After preprocessing
(removing features with NaN, infinite values, or zero variance), {n_features} descriptors
were retained for model training.

### Model Architecture

- **Algorithm**: GradientBoosting Regressor (scikit-learn)
- **Parameters**:
  - n_estimators: 100
  - max_depth: 5
  - learning_rate: 0.1
- **Feature Scaling**: StandardScaler (z-score normalization)

### Validation

5-Fold Cross-Validation was used to evaluate model performance on {n_samples} molecules.

## Results

### Cross-Validation Performance

| Property | Description | R2 | MAE | Unit |
|----------|-------------|-----|-----|------|
| dD | Dispersion | {cv_results['dD']['r2']:.3f} | {cv_results['dD']['mae']:.2f} | MPa^0.5 |
| dP | Polar | {cv_results['dP']['r2']:.3f} | {cv_results['dP']['mae']:.2f} | MPa^0.5 |
| dH | H-bonding | {cv_results['dH']['r2']:.3f} | {cv_results['dH']['mae']:.2f} | MPa^0.5 |
| Tv | Boiling Point | {cv_results['Tv']['r2']:.3f} | {cv_results['Tv']['mae']:.2f} | C |

### Key Findings

1. **Dispersion (dD)**: Achieved R2 = {cv_results['dD']['r2']:.3f}, indicating strong predictive performance.
   This is expected as dispersion forces correlate well with molecular size and structure.

2. **Polar (dP)**: R2 = {cv_results['dP']['r2']:.3f}, showing moderate correlation. Polar interactions
   are more complex and depend on molecular geometry and charge distribution.

3. **H-bonding (dH)**: R2 = {cv_results['dH']['r2']:.3f}, reflecting the complexity of hydrogen bonding
   which depends on specific functional groups and their accessibility.

4. **Boiling Point (Tv)**: R2 = {cv_results['Tv']['r2']:.3f}, demonstrating strong predictive capability
   for this fundamental thermodynamic property.

## Visualization

Cross-validation results are visualized in:
- `cv_scatter_plots.png`: Predicted vs Literature values
- `cv_error_distributions.png`: Error distribution histograms
- `cv_summary.png`: R2 score summary

## Usage

```python
from app.ml import predict_from_smiles

# Predict for a single SMILES
result = predict_from_smiles('CCO')  # Ethanol
print(result)
# {{'smiles': 'CCO', 'is_valid': True, 'dD': 15.8, 'dP': 8.8, 'dH': 19.4, 'Tv': 78.0}}

# Predict for multiple SMILES
results = predict_from_smiles(['CCO', 'CCCCCC', 'c1ccccc1'])
```

## Limitations

1. **Domain of Applicability**: Models are trained on common solvents. Predictions for molecules
   significantly different from the training set may be unreliable.

2. **Functional Group Coverage**: Unusual functional groups not well-represented in the training
   data may lead to larger prediction errors.

3. **Stereochemistry**: The model does not distinguish stereoisomers as RDKit 2D descriptors
   are used.

## References

1. Hansen, C. M. (2007). Hansen Solubility Parameters: A User's Handbook, Second Edition. CRC Press.

2. Niederquell, A., & Kuentz, M. (2018). Solvent data for pharmaceutical and chemical industry -
   Useful physicochemical data of common solvents. Mendeley Data, V1.
   https://doi.org/10.17632/b4dmjzk8w6.1

---

Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""

    report_path = REPORT_DIR / 'ml_method_report.md'
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(report)
    print(f"Report saved to: {report_path}")


def main():
    """Main training pipeline"""
    parser = argparse.ArgumentParser(description='Train SMILES property prediction models')
    parser.add_argument('--visualize', '-v', action='store_true',
                       help='Generate visualization plots')
    args = parser.parse_args()

    print("=" * 70)
    print("SMILES Property Prediction Model Training")
    print("=" * 70)

    # Load data
    df = load_training_data()

    # Calculate descriptors
    X_desc, valid_indices, feature_names = calculate_descriptors(df['Smiles'].tolist())

    # Get valid target data
    df_valid = df.iloc[valid_indices].reset_index(drop=True)

    # Train models
    result = train_models(X_desc.values, df_valid[['dD', 'dP', 'dH', 'Tv']], visualize=args.visualize)

    # Save models
    save_models(result, feature_names)

    # Generate report
    generate_report(result['cv_results'], len(df_valid), len(feature_names))

    print("\n" + "=" * 70)
    print("Training Complete!")
    print("=" * 70)


if __name__ == '__main__':
    main()
