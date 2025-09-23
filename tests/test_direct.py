"""
Direct test to debug experiment creation issue
"""

import sys
sys.path.append('.')

from app.models.hsp_models import HSPExperimentData, HSPExperimentRequest
from app.models.solvent_models import SolventTest, SolubilityType
from app.services.data_manager import data_manager

def test_direct_experiment_creation():
    """Test experiment creation directly without API"""

    print("Testing direct experiment creation...")

    try:
        # Create a simple solvent test
        solvent_test = SolventTest(
            solvent_name="hexane",
            solubility=SolubilityType.INSOLUBLE,
            notes=None
        )

        print(f"Created solvent test: {solvent_test}")

        # Create experiment data
        experiment_data = HSPExperimentData(
            sample_name="Direct Test",
            description=None,
            solvent_tests=[solvent_test],
            experimenter=None,
            notes=None,
            tags=[]
        )

        print(f"Created experiment data: {experiment_data}")

        # Try to save experiment
        experiment_id = data_manager.save_experiment(experiment_data)

        print(f"SUCCESS! Experiment saved with ID: {experiment_id}")

        # Try to load it back
        loaded_experiment = data_manager.load_experiment(experiment_id)
        print(f"Loaded experiment: {loaded_experiment.sample_name}")

    except Exception as e:
        import traceback
        print("ERROR occurred:")
        print(f"Exception: {e}")
        print("Traceback:")
        print(traceback.format_exc())

def test_experiment_request():
    """Test the HSPExperimentRequest model"""

    print("\nTesting HSPExperimentRequest creation...")

    try:
        # Create request data
        request_data = {
            "sample_name": "Request Test",
            "solvent_tests": [
                {
                    "solvent_name": "hexane",
                    "solubility": "insoluble"
                }
            ]
        }

        print(f"Request data: {request_data}")

        # Create request object
        experiment_request = HSPExperimentRequest(**request_data)

        print(f"Created experiment request: {experiment_request}")

        # Convert to experiment data
        experiment_data = HSPExperimentData(
            sample_name=experiment_request.sample_name,
            description=experiment_request.description,
            solvent_tests=experiment_request.solvent_tests,
            experimenter=experiment_request.experimenter,
            notes=experiment_request.notes,
            tags=experiment_request.tags
        )

        print(f"Converted to experiment data: {experiment_data}")

        # Try serialization
        data_dict = experiment_data.dict()
        print(f"Serialized to dict: {data_dict}")

    except Exception as e:
        import traceback
        print("ERROR occurred:")
        print(f"Exception: {e}")
        print("Traceback:")
        print(traceback.format_exc())

if __name__ == "__main__":
    test_direct_experiment_creation()
    test_experiment_request()