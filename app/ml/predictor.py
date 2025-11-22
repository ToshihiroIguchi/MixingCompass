"""
SMILES-based Property Predictor

Predicts Hansen Solubility Parameters (dD, dP, dH) and Boiling Point (Tv)
from molecular SMILES using pre-trained GradientBoosting models.

Reference:
- Training data: Niederquell, A., & Kuentz, M. (2018).
  "Solvent data for pharmaceutical and chemical industry -
  Useful physicochemical data of common solvents."
  Mendeley Data, V1. https://doi.org/10.17632/b4dmjzk8w6.1
"""

import os
import joblib
import numpy as np
from pathlib import Path
from typing import Dict, Optional, List, Union
from dataclasses import dataclass

from rdkit import Chem
from rdkit.Chem import Descriptors
from rdkit.ML.Descriptors import MoleculeDescriptors


# Path to saved models
MODEL_DIR = Path(__file__).parent / 'models'


@dataclass
class PredictionResult:
    """Result of SMILES prediction"""
    smiles: str
    is_valid: bool
    dD: Optional[float] = None
    dP: Optional[float] = None
    dH: Optional[float] = None
    Tv: Optional[float] = None
    error_message: Optional[str] = None

    def to_dict(self) -> Dict:
        return {
            'smiles': self.smiles,
            'is_valid': self.is_valid,
            'dD': self.dD,
            'dP': self.dP,
            'dH': self.dH,
            'Tv': self.Tv,
            'error_message': self.error_message
        }


class SMILESPredictor:
    """
    Predicts molecular properties from SMILES strings.

    Uses GradientBoosting models trained on RDKit molecular descriptors.

    Attributes:
        models: Dict of trained models for each target property
        scaler: StandardScaler for feature normalization
        feature_names: List of descriptor names used as features
    """

    def __init__(self):
        """Initialize predictor and load models"""
        self.models = {}
        self.scaler = None
        self.feature_names = None
        self._descriptor_calculator = None
        self._load_models()

    def _load_models(self):
        """Load pre-trained models from disk"""
        model_path = MODEL_DIR / 'hsp_tv_models.joblib'

        if not model_path.exists():
            raise FileNotFoundError(
                f"Model file not found: {model_path}. "
                "Please run train.py first to generate models."
            )

        data = joblib.load(model_path)
        self.models = data['models']
        self.scaler = data['scaler']
        self.feature_names = data['feature_names']

        # Initialize descriptor calculator
        self._init_descriptor_calculator()

    def _init_descriptor_calculator(self):
        """Initialize RDKit descriptor calculator"""
        descriptor_names = [x[0] for x in Descriptors._descList]
        self._descriptor_calculator = MoleculeDescriptors.MolecularDescriptorCalculator(
            descriptor_names
        )
        self._all_descriptor_names = descriptor_names

    def _calculate_descriptors(self, smiles: str) -> Optional[np.ndarray]:
        """
        Calculate RDKit descriptors for a SMILES string

        Args:
            smiles: SMILES string

        Returns:
            Array of descriptor values, or None if invalid SMILES
        """
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            return None

        try:
            all_desc = self._descriptor_calculator.CalcDescriptors(mol)
            all_desc_dict = dict(zip(self._all_descriptor_names, all_desc))

            # Extract only the features used in training
            desc_values = [all_desc_dict[name] for name in self.feature_names]
            desc_array = np.array(desc_values).reshape(1, -1)

            # Check for invalid values
            if np.any(np.isnan(desc_array)) or np.any(np.isinf(desc_array)):
                return None

            return desc_array

        except Exception:
            return None

    def predict(self, smiles: str) -> PredictionResult:
        """
        Predict properties for a single SMILES string

        Args:
            smiles: SMILES string

        Returns:
            PredictionResult with predicted values
        """
        # Calculate descriptors
        descriptors = self._calculate_descriptors(smiles)

        if descriptors is None:
            return PredictionResult(
                smiles=smiles,
                is_valid=False,
                error_message="Invalid SMILES or failed to calculate descriptors"
            )

        try:
            # Scale features
            X_scaled = self.scaler.transform(descriptors)

            # Predict each property
            predictions = {}
            for target, model in self.models.items():
                pred = model.predict(X_scaled)[0]
                predictions[target] = round(float(pred), 2)

            return PredictionResult(
                smiles=smiles,
                is_valid=True,
                dD=predictions.get('dD'),
                dP=predictions.get('dP'),
                dH=predictions.get('dH'),
                Tv=predictions.get('Tv')
            )

        except Exception as e:
            return PredictionResult(
                smiles=smiles,
                is_valid=False,
                error_message=str(e)
            )

    def predict_batch(self, smiles_list: List[str]) -> List[PredictionResult]:
        """
        Predict properties for multiple SMILES strings

        Args:
            smiles_list: List of SMILES strings

        Returns:
            List of PredictionResult objects
        """
        return [self.predict(smiles) for smiles in smiles_list]


# Global predictor instance (lazy loaded)
_predictor: Optional[SMILESPredictor] = None


def get_predictor() -> SMILESPredictor:
    """Get or create global predictor instance"""
    global _predictor
    if _predictor is None:
        _predictor = SMILESPredictor()
    return _predictor


def predict_from_smiles(smiles: Union[str, List[str]]) -> Union[Dict, List[Dict]]:
    """
    Convenience function to predict properties from SMILES

    Args:
        smiles: Single SMILES string or list of SMILES strings

    Returns:
        Dictionary or list of dictionaries with predictions

    Example:
        >>> result = predict_from_smiles('CCO')  # Ethanol
        >>> print(result)
        {'smiles': 'CCO', 'is_valid': True, 'dD': 15.8, 'dP': 8.8, 'dH': 19.4, 'Tv': 78.0}
    """
    predictor = get_predictor()

    if isinstance(smiles, str):
        return predictor.predict(smiles).to_dict()
    else:
        return [r.to_dict() for r in predictor.predict_batch(smiles)]
