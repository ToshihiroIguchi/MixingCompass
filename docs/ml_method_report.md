# Machine Learning Prediction of Hansen Solubility Parameters and Boiling Point from SMILES

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
(removing features with NaN, infinite values, or zero variance), 164 descriptors
were retained for model training.

### Model Architecture

- **Algorithm**: GradientBoosting Regressor (scikit-learn)
- **Parameters**:
  - n_estimators: 100
  - max_depth: 5
  - learning_rate: 0.1
- **Feature Scaling**: StandardScaler (z-score normalization)

### Validation

5-Fold Cross-Validation was used to evaluate model performance on 499 molecules.

## Results

### Cross-Validation Performance

| Property | Description | R2 | MAE | Unit |
|----------|-------------|-----|-----|------|
| dD | Dispersion | 0.858 | 0.36 | MPa^0.5 |
| dP | Polar | 0.696 | 1.15 | MPa^0.5 |
| dH | H-bonding | 0.794 | 0.94 | MPa^0.5 |
| Tv | Boiling Point | 0.864 | 15.14 | C |

### Key Findings

1. **Dispersion (dD)**: Achieved R2 = 0.858, indicating strong predictive performance.
   This is expected as dispersion forces correlate well with molecular size and structure.

2. **Polar (dP)**: R2 = 0.696, showing moderate correlation. Polar interactions
   are more complex and depend on molecular geometry and charge distribution.

3. **H-bonding (dH)**: R2 = 0.794, reflecting the complexity of hydrogen bonding
   which depends on specific functional groups and their accessibility.

4. **Boiling Point (Tv)**: R2 = 0.864, demonstrating strong predictive capability
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
# {'smiles': 'CCO', 'is_valid': True, 'dD': 15.8, 'dP': 8.8, 'dH': 19.4, 'Tv': 78.0}

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

Generated: 2025-11-22 16:27:28
