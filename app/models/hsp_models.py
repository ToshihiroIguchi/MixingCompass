"""
Hansen Solubility Parameter (HSP) models for experimental data
"""

from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime
import math

from .solvent_models import SolventTest, SolubilityType


class HSPValues(BaseModel):
    """Hansen Solubility Parameter values"""

    delta_d: float = Field(..., description="Dispersion parameter (δD) in MPa^0.5", ge=0)
    delta_p: float = Field(..., description="Polar parameter (δP) in MPa^0.5", ge=0)
    delta_h: float = Field(..., description="Hydrogen bonding parameter (δH) in MPa^0.5", ge=0)
    radius: Optional[float] = Field(None, description="Hansen sphere radius (Ra) in MPa^0.5", ge=0)

    @validator('radius', always=True)
    def set_default_radius(cls, v):
        """Set default radius if not provided"""
        return v if v is not None else 4.0

    @property
    def delta_total(self) -> float:
        """Calculate total solubility parameter"""
        return math.sqrt(self.delta_d**2 + self.delta_p**2 + self.delta_h**2)

    def calculate_red(self, other_hsp: 'HSPValues') -> float:
        """
        Calculate Relative Energy Difference (RED) with another HSP
        RED = Ra / Ro, where Ra is actual distance and Ro is interaction radius
        """
        ra = math.sqrt(
            4 * (self.delta_d - other_hsp.delta_d)**2 +
            (self.delta_p - other_hsp.delta_p)**2 +
            (self.delta_h - other_hsp.delta_h)**2
        )
        return ra / self.radius if self.radius > 0 else float('inf')

    def is_compatible(self, other_hsp: 'HSPValues') -> bool:
        """Check if two HSP values are compatible (RED < 1)"""
        return self.calculate_red(other_hsp) < 1.0

    class Config:
        schema_extra = {
            "example": {
                "delta_d": 18.5,
                "delta_p": 9.2,
                "delta_h": 6.1,
                "radius": 4.2
            }
        }


class HSPCalculationMethod(BaseModel):
    """Method used for HSP calculation"""

    method_name: str = Field(..., description="Name of calculation method")
    description: Optional[str] = Field(None, description="Method description")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Method-specific parameters")

    class Config:
        schema_extra = {
            "example": {
                "method_name": "Hansen_Sphere_Fitting",
                "description": "Traditional Hansen sphere fitting method",
                "parameters": {
                    "weighting": "equal",
                    "convergence_threshold": 0.001
                }
            }
        }


class HSPCalculationResult(BaseModel):
    """Result of HSP calculation"""

    # Core HSP results
    delta_d: float = Field(..., description="Dispersive parameter (δD) in MPa^0.5", ge=0)
    delta_p: float = Field(..., description="Polar parameter (δP) in MPa^0.5", ge=0)
    delta_h: float = Field(..., description="Hydrogen bonding parameter (δH) in MPa^0.5", ge=0)
    radius: float = Field(..., description="Hansen sphere radius (Ra) in MPa^0.5", ge=0)

    # Calculation quality metrics
    accuracy: float = Field(0.0, description="Calculation accuracy (0-1)", ge=0, le=1)
    error: float = Field(0.0, description="Calculation error", ge=0)
    data_fit: float = Field(0.0, description="Data fit quality (0-1)", ge=0, le=1)

    # Method information
    method: str = Field(..., description="Calculation method used")
    solvent_count: int = Field(..., description="Total number of solvents used", ge=0)
    good_solvents: int = Field(..., description="Number of good (soluble) solvents", ge=0)
    poor_solvents: Optional[int] = Field(None, description="Number of poor (insoluble) solvents", ge=0)

    # Additional details
    calculation_details: Optional[Dict[str, Any]] = Field(None, description="Method-specific calculation details")

    @property
    def delta_total(self) -> float:
        """Calculate total solubility parameter"""
        return math.sqrt(self.delta_d**2 + self.delta_p**2 + self.delta_h**2)

    def to_hsp_values(self) -> HSPValues:
        """Convert to HSPValues object"""
        return HSPValues(
            delta_d=self.delta_d,
            delta_p=self.delta_p,
            delta_h=self.delta_h,
            radius=self.radius
        )

    class Config:
        schema_extra = {
            "example": {
                "hsp_values": {
                    "delta_d": 18.5,
                    "delta_p": 9.2,
                    "delta_h": 6.1,
                    "radius": 4.2
                },
                "method": {
                    "method_name": "Hansen_Sphere_Fitting"
                },
                "fit_quality": 0.85,
                "converged": True,
                "num_good_solvents": 12,
                "num_bad_solvents": 8
            }
        }


class HSPExperimentData(BaseModel):
    """Complete HSP experimental dataset"""

    # Basic information
    sample_name: str = Field(..., description="Name of the sample being tested")
    description: Optional[str] = Field(None, description="Sample description")
    created_at: datetime = Field(default_factory=datetime.now, description="Creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")

    # Experimental data
    solvent_tests: List[SolventTest] = Field(..., description="List of solvent tests performed")

    # Calculated results
    calculated_hsp: Optional[HSPCalculationResult] = Field(None, description="Calculated HSP values")

    # Metadata
    experimenter: Optional[str] = Field(None, description="Person who performed the experiment")
    notes: Optional[str] = Field(None, description="Additional notes")
    tags: List[str] = Field(default_factory=list, description="Tags for categorization")

    @validator('solvent_tests')
    def validate_solvent_tests(cls, v):
        """Validate that there are solvent tests"""
        if not v:
            raise ValueError('At least one solvent test is required')
        return v

    @validator('sample_name')
    def validate_sample_name(cls, v):
        """Validate sample name is not empty"""
        if not v or not v.strip():
            raise ValueError('Sample name cannot be empty')
        return v.strip()

    def get_solvent_count_by_type(self) -> Dict[SolubilityType, int]:
        """Get count of solvents by solubility type"""
        counts = {sol_type: 0 for sol_type in SolubilityType}
        for test in self.solvent_tests:
            counts[test.solubility] += 1
        return counts

    def get_good_solvents(self) -> List[SolventTest]:
        """Get list of solvents that dissolve the sample"""
        return [test for test in self.solvent_tests if test.solubility == SolubilityType.SOLUBLE]

    def get_bad_solvents(self) -> List[SolventTest]:
        """Get list of solvents that don't dissolve the sample"""
        return [test for test in self.solvent_tests if test.solubility == SolubilityType.INSOLUBLE]

    def get_partial_solvents(self) -> List[SolventTest]:
        """Get list of solvents that partially dissolve the sample"""
        return [test for test in self.solvent_tests if test.solubility == SolubilityType.PARTIAL]

    class Config:
        schema_extra = {
            "example": {
                "sample_name": "Polymer Sample A",
                "description": "Acrylic-based polymer for coating applications",
                "solvent_tests": [
                    {
                        "solvent_name": "Acetone",
                        "solubility": "soluble"
                    },
                    {
                        "solvent_name": "Water",
                        "solubility": "insoluble"
                    }
                ],
                "experimenter": "Dr. Smith",
                "tags": ["polymer", "coating"]
            }
        }


class HSPExperimentRequest(BaseModel):
    """Request model for creating/updating HSP experiments"""

    sample_name: str = Field(..., description="Name of the sample")
    description: Optional[str] = Field(None, description="Sample description")
    solvent_tests: List[SolventTest] = Field(..., description="Solvent test results")
    experimenter: Optional[str] = Field(None, description="Experimenter name")
    notes: Optional[str] = Field(None, description="Additional notes")
    tags: List[str] = Field(default_factory=list, description="Tags")

    # Calculation options
    auto_calculate: bool = Field(True, description="Automatically calculate HSP values")
    calculation_method: Optional[str] = Field("Hansen_Sphere_Fitting", description="Calculation method")


class HSPExperimentListResponse(BaseModel):
    """Response model for listing HSP experiments"""

    experiments: List[HSPExperimentData] = Field(..., description="List of experiments")
    total_count: int = Field(..., description="Total number of experiments", ge=0)
    page: int = Field(1, description="Current page number", ge=1)
    page_size: int = Field(50, description="Number of items per page", ge=1)

    class Config:
        schema_extra = {
            "example": {
                "experiments": [
                    {
                        "sample_name": "Sample A",
                        "solvent_tests": [],
                        "created_at": "2023-01-01T00:00:00"
                    }
                ],
                "total_count": 1,
                "page": 1,
                "page_size": 50
            }
        }


class HSPCalculationRequest(BaseModel):
    """Request model for HSP calculation"""

    sample_name: str = Field(..., description="Sample name")
    solvent_tests: List[SolventTest] = Field(..., description="Solvent test data")
    method: str = Field("Hansen_Sphere_Fitting", description="Calculation method")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Method parameters")

    class Config:
        schema_extra = {
            "example": {
                "sample_name": "Test Sample",
                "solvent_tests": [
                    {"solvent_name": "Acetone", "solubility": "soluble"},
                    {"solvent_name": "Water", "solubility": "insoluble"}
                ],
                "method": "Hansen_Sphere_Fitting"
            }
        }