"""
Solvent data models for MixingCompass application
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Union
from enum import Enum


class SolubilityType(str, Enum):
    """Solubility classification for solvent tests"""
    SOLUBLE = "soluble"
    INSOLUBLE = "insoluble"
    PARTIAL = "partial"


class SolventData(BaseModel):
    """Complete solvent data model"""

    # Essential HSP data
    solvent: Optional[str] = Field(None, description="Solvent name")
    delta_d: float = Field(..., description="Dispersion parameter (δD) in MPa^0.5", ge=0)
    delta_p: float = Field(..., description="Polar parameter (δP) in MPa^0.5", ge=0)
    delta_h: float = Field(..., description="Hydrogen bonding parameter (δH) in MPa^0.5", ge=0)

    # Chemical identifiers
    cas: Optional[str] = Field(None, description="CAS Registry Number")
    smiles: Optional[str] = Field(None, description="SMILES notation")
    inchi_key: Optional[str] = Field(None, description="InChI Key")

    # Physical properties
    molecular_weight: Optional[float] = Field(None, description="Molecular weight (g/mol)", ge=0)
    molar_volume: Optional[float] = Field(None, description="Molar volume (cm³/mol)", ge=0)
    density: Optional[float] = Field(None, description="Density (g/cm³)", ge=0)
    boiling_point: Optional[float] = Field(None, description="Boiling point (°C)")
    vapor_pressure: Optional[float] = Field(None, description="Vapor pressure (hPa)", ge=0)

    # Chemical composition
    cho: Optional[bool] = Field(None, description="Contains only C, H, O elements")

    # Safety and regulatory
    ghs_classification: Optional[str] = Field(None, description="GHS classification")
    hazard_statements: Optional[str] = Field(None, description="H-statements")
    wgk_class: Optional[int] = Field(None, description="Water hazard class", ge=0, le=3)

    # Economic data
    cost_per_ml: Optional[float] = Field(None, description="Cost per mL (€/mL)", ge=0)

    # Calculated properties
    delta_total: Optional[float] = Field(None, description="Total solubility parameter", ge=0)

    # Data source tracking
    source_file: Optional[str] = Field(None, description="Source file name")
    source_row: Optional[int] = Field(None, description="Source row number", ge=1)
    source_url: Optional[str] = Field(None, description="Reference URL for source data")
    completeness: Optional[float] = Field(None, description="Data completeness ratio", ge=0, le=1)

    @validator('delta_total', always=True)
    def calculate_delta_total(cls, v, values):
        """Calculate total solubility parameter if not provided"""
        if v is None and all(key in values for key in ['delta_d', 'delta_p', 'delta_h']):
            delta_d = values['delta_d']
            delta_p = values['delta_p']
            delta_h = values['delta_h']
            return (delta_d**2 + delta_p**2 + delta_h**2)**0.5
        return v

    @validator('solvent')
    def validate_solvent_name(cls, v):
        """Validate solvent name is not empty when provided"""
        if v is not None and (not v or not v.strip()):
            raise ValueError('Solvent name cannot be empty when provided')
        return v.strip() if v else None

    class Config:
        schema_extra = {
            "example": {
                "solvent": "Acetone",
                "delta_d": 15.5,
                "delta_p": 10.4,
                "delta_h": 7.0,
                "cas": "67-64-1",
                "smiles": "CC(=O)C",
                "molecular_weight": 58.08,
                "molar_volume": 73.8,
                "density": 0.784,
                "boiling_point": 56.5,
                "ghs_classification": "2",
                "hazard_statements": "H225-H319-H336"
            }
        }


class SolventTest(BaseModel):
    """Solvent test result for HSP experiments"""

    solvent_name: str = Field(..., description="Name of tested solvent")
    solubility: Union[SolubilityType, float] = Field(..., description="Solubility classification or numerical value (0.0-1.0)")

    @validator('solubility')
    def validate_solubility(cls, v):
        """Validate solubility value"""
        if isinstance(v, float):
            if not (0.0 <= v <= 1.0):
                raise ValueError('Numerical solubility must be between 0.0 and 1.0')
        return v

    notes: Optional[str] = Field(None, description="Additional notes or observations")

    # Optional solvent data reference
    solvent_data: Optional[SolventData] = Field(None, description="Complete solvent data")

    # Manual HSP override (when solvent not in database)
    manual_delta_d: Optional[float] = Field(None, description="Manual δD value", ge=0)
    manual_delta_p: Optional[float] = Field(None, description="Manual δP value", ge=0)
    manual_delta_h: Optional[float] = Field(None, description="Manual δH value", ge=0)

    @validator('solvent_name')
    def validate_solvent_name(cls, v):
        """Validate solvent name is not empty"""
        if not v or not v.strip():
            raise ValueError('Solvent name cannot be empty')
        return v.strip()

    def get_hsp_values(self) -> tuple[float, float, float]:
        """Get HSP values from either database or manual input"""
        if self.manual_delta_d is not None and self.manual_delta_p is not None and self.manual_delta_h is not None:
            return (self.manual_delta_d, self.manual_delta_p, self.manual_delta_h)
        elif self.solvent_data:
            return (self.solvent_data.delta_d, self.solvent_data.delta_p, self.solvent_data.delta_h)
        else:
            raise ValueError(f"No HSP data available for {self.solvent_name}")

    class Config:
        schema_extra = {
            "example": {
                "solvent_name": "Acetone",
                "solubility": "soluble",
                "notes": "Complete dissolution observed"
            }
        }


class SolventSearchQuery(BaseModel):
    """Search query parameters for solvents"""

    query: Optional[str] = Field(None, description="Search term (name, CAS, etc.)")
    delta_d_min: Optional[float] = Field(None, description="Minimum δD value", ge=0)
    delta_d_max: Optional[float] = Field(None, description="Maximum δD value", ge=0)
    delta_p_min: Optional[float] = Field(None, description="Minimum δP value", ge=0)
    delta_p_max: Optional[float] = Field(None, description="Maximum δP value", ge=0)
    delta_h_min: Optional[float] = Field(None, description="Minimum δH value", ge=0)
    delta_h_max: Optional[float] = Field(None, description="Maximum δH value", ge=0)
    has_smiles: Optional[bool] = Field(None, description="Filter by SMILES availability")
    has_cas: Optional[bool] = Field(None, description="Filter by CAS availability")
    limit: int = Field(50, description="Maximum number of results", ge=1, le=1000)
    offset: int = Field(0, description="Number of results to skip", ge=0)

    class Config:
        schema_extra = {
            "example": {
                "query": "acetone",
                "delta_d_min": 15.0,
                "delta_d_max": 16.0,
                "limit": 10
            }
        }


class SolventSearchResponse(BaseModel):
    """Response model for solvent search"""

    solvents: List[SolventData] = Field(..., description="List of matching solvents")
    total_count: int = Field(..., description="Total number of matches", ge=0)
    query: SolventSearchQuery = Field(..., description="Original search query")
    execution_time_ms: Optional[float] = Field(None, description="Query execution time in milliseconds")

    class Config:
        schema_extra = {
            "example": {
                "solvents": [
                    {
                        "solvent": "Acetone",
                        "delta_d": 15.5,
                        "delta_p": 10.4,
                        "delta_h": 7.0,
                        "cas": "67-64-1"
                    }
                ],
                "total_count": 1,
                "query": {"query": "acetone"},
                "execution_time_ms": 12.5
            }
        }