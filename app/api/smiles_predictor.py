"""
SMILES Prediction API

Provides REST endpoints for predicting HSP and boiling point from SMILES.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import io
import zipfile
import json
import csv

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
    structure_svg: Optional[str] = Field(None, description="SVG string of molecular structure")
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


class ExportInput(BaseModel):
    """Input model for exporting prediction as ZIP package"""
    solvent_name: str = Field(..., description="Name of the solvent")
    smiles: str
    dD: Optional[float]
    dP: Optional[float]
    dH: Optional[float]
    Tv: Optional[float]
    CHO: Optional[bool]
    molecular_formula: Optional[str]
    structure_svg: Optional[str]


@router.post("/export")
async def export_prediction_as_zip(data: ExportInput):
    """
    Export prediction results as a ZIP package containing:
    - CSV file with prediction data
    - JSON file with complete data
    - SVG file with molecular structure
    - README file with summary
    """
    try:
        # Create ZIP file in memory
        zip_buffer = io.BytesIO()

        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            # 1. Generate CSV
            csv_buffer = io.StringIO()
            csv_writer = csv.writer(csv_buffer)

            # Header section
            csv_writer.writerow(['Solvent Name', data.solvent_name])
            csv_writer.writerow(['SMILES', data.smiles])
            csv_writer.writerow(['Molecular Formula', data.molecular_formula or '-'])
            csv_writer.writerow(['CHO', 'Yes' if data.CHO is True else ('No' if data.CHO is False else '-')])
            csv_writer.writerow(['Export Date', datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
            csv_writer.writerow([])

            # HSP Parameters
            csv_writer.writerow(['Property', 'Value', 'Unit'])
            csv_writer.writerow(['δD (Dispersion)', f'{data.dD:.2f}' if data.dD is not None else '-', 'MPa^0.5'])
            csv_writer.writerow(['δP (Polar)', f'{data.dP:.2f}' if data.dP is not None else '-', 'MPa^0.5'])
            csv_writer.writerow(['δH (H-bonding)', f'{data.dH:.2f}' if data.dH is not None else '-', 'MPa^0.5'])
            csv_writer.writerow(['Boiling Point', f'{data.Tv:.1f}' if data.Tv is not None else '-', '°C'])
            csv_writer.writerow(['Source', 'ML Prediction', '-'])

            zip_file.writestr('data/prediction.csv', csv_buffer.getvalue())

            # 2. Generate JSON
            json_data = {
                'solvent_name': data.solvent_name,
                'smiles': data.smiles,
                'molecular_formula': data.molecular_formula,
                'CHO': data.CHO,
                'export_date': datetime.now().isoformat(),
                'hsp_parameters': {
                    'delta_d': data.dD,
                    'delta_p': data.dP,
                    'delta_h': data.dH
                },
                'properties': {
                    'boiling_point': data.Tv
                },
                'source': 'ML Prediction'
            }
            zip_file.writestr('data/prediction.json', json.dumps(json_data, indent=2))

            # 3. Save structure SVG if available
            if data.structure_svg:
                # Wrap SVG in proper HTML for standalone viewing
                svg_html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Molecular Structure - {data.solvent_name}</title>
    <style>
        body {{
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: #f5f5f5;
        }}
        .container {{
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }}
        h1 {{
            text-align: center;
            color: #333;
            margin-bottom: 1rem;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>{data.solvent_name}</h1>
        {data.structure_svg}
    </div>
</body>
</html>"""
                zip_file.writestr('structure/molecule.html', svg_html)

                # Also save raw SVG
                zip_file.writestr('structure/molecule.svg', data.structure_svg)

            # 4. Generate README
            readme_content = f"""SMILES Prediction Results
Solvent: {data.solvent_name}
Export Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

SMILES: {data.smiles}
Molecular Formula: {data.molecular_formula or 'N/A'}
CHO: {'Yes' if data.CHO is True else ('No' if data.CHO is False else 'N/A')}

Hansen Solubility Parameters:
- δD (Dispersion)  = {data.dD:.2f} MPa^0.5
- δP (Polar)       = {data.dP:.2f} MPa^0.5
- δH (H-bonding)   = {data.dH:.2f} MPa^0.5

Properties:
- Boiling Point    = {data.Tv:.1f} °C

Source: ML Prediction

Package Contents:
- data/prediction.csv       : Prediction data in CSV format
- data/prediction.json      : Complete prediction data in JSON format
- structure/molecule.svg    : Molecular structure (SVG)
- structure/molecule.html   : Molecular structure (HTML viewer)
- README.txt                : This file

Notes:
- All predictions are generated using machine learning models
- HSP values are in MPa^0.5 units
- Boiling point is in degrees Celsius
"""
            zip_file.writestr('README.txt', readme_content)

        # Prepare ZIP for download
        zip_buffer.seek(0)

        # Generate filename with sanitized solvent name
        safe_name = "".join(c for c in data.solvent_name if c.isalnum() or c in (' ', '-', '_')).strip()
        safe_name = safe_name.replace(' ', '_')
        date_str = datetime.now().strftime('%Y%m%d')
        filename = f"{safe_name}_prediction_{date_str}.zip"

        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export error: {str(e)}")
