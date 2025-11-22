"""
SMILES Prediction API

Provides REST endpoints for predicting HSP and boiling point from SMILES.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional

router = APIRouter(prefix="/api/predict", tags=["SMILES Prediction"])


class SMILESInput(BaseModel):
    """Input model for single SMILES prediction"""
    smiles: str = Field(..., description="SMILES string of the molecule")


class BatchSMILESInput(BaseModel):
    """Input model for batch SMILES prediction"""
    smiles_list: List[str] = Field(..., description="List of SMILES strings")


class PredictionOutput(BaseModel):
    """Output model for prediction results"""
    smiles: str
    is_valid: bool
    dD: Optional[float] = Field(None, description="Dispersion parameter (MPa^0.5)")
    dP: Optional[float] = Field(None, description="Polar parameter (MPa^0.5)")
    dH: Optional[float] = Field(None, description="H-bonding parameter (MPa^0.5)")
    Tv: Optional[float] = Field(None, description="Boiling point (C)")
    CHO: Optional[bool] = Field(None, description="True if molecule contains only C, H, O")
    molecular_formula: Optional[str] = Field(None, description="Molecular formula")
    error_message: Optional[str] = None


class BatchPredictionOutput(BaseModel):
    """Output model for batch prediction results"""
    results: List[PredictionOutput]
    total: int
    valid_count: int


# Lazy load predictor to avoid startup delay
_predictor = None


def get_predictor():
    """Get or initialize the predictor"""
    global _predictor
    if _predictor is None:
        from app.ml.predictor import SMILESPredictor
        _predictor = SMILESPredictor()
    return _predictor


@router.post("/single", response_model=PredictionOutput)
async def predict_single(data: SMILESInput):
    """
    Predict HSP and boiling point for a single SMILES string.

    - **smiles**: SMILES representation of the molecule

    Returns predicted dD, dP, dH (MPa^0.5) and Tv (C).
    """
    try:
        predictor = get_predictor()
        result = predictor.predict(data.smiles)
        return PredictionOutput(**result.to_dict())
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")


@router.post("/batch", response_model=BatchPredictionOutput)
async def predict_batch(data: BatchSMILESInput):
    """
    Predict HSP and boiling point for multiple SMILES strings.

    - **smiles_list**: List of SMILES representations

    Returns predictions for all molecules.
    """
    if len(data.smiles_list) > 100:
        raise HTTPException(
            status_code=400,
            detail="Batch size limited to 100 molecules"
        )

    try:
        predictor = get_predictor()
        results = predictor.predict_batch(data.smiles_list)

        outputs = [PredictionOutput(**r.to_dict()) for r in results]
        valid_count = sum(1 for r in results if r.is_valid)

        return BatchPredictionOutput(
            results=outputs,
            total=len(results),
            valid_count=valid_count
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")


@router.get("/health")
async def health_check():
    """Check if the prediction service is ready"""
    try:
        predictor = get_predictor()
        # Test prediction
        result = predictor.predict("CCO")  # Ethanol
        return {
            "status": "healthy",
            "model_loaded": True,
            "test_prediction": result.to_dict()
        }
    except FileNotFoundError:
        return {
            "status": "unhealthy",
            "model_loaded": False,
            "error": "Model file not found. Run training first."
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "model_loaded": False,
            "error": str(e)
        }
