"""
Machine Learning Module for MixingCompass

Provides SMILES-based prediction of:
- Hansen Solubility Parameters (dD, dP, dH)
- Boiling Point (Tv)

Using GradientBoosting with RDKit molecular descriptors.
"""

from app.ml.predictor import SMILESPredictor, predict_from_smiles

__all__ = ['SMILESPredictor', 'predict_from_smiles']
