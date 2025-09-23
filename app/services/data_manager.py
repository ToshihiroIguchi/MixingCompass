"""
Data management service for HSP experimental data
"""

import json
import logging
from typing import List, Optional, Dict, Any
from pathlib import Path
from datetime import datetime
import uuid

from app.models.hsp_models import (
    HSPExperimentData,
    HSPExperimentRequest,
    HSPCalculationResult
)

logger = logging.getLogger(__name__)


class DataManager:
    """Service for managing HSP experimental data storage"""

    def __init__(self, data_dir: str = "data/experiments"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self._cache: Dict[str, HSPExperimentData] = {}

    def save_experiment(self, experiment: HSPExperimentData) -> str:
        """Save HSP experiment data to file system"""

        try:
            # Generate unique ID if not exists
            experiment_id = str(uuid.uuid4())

            # Update timestamp
            experiment.updated_at = datetime.now()

            # Create file path
            file_path = self.data_dir / f"{experiment_id}.json"

            # Convert to dict and save
            experiment_dict = experiment.model_dump()
            experiment_dict['id'] = experiment_id

            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(experiment_dict, f, indent=2, default=str)

            # Update cache
            self._cache[experiment_id] = experiment

            logger.info(f"Saved experiment '{experiment.sample_name}' with ID {experiment_id}")
            return experiment_id

        except Exception as e:
            logger.error(f"Error saving experiment: {e}")
            raise

    def load_experiment(self, experiment_id: str) -> Optional[HSPExperimentData]:
        """Load HSP experiment data by ID"""

        # Check cache first
        if experiment_id in self._cache:
            return self._cache[experiment_id]

        try:
            file_path = self.data_dir / f"{experiment_id}.json"

            if not file_path.exists():
                return None

            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            # Remove ID from data (it's not part of the model)
            data.pop('id', None)

            # Convert back to model
            experiment = HSPExperimentData(**data)

            # Update cache
            self._cache[experiment_id] = experiment

            return experiment

        except Exception as e:
            logger.error(f"Error loading experiment {experiment_id}: {e}")
            return None

    def list_experiments(self, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        """List all saved experiments with metadata"""

        try:
            experiments = []

            # Get all experiment files
            experiment_files = list(self.data_dir.glob("*.json"))
            experiment_files.sort(key=lambda x: x.stat().st_mtime, reverse=True)

            # Apply pagination
            start_idx = offset
            end_idx = start_idx + limit
            paginated_files = experiment_files[start_idx:end_idx]

            for file_path in paginated_files:
                try:
                    experiment_id = file_path.stem

                    # Load basic metadata without full experiment
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)

                    experiments.append({
                        'id': experiment_id,
                        'sample_name': data.get('sample_name', 'Unknown'),
                        'created_at': data.get('created_at'),
                        'updated_at': data.get('updated_at'),
                        'experimenter': data.get('experimenter'),
                        'num_solvents': len(data.get('solvent_tests', [])),
                        'has_results': data.get('calculated_hsp') is not None,
                        'tags': data.get('tags', [])
                    })

                except Exception as e:
                    logger.warning(f"Error reading experiment file {file_path}: {e}")

            return experiments

        except Exception as e:
            logger.error(f"Error listing experiments: {e}")
            return []

    def delete_experiment(self, experiment_id: str) -> bool:
        """Delete experiment by ID"""

        try:
            file_path = self.data_dir / f"{experiment_id}.json"

            if file_path.exists():
                file_path.unlink()

            # Remove from cache
            self._cache.pop(experiment_id, None)

            logger.info(f"Deleted experiment {experiment_id}")
            return True

        except Exception as e:
            logger.error(f"Error deleting experiment {experiment_id}: {e}")
            return False

    def update_experiment(self, experiment_id: str, experiment: HSPExperimentData) -> bool:
        """Update existing experiment"""

        try:
            file_path = self.data_dir / f"{experiment_id}.json"

            if not file_path.exists():
                logger.error(f"Experiment {experiment_id} not found")
                return False

            # Update timestamp
            experiment.updated_at = datetime.now()

            # Save updated data
            experiment_dict = experiment.model_dump()
            experiment_dict['id'] = experiment_id

            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(experiment_dict, f, indent=2, default=str)

            # Update cache
            self._cache[experiment_id] = experiment

            logger.info(f"Updated experiment {experiment_id}")
            return True

        except Exception as e:
            logger.error(f"Error updating experiment {experiment_id}: {e}")
            return False

    def search_experiments(self,
                          sample_name: Optional[str] = None,
                          experimenter: Optional[str] = None,
                          tags: Optional[List[str]] = None,
                          has_results: Optional[bool] = None) -> List[Dict[str, Any]]:
        """Search experiments with filters"""

        try:
            all_experiments = self.list_experiments(limit=1000)  # Get all for searching

            filtered = []

            for exp in all_experiments:
                # Apply filters
                if sample_name and sample_name.lower() not in exp['sample_name'].lower():
                    continue

                if experimenter and experimenter.lower() not in (exp.get('experimenter', '') or '').lower():
                    continue

                if has_results is not None and exp['has_results'] != has_results:
                    continue

                if tags:
                    exp_tags = exp.get('tags', [])
                    if not any(tag.lower() in [t.lower() for t in exp_tags] for tag in tags):
                        continue

                filtered.append(exp)

            return filtered

        except Exception as e:
            logger.error(f"Error searching experiments: {e}")
            return []

    def export_experiment(self, experiment_id: str, format: str = "json") -> Optional[Dict[str, Any]]:
        """Export experiment data in specified format"""

        experiment = self.load_experiment(experiment_id)
        if not experiment:
            return None

        if format.lower() == "json":
            return experiment.model_dump()
        else:
            logger.error(f"Unsupported export format: {format}")
            return None

    def get_storage_stats(self) -> Dict[str, Any]:
        """Get storage statistics"""

        try:
            experiment_files = list(self.data_dir.glob("*.json"))

            total_size = sum(f.stat().st_size for f in experiment_files)
            total_experiments = len(experiment_files)

            return {
                "total_experiments": total_experiments,
                "total_size_bytes": total_size,
                "data_directory": str(self.data_dir),
                "cache_size": len(self._cache)
            }

        except Exception as e:
            logger.error(f"Error getting storage stats: {e}")
            return {}

    def backup_data(self, backup_path: str) -> bool:
        """Create backup of all experiment data"""

        try:
            import shutil
            backup_dir = Path(backup_path)
            backup_dir.mkdir(parents=True, exist_ok=True)

            # Copy all experiment files
            for experiment_file in self.data_dir.glob("*.json"):
                shutil.copy2(experiment_file, backup_dir)

            logger.info(f"Backup created at {backup_path}")
            return True

        except Exception as e:
            logger.error(f"Error creating backup: {e}")
            return False


# Global data manager instance
data_manager = DataManager()